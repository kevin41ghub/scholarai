"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getScholarships, formatINR } from "@/lib/api";
import { ScholarshipListItem } from "@/types/student";

const CATEGORY_TABS = [
  { id: "ALL", label: "All Schemes" },
  { id: "Tamil Nadu State Schemes", label: "TN State Directives" },
  { id: "Community/Category-Based", label: "Post-Matric (SC/ST/BC/MBC)" },
  { id: "Women in Higher Education", label: "Women Scholars (Pudhumai Penn)" },
  { id: "Tuition and Fee Assistance", label: "Tuition Waivers & First Graduate" },
  { id: "Central Government Schemes", label: "Central Schemes (NSP / AICTE)" },
  { id: "Disability Support", label: "Differently-Abled (Saksham)" },
  { id: "Research and Postgraduate Funding", label: "Postgraduate & Research" },
];

export default function DiscoverPage() {
  const [scholarships, setScholarships] = useState<ScholarshipListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Sorting state
  const [streamFilter, setStreamFilter] = useState<"ALL" | "ARTS_SCIENCE" | "ENGINEERING">("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [eligibilityFilter, setEligibilityFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recommended");

  const loadScholarships = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getScholarships({
        query: searchQuery,
        stream: streamFilter === "ALL" ? undefined : streamFilter,
        category_tag: categoryFilter === "ALL" ? undefined : categoryFilter,
        eligibility_filter: eligibilityFilter === "all" ? undefined : eligibilityFilter,
        status_filter: "ACTIVE",
        sort_by: sortBy,
      });

      // Strict Defense-in-Depth: Filter out any retired demonstration or inactive records
      const verifiedOnly = data.filter((s) => {
        const isRetired =
          s.status === "INACTIVE" ||
          s.verification_status === "RETIRED_DEMO" ||
          s.verification_status === "DEMO_DATA" ||
          (s.provider && s.provider.includes("(Demo)"));
        return !isRetired;
      });
      setScholarships(verifiedOnly);
    } catch (err: unknown) {
      setError((err as Error)?.message || "Failed to load scholarship records.");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, streamFilter, categoryFilter, eligibilityFilter, sortBy]);

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

  const resetFilters = () => {
    setStreamFilter("ALL");
    setCategoryFilter("ALL");
    setSearchQuery("");
    setEligibilityFilter("all");
    setSortBy("recommended");
  };

  const getRecommendationBadge = (category?: string) => {
    switch (category) {
      case "LIKELY_ELIGIBLE":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            ✓ Likely Eligible
          </span>
        );
      case "POTENTIALLY_ELIGIBLE":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            ⚠ Potentially Eligible
          </span>
        );
      case "WINDOW_NEEDS_VERIFICATION":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
            ⏳ Window Verification
          </span>
        );
      case "CURRENTLY_INELIGIBLE":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
            ✕ Ineligible
          </span>
        );
      default:
        return null;
    }
  };

  const getVerificationBadge = (status?: string) => {
    switch (status) {
      case "SOURCE_VERIFIED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/80">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400"></span>
            SOURCE VERIFIED
          </span>
        );
      case "PARTIALLY_VERIFIED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/80">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600 dark:bg-amber-400"></span>
            PARTIALLY VERIFIED
          </span>
        );
      case "ELIGIBILITY_CONFIRMATION_REQUIRED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-300 dark:border-stone-700">
            POLICY UNDER REVIEW
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-300 dark:border-stone-700">
            {status || "OFFICIAL SCHEME"}
          </span>
        );
    }
  };

  const getMatchSeal = (status?: string, disqualification_reasons?: string[]) => {
    switch (status) {
      case "eligible":
        return (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-900 dark:text-emerald-200">
            <svg className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <span className="font-semibold block">Criteria Satisfied</span>
              <span className="text-[11px] text-emerald-800 dark:text-emerald-300">
                Your autonomous college profile aligns with statutory eligibility and income rules.
              </span>
            </div>
          </div>
        );
      case "ineligible":
        const primaryReason = disqualification_reasons && disqualification_reasons.length > 0
          ? disqualification_reasons[0]
          : "Criteria do not align with current profile.";
        return (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-900 dark:text-rose-200">
            <svg className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <div>
              <span className="font-semibold block">Boundary Restriction</span>
              <span className="text-[11px] text-rose-800 dark:text-rose-300 leading-relaxed">
                {primaryReason}
              </span>
            </div>
          </div>
        );
      case "needs_verification":
        return (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200">
            <svg className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <span className="font-semibold block">Documentation Verification Required</span>
              <span className="text-[11px] text-amber-800 dark:text-amber-300">
                Official quota seat allotment, E-Sevai Tahsildar certificate, or institution endorsement must be confirmed.
              </span>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Editorial Journal Masthead */}
      <section className="border-b border-[#e6dfd3] dark:border-[#2f343d] pb-8 pt-2">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] tracking-widest uppercase font-semibold text-[#86192c] dark:text-[#fb7185] mb-1.5">
              <span>SCHOLARSHIP INTELLIGENCE PLATFORM</span>
              <span>•</span>
              <span>VOL. 2025–2026</span>
              <span>•</span>
              <span className="text-stone-500 dark:text-stone-400">INSTITUTIONAL INTELLIGENCE GAZETTE</span>
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
              Collegiate Intelligence & Scheme Catalogue
            </h1>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-[11px] font-mono text-stone-500 dark:text-stone-400 uppercase tracking-wider">
              Primary Sources Verified
            </p>
            <p className="text-xs font-serif italic text-stone-700 dark:text-stone-300">
              TNDCE • TN SSP • BCMBCMW • NSP • DOTE
            </p>
          </div>
        </div>

        <p className="text-base text-stone-700 dark:text-stone-300 font-serif leading-relaxed max-w-4xl">
          An editorial research index of authenticated higher education scholarships for students studying{" "}
          <strong className="font-semibold text-stone-900 dark:text-stone-100">Arts & Science</strong> and{" "}
          <strong className="font-semibold text-stone-900 dark:text-stone-100">Engineering</strong> in recognized autonomous colleges across Tamil Nadu.
          Every record cites statutory authorities, autonomous institution coverage rules, and verified income ceilings.
        </p>

        {/* Editorial Trust Principle Banner */}
        <div className="mt-5 p-3.5 rounded-lg bg-[#f5f1e8] dark:bg-[#191c20] border border-[#e6dfd3] dark:border-[#2f343d] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-serif italic font-bold text-[#86192c] dark:text-[#fb7185] text-sm">
              Editorial Rule:
            </span>
            <span className="text-stone-800 dark:text-stone-200 font-medium">
              &ldquo;AI assists. Official sources decide. Student approves.&rdquo;
            </span>
          </div>
          <p className="text-stone-600 dark:text-stone-400 text-[11px]">
            No fabricated awards. Autonomous status alone does not establish eligibility; department quotas apply.
          </p>
        </div>
      </section>

      {/* Prominent Stream Selector Toggle */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
            Select Academic Discipline Stream
          </span>
          <span className="text-xs font-mono text-stone-500 dark:text-stone-400">
            Targeting Tamil Nadu Autonomous Colleges
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setStreamFilter("ALL")}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
              streamFilter === "ALL"
                ? "bg-[#86192c] text-white border-[#86192c] shadow-sm"
                : "bg-white dark:bg-[#191c20] text-stone-800 dark:text-stone-200 border-[#e6dfd3] dark:border-[#2f343d] hover:border-stone-400"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-serif font-bold text-base">All Higher Education</span>
              <span className={`text-[11px] font-mono px-2 py-0.5 rounded ${streamFilter === "ALL" ? "bg-white/20 text-white" : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400"}`}>
                {streamFilter === "ALL" && !loading ? `${scholarships.length} Schemes Available` : "All Streams"}
              </span>
            </div>
            <p className={`text-xs leading-relaxed ${streamFilter === "ALL" ? "text-rose-100" : "text-stone-500 dark:text-stone-400"}`}>
              Unified gazette covering common state welfare, central sector merit grants, and women assistance.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setStreamFilter("ARTS_SCIENCE")}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
              streamFilter === "ARTS_SCIENCE"
                ? "bg-[#86192c] text-white border-[#86192c] shadow-sm"
                : "bg-white dark:bg-[#191c20] text-stone-800 dark:text-stone-200 border-[#e6dfd3] dark:border-[#2f343d] hover:border-stone-400"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-serif font-bold text-base">Arts & Science</span>
              <span className={`text-[11px] font-mono px-2 py-0.5 rounded ${streamFilter === "ARTS_SCIENCE" ? "bg-white/20 text-white" : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400"}`}>
                DCE / TANSCHE
              </span>
            </div>
            <p className={`text-xs leading-relaxed ${streamFilter === "ARTS_SCIENCE" ? "text-rose-100" : "text-stone-500 dark:text-stone-400"}`}>
              B.A., B.Sc., B.Com., BCA, BBA & M.Sc. in Autonomous collegiate institutions (e.g. Loyola, Madras Christian College).
            </p>
          </button>

          <button
            type="button"
            onClick={() => setStreamFilter("ENGINEERING")}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
              streamFilter === "ENGINEERING"
                ? "bg-[#86192c] text-white border-[#86192c] shadow-sm"
                : "bg-white dark:bg-[#191c20] text-stone-800 dark:text-stone-200 border-[#e6dfd3] dark:border-[#2f343d] hover:border-stone-400"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-serif font-bold text-base">Engineering & Tech</span>
              <span className={`text-[11px] font-mono px-2 py-0.5 rounded ${streamFilter === "ENGINEERING" ? "bg-white/20 text-white" : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400"}`}>
                DOTE / AICTE
              </span>
            </div>
            <p className={`text-xs leading-relaxed ${streamFilter === "ENGINEERING" ? "text-rose-100" : "text-stone-500 dark:text-stone-400"}`}>
              B.E. & B.Tech. in AICTE-approved Autonomous Engineering institutions (e.g. PSG Tech, CIT) under TNEA counselling.
            </p>
          </button>
        </div>
      </section>

      {/* Category Index Navigation Pills */}
      <section className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 block">
          Editorial Subject Index
        </span>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCategoryFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                categoryFilter === tab.id
                  ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 font-semibold"
                  : "bg-white dark:bg-[#191c20] text-stone-700 dark:text-stone-300 border border-[#e6dfd3] dark:border-[#2f343d] hover:bg-stone-100 dark:hover:bg-stone-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* Search & Intelligence Filters */}
      <section className="bg-white dark:bg-[#191c20] p-4 sm:p-5 rounded-xl border border-[#e6dfd3] dark:border-[#2f343d] shadow-xs">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by scheme title, authority, or dossier number (e.g., 'BC/MBC', 'First Graduate', '№ TN-DCE')..."
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-[#e6dfd3] dark:border-[#2f343d] text-sm bg-[#fbf9f5] dark:bg-[#121417] text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#86192c] dark:focus:ring-[#fb7185]"
            />
            <svg className="w-4 h-4 text-stone-400 absolute left-3 top-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={eligibilityFilter}
              onChange={(e) => setEligibilityFilter(e.target.value)}
              className="px-3 py-2.5 rounded-lg border border-[#e6dfd3] dark:border-[#2f343d] text-xs font-semibold bg-[#fbf9f5] dark:bg-[#121417] text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-[#86192c]"
            >
              <option value="all">All Eligibility Categories</option>
              <option value="LIKELY_ELIGIBLE">✓ Likely Eligible (Full Match)</option>
              <option value="POTENTIALLY_ELIGIBLE">⚠ Potentially Eligible (Info/Docs Needed)</option>
              <option value="WINDOW_NEEDS_VERIFICATION">⏳ Window / Cycle Verification</option>
              <option value="CURRENTLY_INELIGIBLE">✕ Currently Ineligible</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2.5 rounded-lg border border-[#e6dfd3] dark:border-[#2f343d] text-xs font-semibold bg-[#fbf9f5] dark:bg-[#121417] text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-[#86192c]"
            >
              <option value="recommended">Sort: Recommended Priority</option>
              <option value="amount_high">Sort: Maximum Assistance</option>
              <option value="deadline">Sort: Application Window</option>
            </select>

            <button
              type="submit"
              className="px-4 py-2.5 bg-[#86192c] hover:bg-[#9f1239] text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              Search
            </button>
          </div>
        </form>
      </section>

      {/* Main Intelligence Results List */}
      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-[#e6dfd3] dark:border-[#2f343d] pb-2 text-xs font-mono text-stone-500 dark:text-stone-400">
          <span>CATALOGUE DOSSIERS ({scholarships.length} RESULTS)</span>
          <span>INSTITUTIONAL INTELLIGENCE DISPATCH</span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[30vh] space-y-3">
            <div className="w-8 h-8 border-2 border-[#86192c] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-stone-500 dark:text-stone-400 font-serif italic">
              Scanning verified statutory scholarship gazettes against your academic profile...
            </p>
          </div>
        ) : error ? (
          <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 p-6 rounded-xl text-center text-rose-800 dark:text-rose-200 text-sm">
            <p className="font-semibold">{error}</p>
            <button
              onClick={() => loadScholarships()}
              className="mt-3 px-4 py-1.5 bg-[#86192c] text-white rounded text-xs font-semibold cursor-pointer"
            >
              Retry Retrieval
            </button>
          </div>
        ) : scholarships.length === 0 ? (
          <div className="bg-white dark:bg-[#191c20] rounded-xl border border-[#e6dfd3] dark:border-[#2f343d] p-8 sm:p-12 text-center max-w-2xl mx-auto space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-[#f5f1e8] dark:bg-[#22262c] flex items-center justify-center text-stone-500">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="space-y-1">
              <h3 className="font-serif text-lg font-bold text-stone-900 dark:text-stone-100">
                No Verified Scholarships Currently Available
              </h3>
              <p className="text-xs text-stone-600 dark:text-stone-400 font-serif leading-relaxed">
                In strict compliance with our platform integrity principles, retired demonstration scholarships are completely excluded from student discovery. Only authoritative, officially verified scholarship schemes are displayed.
              </p>
            </div>

            <div className="p-3.5 bg-[#fbf9f5] dark:bg-[#121417] rounded-lg border border-[#e6dfd3] dark:border-[#2f343d] text-left text-xs space-y-2">
              <span className="font-semibold text-stone-800 dark:text-stone-200 block text-[11px] uppercase tracking-wider">
                Official Primary Source Portals for Tamil Nadu:
              </span>
              <ul className="space-y-1 text-[11px] text-stone-600 dark:text-stone-400">
                <li>• <a href="https://tndce.tn.gov.in/Home/scholarship_cms" target="_blank" rel="noreferrer" className="underline hover:text-[#86192c]">Directorate of Collegiate Education (TNDCE)</a></li>
                <li>• <a href="https://sspdept.tnega.org/" target="_blank" rel="noreferrer" className="underline hover:text-[#86192c]">Tamil Nadu State Scholarship Portal (SSP / UMIS)</a></li>
                <li>• <a href="https://bcmbcmw.tn.gov.in/welfschemes.htm" target="_blank" rel="noreferrer" className="underline hover:text-[#86192c]">BC, MBC & Minorities Welfare Department</a></li>
                <li>• <a href="https://scholarships.gov.in/All-Scholarships" target="_blank" rel="noreferrer" className="underline hover:text-[#86192c]">National Scholarship Portal (Central Schemes)</a></li>
              </ul>
            </div>

            <button
              onClick={resetFilters}
              className="px-4 py-2 bg-[#86192c] text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {scholarships.map((s, index) => (
              <article
                key={s.id}
                className="bg-white dark:bg-[#191c20] rounded-xl border border-[#e6dfd3] dark:border-[#2f343d] p-6 sm:p-7 shadow-xs hover:border-stone-400 dark:hover:border-stone-600 transition-all"
              >
                {/* Dossier Header Strip */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#f0eae0] dark:border-[#242830] text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-[#86192c] dark:text-[#fb7185] bg-[#fff1f2] dark:bg-rose-950/40 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-900/50">
                      {s.dossier_index || `№ TN-${index + 1}`}
                    </span>
                    <span className="text-stone-400">•</span>
                    <span className="font-serif italic text-stone-600 dark:text-stone-300">
                      {s.academic_year || "Academic Year 2024–2026"}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {getRecommendationBadge(s.recommendation_category)}
                    {getVerificationBadge(s.source_verification_status || s.verification_status)}
                    <span className="text-[11px] font-mono text-stone-500 dark:text-stone-400">
                      Cycle: {s.application_window_status || "Annual Cycle"}
                    </span>
                  </div>
                </div>

                {/* Main Content Area */}
                <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Column: Scheme Title & Details (8 Cols) */}
                  <div className="lg:col-span-8 space-y-3">
                    <div>
                      <p className="text-[11px] font-mono uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">
                        Awarding Authority: <strong className="font-semibold text-stone-800 dark:text-stone-200">{s.provider}</strong>
                      </p>
                      <h2 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100 hover:text-[#86192c] dark:hover:text-[#fb7185] transition-colors">
                        <Link href={`/discover/${s.id}`}>{s.name}</Link>
                      </h2>
                    </div>

                    {/* Stream & Category Badges */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 font-mono text-[11px] font-semibold">
                        Stream: {s.stream === "BOTH" ? "Arts & Science and Engineering" : s.stream}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 font-mono text-[11px]">
                        Level: {s.study_level || "Undergraduate / Postgraduate"}
                      </span>
                      {s.tn_residency_required && (
                        <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40 text-[10px] font-semibold">
                          TN Domicile Mandatory
                        </span>
                      )}
                    </div>

                    <p className="text-xs sm:text-sm text-stone-700 dark:text-stone-300 leading-relaxed font-serif">
                      {s.description}
                    </p>

                    {/* Autonomous College Policy Note */}
                    {s.autonomous_compatibility && (
                      <div className="p-3 rounded-lg bg-[#fbf9f5] dark:bg-[#121417] border border-[#e6dfd3] dark:border-[#2f343d] text-xs space-y-1">
                        <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-stone-500 dark:text-stone-400 block">
                          Autonomous College Coverage Rule:
                        </span>
                        <p className="text-stone-800 dark:text-stone-200 leading-relaxed">
                          {s.autonomous_compatibility}
                        </p>
                      </div>
                    )}

                    {/* Transparent Eligibility Evaluation */}
                    {getMatchSeal(s.match_status, s.disqualification_reasons)}
                  </div>

                  {/* Right Column: Financial Support, Official Portal & Action (4 Cols) */}
                  <div className="lg:col-span-4 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-[#f0eae0] dark:border-[#242830] pt-4 lg:pt-0 lg:pl-6 space-y-4">
                    <div>
                      <span className="text-[11px] font-mono uppercase tracking-wider text-stone-500 dark:text-stone-400 block mb-1">
                        Statutory Assistance
                      </span>
                      <div className="font-serif text-2xl font-bold text-[#86192c] dark:text-[#fb7185]">
                        {formatINR(s.amount)}
                      </div>
                      <p className="text-xs font-serif italic text-stone-600 dark:text-stone-400 mt-1">
                        {s.award_display || `${s.award_type || "Financial Assistance"} per annum`}
                      </p>
                    </div>

                    {s.income_criteria_raw && (
                      <div className="text-xs text-stone-600 dark:text-stone-400 bg-stone-50 dark:bg-stone-900/60 p-2.5 rounded border border-stone-200 dark:border-stone-800">
                        <span className="font-semibold text-stone-800 dark:text-stone-200 block text-[11px]">Income Rule:</span>
                        <span className="text-[11px] leading-tight block mt-0.5">{s.income_criteria_raw}</span>
                      </div>
                    )}

                    <div className="space-y-2 pt-2 border-t border-[#f0eae0] dark:border-[#242830]">
                      <div className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center justify-between">
                        <span>Official Portal:</span>
                        <span className="font-medium text-stone-700 dark:text-stone-300 truncate max-w-[150px]">
                          {s.official_portal_name || "Official Dept Portal"}
                        </span>
                      </div>

                      <div className="flex flex-col gap-2 pt-2">
                        <Link
                          href={`/discover/${s.id}`}
                          className="w-full text-center px-4 py-2.5 bg-[#86192c] hover:bg-[#9f1239] text-white rounded-lg text-xs font-semibold tracking-wide transition-colors cursor-pointer shadow-xs"
                        >
                          Inspect Research Dossier →
                        </Link>
                        {s.official_guideline_url && (
                          <a
                            href={s.official_guideline_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-center text-[11px] text-stone-600 dark:text-stone-400 hover:text-[#86192c] dark:hover:text-[#fb7185] underline"
                          >
                            Read Official Gazette Directive ↗
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
