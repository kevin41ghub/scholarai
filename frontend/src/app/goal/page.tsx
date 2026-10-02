"use client";

import { useEffect, useState } from "react";
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

  const loadPlanner = async () => {
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
    } catch (err: any) {
      setError(err?.message || "Failed to load funding planner.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlanner();
  }, []);

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
    } catch (err: any) {
      setError(err?.message || "Failed to update goal settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-500 font-medium">Computing funding strategy and weekly effort allocation...</p>
      </div>
    );
  }

  if (error || !planner) {
    return (
      <div className="max-w-xl mx-auto my-12 bg-white rounded-xl border border-red-200 p-8 text-center">
        <h2 className="text-base font-bold text-slate-900">Planner Error</h2>
        <p className="text-xs text-slate-600 mt-2">{error || "Could not retrieve planner data."}</p>
        <button onClick={loadPlanner} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded text-xs">Retry</button>
      </div>
    );
  }

  const funding = planner.funding_overview;
  const weeklyPlan = planner.suggested_weekly_plan;
  const strategy = planner.funding_strategy;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs text-slate-500 mb-1">
              <Link href="/" className="hover:text-indigo-600 transition-colors">Dashboard</Link>
              <span>/</span>
              <span className="text-slate-800 font-medium">My Goal & Funding Strategy</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Goal & Funding Strategy</h1>
            <p className="text-sm text-slate-600 max-w-2xl mt-1">
              Set target goals, optimize weekly preparation hours, and structure a compliant multi-scholarship pursuit strategy.
            </p>
          </div>
          <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-900 max-w-xs">
            <span className="font-bold block mb-0.5">Trust Principle</span>
            &ldquo;AI assists. Official sources decide. Student approves.&rdquo; All award decisions depend on official awarding rules.
          </div>
        </div>
      </div>

      {successToast && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center justify-between">
          <span>✓ {successToast}</span>
          <button onClick={() => setSuccessToast(null)} className="text-emerald-700 font-bold ml-2">&times;</button>
        </div>
      )}

      {/* 1. FUNDING OVERVIEW METRIC CARDS */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-slate-900">Funding Target vs. Pipeline Analysis</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[11px] text-slate-500 block uppercase">Annual Cost</span>
            <span className="text-base font-bold text-slate-900">{formatINR(funding.annual_education_cost)}</span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[11px] text-slate-500 block uppercase">Existing Aid</span>
            <span className="text-base font-bold text-slate-900">{formatINR(funding.existing_support)}</span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[11px] text-amber-700 block uppercase font-bold">Funding Gap</span>
            <span className="text-base font-bold text-amber-800">{formatINR(funding.funding_gap)}</span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[11px] text-indigo-700 block uppercase font-bold">Target Funding</span>
            <span className="text-base font-bold text-indigo-900">{formatINR(funding.target_funding)}</span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[11px] text-slate-500 block uppercase">Identified in Pipeline</span>
            <span className="text-base font-bold text-emerald-700">{formatINR(funding.potential_funding_identified)}</span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[11px] text-slate-500 block uppercase">Potential Remaining</span>
            <span className="text-base font-bold text-slate-900">{formatINR(funding.potential_remaining_gap)}</span>
          </div>
        </div>
      </div>

      {/* 2. TIME-CONSTRAINED PORTFOLIO PLANNER */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
        <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Suggested Weekly Plan</h2>
            <p className="text-xs text-slate-500">Heuristic time allocation based on deadline urgency and shared blockers</p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            {weeklyPlan.total_hours} Hours Available This Week
          </span>
        </div>

        {/* Weekly Task Allocation Breakdown */}
        <div className="space-y-3">
          {weeklyPlan.allocations.map((alloc, idx) => (
            <div key={idx} className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <span className="font-bold text-slate-900 text-sm block">{alloc.task}</span>
                <p className="text-slate-600">{alloc.reason}</p>
                <span className="text-[10px] text-slate-400 uppercase font-medium">{alloc.category}</span>
              </div>
              <div className="text-right flex-shrink-0">
                <span className="text-base font-extrabold text-indigo-700 block">{alloc.allocated_hours} hrs</span>
                <span className="text-[10px] text-slate-400">allocated time</span>
              </div>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-slate-400 italic">
          {weeklyPlan.methodology_disclaimer}
        </p>

        {/* Update Weekly Hours Form */}
        <form onSubmit={handleUpdateGoal} className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Available Hours / Week
            </label>
            <input
              type="number"
              step="0.5"
              min="1"
              max="40"
              value={hoursPerWeek}
              onChange={(e) => setHoursPerWeek(parseFloat(e.target.value) || 1)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Target Funding (₹)
            </label>
            <input
              type="number"
              step="1000"
              min="0"
              value={targetFunding}
              onChange={(e) => setTargetFunding(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Strategy Priority
            </label>
            <input
              type="text"
              value={priorities}
              onChange={(e) => setPriorities(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
          >
            {saving ? "Re-calculating..." : "Update Weekly Plan"}
          </button>
        </form>
      </div>

      {/* 3. MULTI-SCHOLARSHIP FUNDING STRATEGY & CONCURRENT AWARD RULES */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-900">Funding Strategy & Award Compliance</h2>
          <p className="text-xs text-slate-500">Crucial distinctions between application, award, and concurrent holding</p>
        </div>

        {/* Warning Callout on Concurrent Awards */}
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs space-y-1 text-amber-900">
          <span className="font-bold uppercase tracking-wider text-[11px] block">
            Concurrent Award Rule Notice: Needs Verification
          </span>
          <p className="leading-relaxed">
            {strategy.concurrent_award_rule}
          </p>
          <p className="text-[11px] text-amber-800 italic mt-1">
            Applying to multiple scholarships increases discovery probability, but official awarding guidelines determine whether multiple awards may be held simultaneously.
          </p>
        </div>

        {/* 3 Core Educational Distinctions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          {strategy.distinctions.map((d, i) => (
            <div key={i} className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
              <span className="font-bold text-indigo-700 uppercase tracking-wide block">{d.concept}</span>
              <p className="text-slate-600 leading-relaxed">{d.meaning}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
