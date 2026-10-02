"use client";

import { useEffect, useState } from "react";
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

  const loadScholarships = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getScholarships({
        query: searchQuery,
        eligibility_filter: eligibilityFilter,
        sort_by: sortBy,
      });
      setScholarships(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load scholarship schemes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScholarships();
  }, [eligibilityFilter, sortBy]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadScholarships();
  };

  const getMatchBadge = (status?: string) => {
    switch (status) {
      case "eligible":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">Likely Eligible</span>;
      case "needs_verification":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">Needs Verification</span>;
      case "ineligible":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">Ineligible</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">Potential Fit</span>;
    }
  };

  const getDeadlineRiskBadge = (risk?: string, days?: number) => {
    if (days !== undefined && days <= 4) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">Urgent: {days}d left</span>;
    }
    if (days !== undefined && days <= 10) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">{days}d left</span>;
    }
    return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">{days ?? 0}d left</span>;
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs text-slate-500 mb-1">
              <Link href="/" className="hover:text-indigo-600 transition-colors">Dashboard</Link>
              <span>/</span>
              <span className="text-slate-800 font-medium">Discover Scholarships</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Scholarship Discover</h1>
            <p className="text-sm text-slate-600 max-w-2xl mt-1">
              Explore schemes mapped against your profile. AI assists with deterministic rule matching, but official awarding sources decide final eligibility.
            </p>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 max-w-xs">
            <span className="font-semibold text-slate-800 block mb-0.5">Trust Principle</span>
            &ldquo;AI assists. Official sources decide. Student approves.&rdquo; Never guarantee eligibility or awards.
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="mt-6 pt-6 border-t border-slate-100 flex flex-col md:flex-row gap-4">
          <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search scholarships by title, provider, or field..."
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />
              <svg className="w-4 h-4 text-slate-400 absolute left-3 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Search
            </button>
          </form>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={eligibilityFilter}
              onChange={(e) => setEligibilityFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Eligibility</option>
              <option value="eligible">Likely Eligible Only</option>
              <option value="needs_verification">Needs Verification</option>
              <option value="ineligible">Ineligible</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
        <div className="flex flex-col items-center justify-center min-h-[30vh] space-y-3">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-slate-500">Evaluating scholarship opportunities...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center text-red-800 text-sm">
          <p className="font-semibold">{error}</p>
          <button onClick={loadScholarships} className="mt-3 px-3 py-1.5 bg-red-600 text-white rounded text-xs">Retry</button>
        </div>
      ) : scholarships.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
          <p className="font-semibold text-slate-800">No scholarships found matching criteria.</p>
          <p className="text-xs mt-1">Try broadening your search term or clearing the eligibility filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {scholarships.map((s) => (
            <div
              key={s.id}
              className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                {/* Top Row: Provider & Badges */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{s.provider}</span>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                      {s.verification_status}
                    </span>
                    {getMatchBadge(s.match_status)}
                  </div>
                </div>

                {/* Title */}
                <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                  <Link href={`/discover/${s.id}`}>{s.name}</Link>
                </h3>

                {/* Amount & Deadline */}
                <div className="flex items-baseline space-x-3 mt-2 pb-3 border-b border-slate-100">
                  <span className="text-xl font-bold text-indigo-700">{formatINR(s.amount)}</span>
                  <span className="text-xs text-slate-500">/ academic award</span>
                  <div className="ml-auto">
                    {getDeadlineRiskBadge(s.deadline_risk, s.days_remaining)}
                  </div>
                </div>

                {/* Description & Eligibility Summary */}
                <p className="text-xs text-slate-600 mt-3 line-clamp-2">{s.description}</p>
                {s.eligibility_summary && (
                  <div className="mt-2 text-xs bg-slate-50 p-2 rounded text-slate-700">
                    <span className="font-semibold text-slate-800">Criteria: </span>
                    {s.eligibility_summary}
                  </div>
                )}

                {/* Why this may fit */}
                {s.fit_reasons && s.fit_reasons.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Why this may fit
                    </span>
                    {s.fit_reasons.map((reason, idx) => (
                      <p key={idx} className="text-xs text-slate-600 flex items-start space-x-1.5">
                        <span className="text-indigo-500 font-bold">&bull;</span>
                        <span>{reason}</span>
                      </p>
                    ))}
                  </div>
                )}
              </div>

              {/* Card Footer */}
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="text-[11px] text-slate-500">
                  <span>Effort: </span>
                  <span className="font-semibold text-slate-700">{s.application_effort || "Medium"}</span>
                </div>

                <div className="flex items-center space-x-2">
                  {s.application_status && s.application_status !== "NOT_STARTED" ? (
                    <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      Applied ({s.application_status})
                    </span>
                  ) : (
                    <Link
                      href={`/discover/${s.id}`}
                      className="px-3.5 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
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
