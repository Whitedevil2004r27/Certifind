export function toFiniteNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function toFiniteInteger(value: unknown, fallback = 0) {
  return Math.trunc(toFiniteNumber(value, fallback));
}

export function normalizeCourseRecord<T extends Record<string, any>>(course: T): T {
  return {
    ...course,
    price: toFiniteNumber(course.price),
    original_price: course.original_price == null ? null : toFiniteNumber(course.original_price),
    discount_percentage: toFiniteNumber(course.discount_percentage),
    rating: toFiniteNumber(course.rating),
    total_ratings: toFiniteInteger(course.total_ratings),
    duration_hours: course.duration_hours == null ? null : toFiniteNumber(course.duration_hours),
    platforms: {
      name: course.platform,
      category: course.platform_category || course.platforms?.category || "Global",
    },
  };
}
