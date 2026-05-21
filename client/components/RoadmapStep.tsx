import React from 'react';
import { ArrowRight, Star, GraduationCap } from 'lucide-react';
import PlatformBadge from './PlatformBadge';
import Link from 'next/link';

interface RoadmapStepProps {
  phase: string;
  course: {
    course_id: string;
    title: string;
    department: string;
    rating: number;
    level: string;
    newSkillsCount: number;
    platforms?: {
      name: string;
      category: string;
    };
  };
  index: number;
}

export default function RoadmapStep({ phase, course, index }: RoadmapStepProps) {
  const isEven = index % 2 === 0;
  const rating = Number.isFinite(Number(course.rating)) ? Number(course.rating) : 0;
  const newSkillsCount = Number.isFinite(Number(course.newSkillsCount)) ? Number(course.newSkillsCount) : 0;

  return (
    <div className={`relative mb-8 flex flex-col items-stretch justify-between gap-6 last:mb-0 md:mb-20 md:items-center md:gap-8 ${isEven ? 'md:flex-row' : 'md:flex-row-reverse'}`}>
      
      {/* Timeline Dot & Line */}
      <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-[-80px] w-0.5 bg-gradient-to-b from-certifind-accent/50 via-certifind-accent/20 to-transparent hidden md:block">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-certifind-accent shadow-[0_0_15px_rgba(114,38,255,0.8)] border-4 border-[#010030]" />
      </div>

      {/* Content Card */}
      <div className="w-full md:w-[45%] group">
        <div className="bg-neutral-900/40 border border-white/5 hover:border-certifind-accent/30 p-5 sm:p-6 rounded-[2rem] backdrop-blur-xl transition-all duration-500 hover:-translate-y-2 shadow-2xl relative overflow-hidden">
          
          {/* Phase Badge */}
          <div className="inline-flex items-center gap-2 bg-certifind-accent/10 text-certifind-accent px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase mb-4 border border-certifind-accent/20">
            {phase}
          </div>

          <h3 className="text-xl font-bold text-white mb-3 group-hover:text-certifind-accent transition-colors line-clamp-2">
            {course.title}
          </h3>

          <div className="flex flex-wrap gap-3 mb-6">
            <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-400 bg-white/5 px-2.5 py-1 rounded-lg">
              <Star size={12} className="text-amber-400 fill-amber-400" /> {rating.toFixed(1)}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-400 bg-white/5 px-2.5 py-1 rounded-lg">
              <GraduationCap size={12} className="text-blue-400" /> {course.level}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/5 px-2.5 py-1 rounded-lg border border-emerald-500/10">
              +{newSkillsCount} new skills
            </div>
          </div>

          <div className="flex flex-col gap-4 border-t border-white/5 pt-4 sm:flex-row sm:items-center sm:justify-between">
            {course.platforms && (
              <PlatformBadge name={course.platforms.name} category={course.platforms.category} />
            )}
            <Link 
              href={`/courses/${course.course_id}`}
              className="relative z-10 flex items-center gap-2 text-sm font-bold text-white transition-colors hover:text-certifind-accent sm:justify-end"
            >
              Start Learning <ArrowRight size={16} />
            </Link>
          </div>

          {/* Decorative Glow */}
          <div className="pointer-events-none absolute -right-10 -bottom-10 w-32 h-32 bg-certifind-accent/5 blur-3xl rounded-full transition-all group-hover:bg-certifind-accent/10" />
        </div>
      </div>

      {/* Spacer for MD screens to keep alignment */}
      <div className="hidden md:block w-[45%]" />
      
    </div>
  );
}
