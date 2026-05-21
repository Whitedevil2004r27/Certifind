import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAppUser } from '@/lib/current-user';
import { normalizeCourseRecord } from '@/lib/course-data';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get('courseId');
  const courseIdsParam = searchParams.get('courseIds');
  const user = await getAppUser();

  if (!user) {
    if (courseIdsParam) {
      return NextResponse.json({ bookmarkedCourseIds: [], authenticated: false });
    }

    if (courseId) {
      return NextResponse.json({ isBookmarked: false, authenticated: false });
    }

    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (courseIdsParam) {
      const courseIds = Array.from(
        new Set(
          courseIdsParam
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean)
        )
      ).slice(0, 60);

      if (courseIds.length === 0) {
        return NextResponse.json({ bookmarkedCourseIds: [] });
      }

      const placeholders = courseIds.map((_, index) => `$${index + 2}`).join(', ');
      const rows = await query<{ course_id: string }>(
        `SELECT course_id FROM bookmarks WHERE user_id = $1 AND course_id IN (${placeholders})`,
        [user.id, ...courseIds]
      );

      return NextResponse.json({ bookmarkedCourseIds: rows.map((row) => row.course_id) });
    }

    if (courseId) {
      const bookmark = await query<{ id: string }>(
        'SELECT id FROM bookmarks WHERE user_id = $1 AND course_id = $2 LIMIT 1',
        [user.id, courseId]
      );

      return NextResponse.json({ isBookmarked: bookmark.length > 0 });
    }

    const bookmarks = await query(
      `
      SELECT c.*, p.category as platform_category
      FROM bookmarks b
      JOIN courses c ON b.course_id = c.course_id
      LEFT JOIN platforms p ON c.platform = p.name
      WHERE b.user_id = $1
      ORDER BY b.created_at DESC
      `,
      [user.id]
    );

    return NextResponse.json(bookmarks.map((course: any) => normalizeCourseRecord(course)));
  } catch (err: any) {
    console.error('Bookmarks API error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch bookmarks', details: err.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const user = await getAppUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { courseId } = await request.json();

    if (!courseId) {
      return NextResponse.json({ error: 'courseId is required' }, { status: 400 });
    }

    const existing = await query(
      'SELECT id FROM bookmarks WHERE user_id = $1 AND course_id = $2',
      [user.id, courseId]
    );

    if (existing.length > 0) {
      await query(
        'DELETE FROM bookmarks WHERE user_id = $1 AND course_id = $2',
        [user.id, courseId]
      );
      return NextResponse.json({ isBookmarked: false });
    }

    await query(
      'INSERT INTO bookmarks (user_id, course_id) VALUES ($1, $2)',
      [user.id, courseId]
    );

    return NextResponse.json({ isBookmarked: true }, { status: 201 });
  } catch (err: any) {
    console.error('Bookmark toggle API error:', err);
    return NextResponse.json(
      { error: 'Failed to toggle bookmark', details: err.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const user = await getAppUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { courseId } = await request.json();

    if (!courseId) {
      return NextResponse.json({ error: 'courseId is required' }, { status: 400 });
    }

    await query(
      'DELETE FROM bookmarks WHERE user_id = $1 AND course_id = $2',
      [user.id, courseId]
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Bookmark delete API error:', err);
    return NextResponse.json(
      { error: 'Failed to delete bookmark', details: err.message },
      { status: 500 }
    );
  }
}
