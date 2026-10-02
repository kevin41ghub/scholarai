"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCurrentStudent, getPortfolioSummary, formatINR } from "@/lib/api";
import { StudentDetail, PortfolioSummary } from "@/types/student";
import MetricCard from "@/components/MetricCard";
import FundingProgressBar from "@/components/FundingProgressBar";

export default function Dashboard() {
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [studentData, portfolioData] = await Promise.all([
        getCurrentStudent(),
        getPortfolioSummary(),
      ]);
      setStudent(studentData);
      setPortfolio(portfolioData);
    } catch (err: any) {
      setError(err?.message || "Failed to connect to SCHOLARAi backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-slate-500 font-medium">Loading SCHOLARAi Intelligence Portal...</p>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="max-w-2xl mx-auto my-12 bg-white rounded-xl border border-red-200 p-8 shadow-sm text-center">
        <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-slate-900">Backend Communication Notice</h2>
        <p className="text-sm text-slate-600 mt-2">{error || "Could not retrieve student profile."}</p>
        <button
          onClick={loadData}
          className="mt-6 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const { profile, funding_profile } = student;
  const annualCost = funding_profile?.annual_education_cost || 0;
  const existingSupport = funding_profile?.existing_support || 0;
  const fundingGap = funding_profile?.funding_gap || 0;
  const progressPct = funding_profile?.funding_progress_percentage || 0;

  const sharedBlocker = portfolio?.primary_shared_blocker;
  const topAction = portfolio?.top_next_best_action;

  return (
    <div className="space-y-8 pb-12">
      {/* Top Banner / Welcome & Trust Principle */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold">
              <span>Block 2 Core Product</span>
              <span>&bull;</span>
              <span>Active</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
              Welcome back, {student.name}
            </h1>
            <p className="text-sm text-slate-600 max-w-2xl">
              Student Funding & Application Intelligence &bull; Connecting funding needs, scholarship rules, application states, and next best actions.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/discover"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
            >
              Discover Scholarships
            </Link>
            <Link
              href="/profile"
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
            >
              Profile
            </Link>
          </div>
        </div>

        {/* Core Trust Statement Box */}
        <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start space-x-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div className="text-xs space-y-1">
            <p className="font-semibold text-slate-900 uppercase tracking-wide">
              Trust Principle: &ldquo;AI assists. Official sources decide. Student approves.&rdquo;
            </p>
            <p className="text-slate-600">
              SCHOLARAi coordinates scholarship discovery, deadlines, and documentation. Final eligibility and awards are decided solely by official awarding bodies. Never guarantee eligibility or awards.
            </p>
          </div>
        </div>
      </div>

      {/* 1. FUNDING NEED OVERVIEW */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Funding Need Overview</h2>
            <p className="text-xs text-slate-500">Live breakdown of educational expenses, confirmed aid, and remaining funding gap</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Annual Education Cost"
            value={formatINR(annualCost)}
            subtitle="Tuition, fees & living expenses"
            badge={{ text: "Target Need", variant: "neutral" }}
          />
          <MetricCard
            title="Existing Support"
            value={formatINR(existingSupport)}
            subtitle="Confirmed institutional aid & scholarships"
            badge={{ text: "Secured", variant: "success" }}
          />
          <MetricCard
            title="Remaining Funding Gap"
            value={formatINR(fundingGap)}
            subtitle="Calculated: max(0, Cost - Support)"
            badge={{ text: fundingGap > 0 ? "Action Required" : "Fully Funded", variant: fundingGap > 0 ? "warning" : "success" }}
          />
          <MetricCard
            title="Pursuit Target"
            value={formatINR(portfolio?.potential_funding_under_pursuit || 0)}
            subtitle="Across active scholarship applications"
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

      {/* 2. APPLICATION PORTFOLIO OVERVIEW */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Application Portfolio</h2>
            <p className="text-xs text-slate-500">Current active applications and pipeline status</p>
          </div>
          <Link href="/applications" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
            View All Applications &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div className="p-3 bg-slate-50 rounded-lg">
            <span className="text-xs text-slate-500 block">Active Applications</span>
            <span className="text-2xl font-bold text-slate-900">{portfolio?.active_applications_count || 0}</span>
          </div>
          <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-lg">
            <span className="text-xs text-amber-700 block">At Deadline Risk</span>
            <span className="text-2xl font-bold text-amber-800">{portfolio?.at_risk_count || 0}</span>
          </div>
          <div className="p-3 bg-rose-50/70 border border-rose-100 rounded-lg">
            <span className="text-xs text-rose-700 block">Blocked by Docs</span>
            <span className="text-2xl font-bold text-rose-800">{portfolio?.blocked_count || 0}</span>
          </div>
          <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-lg">
            <span className="text-xs text-indigo-700 block">Funding Under Pursuit</span>
            <span className="text-2xl font-bold text-indigo-900">{formatINR(portfolio?.potential_funding_under_pursuit || 0)}</span>
          </div>
        </div>
      </div>

      {/* 3. SHARED BLOCKER HIGHLIGHT */}
      {sharedBlocker && sharedBlocker.blocked_applications_count > 0 && (
        <div className="bg-amber-50/90 border border-amber-300 rounded-xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-lg bg-amber-200 text-amber-900 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <div className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900 uppercase tracking-wider mb-1">
                  Shared Blocker Detected
                </div>
                <h3 className="text-base font-bold text-amber-950">
                  {sharedBlocker.document_name}
                </h3>
                <p className="text-xs text-amber-800 mt-0.5">
                  Currently missing and blocking <span className="font-bold">{sharedBlocker.blocked_applications_count} active applications</span> ({sharedBlocker.affected_applications.map(a => a.scholarship_name).join(", ")}).
                </p>
                <p className="text-xs font-semibold text-amber-900 mt-1">
                  Potential Funding Affected: {formatINR(sharedBlocker.potential_funding_affected)}
                </p>
              </div>
            </div>
            <Link
              href="/documents"
              className="px-4 py-2.5 bg-amber-700 text-white rounded-lg text-xs font-semibold hover:bg-amber-800 transition-colors shadow-sm self-start sm:self-auto flex items-center space-x-1"
            >
              <span>Manage in Documents</span>
              <span>&rarr;</span>
            </Link>
          </div>
        </div>
      )}

      {/* 4. NEXT BEST ACTION & UPCOMING DEADLINES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Next Best Action Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-ping"></span>
                <h2 className="text-base font-semibold text-slate-900">Next Best Action</h2>
              </div>
              {topAction && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  topAction.urgency === "URGENT" ? "bg-red-100 text-red-800 border border-red-200" :
                  topAction.urgency === "HIGH" ? "bg-amber-100 text-amber-800 border border-amber-200" :
                  "bg-indigo-100 text-indigo-800 border border-indigo-200"
                }`}>
                  {topAction.urgency} Urgency
                </span>
              )}
            </div>

            {topAction ? (
              <div className="space-y-3">
                <h3 className="text-base font-bold text-slate-900">{topAction.title}</h3>
                <p className="text-xs text-slate-600">{topAction.reason}</p>

                <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                  <div className="p-2.5 bg-slate-50 rounded-lg">
                    <span className="text-slate-500 block">Estimated Effort</span>
                    <span className="font-semibold text-slate-800">{topAction.effort_estimate}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg">
                    <span className="text-slate-500 block">Funding Impact</span>
                    <span className="font-semibold text-indigo-700">{formatINR(topAction.potential_funding_impact)}</span>
                  </div>
                </div>

                {topAction.blocker_impact && (
                  <p className="text-xs text-amber-700 font-medium">
                    &bull; {topAction.blocker_impact}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500">No immediate pending actions. Great job!</p>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            {topAction?.target_type === "document" ? (
              <Link
                href="/documents"
                className="w-full py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center space-x-1"
              >
                <span>Take Action in Documents</span>
                <span>&rarr;</span>
              </Link>
            ) : (
              <Link
                href="/applications"
                className="w-full py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center space-x-1"
              >
                <span>View Application</span>
                <span>&rarr;</span>
              </Link>
            )}
            <p className="text-[11px] text-slate-400 text-center mt-2 italic">
              Recommended next action based on your current profile and application state.
            </p>
          </div>
        </div>

        {/* Upcoming Deadlines */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h2 className="text-base font-semibold text-slate-900">Upcoming Deadlines</h2>
              <Link href="/applications" className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                View All &rarr;
              </Link>
            </div>

            <div className="space-y-3">
              {portfolio?.upcoming_deadlines && portfolio.upcoming_deadlines.length > 0 ? (
                portfolio.upcoming_deadlines.map((item) => (
                  <div key={item.application_id} className="p-3 rounded-lg border border-slate-100 hover:bg-slate-50 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{item.scholarship_name}</h4>
                      <div className="flex items-center space-x-2 mt-0.5 text-[11px] text-slate-500">
                        <span>{formatINR(item.amount)}</span>
                        <span>&bull;</span>
                        <span>{item.progress.toFixed(0)}% ready</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.risk_level === "URGENT" ? "bg-red-100 text-red-800 border border-red-200" :
                        item.risk_level === "HIGH" ? "bg-amber-100 text-amber-800 border border-amber-200" :
                        "bg-slate-100 text-slate-700"
                      }`}>
                        {item.days_remaining}d left
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500">No active applications with upcoming deadlines.</p>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <Link
              href="/goal"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center justify-center space-x-1"
            >
              <span>Review Weekly Plan & Strategy</span>
              <span>&rarr;</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
