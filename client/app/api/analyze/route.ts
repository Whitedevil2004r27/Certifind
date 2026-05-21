import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { fallbackCourses, withFallbackPlatform } from '@/lib/fallback-catalog';
import { extractText } from 'unpdf';

export const runtime = 'nodejs';

type AnalyzerCourseRow = {
  course_id: string;
  title: string;
  department: string | null;
  rating: number | null;
  level: string | null;
  platform: string | null;
  tags: string[] | null;
  total_ratings: number | null;
  thumbnail_url?: string | null;
  image_alt?: string | null;
  course_type?: string | null;
  certificate_offered?: boolean | null;
  platform_category?: string | null;
  platforms?: {
    name?: string;
    category?: string;
  };
};

const MAX_RESUME_SIZE_BYTES = 5 * 1024 * 1024;
const ANALYZER_COURSE_LIMIT = 1500;
const ANALYZER_COURSE_CACHE_TTL = 60_000;

const CURATED_SKILL_ALIASES = [
  { key: 'artificial intelligence', display: 'Artificial Intelligence', aliases: ['ai', 'artificial intelligence', 'machine learning', 'llm'] },
  { key: 'frontend development', display: 'Frontend Development', aliases: ['frontend', 'frontend developer', 'react', 'javascript', 'typescript', 'ui'] },
  { key: 'data analytics', display: 'Data Analytics', aliases: ['data analyst', 'data analytics', 'analytics', 'tableau', 'excel'] },
  { key: 'cloud devops', display: 'Cloud & DevOps', aliases: ['cloud', 'devops', 'aws', 'azure', 'kubernetes', 'ci cd'] },
  { key: 'backend engineering', display: 'Backend Engineering', aliases: ['backend', 'api', 'apis', 'node', 'postgresql', 'sql'] },
  { key: 'product ux', display: 'Product & UX', aliases: ['product', 'ux', 'ui ux', 'user research', 'user testing'] },
  { key: 'cybersecurity', display: 'Cybersecurity', aliases: ['cybersecurity', 'security', 'soc', 'risk management'] },
  { key: 'python', display: 'Python', aliases: ['python'] },
  { key: 'react', display: 'React', aliases: ['react'] },
  { key: 'sql analytics', display: 'SQL Analytics', aliases: ['sql', 'analytics sql'] },
];

const GENERIC_CATALOG_SKILLS = new Set(
  [
    'all levels',
    'audit',
    'beginner',
    'certificate',
    'certification',
    'free',
    'intermediate',
    'paid',
  ].map(normalizeSkill)
);

let analyzerCourseCache: {
  expiresAt: number;
  courses: AnalyzerCourseRow[];
} | null = null;

function normalizeSkill(value: unknown) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, ' ')
    .trim();
}

function displaySkill(value: string) {
  const trimmed = value.trim();
  const compact = trimmed.toLowerCase();
  const acronyms = new Set(['ai', 'ui', 'ux', 'sql', 'aws', 'api']);

  if (acronyms.has(compact)) return compact.toUpperCase();

  return trimmed
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function resumeContainsSkill(normalizedResumeText: string, aliases: string[]) {
  return aliases.some((alias) => alias.length > 1 && normalizedResumeText.includes(` ${alias} `));
}

function coursePlatform(course: AnalyzerCourseRow) {
  return {
    name: course.platform || course.platforms?.name || 'CertiFind',
    category: course.platform_category || course.platforms?.category || 'Global',
  };
}

async function getAnalyzerCourses() {
  if (analyzerCourseCache && analyzerCourseCache.expiresAt > Date.now()) {
    return { source: 'neon' as const, courses: analyzerCourseCache.courses };
  }

  try {
    const courses = await query<AnalyzerCourseRow>(`
      SELECT
        c.course_id,
        c.title,
        c.department,
        c.rating,
        c.level,
        c.platform,
        c.tags,
        c.total_ratings,
        c.thumbnail_url,
        c.image_alt,
        c.course_type,
        c.certificate_offered,
        p.category as platform_category
      FROM courses c
      LEFT JOIN platforms p ON c.platform = p.name
      ORDER BY c.rating DESC, c.total_ratings DESC
      LIMIT ${ANALYZER_COURSE_LIMIT}
    `);

    analyzerCourseCache = {
      expiresAt: Date.now() + ANALYZER_COURSE_CACHE_TTL,
      courses,
    };

    return { source: 'neon' as const, courses };
  } catch (err: any) {
    console.warn('Analyzer using cached catalog:', err?.message || err);
    return { source: 'cached' as const, courses: fallbackCourses.map(withFallbackPlatform) };
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('resume') as File;

    if (!file) {
      console.error('Analyzer: No file provided');
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (file.size > MAX_RESUME_SIZE_BYTES) {
      return NextResponse.json({ error: 'Resume file must be 5MB or smaller' }, { status: 413 });
    }

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      return NextResponse.json({ error: 'Only PDF resume files are supported' }, { status: 415 });
    }

    // Convert file to buffer as Required by unpdf
    const bytes = await file.arrayBuffer();
    const uint8Array = new Uint8Array(bytes);
    
    // Performance Optimization: Run PDF Parsing and Database Fetching in Parallel
    const [extracted, courseResult] = await Promise.all([
      extractText(uint8Array).catch(err => {
        console.error('unpdf Parse Internal Error:', err.message);
        return null;
      }),
      getAnalyzerCourses()
    ]);
    const courses = courseResult.courses;
    
    if (!courses || courses.length === 0) {
      throw new Error('No courses found in database');
    }


    if (!extracted || !extracted.text) {
      throw new Error('No text extracted from PDF. The file may be empty or encrypted.');
    }
    
    const rawText = Array.isArray(extracted.text) ? extracted.text.join(' ') : extracted.text;
    const normalizedResumeText = ` ${normalizeSkill(rawText)} `;

    // 1. Identify skills
    const courseSkillMap = new Map<AnalyzerCourseRow, string[]>();
    const skillDisplayByKey = new Map<string, string>();
    const skillAliasesByKey = new Map<string, string[]>();

    CURATED_SKILL_ALIASES.forEach((entry) => {
      const key = normalizeSkill(entry.key);
      skillDisplayByKey.set(key, entry.display);
      skillAliasesByKey.set(key, Array.from(new Set([key, ...entry.aliases.map(normalizeSkill)])));
    });

    for (const course of courses) {
      const rawSkills = [
        course.department || '',
        ...(Array.isArray(course.tags) ? course.tags : []),
      ];
      const skills = Array.from(new Set(
        rawSkills
          .map(normalizeSkill)
          .filter((skill) => skill.length > 1 && !GENERIC_CATALOG_SKILLS.has(skill))
      ));

      courseSkillMap.set(course, skills);
      rawSkills.forEach((skill) => {
        const normalized = normalizeSkill(skill);
        if (normalized.length > 1 && !GENERIC_CATALOG_SKILLS.has(normalized) && !skillDisplayByKey.has(normalized)) {
          skillDisplayByKey.set(normalized, displaySkill(String(skill)));
        }
        if (normalized.length > 1 && !GENERIC_CATALOG_SKILLS.has(normalized) && !skillAliasesByKey.has(normalized)) {
          skillAliasesByKey.set(normalized, [normalized]);
        }
      });
    }

    const matchedSkillKeys = Array.from(skillDisplayByKey.keys()).filter((skill) =>
      resumeContainsSkill(normalizedResumeText, skillAliasesByKey.get(skill) || [skill])
    );
    const matchedSkillsSet = new Set(matchedSkillKeys);
    const detectedSkills = matchedSkillKeys
      .map((skill) => skillDisplayByKey.get(skill) || displaySkill(skill))
      .slice(0, 10);

    // 2. Synthesize 3-Phase Roadmap
    // We want P1: Foundations, P2: Core, P3: Advanced
    const roadmapPhases = [
      { id: 'p1', title: 'Phase 1: Skill Foundations', levelMatch: ['Beginner', 'All Levels'] },
      { id: 'p2', title: 'Phase 2: Core Engineering', levelMatch: ['Intermediate', 'All Levels'] },
      { id: 'p3', title: 'Phase 3: Elite Specialization', levelMatch: ['Advanced'] }
    ];

    const selectedCourseIds = new Set<string>();
    const recommendations = roadmapPhases.map(phase => {
      const phaseCandidates = courses.filter(c => phase.levelMatch.includes(c.level || 'All Levels'));
      const candidates = (phaseCandidates.length > 0 ? phaseCandidates : courses)
        .filter((course) => !selectedCourseIds.has(course.course_id));

      let bestCourse: any = null;
      let bestScore = Number.NEGATIVE_INFINITY;

      for (const course of candidates.length > 0 ? candidates : courses) {
        if (selectedCourseIds.has(course.course_id)) continue;

        const courseSkills = Array.from(new Set(courseSkillMap.get(course) || []));
        const newSkillsCount = courseSkills.filter(s => !matchedSkillsSet.has(s)).length;
        const matchScore = courseSkills.filter(s => matchedSkillsSet.has(s)).length;

        const rating = Number(course.rating || 0);
        const totalRatings = Number(course.total_ratings || 0);
        const popularityScore = Math.log10(Math.max(totalRatings, 1));
        const isProfileRelevant = matchScore > 0;
        const relevanceScore = matchScore * 6;
        const explorationScore = Math.min(newSkillsCount, 4) * (isProfileRelevant ? 1.25 : 0.35);
        const impactScore = relevanceScore + explorationScore + rating + popularityScore;

        if (impactScore > bestScore) {
          bestScore = impactScore;
          bestCourse = {
            ...course,
            newSkillsCount,
            matchScore,
            phaseId: phase.id,
            phaseTitle: phase.title,
            impactScore,
            rating,
            total_ratings: totalRatings,
            level: course.level || 'All Levels',
            department: course.department || 'Career Skills',
            platform: course.platform || course.platforms?.name || 'CertiFind',
            platforms: coursePlatform(course),
          };
        }
      }

      if (bestCourse) {
        selectedCourseIds.add(bestCourse.course_id);
      }

      return bestCourse;
    }).filter(Boolean);

    return NextResponse.json({
      source: courseResult.source,
      detectedSkills,
      recommendations,
      summary: `Our AI scanned your profile and identified ${matchedSkillKeys.length} core competencies. We've structured a 3-phase roadmap to bridge your skill gaps and elevate your market value.`
    });

  } catch (err: any) {
    console.error('AI Analyzer Final Error:', err.message, err.stack);
    return NextResponse.json({ 
      error: 'Failed to analyze resume',
      details: err.message
    }, { status: 500 });
  }
}
