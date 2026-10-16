"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getScholarships, formatINR } from "@/lib/api";
import { ScholarshipListItem } from "@/types/student";

export default function DiscoverPage() {
  const [scholarships, setScholarships] = useState<ScholarshipListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Sorting state
  const [searchQuery, setSearchQuery] = useState("");
  const [eligibilityFilter, setEligibilityFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recommended");

  const loadScholarships = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getScholarships({
        query: searchQuery,
        eligibility_filter: eligibilityFilter,
        sort_by: sortBy,
      });
      setScholarships(data);
    } catch (err: unknown) {
      setError((err as Error)?.message || "Failed to load scholarship schemes.");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, eligibilityFilter, sortBy]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadScholarships();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadScholarships]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadScholarships();
  };

  const getMatchBadge = (status?: string) => {
    switch (status) {
      case "eligible":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Likely Eligible
          </span>
        );
      case "needs_verification":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Needs Verification
          </span>
        );
      case "ineligible":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            Ineligible
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            Potential Fit
          </span>
        );
    }
  };

  const getDeadlineRiskBadge = (risk?: string, days?: number) => {
    if (days !== undefined && days <= 4) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
          Urgent: {days}d left
        </span>
      );
    }
    if (days !== undefined && days <= 10) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
          {days}d left
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
        {days ?? 0}d left
      </span>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-xs transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 mb-1.5">
              <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Dashboard</Link>
              <span>/</span>
              <span className="text-slate-800 dark:text-slate-200 font-medium">Discover Scholarships</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Scholarship Discovery & Intelligence
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl mt-1.5 leading-relaxed">
              Explore educational funding schemes matched deterministically against your academic profile and financial gap.
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl text-xs text-slate-600 dark:text-slate-300 max-w-sm">
            <div className="flex items-center space-x-1.5 font-semibold text-slate-900 dark:text-white mb-1">
              <svg className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Trust Principle</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              &ldquo;AI assists. Official sources decide. Student approves.&rdquo; Rules are computed against official guidelines without guaranteeing award allocation.
            </p>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row gap-4">
          <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search scholarships by name, awarding body, or field..."
                className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-blue-500 transition-colors"
              />
              <svg className="w-4 h-4 text-slate-400 absolute left-3 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-2xs"
            >
              Search
            </button>
          </form>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={eligibilityFilter}
              onChange={(e) => setEligibilityFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-blue-500"
            >
              <option value="all">All Eligibility Levels</option>
              <option value="eligible">Likely Eligible Only</option>
              <option value="needs_verification">Needs Verification</option>
              <option value="ineligible">Ineligible</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-blue-500"
            >
              <option value="recommended">Sort by: Recommended</option>
              <option value="deadline">Sort by: Deadline</option>
              <option value="amount_high">Sort by: Highest Amount</option>
              <option value="amount_low">Sort by: Lowest Amount</option>
            </select>
          </div>
        </div>
      </div>

      {/* Scholarships Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[35vh] space-y-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Evaluating scholarship opportunities against your profile...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-6 text-center text-rose-700 dark:text-rose-400 text-sm">
          <p className="font-semibold">{error}</p>
          <button onClick={() => loadScholarships()} className="mt-3 px-3 py-1.5 bg-rose-600 text-white rounded text-xs font-semibold">
            Retry
          </button>
        </div>
      ) : scholarships.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-500 dark:text-slate-400">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <p className="font-semibold text-slate-900 dark:text-white">No scholarships match the current criteria.</p>
          <p className="text-xs mt-1">Try broadening your search term or clearing the eligibility filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {scholarships.map((s) => (
            <div
              key={s.id}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between"
            >
              <div>
                {/* Top Row: Provider & Badges */}
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {s.provider}
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                      {s.verification_status}
                    </span>
                    {getMatchBadge(s.match_status)}
                  </div>
                </div>

                {/* Title */}
                <h3 className="text-base font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  <Link href={`/discover/${s.id}`}>{s.name}</Link>
                </h3>

                {/* Amount & Deadline */}
                <div className="flex items-baseline space-x-3 mt-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-xl font-bold font-mono text-blue-700 dark:text-blue-400">{formatINR(s.amount)}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">/ academic award</span>
                  <div className="ml-auto">
                    {getDeadlineRiskBadge(s.deadline_risk, s.days_remaining)}
                  </div>
                </div>

                {/* Description & Eligibility Summary */}
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-3 line-clamp-2 leading-relaxed">
                  {s.description}
                </p>

                {s.eligibility_summary && (
                  <div className="mt-3 text-xs bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-800">
                    <span className="font-semibold text-slate-900 dark:text-white">Criteria: </span>
                    {s.eligibility_summary}
                  </div>
                )}

                {/* Why this may fit */}
                {s.fit_reasons && s.fit_reasons.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                      Profile Fit Factors
                    </span>
                    {s.fit_reasons.map((reason, idx) => (
                      <p key={idx} className="text-xs text-slate-600 dark:text-slate-400 flex items-start space-x-2">
                        <span className="text-blue-600 dark:text-blue-400 font-bold">&bull;</span>
                        <span>{reason}</span>
                      </p>
                    ))}
                  </div>
                )}
              </div>

              {/* Card Footer */}
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  <span>Effort: </span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{s.application_effort || "Medium"}</span>
                </div>

                <div className="flex items-center space-x-2">
                  {s.application_status && s.application_status !== "NOT_STARTED" ? (
                    <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
                      Applied ({s.application_status})
                    </span>
                  ) : (
                    <Link
                      href={`/discover/${s.id}`}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-2xs"
                    >
                      View & Apply &rarr;
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
