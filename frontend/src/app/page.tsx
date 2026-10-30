"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  getCurrentStudent,
  getPortfolioSummary,
  getPersonalizedRecommendations,
  getProfileCompletion,
  formatINR,
} from "@/lib/api";
import {
  StudentDetail,
  PortfolioSummary,
  PersonalizedRecommendationsData,
  ProfileCompletionData,
  ScholarshipRecommendationItem,
} from "@/types/student";
import MetricCard from "@/components/MetricCard";
import FundingProgressBar from "@/components/FundingProgressBar";
import { useAuth } from "@/context/AuthContext";

type RecCategoryTab = "likely" | "potentially" | "ineligible" | "window";

export default function Dashboard() {
  const { displayName, student: authStudent } = useAuth();
  const [student, setStudent] = useState<StudentDetail | null>(authStudent);
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [recommendations, setRecommendations] = useState<PersonalizedRecommendationsData | null>(null);
  const [completion, setCompletion] = useState<ProfileCompletionData | null>(null);
  const [recTab, setRecTab] = useState<RecCategoryTab>("likely");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [studentData, portfolioData, recsData, compData] = await Promise.all([
        getCurrentStudent(),
        getPortfolioSummary(),
        getPersonalizedRecommendations().catch(() => null),
        getProfileCompletion().catch(() => null),
      ]);
      setStudent(studentData);
      setPortfolio(portfolioData);
      if (recsData) setRecommendations(recsData);
      if (compData) setCompletion(compData);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to connect to SCHOLARAi backend.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  if (loading && !student) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          Synchronizing student funding portfolio & intelligence...
        </p>
      </div>
    );
  }

  if (error && !student) {
    return (
      <div className="max-w-xl mx-auto my-12 bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm text-center">
        <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-xl flex items-center justify-center mx-auto mb-4 border border-rose-200 dark:border-rose-900/60">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Authentication or Connection Required</h2>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">{error}</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={loadData}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg hover:bg-slate-200 transition-colors"
          >
            Retry Connection
          </button>
          <Link
            href="/login"
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  const fundingProfile = student?.funding_profile;
  const annualCost = fundingProfile?.annual_education_cost || 0;
  const existingSupport = fundingProfile?.existing_support || 0;
  const fundingGap = fundingProfile?.funding_gap || 0;
  const progressPct = fundingProfile?.funding_progress_percentage || 0;

  const sharedBlocker = portfolio?.primary_shared_blocker;
  const topAction = portfolio?.top_next_best_action;

  // Active list of recommendations depending on selected tab
  const displayedRecs: ScholarshipRecommendationItem[] = recommendations
    ? recTab === "likely"
      ? recommendations.likely_eligible
      : recTab === "potentially"
      ? recommendations.potentially_eligible
      : recTab === "ineligible"
      ? recommendations.currently_ineligible
      : recommendations.window_needs_verification
    : [];

  return (
    <div className="space-y-6 pb-16">
      {/* Executive Intelligence Briefing Header */}
      <div className="bg-white dark:bg-[#191c20] rounded-2xl border border-[#e6dfd3] dark:border-[#2f343d] p-6 sm:p-8 shadow-xs transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-[#fff1f2] dark:bg-rose-950/40 text-[#86192c] dark:text-[#fb7185] border border-rose-200 dark:border-rose-900/50 text-[10px] font-mono font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-[#86192c] dark:bg-[#fb7185] animate-pulse"></span>
              <span>Tamil Nadu Collegiate Dispatch</span>
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
              Welcome, {displayName}
            </h1>
            <p className="text-xs font-serif text-stone-600 dark:text-stone-400 leading-relaxed">
              {student?.profile?.institution ? (
                <>
                  <strong className="text-stone-800 dark:text-stone-200">{student.profile.institution}</strong> &bull; {student.profile.course} &bull; Domicile: {student.profile.state || "Tamil Nadu"}
                </>
              ) : (
                "Verified scholarship intelligence, deterministic eligibility scoring, and dependency risk management for collegiate scholars."
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/profile"
              className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all flex items-center space-x-1.5"
            >
              <span>My Profile Settings</span>
              <span>&rarr;</span>
            </Link>
            <Link
              href="/assistant"
              className="px-4 py-2.5 bg-[#86192c] hover:bg-[#9f1239] text-white rounded-xl text-xs font-semibold shadow-xs transition-all flex items-center space-x-2 cursor-pointer"
            >
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Consult Assistant</span>
            </Link>
            <Link
              href="/discover"
              className="px-3.5 py-2.5 bg-[#fbf9f5] dark:bg-[#121417] text-stone-800 dark:text-stone-200 border border-[#e6dfd3] dark:border-[#2f343d] rounded-xl text-xs font-semibold hover:border-stone-400 transition-colors"
            >
              Discover
            </Link>
          </div>
        </div>

        {/* Operating Principle Banner */}
        <div className="mt-6 p-3.5 rounded-xl bg-[#fbf9f5] dark:bg-[#121417] border border-[#e6dfd3] dark:border-[#2f343d] flex items-start space-x-3">
          <div className="w-6 h-6 rounded-md bg-[#fff1f2] dark:bg-rose-950/40 text-[#86192c] dark:text-[#fb7185] flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div className="text-[11px] leading-relaxed font-serif">
            <span className="font-bold text-stone-900 dark:text-stone-100 uppercase tracking-wider mr-1.5">
              Operating Principle:
            </span>
            <span className="text-stone-600 dark:text-stone-400">
              &ldquo;AI assists. Official sources decide. Student approves.&rdquo; SCHOLARAi organizes deadlines and verified documentation. Award decisions are determined exclusively by official statutory bodies.
            </span>
          </div>
        </div>
      </div>

      {/* Profile Incomplete Notification Banner (Post-Login Guidance) */}
      {completion && completion.overall_percentage < 85 && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start space-x-3.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-200/80 dark:bg-amber-900 text-amber-900 dark:text-amber-200 font-mono">
                  Profile Incomplete ({completion.overall_percentage}% Readiness)
                </span>
                <span className="text-xs font-bold text-zinc-900 dark:text-white">
                  Action Recommended: Complete Your Profile Attributes
                </span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1">
                Certain official statutory schemes require specific profile attributes (e.g. Community category, annual family income, institution type, or school history). Complete your profile in <strong>Settings &rarr; My Profile</strong> to unlock all verified recommendations.
              </p>
            </div>
          </div>
          <Link
            href="/settings?tab=profile"
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold shadow-xs self-start sm:self-auto transition-colors flex items-center space-x-1.5 whitespace-nowrap"
          >
            <span>Complete My Profile</span>
            <span>&rarr;</span>
          </Link>
        </div>
      )}

      {/* Shared Blocker High-Priority Notification (if any) */}
      {sharedBlocker && sharedBlocker.blocked_applications_count > 0 && (
        <div className="bg-amber-500/10 border-l-4 border-amber-500 rounded-r-xl p-5 shadow-xs bg-white dark:bg-[#111827] border-y border-r border-slate-200 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start space-x-3.5">
              <div className="w-9 h-9 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                    Shared Dependency Blocker
                  </span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {sharedBlocker.document_name}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  Missing document is currently blocking{" "}
                  <strong className="text-slate-900 dark:text-white font-semibold">
                    {sharedBlocker.blocked_applications_count} active applications
                  </strong>{" "}
                  representing{" "}
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                    {formatINR(sharedBlocker.potential_funding_affected)}
                  </span>{" "}
                  in potential funding.
                </p>
              </div>
            </div>
            <Link
              href="/documents"
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold shadow-xs self-start sm:self-auto transition-colors flex items-center space-x-1.5 whitespace-nowrap"
            >
              <span>Resolve in Vault</span>
              <span>&rarr;</span>
            </Link>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* RECOMMENDED SCHOLARSHIPS FOR YOU (Section 5) */}
      {/* =================================================================== */}
      <div className="bg-white dark:bg-[#121215] rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 space-y-6 shadow-sm transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse"></span>
              <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">
                Recommended Scholarships For You
              </h2>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Personalized statutory recommendations evaluated deterministically against your saved profile attributes.
            </p>
          </div>

          <Link
            href="/discover"
            className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline self-start sm:self-auto"
          >
            Explore Full Catalogue &rarr;
          </Link>
        </div>

        {/* Category Tabs */}
        {recommendations && (
          <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <button
              onClick={() => setRecTab("likely")}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center space-x-2 cursor-pointer ${
                recTab === "likely"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              <span>Likely Eligible</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                recTab === "likely" ? "bg-emerald-800 text-white" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
              }`}>
                {recommendations.likely_eligible.length}
              </span>
            </button>

            <button
              onClick={() => setRecTab("potentially")}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center space-x-2 cursor-pointer ${
                recTab === "potentially"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              <span>Potentially Eligible &bull; More Info Required</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                recTab === "potentially" ? "bg-amber-800 text-white" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
              }`}>
                {recommendations.potentially_eligible.length}
              </span>
            </button>

            <button
              onClick={() => setRecTab("ineligible")}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center space-x-2 cursor-pointer ${
                recTab === "ineligible"
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              <span>Currently Ineligible &bull; Explain Why</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                recTab === "ineligible" ? "bg-zinc-700 text-white" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
              }`}>
                {recommendations.currently_ineligible.length}
              </span>
            </button>

            <button
              onClick={() => setRecTab("window")}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center space-x-2 cursor-pointer ${
                recTab === "window"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              <span>Window Needs Verification</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                recTab === "window" ? "bg-purple-800 text-white" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
              }`}>
                {recommendations.window_needs_verification.length}
              </span>
            </button>
          </div>
        )}

        {/* Recommendations Cards Grid */}
        <div className="space-y-4">
          {displayedRecs.length > 0 ? (
            displayedRecs.map((rec) => (
              <div
                key={rec.id}
                className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold">
                        {rec.academic_year || "2024-2026 Cycle"}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        rec.recommendation_category === "LIKELY_ELIGIBLE"
                          ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                          : rec.recommendation_category === "POTENTIALLY_ELIGIBLE"
                          ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                          : rec.recommendation_category === "WINDOW_NEEDS_VERIFICATION"
                          ? "bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                          : "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                      }`}>
                        {rec.recommendation_category.replace(/_/g, " ")} ({rec.match_score}%)
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                      {rec.name}
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Awarding Authority: <strong className="text-zinc-700 dark:text-zinc-300">{rec.provider}</strong>
                    </p>
                  </div>

                  <div className="text-left sm:text-right flex-shrink-0">
                    <span className="text-lg font-bold font-mono text-zinc-900 dark:text-white block">
                      {formatINR(rec.amount)}
                    </span>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block">
                      {rec.award_display || "Variable Statutory Aid"}
                    </span>
                  </div>
                </div>

                {/* Eligibility Summary & Match Rationale */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200/80 dark:border-zinc-800/80 text-xs space-y-2">
                  <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    <strong>Scheme Overview:</strong> {rec.eligibility_summary}
                  </p>

                  {/* Why it matches */}
                  {rec.satisfied_requirements.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">
                        ✓ Why it Matches Your Saved Profile:
                      </span>
                      <ul className="space-y-0.5 pl-4 list-disc text-[11px] text-zinc-600 dark:text-zinc-300">
                        {rec.satisfied_requirements.map((r, idx) => (
                          <li key={idx}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Missing information */}
                  {rec.missing_information.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block">
                        ⚠ Missing Profile Information to Confirm Fit:
                      </span>
                      <ul className="space-y-0.5 pl-4 list-disc text-[11px] text-amber-800 dark:text-amber-300">
                        {rec.missing_information.map((m, idx) => (
                          <li key={idx}>{m}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Requirements needing document verification */}
                  {rec.requirements_needing_verification.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
                        📄 Document &amp; Policy Verification Required:
                      </span>
                      <ul className="space-y-0.5 pl-4 list-disc text-[11px] text-zinc-500 dark:text-zinc-400">
                        {rec.requirements_needing_verification.map((v, idx) => (
                          <li key={idx}>{v}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Required Documents Checklist */}
                  {rec.required_documents && rec.required_documents.length > 0 && (
                    <div className="space-y-1 pt-1 border-t border-zinc-100 dark:border-zinc-800">
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                        📑 Mandatory Documents Checklist:
                      </span>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {rec.required_documents.map((doc, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[10px] font-medium border border-zinc-200 dark:border-zinc-700"
                          >
                            ✓ {doc}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer with statutory links, official portal button, and assistant launcher */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 text-xs">
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-500 dark:text-zinc-400">
                    {rec.official_source_url && (
                      <a
                        href={rec.official_source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-red-600 dark:text-red-400 hover:underline flex items-center space-x-1"
                      >
                        <span>Official Guidelines</span>
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}
                    {rec.official_application_portal_url && (
                      <a
                        href={rec.official_application_portal_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-zinc-600 dark:text-zinc-300 hover:underline flex items-center space-x-1"
                      >
                        <span>Official Portal</span>
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}
                    {rec.days_remaining !== null && rec.days_remaining !== undefined && (
                      <span className="font-mono">
                        Deadline: {rec.days_remaining}d remaining
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    {(rec.official_application_portal_url || rec.official_source_url) && (
                      <a
                        href={rec.official_application_portal_url || rec.official_source_url || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <span>Open Official Portal &amp; Verify</span>
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}
                    <Link
                      href={`/discover/${rec.id}`}
                      className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all flex items-center space-x-1.5 whitespace-nowrap"
                    >
                      <span>Prepare with Assistant</span>
                      <span>&rarr;</span>
                    </Link>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center bg-zinc-50/50 dark:bg-zinc-900/30 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
              No scholarships currently classified under this category. Update your profile in <strong>Settings &rarr; My Profile</strong> to refresh evaluations.
            </div>
          )}
        </div>

        <div className="pt-2 text-[11px] text-zinc-500 dark:text-zinc-400 italic">
          Disclaimer: SCHOLARAi recommendations are deterministically scored against official statutory scheme rules. A recommendation is not an official eligibility decision or guarantee of funding. Award determinations are conducted exclusively by awarding authorities.
        </div>
      </div>

      {/* 1. FINANCIAL GAP & PORTFOLIO METRICS */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Educational Funding & Need Overview
            </h2>
          </div>
          <Link href="/goal" className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline">
            Adjust Strategy &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Annual Educational Need"
            value={formatINR(annualCost)}
            subtitle="Tuition, books, and living allowance"
            badge={{ text: "Total Cost", variant: "neutral" }}
          />
          <MetricCard
            title="Confirmed Support"
            value={formatINR(existingSupport)}
            subtitle="Secured institutional aid and fellowships"
            badge={{ text: "Secured", variant: "success" }}
          />
          <MetricCard
            title="Net Funding Shortfall"
            value={formatINR(fundingGap)}
            subtitle="Funding gap remaining to be covered"
            badge={{
              text: fundingGap > 0 ? "Gap Open" : "Funded",
              variant: fundingGap > 0 ? "warning" : "success",
            }}
          />
          <MetricCard
            title="Applications in Pursuit"
            value={formatINR(portfolio?.potential_funding_under_pursuit || 0)}
            subtitle={`${portfolio?.active_applications_count || 0} active scholarship applications`}
            badge={{ text: "In Pipeline", variant: "info" }}
          />
        </div>

        <div className="mt-4">
          <FundingProgressBar
            annualCost={annualCost}
            existingSupport={existingSupport}
            fundingGap={fundingGap}
            percentage={progressPct}
          />
        </div>
      </div>

      {/* 2. DECISION INTELLIGENCE: NEXT BEST ACTION & DEADLINE HORIZON */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Next Best Action Card */}
        <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-xs flex flex-col justify-between transition-colors">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 dark:bg-red-500 animate-ping"></span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Top Recommended Next Action
                </h3>
              </div>
              {topAction && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    topAction.urgency === "URGENT"
                      ? "bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                      : topAction.urgency === "HIGH"
                      ? "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                      : "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/40"
                  }`}
                >
                  {topAction.urgency} Urgency
                </span>
              )}
            </div>

            {topAction ? (
              <div className="space-y-3">
                <h4 className="text-base font-bold text-slate-900 dark:text-white">{topAction.title}</h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{topAction.reason}</p>

                <div className="grid grid-cols-2 gap-3 pt-2 text-xs font-mono">
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-sans text-slate-400 block uppercase tracking-wider">
                      Effort Estimate
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block">
                      {topAction.effort_estimate}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-sans text-slate-400 block uppercase tracking-wider">
                      Funding Impact
                    </span>
                    <span className="font-bold text-red-600 dark:text-red-400 mt-0.5 block">
                      {formatINR(topAction.potential_funding_impact)}
                    </span>
                  </div>
                </div>

                {topAction.blocker_impact && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                    &bull; {topAction.blocker_impact}
                  </p>
                )}
              </div>
            ) : (
              <div className="p-6 text-center text-slate-400 text-xs">
                No immediate blockers detected. All portfolio actions are current.
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
            {topAction?.target_type === "document" ? (
              <Link
                href="/documents"
                className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center space-x-1.5 shadow-xs"
              >
                <span>Complete Document in Vault</span>
                <span>&rarr;</span>
              </Link>
            ) : (
              <Link
                href="/applications"
                className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center space-x-1.5 shadow-xs"
              >
                <span>Advance Application</span>
                <span>&rarr;</span>
              </Link>
            )}
          </div>
        </div>

        {/* Approaching Deadlines Horizon */}
        <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-xs flex flex-col justify-between transition-colors">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Upcoming Deadlines Horizon
              </h3>
              <Link
                href="/applications"
                className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline"
              >
                View Tracker &rarr;
              </Link>
            </div>

            <div className="space-y-3">
              {portfolio?.upcoming_deadlines && portfolio.upcoming_deadlines.length > 0 ? (
                portfolio.upcoming_deadlines.map((item) => (
                  <div
                    key={item.application_id}
                    className="p-3 rounded-lg border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors flex items-center justify-between"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        {item.scholarship_name}
                      </h4>
                      <div className="flex items-center space-x-2 mt-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {formatINR(item.amount)}
                        </span>
                        <span>&bull;</span>
                        <span>{item.progress.toFixed(0)}% checklist ready</span>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase tracking-wider ${
                          item.risk_level === "URGENT"
                            ? "bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                            : item.risk_level === "HIGH"
                            ? "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {item.days_remaining}d remaining
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-slate-400 text-xs">
                  No active applications with pending deadlines. Browse scholarships in Discover.
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
            <span className="text-slate-500 dark:text-slate-400">Weekly allocation plan</span>
            <Link
              href="/goal"
              className="font-semibold text-red-600 dark:text-red-400 hover:underline"
            >
              Allocate Hours &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
