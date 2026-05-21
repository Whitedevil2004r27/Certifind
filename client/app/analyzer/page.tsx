"use client";

import { useState } from "react";
import { Upload, CheckCircle2, TrendingUp, Sparkles, Loader2, ArrowRight, Download, Eye, X } from "lucide-react";
import RoadmapStep from "@/components/RoadmapStep";
import ResumeTemplate from "@/components/ResumeTemplate";
import { generateResumePDF } from "@/lib/pdf-generator";

type ResumeData = {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  skills: string[];
  experience: {
    company: string;
    role: string;
    period: string;
    description: string[];
  }[];
  education: {
    school: string;
    degree: string;
    year: string;
  }[];
};

type AnalyzerRecommendation = {
  course_id: string;
  title: string;
  department: string;
  rating: number;
  level: string;
  newSkillsCount: number;
  phaseTitle?: string;
  platforms?: {
    name: string;
    category: string;
  };
};

type AnalyzerResult = {
  detectedSkills: string[];
  recommendations: AnalyzerRecommendation[];
  summary: string;
  source?: string;
};

const MAX_RESUME_SIZE_BYTES = 5 * 1024 * 1024;
const RESUME_EXPORT_ID = "resume-export-content";

const defaultResumeData: ResumeData = {
  fullName: "Career Scholar",
  email: "scholar@certifind.ai",
  phone: "+1 (555) CERT-AI",
  location: "Global Digital Hub",
  skills: ["AI Strategy", "Full-Stack Development", "Technical Architecture"],
  experience: [
    {
      company: "CertiFind AI Labs",
      role: "Senior Skill Architect",
      period: "2023 - Present",
      description: ["Designing automated career roadmap algorithms", "Implementing serverless PDF parsing engines"],
    },
  ],
  education: [
    {
      school: "CertiFind Academy",
      degree: "Master of Continuous Learning",
      year: "2024",
    },
  ],
};

function validateResumeFile(candidate: File | null) {
  if (!candidate) return "Please choose a resume PDF first.";
  const isPdf = candidate.type === "application/pdf" || candidate.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return "Only PDF resume files are supported.";
  if (candidate.size > MAX_RESUME_SIZE_BYTES) return "Resume file must be 5MB or smaller.";
  return "";
}

export default function AnalyzerPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzerResult | null>(null);
  const [error, setError] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [resumeData, setResumeData] = useState<ResumeData>(defaultResumeData);

  const updateSelectedFile = (candidate: File | null) => {
    const validationError = validateResumeFile(candidate);
    setError(validationError);
    setFile(validationError ? null : candidate);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please choose a resume PDF first.");
      return;
    }
    const validationError = validateResumeFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    const resumeFile: File = file;

    setLoading(true);
    setError("");
    setResult(null);

    const formData = new FormData();
    formData.append("resume", resumeFile);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.details || errData.error || "Analysis failed. Please ensure the file is a valid PDF.");
      }
      const data = (await res.json()) as AnalyzerResult;
      if (!Array.isArray(data.recommendations) || data.recommendations.length === 0) {
        throw new Error("No course recommendations were returned. Please try another resume.");
      }
      setResult(data);
      
      setResumeData(prev => ({
        ...prev,
        skills: Array.from(new Set([...prev.skills, ...(data.detectedSkills || [])])).slice(0, 12)
      }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setError("");
    const success = await generateResumePDF(RESUME_EXPORT_ID, `${resumeData.fullName}_CertiFind_Resume.pdf`);
    setExporting(false);
    if (!success) {
      setError("Resume export failed. Please open the preview and try again.");
    }
  };

  return (
    <div className="min-h-screen max-w-[1400px] mx-auto px-4 sm:px-6 py-10 lg:py-20 relative">
      {/* Background Decor */}
      <div className="absolute top-0 inset-x-0 h-[500px] bg-certifind-accent/5 blur-[120px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10 sm:mb-16">
          <div className="inline-flex items-center gap-2 bg-certifind-accent/10 text-certifind-accent px-4 py-1.5 rounded-full text-xs font-black tracking-widest uppercase mb-6 border border-certifind-accent/20">
            <Sparkles className="w-3.5 h-3.5" /> AI Career Hub
          </div>
          <h1 className="text-2xl sm:text-4xl md:text-6xl font-black text-white mb-4 sm:mb-6 tracking-tight">
            {result ? "Your Growth Strategy" : "Elite Resume Analyzer"}
          </h1>
          <p className="text-base sm:text-xl text-neutral-400 max-w-2xl mx-auto leading-relaxed">
            {result 
              ? "We've mapped your competencies and built an upgraded resume template for you." 
              : "Upload your resume to identify skill gaps and instantly generate an ATS-optimized AI resume."
            }
          </p>
        </div>

        {!result ? (
          <div className="bg-neutral-900/40 border border-white/5 backdrop-blur-3xl rounded-[2rem] p-5 sm:p-8 md:p-16 shadow-2xl relative overflow-hidden group">
            <form onSubmit={handleUpload} className="space-y-10">
              <div 
                className={`border-2 border-dashed rounded-[2rem] p-6 text-center transition-all duration-500 cursor-pointer flex flex-col items-center gap-5 sm:p-10 md:p-12 md:gap-6 ${
                  file ? "border-emerald-500/50 bg-emerald-500/5" : "border-white/10 hover:border-certifind-accent/50 hover:bg-white/5"
                }`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  updateSelectedFile(e.dataTransfer.files[0] || null);
                }}
              >
                <div className={`w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-500 ${
                  file ? "bg-emerald-500 text-white" : "bg-neutral-800 text-neutral-500 group-hover:text-certifind-accent group-hover:scale-110"
                }`}>
                  {file ? <CheckCircle2 className="w-10 h-10" /> : <Upload className="w-10 h-10" />}
                </div>
                
                <input 
                  type="file" accept=".pdf" className="hidden" id="resume-upload"
                  onChange={(e) => updateSelectedFile(e.target.files?.[0] || null)}
                />
                <label htmlFor="resume-upload" className="cursor-pointer">
                  <h3 className="mb-2 break-all text-xl font-bold text-white sm:text-2xl">{file ? file.name : "Select your Resume"}</h3>
                  <p className="text-sm font-medium leading-relaxed text-neutral-500 sm:text-base">Drag and drop or click to browse. Supports PDF (Max 5MB).</p>
                </label>
              </div>

              {error && <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 px-6 py-4 rounded-2xl text-sm font-bold">Error: {error}</div>}

              <button
                type="submit" disabled={!file || loading}
                className="w-full bg-certifind-accent hover:bg-certifind-accent/80 disabled:opacity-50 text-white font-black py-5 rounded-2xl transition-all shadow-[0_0_30px_rgba(114,38,255,0.3)] flex items-center justify-center gap-3 text-lg"
              >
                {loading ? <><Loader2 className="w-6 h-6 animate-spin" /> Analyzing...</> : <>Start Discovery <ArrowRight className="w-6 h-6" /></>}
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-12 animate-fade-in relative">
            {/* Quick Actions Tray - stacks vertically on mobile */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mb-10 sm:mb-12">
              <button 
                onClick={() => setShowPreview(true)}
                className="w-full sm:w-auto bg-white/10 hover:bg-white/20 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-2xl font-black flex items-center justify-center gap-3 transition-all border border-white/10 group"
              >
                <Eye className="w-5 h-5 text-certifind-accent group-hover:scale-110" /> Preview AI Resume
              </button>
              <button 
                onClick={handleExport}
                disabled={exporting}
                className="w-full sm:w-auto bg-certifind-accent hover:bg-certifind-accent/80 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-2xl font-black flex items-center justify-center gap-3 transition-all shadow-xl disabled:opacity-50"
              >
                {exporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />} 
                One-Click Export
              </button>
            </div>

            {/* Resume Preview Modal - Properly scrollable on mobile */}
            {showPreview && (
              <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm overflow-y-auto p-3 sm:p-6 md:p-10">
                <div className="relative max-w-4xl w-full mx-auto">
                  <div className="flex justify-end mb-3">
                    <button 
                      onClick={() => setShowPreview(false)}
                      className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-full font-black text-sm hover:bg-gray-200 transition-colors shadow-2xl"
                    >
                      <X className="w-4 h-4" /> Close
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <ResumeTemplate data={resumeData} elementId="resume-preview-content" />
                  </div>
                </div>
              </div>
            )}

            {/* Analysis Results Card */}
            {error && <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 px-6 py-4 rounded-2xl text-sm font-bold">Error: {error}</div>}

            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-[2rem] p-5 backdrop-blur-xl sm:p-8 md:rounded-[2.5rem] md:p-12">
              <div className="flex flex-col items-center gap-8 justify-between md:flex-row">
                <div className="text-center md:text-left">
                  <h3 className="mb-4 text-2xl font-black text-white sm:text-3xl">Profile Updated!</h3>
                  <p className="max-w-xl text-sm leading-relaxed text-neutral-300 sm:text-base lg:text-lg">{result.summary}</p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {result.detectedSkills.length > 0 ? result.detectedSkills.map((skill) => (
                    <span key={skill} className="bg-emerald-500/20 text-emerald-400 px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wider border border-emerald-500/30 font-black">
                      {skill}
                    </span>
                  )) : (
                    <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-wider text-neutral-300">
                      Discovery mode
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Course Recommendations / Roadmap */}
            <div className="relative pt-10">
              <div className="mb-10 flex flex-col items-center justify-center gap-4 text-center sm:mb-16 sm:flex-row sm:text-left">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-certifind-accent/30 bg-certifind-accent/20 shadow-[0_0_20px_rgba(114,38,255,0.2)]">
                  <TrendingUp className="w-6 h-6 text-certifind-accent" />
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-white sm:text-4xl">AI Roadmap <span className="text-certifind-accent">V2.0</span></h2>
                  <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 sm:text-sm">3-Stage Career Acceleration Plan</p>
                </div>
              </div>

              <div className="relative">
                <div className="space-y-4">
                  {result.recommendations.map((course, idx) => (
                    <RoadmapStep 
                      key={course.course_id}
                      index={idx}
                      phase={course.phaseTitle || `Phase ${idx+1}`}
                      course={course}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="text-center pt-20">
              <button 
                onClick={() => { setResult(null); setFile(null); setError(""); setResumeData(defaultResumeData); }}
                className="text-neutral-500 hover:text-white font-black uppercase tracking-[0.2em] text-[10px] transition-all flex items-center gap-3 mx-auto px-6 py-2 rounded-full border border-white/5 hover:border-white/10 bg-white/5"
              >
                <X className="w-3 h-3" /> Start New Analysis
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Hidden container for PDF generation */}
      <div className="fixed left-[-10000px] top-0 w-[800px] pointer-events-none" aria-hidden="true">
        <ResumeTemplate data={resumeData} elementId={RESUME_EXPORT_ID} />
      </div>
    </div>
  );
}
