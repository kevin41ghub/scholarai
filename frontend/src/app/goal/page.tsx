"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getPlanner, updatePlanner, formatINR } from "@/lib/api";
import { PlannerOverview } from "@/types/student";

export default function MyGoalPage() {
  const [planner, setPlanner] = useState<PlannerOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form inputs
  const [hoursPerWeek, setHoursPerWeek] = useState<number>(5.0);
  const [targetFunding, setTargetFunding] = useState<number>(60000.0);
  const [purpose, setPurpose] = useState<string>("Tuition & Academic Lab Equipment");
  const [timeline, setTimeline] = useState<string>("Current Academic Year (2026-2027)");
  const [priorities, setPriorities] = useState<string>("High-impact & Deadline-urgent");

  const loadPlanner = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getPlanner();
      setPlanner(data);
      setHoursPerWeek(data.goal_preferences.available_hours_per_week);
      setTargetFunding(data.funding_overview.target_funding);
      setPurpose(data.goal_preferences.purpose);
      setTimeline(data.goal_preferences.timeline);
      setPriorities(data.goal_preferences.priorities);
    } catch (err: unknown) {
      setError((err as Error)?.message || "Failed to load funding planner.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadPlanner();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadPlanner]);

  const handleUpdateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setSuccessToast(null);
      const updated = await updatePlanner({
        available_hours_per_week: hoursPerWeek,
        target_funding: targetFunding,
        purpose,
        timeline,
        priorities,
      });
      setPlanner(updated);
      setSuccessToast("Goal preferences updated and weekly plan re-allocated!");
    } catch (err: unknown) {
      setError((err as Error)?.message || "Failed to update goal settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Computing funding strategy and weekly effort allocation...</p>
      </div>
    );
  }

  if (error || !planner) {
    return (
      <div className="max-w-xl mx-auto my-12 bg-white dark:bg-slate-900 rounded-xl border border-rose-500/20 p-8 text-center">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Planner Unavailable</h2>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">{error || "Could not retrieve planner data."}</p>
        <button onClick={() => loadPlanner()} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold">Retry</button>
      </div>
    );
  }

  const funding = planner.funding_overview;
  const weeklyPlan = planner.suggested_weekly_plan;
  const strategy = planner.funding_strategy;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-xs transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 mb-1.5">
              <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Dashboard</Link>
              <span>/</span>
              <span className="text-slate-800 dark:text-slate-200 font-medium">Goal & Strategy Planner</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Goal & Funding Strategy Planner
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl mt-1.5 leading-relaxed">
              Target educational coverage goals, allocate weekly preparation hours, and pursue multi-scholarship portfolios compliantly.
            </p>
          </div>
          <div className="p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-800 dark:text-blue-300 max-w-sm">
            <span className="font-bold block mb-1">Trust Principle</span>
            &ldquo;AI assists. Official sources decide. Student approves.&rdquo; All final award decisions depend strictly on official portal requirements.
          </div>
        </div>
      </div>

      {successToast && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs font-semibold rounded-xl flex items-center justify-between shadow-2xs">
          <span>✓ {successToast}</span>
          <button onClick={() => setSuccessToast(null)} className="text-emerald-700 dark:text-emerald-400 font-bold ml-2 text-sm">&times;</button>
        </div>
      )}

      {/* 1. FUNDING OVERVIEW METRIC CARDS */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
          Funding Target vs. Pipeline Analysis
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase font-bold tracking-wider">Annual Cost</span>
            <span className="text-base font-bold font-mono text-slate-900 dark:text-white mt-1 block">{formatINR(funding.annual_education_cost)}</span>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase font-bold tracking-wider">Existing Aid</span>
            <span className="text-base font-bold font-mono text-slate-900 dark:text-white mt-1 block">{formatINR(funding.existing_support)}</span>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-amber-500/30 shadow-xs">
            <span className="text-[10px] text-amber-700 dark:text-amber-400 block uppercase font-bold tracking-wider">Funding Gap</span>
            <span className="text-base font-bold font-mono text-amber-700 dark:text-amber-400 mt-1 block">{formatINR(funding.funding_gap)}</span>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-blue-500/30 shadow-xs">
            <span className="text-[10px] text-blue-700 dark:text-blue-400 block uppercase font-bold tracking-wider">Target Goal</span>
            <span className="text-base font-bold font-mono text-blue-800 dark:text-blue-300 mt-1 block">{formatINR(funding.target_funding)}</span>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase font-bold tracking-wider">Pipeline Identified</span>
            <span className="text-base font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-1 block">{formatINR(funding.potential_funding_identified)}</span>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase font-bold tracking-wider">Remaining Gap</span>
            <span className="text-base font-bold font-mono text-slate-900 dark:text-white mt-1 block">{formatINR(funding.potential_remaining_gap)}</span>
          </div>
        </div>
      </div>

      {/* 2. TIME-CONSTRAINED PORTFOLIO PLANNER */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-6 transition-colors">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Suggested Weekly Preparation Plan</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Heuristic effort allocation prioritizing deadline proximity and shared document blockers</p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
            {weeklyPlan.total_hours} Hours Allocated / Week
          </span>
        </div>

        {/* Weekly Task Allocation Breakdown */}
        <div className="space-y-3">
          {weeklyPlan.allocations.map((alloc, idx) => (
            <div key={idx} className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <span className="font-bold text-slate-900 dark:text-white text-sm block">{alloc.task}</span>
                <p className="text-slate-600 dark:text-slate-400">{alloc.reason}</p>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold">{alloc.category}</span>
              </div>
              <div className="text-right flex-shrink-0">
                <span className="text-base font-extrabold font-mono text-blue-700 dark:text-blue-400 block">{alloc.allocated_hours} hrs</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">allocated time</span>
              </div>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">
          {weeklyPlan.methodology_disclaimer}
        </p>

        {/* Update Weekly Hours Form */}
        <form onSubmit={handleUpdateGoal} className="pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Available Hours / Week
            </label>
            <input
              type="number"
              step="0.5"
              min="1"
              max="40"
              value={hoursPerWeek}
              onChange={(e) => setHoursPerWeek(parseFloat(e.target.value) || 1)}
              className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Target Funding (₹)
            </label>
            <input
              type="number"
              step="1000"
              min="0"
              value={targetFunding}
              onChange={(e) => setTargetFunding(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Strategy Priority
            </label>
            <input
              type="text"
              value={priorities}
              onChange={(e) => setPriorities(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-2xs disabled:opacity-50"
          >
            {saving ? "Re-calculating..." : "Update Weekly Plan"}
          </button>
        </form>
      </div>

      {/* 3. MULTI-SCHOLARSHIP FUNDING STRATEGY & CONCURRENT AWARD RULES */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4 transition-colors">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Funding Strategy & Award Compliance</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Key distinctions between application submission, award notification, and concurrent holding</p>
        </div>

        {/* Warning Callout on Concurrent Awards */}
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1 text-amber-800 dark:text-amber-300">
          <span className="font-bold uppercase tracking-wider text-[10px] block">
            Concurrent Award Rule Notice: Needs Verification
          </span>
          <p className="leading-relaxed">
            {strategy.concurrent_award_rule}
          </p>
          <p className="text-[11px] text-amber-700 dark:text-amber-400 italic mt-1">
            Applying to multiple scholarships increases discovery probability, but official awarding guidelines determine whether multiple awards may be held simultaneously.
          </p>
        </div>

        {/* 3 Core Educational Distinctions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          {strategy.distinctions.map((d, i) => (
            <div key={i} className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
              <span className="font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wide block">{d.concept}</span>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{d.meaning}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
