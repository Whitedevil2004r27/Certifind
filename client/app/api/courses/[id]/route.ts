import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { query } from '@/lib/db';
import { getFallbackCourseById } from '@/lib/fallback-catalog';
import { normalizeCourseRecord } from '@/lib/course-data';

export const runtime = 'nodejs';

const COURSE_DETAIL_COLUMNS = `
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const getCourse = unstable_cache(
      () => query<any>(
        `
        SELECT ${COURSE_DETAIL_COLUMNS}
        FROM courses c
        LEFT JOIN platforms p ON c.platform = p.name
        WHERE c.course_id = $1
        LIMIT 1
        `,
        [id]
      ),
      ['courses:detail', id],
      { revalidate: 60, tags: ['courses'] }
    );
    const result = await getCourse();

    if (result.length === 0) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    return NextResponse.json(normalizeCourseRecord(result[0]), {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (err: any) {
    console.error('Course detail API using cached catalog:', err);
    const { id } = await params;
    const fallbackCourse = getFallbackCourseById(id);

    if (fallbackCourse) {
      return NextResponse.json({
        source: 'cached',
        warning: 'Neon is temporarily unavailable. Showing cached course details.',
        ...fallbackCourse,
      }, {
        headers: {
          'X-Certifind-Data-Source': 'cached',
        },
      });
    }

    return NextResponse.json(
      { error: 'Failed to fetch course', details: err.message },
      { status: 503 }
    );
  }
}
