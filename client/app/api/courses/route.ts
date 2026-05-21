import { NextResponse } from 'next/server';
import { revalidateTag, unstable_cache } from 'next/cache';
import { query } from '@/lib/db';
import { getAppUser, isAdminUser } from '@/lib/current-user';
import { getFallbackCourses } from '@/lib/fallback-catalog';
import { normalizeCourseRecord } from '@/lib/course-data';

export const runtime = 'nodejs';

type CourseListResult = {
  countResult: { count: string }[];
  dataResult: Record<string, unknown>[];
};

const COURSE_LIST_CACHE_TTL = 20000;
const COURSE_LIST_CACHE_LIMIT = 80;
const courseListMemoryCache = new Map<string, { expiresAt: number; value: CourseListResult }>();

const COURSE_LIST_COLUMNS = `
  c.course_id,
  c.title,
  c.description,
  c.instructor_name,
  c.platform,
  c.department,
  c.course_type,
  c.price,
  c.original_price,
  c.discount_percentage,
  c.rating,
  c.total_ratings,
  c.duration_hours,
  c.level,
  c.language,
  c.thumbnail_url,
  c.image_alt,
  c.course_url,
  c.tags,
  c.is_bestseller,
  c.is_new,
  c.certificate_offered,
  c.updated_at,
  p.category as platform_category
`;

function boundedInt(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function splitParam(value: string | null, maxValues = 16) {
  return Array.from(
    new Set(
      (value || '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
    )
  ).slice(0, maxValues);
}

function readCourseListCache(cacheKey: string) {
  const cached = courseListMemoryCache.get(cacheKey);
  if (!cached || cached.expiresAt <= Date.now()) {
    courseListMemoryCache.delete(cacheKey);
    return null;
  }

  return cached.value;
}

function writeCourseListCache(cacheKey: string, value: CourseListResult) {
  if (courseListMemoryCache.size >= COURSE_LIST_CACHE_LIMIT) {
    const oldestKey = courseListMemoryCache.keys().next().value;
    if (oldestKey) courseListMemoryCache.delete(oldestKey);
  }

  courseListMemoryCache.set(cacheKey, {
    expiresAt: Date.now() + COURSE_LIST_CACHE_TTL,
    value,
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    const page = boundedInt(searchParams.get('page'), 1, 1, 1000);
    const limit = boundedInt(searchParams.get('limit'), 12, 1, 48);
    
    const course_type = searchParams.get('course_type');
    const departmentStr = searchParams.get('department');
    const platformStr = searchParams.get('platform');
    const levelStr = searchParams.get('level');
    
    const min_rating = searchParams.get('min_rating');
    const max_duration = searchParams.get('max_duration');
    const search = (searchParams.get('search') || '').trim().slice(0, 80);
    const sort_by = searchParams.get('sort_by');

    const offset = (page - 1) * limit;

    const whereConditions: string[] = [];
    const queryParams: unknown[] = [];
    let paramIndex = 1;

    if (course_type) {
      whereConditions.push(`c.course_type = $${paramIndex++}`);
      queryParams.push(course_type);
    }
    
    if (departmentStr) {
      const deps = splitParam(departmentStr);
      const placeholders = deps.map(() => `$${paramIndex++}`).join(', ');
      if (deps.length) {
        whereConditions.push(`c.department IN (${placeholders})`);
        queryParams.push(...deps);
      }
    }
    
    if (platformStr) {
      const plats = splitParam(platformStr);
      const placeholders = plats.map(() => `$${paramIndex++}`).join(', ');
      if (plats.length) {
        whereConditions.push(`c.platform IN (${placeholders})`);
        queryParams.push(...plats);
      }
    }
    
    if (levelStr) {
      const lvls = splitParam(levelStr);
      const placeholders = lvls.map(() => `$${paramIndex++}`).join(', ');
      if (lvls.length) {
        whereConditions.push(`c.level IN (${placeholders})`);
        queryParams.push(...lvls);
      }
    }

    if (min_rating) {
      whereConditions.push(`c.rating >= $${paramIndex++}`);
      queryParams.push(parseFloat(min_rating));
    }
    if (max_duration) {
      whereConditions.push(`c.duration_hours <= $${paramIndex++}`);
      queryParams.push(parseFloat(max_duration));
    }

    if (search) {
      whereConditions.push(`(c.title ILIKE $${paramIndex} OR c.instructor_name ILIKE $${paramIndex} OR c.department ILIKE $${paramIndex})`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    let orderBy = 'ORDER BY c.rating DESC, c.total_ratings DESC';
    if (sort_by === 'newest') {
      orderBy = 'ORDER BY COALESCE(c.updated_at, c.scraped_at, c.last_updated::timestamptz) DESC, c.is_new DESC';
    } else if (sort_by === 'popularity') {
      orderBy = 'ORDER BY c.total_ratings DESC, c.is_bestseller DESC';
    } else if (sort_by === 'updated') {
      orderBy = 'ORDER BY COALESCE(c.updated_at, c.scraped_at, c.last_updated::timestamptz) DESC';
    }

    const countQuery = `SELECT COUNT(*) FROM courses c ${whereClause}`;
    const dataQuery = `
      SELECT ${COURSE_LIST_COLUMNS}
      FROM courses c
      LEFT JOIN platforms p ON c.platform = p.name
      ${whereClause}
      ${orderBy}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    
    const cacheKey = ['courses:list', whereClause, orderBy, JSON.stringify(queryParams), String(limit), String(offset)].join('|');
    const cachedCourses = readCourseListCache(cacheKey);
    const getCourses = unstable_cache(
      async () => {
        const [countResult, dataResult] = await Promise.all([
          query<{ count: string }>(countQuery, queryParams),
          query<Record<string, unknown>>(dataQuery, [...queryParams, limit, offset])
        ]);

        return { countResult, dataResult };
      },
      cacheKey.split('|'),
      { revalidate: 20, tags: ['courses'] }
    );

    const { countResult, dataResult } = cachedCourses || await getCourses();
    if (!cachedCourses) {
      writeCourseListCache(cacheKey, { countResult, dataResult });
    }

    const totalCount = parseInt(countResult[0].count);

    const courses = dataResult.map((course) => normalizeCourseRecord(course));

    return NextResponse.json({
      source: 'neon',
      courses,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit)
      }
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=60',
      },
    });

  } catch (err: any) {
    console.error('Courses API using cached catalog:', err);
    const { searchParams } = new URL(request.url);
    const fallback = getFallbackCourses(searchParams);

    return NextResponse.json({
      source: 'cached',
      warning: 'Neon is temporarily unavailable. Showing cached course catalog.',
      details: err.message,
      ...fallback,
    }, {
      headers: {
        'X-Certifind-Data-Source': 'cached',
      },
    });
  }
}

export async function POST(request: Request) {
  const user = await getAppUser();

  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      title,
      description,
      platform,
      department,
      course_type,
      price,
      original_price,
      discount_percentage,
      rating,
      total_ratings,
      duration_hours,
      level,
      language,
      thumbnail_url,
      course_url,
      tags,
      is_bestseller,
      is_new,
      certificate_offered,
    } = body;

    if (!title || !platform || !department || !course_type || !course_url) {
      return NextResponse.json(
        { error: 'title, platform, department, course_type, and course_url are required' },
        { status: 400 }
      );
    }

    const result = await query(
      `
      INSERT INTO courses (
        title, description, instructor_name, platform, department, course_type,
        price, original_price, discount_percentage, rating,
        total_ratings, duration_hours, level, language,
        thumbnail_url, course_url, tags, is_bestseller,
        is_new, certificate_offered
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *
      `,
      [
        title,
        description || null,
        user?.name || 'Admin',
        platform,
        department,
        course_type,
        price || 0,
        original_price || null,
        discount_percentage || 0,
        rating || 0,
        total_ratings || 0,
        duration_hours || 0,
        level || 'All Levels',
        language || 'English',
        thumbnail_url || null,
        course_url,
        Array.isArray(tags) ? tags : [],
        Boolean(is_bestseller),
        Boolean(is_new),
        Boolean(certificate_offered),
      ]
    );

    courseListMemoryCache.clear();
    revalidateTag('courses');
    return NextResponse.json(result[0], { status: 201 });
  } catch (err: any) {
    console.error('Create course API error:', err);
    return NextResponse.json(
      { error: 'Failed to create course', details: err.message },
      { status: 500 }
    );
  }
}

