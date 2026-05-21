"use client"

import React, { memo, useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Star, Clock, BarChart, Bookmark, ExternalLink, Trophy, BadgeCheck } from 'lucide-react'
import PlatformBadge from './PlatformBadge'
import { usePathname, useRouter } from 'next/navigation'
import { toFiniteInteger, toFiniteNumber } from '@/lib/course-data'

export interface Course {
  course_id: string
  title: string
  description?: string
  instructor_name: string
  platform: string
  platforms?: {
    category: string
    name?: string
  }
  department: string
  course_type: string
  price: number | string | null
  original_price?: number | string | null
  discount_percentage?: number | string | null
  rating: number | string | null
  total_ratings: number | string | null
  duration_hours?: number | string | null
  level: string
  thumbnail_url?: string
  image_alt?: string
  updated_at?: string
  course_url: string
  certificate_offered?: boolean
  is_bestseller?: boolean
  is_new?: boolean
}

interface CourseCardProps {
  course: Course;
  isBookmarked?: boolean;
  onBookmarkToggle?: (courseId: string, isBookmarked: boolean) => void;
}

const CourseCard: React.FC<CourseCardProps> = ({ course, isBookmarked: externalBookmarkState, onBookmarkToggle }) => {
  const router = useRouter()
  const pathname = usePathname()
  const hasExternalBookmarkState = typeof externalBookmarkState === "boolean"
  const [isBookmarked, setIsBookmarked] = useState(Boolean(externalBookmarkState))
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (hasExternalBookmarkState) {
      setIsBookmarked(Boolean(externalBookmarkState))
      return
    }

    const controller = new AbortController()

    const checkBookmark = async () => {
      try {
        const response = await fetch(`/api/bookmarks?courseId=${encodeURIComponent(course.course_id)}`, {
          signal: controller.signal,
        })

        if (response.status === 401) {
          setIsBookmarked(false)
          return
        }

        if (!response.ok) return

        const status = await response.json()
        setIsBookmarked(Boolean(status.isBookmarked))
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("Bookmark status error:", error)
        }
      }
    }

    checkBookmark()

    return () => controller.abort()
  }, [course.course_id, externalBookmarkState, hasExternalBookmarkState])

  const toggleBookmark = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    setLoading(true)
    try {
      const response = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: course.course_id }),
      })

      if (response.status === 401) {
        router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`)
        return
      }

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Bookmark update failed')

      setIsBookmarked(result.isBookmarked)
      onBookmarkToggle?.(course.course_id, result.isBookmarked)
    } catch (err) {
      console.error("Bookmark error:", err)
    } finally {
      setLoading(false)
    }
  }, [course.course_id, onBookmarkToggle, pathname, router])

  const rating = toFiniteNumber(course.rating)
  const totalRatings = toFiniteInteger(course.total_ratings)
  const durationHours = toFiniteNumber(course.duration_hours)
  const price = toFiniteNumber(course.price)
  const originalPrice = toFiniteNumber(course.original_price)
  const discountPercentage = toFiniteNumber(course.discount_percentage)

  const ratingStars = useMemo(
    () =>
      Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          size={14}
          className={i < Math.floor(rating) ? 'fill-amber-400 text-amber-400' : 'text-neutral-600'}
        />
      )),
    [rating]
  )
  const shortDescription =
    course.description?.trim() ||
    `${course.department} course from ${course.platform} with practical lessons and portfolio-ready outcomes.`
  const handleOpenCourse = useCallback(() => {
    router.push(`/courses/${course.course_id}`)
  }, [course.course_id, router])

  return (
    <article
      onClick={handleOpenCourse}
      className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#080817]/80 shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur-sm transition duration-500 hover:-translate-y-1 hover:border-certifind-accent/45 hover:shadow-[0_22px_70px_rgba(114,38,255,0.14)] active:scale-[0.99]"
    >
      <div className="relative aspect-video overflow-hidden block">
        <Image
          src={course.thumbnail_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=800&auto=format&fit=crop'}
          alt={course.image_alt || course.title}
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/15" />

        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] shadow-lg backdrop-blur-md ${
            course.course_type === 'Free'
              ? 'bg-emerald-300 text-emerald-950'
              : 'bg-amber-300 text-amber-950'
          }`}>
            {course.course_type}
          </span>
          {course.is_bestseller && (
            <span className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-black shadow-lg backdrop-blur-md">
              Bestseller
            </span>
          )}
          {course.is_new && (
            <span className="rounded-full bg-certifind-accent px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white shadow-lg backdrop-blur-md">
              New
            </span>
          )}
        </div>

        <button 
          onClick={toggleBookmark}
          disabled={loading}
          className={`absolute right-4 top-4 z-20 rounded-full border border-white/10 p-2 backdrop-blur-md transition-all duration-300 sm:opacity-0 sm:group-hover:opacity-100 ${
            isBookmarked ? 'bg-rose-500 text-white opacity-100 translate-y-0' : 'bg-black/40 text-white/60 hover:text-white'
          }`}
          aria-label={isBookmarked ? 'Remove bookmark' : 'Save course'}
        >
          <Bookmark size={18} className={isBookmarked ? 'fill-white' : ''} />
        </button>
        
        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <PlatformBadge className="max-w-[136px] sm:max-w-[152px]" name={course.platform} category={course.platforms?.category || 'Global'} />
          </div>
          <span className="max-w-[54%] truncate rounded-full border border-white/15 bg-black/55 px-3 py-1 text-right text-[10px] font-black uppercase tracking-[0.14em] text-white/80 backdrop-blur-md">
            {course.department}
          </span>
        </div>
      </div>

      <div className="flex flex-grow flex-col p-5">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex items-center gap-1">
            {ratingStars}
          </div>
          <span className="text-xs font-bold text-amber-300/85">({totalRatings.toLocaleString()})</span>
        </div>

        <h3 className="mb-2 min-h-[44px] text-lg font-black leading-tight tracking-tight text-white transition-colors group-hover:text-certifind-accent">
          {course.title}
        </h3>

        <p className="mb-4 line-clamp-3 min-h-[60px] text-sm leading-5 text-neutral-400">
          {shortDescription}
        </p>

        <div className="mb-5 grid grid-cols-2 gap-3 border-t border-white/5 pt-4">
          <div className="flex items-center gap-2 text-neutral-500">
            <Clock size={14} />
            <span className="text-xs font-medium">{durationHours.toFixed(1)} hrs</span>
          </div>
          <div className="flex items-center gap-2 text-neutral-500">
            <BarChart size={14} />
            <span className="text-xs font-medium">{course.level}</span>
          </div>
          <div className="col-span-2 flex items-center gap-2 text-neutral-500">
            {course.certificate_offered ? (
              <Trophy size={14} className="text-certifind-accent" />
            ) : (
              <BadgeCheck size={14} className="text-neutral-500" />
            )}
            <span className="text-xs font-medium">
              {course.certificate_offered ? 'Certificate included' : 'Audit track'}
            </span>
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between">
          <div className="flex flex-col">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">
                {course.course_type === 'Free' ? 'FREE' : `$${price}`}
              </span>
              {originalPrice > price && (
                <span className="text-sm text-neutral-600 line-through">
                  ${originalPrice}
                </span>
              )}
            </div>
            {discountPercentage > 0 && (
              <span className="text-[10px] font-bold text-certifind-accent uppercase tracking-widest">
                Save {discountPercentage}%
              </span>
            )}
          </div>

          <a
            href={course.course_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="z-10 flex items-center gap-2 rounded-xl bg-certifind-accent px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-certifind-accent/20 transition-all hover:bg-certifind-accent/80"
          >
            <span>Learn</span>
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </article>
  )
}

export default memo(CourseCard)
