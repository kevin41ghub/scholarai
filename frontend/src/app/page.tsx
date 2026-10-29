"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getCurrentStudent, getPortfolioSummary, formatINR } from "@/lib/api";
import { StudentDetail, PortfolioSummary } from "@/types/student";
import MetricCard from "@/components/MetricCard";
import FundingProgressBar from "@/components/FundingProgressBar";
import { useAuth } from "@/context/AuthContext";

export default function Dashboard() {
  const { displayName, student: authStudent } = useAuth();
  const [student, setStudent] = useState<StudentDetail | null>(authStudent);
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [studentData, portfolioData] = await Promise.all([
        getCurrentStudent(),
        getPortfolioSummary(),
      ]);
      setStudent(studentData);
      setPortfolio(portfolioData);
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

  return (
    <div className="space-y-6 pb-12">
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
                "Verified scholarship intelligence, deterministic eligibility scoring, and dependency risk management for autonomous college scholars."
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
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
              Browse Intelligence Catalogue
            </Link>
            <Link
              href="/evidence"
              className="px-3.5 py-2.5 bg-[#fbf9f5] dark:bg-[#121417] text-stone-800 dark:text-stone-200 border border-[#e6dfd3] dark:border-[#2f343d] rounded-xl text-xs font-semibold hover:border-stone-400 transition-colors"
            >
              Evidence Repository
            </Link>
          </div>
        </div>

        {/* Trust Principle Banner */}
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
              &ldquo;AI assists. Official sources decide. Student approves.&rdquo; SCHOLARAi organizes deadlines and evidence. Award decisions are determined exclusively by official statutory bodies.
            </span>
          </div>
        </div>
      </div>

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
