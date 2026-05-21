"use client";

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { Star, Clock, BarChart, Bookmark, ExternalLink, Trophy, ArrowLeft, Loader2, PlayCircle, Globe, ShieldCheck, Sparkles } from 'lucide-react';
import PlatformBadge from '@/components/PlatformBadge';
import Link from 'next/link';
import { Course } from '@/components/CourseCard';
import { toFiniteInteger, toFiniteNumber } from '@/lib/course-data';

export default function CourseDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const courseId = Array.isArray(id) ? id[0] : id;
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarking, setBookmarking] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchData() {
      try {
        if (!courseId) return;

        const bookmarkRequest = fetch(`/api/bookmarks?courseId=${encodeURIComponent(courseId)}`, {
          signal: controller.signal,
        }).catch(() => null);
        const res = await fetch(`/api/courses/${courseId}`, {
          signal: controller.signal,
        });
        const data = await res.json();

        if (controller.signal.aborted) return;

        if (res.ok && data && !data.error) {
          setCourse(data);
          setLoading(false);
          const bookmarkResponse = await bookmarkRequest;
          if (bookmarkResponse?.ok) {
            const status = await bookmarkResponse.json();
            if (!controller.signal.aborted) {
              setIsBookmarked(Boolean(status.isBookmarked));
            }
          }
          return;
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error("Failed to fetch course details:", err);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => controller.abort();
  }, [courseId]);

  const toggleBookmark = async () => {
    if (!courseId || bookmarking) return;

    setBookmarking(true);
    try {
      const response = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId }),
      });

      if (response.status === 401) {
        router.push(`/login?callbackUrl=${encodeURIComponent(`/courses/${courseId}`)}`);
        return;
      }

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Bookmark toggle failed");
      setIsBookmarked(result.isBookmarked);
    } catch (err) {
      console.error("Bookmark toggle failed:", err);
    } finally {
      setBookmarking(false);
    }
  };


  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-[#010030]">
      <Loader2 className="w-12 h-12 text-certifind-accent animate-spin" />
    </div>
  );

  if (!course) return (
    <div className="flex flex-col h-screen items-center justify-center bg-[#010030] text-white">
      <h1 className="text-4xl font-black mb-4">Course Not Found</h1>
      <Link href="/" className="text-certifind-accent font-bold hover:underline">Return Home</Link>
    </div>
  );

  const courseImage = course.thumbnail_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=1200&auto=format&fit=crop';
  const price = toFiniteNumber(course.price);
  const originalPrice = toFiniteNumber(course.original_price);
  const discountPercentage = toFiniteNumber(course.discount_percentage);
  const rating = toFiniteNumber(course.rating);
  const totalRatings = toFiniteInteger(course.total_ratings);
  const durationHours = toFiniteNumber(course.duration_hours);

  return (
    <div className="min-h-screen bg-[#010030] text-white pb-20">
      
      {/* Hero Section */}
      <div className="relative h-[400px] md:h-[500px] w-full">
        <div className="absolute inset-0 z-0">
          <Image
            src={courseImage}
            alt={course.image_alt || course.title}
            fill
            sizes="100vw"
            priority
            className="object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#010030] via-[#010030]/80 to-transparent" />
        </div>

        <div className="relative z-10 mx-auto flex h-full max-w-[1400px] flex-col justify-end px-5 pb-10 sm:px-6 sm:pb-12">
          <button onClick={() => router.back()} className="absolute top-8 left-4 flex items-center gap-2 text-neutral-400 hover:text-white transition-colors bg-white/5 px-4 py-2 rounded-full border border-white/10 backdrop-blur-md">
            <ArrowLeft size={18} /> Back to Browse
          </button>

          <div className="flex flex-wrap gap-3 mb-6">
            <PlatformBadge name={course.platform} category={course.platforms?.category || 'Global'} />
            {course.is_bestseller && <span className="bg-amber-500 text-black px-3 py-1 rounded-full text-[10px] font-black uppercase">Bestseller</span>}
            {course.is_new && <span className="bg-certifind-accent text-white px-3 py-1 rounded-full text-[10px] font-black uppercase">New Arrival</span>}
          </div>

          <h1 className="mb-6 max-w-4xl break-words text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl md:text-5xl lg:text-6xl">
            {course.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-neutral-300 sm:gap-6">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={16} className={i < Math.floor(rating) ? 'fill-amber-400 text-amber-400' : 'text-neutral-600'} />
                ))}
              </div>
              <span className="font-bold text-white">{rating.toFixed(1)}</span>
              <span className="text-xs">({totalRatings.toLocaleString()} ratings)</span>
            </div>
            <div className="flex items-center gap-2 sm:border-l sm:border-white/10 sm:pl-6">
              <span className="text-sm font-medium">By <span className="text-white font-bold">{course.instructor_name}</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="mx-auto mt-10 grid max-w-[1400px] grid-cols-1 gap-8 px-5 sm:px-6 lg:mt-12 lg:grid-cols-3 lg:gap-12">
        
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-12">
          
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm sm:p-8">
            <h2 className="mb-5 flex items-center gap-3 text-xl font-bold sm:mb-6 sm:text-2xl">
              <PlayCircle className="text-certifind-accent" /> Course Overview
            </h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-300 sm:text-base lg:text-lg">
              {course.description || "No detailed description available for this module yet. CertiFind is currently working with the host platform to ingest full metadata."}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white/5 border border-white/10 p-6 rounded-3xl text-center">
              <Clock className="w-8 h-8 text-certifind-accent mx-auto mb-4" />
              <div className="text-2xl font-black">{durationHours.toFixed(1)}</div>
              <div className="text-xs text-neutral-500 uppercase font-bold tracking-widest mt-1">Hours of Content</div>
            </div>
            <div className="bg-white/5 border border-white/10 p-6 rounded-3xl text-center">
              <BarChart className="w-8 h-8 text-certifind-accent mx-auto mb-4" />
              <div className="text-2xl font-black uppercase text-sm sm:text-base">{course.level}</div>
              <div className="text-xs text-neutral-500 uppercase font-bold tracking-widest mt-1">Skill Requirement</div>
            </div>
            <div className="bg-white/5 border border-white/10 p-6 rounded-3xl text-center">
              <Trophy className="w-8 h-8 text-certifind-accent mx-auto mb-4" />
              <div className="text-2xl font-black">{course.certificate_offered ? "Yes" : "Audit Only"}</div>
              <div className="text-xs text-neutral-500 uppercase font-bold tracking-widest mt-1">Certification</div>
            </div>
          </div>

          {/* Platform Deep Dive */}
          <div className="group relative overflow-hidden rounded-[2rem] border border-certifind-accent/20 bg-certifind-accent/10 p-5 sm:p-8 lg:rounded-[2.5rem] lg:p-10">
            <div className="relative z-10 flex flex-col items-center gap-6 md:flex-row md:gap-10">
              <div className="w-32 h-32 rounded-3xl bg-white/5 flex items-center justify-center border border-white/10 flex-shrink-0">
                <Globe className="w-16 h-16 text-certifind-accent" />
              </div>
              <div>
                <p className="text-certifind-accent font-black uppercase text-xs tracking-[0.2em] mb-2">Verified Host Platform</p>
                <h3 className="mb-4 break-words text-2xl font-black text-white sm:text-3xl lg:text-4xl">{course.platform}</h3>
                <p className="text-neutral-300 leading-relaxed max-w-xl">
                  This course is officially hosted and verified by <strong className="text-white">{course.platform}</strong>. CertiFind partners with platforms in the <strong className="text-white">{course.platforms?.category || 'Global'}</strong> learning ecosystem to ensure academic integrity and expert-led curriculum.
                </p>
              </div>
            </div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-certifind-accent/5 blur-[100px] rounded-full group-hover:bg-certifind-accent/10 transition-all pointer-events-none" />
          </div>
        </div>

        {/* Sidebar Actions */}
        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-xl sm:p-8 lg:sticky lg:top-28">
            <div className="mb-8">
              <div className="mb-1 flex flex-wrap items-baseline gap-3">
                <span className="break-words text-4xl font-black text-white sm:text-5xl">{course.course_type === 'Free' ? 'FREE' : `$${price}`}</span>
                {originalPrice > price && <span className="text-lg text-neutral-500 line-through">${originalPrice}</span>}
              </div>
              {discountPercentage > 0 && <span className="text-emerald-400 font-bold text-sm uppercase tracking-widest">Limited Offer: Save {discountPercentage}%</span>}
            </div>

            <div className="space-y-4">
              <a href={course.course_url} target="_blank" rel="noopener noreferrer" className="w-full bg-certifind-accent hover:bg-certifind-accent/80 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-[0_0_30px_rgba(114,38,255,0.3)]">
                Enroll on {course.platform} <ExternalLink size={20} />
              </a>
              <button 
                onClick={toggleBookmark}
                disabled={bookmarking}
                className={`w-full font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all border ${
                  isBookmarked ? 'bg-rose-500/20 border-rose-500/40 text-rose-400' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                }`}
              >
                <Bookmark size={20} className={isBookmarked ? 'fill-rose-400' : ''} /> {isBookmarked ? "Bookmarked" : "Save for Later"}
              </button>
            </div>

            <div className="mt-8 pt-8 border-t border-white/5 space-y-4">
              <div className="flex items-center gap-3 text-neutral-400 text-sm">
                <ShieldCheck className="text-emerald-500" size={18} />
                <span>Verified Direct-to-Source Link</span>
              </div>
              <div className="flex items-center gap-3 text-neutral-400 text-sm">
                <Sparkles className="text-certifind-accent" size={18} />
                <span>AI-Assisted Learning Path Ready</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
