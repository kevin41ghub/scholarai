"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getScholarshipDetail, applyToScholarship, formatINR } from "@/lib/api";
import { ScholarshipDetail } from "@/types/student";

export default function ScholarshipDetailPage() {
  const params = useParams();
  const id = Number(params.id);

  const [scholarship, setScholarship] = useState<ScholarshipDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getScholarshipDetail(id);
      setScholarship(data);
    } catch (err: unknown) {
      setError((err as Error)?.message || "Failed to load scholarship details.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      const timer = setTimeout(() => {
        loadDetail();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [id, loadDetail]);

  const handleStartApplication = async () => {
    try {
      setApplying(true);
      setApplyMessage(null);
      const res = await applyToScholarship(id);
      setApplyMessage(res.message);
      await loadDetail();
    } catch (err: unknown) {
      setError((err as Error)?.message || "Failed to start application.");
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Evaluating scheme details and funding impact...</p>
      </div>
    );
  }

  if (error || !scholarship) {
    return (
      <div className="max-w-xl mx-auto my-12 bg-white dark:bg-slate-900 rounded-xl border border-rose-500/20 p-8 text-center">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Scholarship Not Found</h2>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">{error || "Could not retrieve scheme details."}</p>
        <Link href="/discover" className="mt-4 inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold">
          &larr; Back to Discover
        </Link>
      </div>
    );
  }

  const impact = scholarship.funding_impact;
  const elig = scholarship.eligibility;
  const isApplied = scholarship.current_application !== null && scholarship.current_application !== undefined;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Navigation breadcrumb */}
      <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400">
        <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Dashboard</Link>
        <span>/</span>
        <Link href="/discover" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Discover</Link>
        <span>/</span>
        <span className="text-slate-800 dark:text-slate-200 font-medium truncate">{scholarship.name}</span>
      </div>

      {applyMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-sm flex items-center justify-between">
          <span className="font-medium">{applyMessage}</span>
          <Link href="/applications" className="underline text-xs font-bold text-emerald-700 dark:text-emerald-400">
            View in Applications &rarr;
          </Link>
        </div>
      )}

      {/* Main Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-xs transition-colors">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {scholarship.provider}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                {scholarship.verification_status}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {scholarship.name}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
              {scholarship.description}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <div className="text-right">
              <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">Award Amount</span>
              <span className="text-3xl font-bold font-mono text-blue-700 dark:text-blue-400">{formatINR(scholarship.amount)}</span>
            </div>

            {isApplied ? (
              <div className="mt-2 text-right">
                <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 inline-block">
                  Application In Progress ({scholarship.current_application?.progress.toFixed(0)}%)
                </span>
                <Link
                  href="/applications"
                  className="block text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold mt-1.5"
                >
                  Manage Application &rarr;
                </Link>
              </div>
            ) : (
              <button
                onClick={handleStartApplication}
                disabled={applying}
                className="mt-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors shadow-2xs"
              >
                {applying ? "Initiating Application..." : "Start Application"}
              </button>
            )}
          </div>
        </div>

        {/* Scheme Info Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div>
            <span className="text-slate-400 dark:text-slate-500 block">Deadline</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {new Date(scholarship.deadline).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
            </span>
          </div>
          <div>
            <span className="text-slate-400 dark:text-slate-500 block">Deadline Urgency</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {scholarship.deadline_risk?.risk_level || "MEDIUM"} ({scholarship.deadline_risk?.days_remaining}d remaining)
            </span>
          </div>
          <div>
            <span className="text-slate-400 dark:text-slate-500 block">Application Effort</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{scholarship.application_effort || "Medium"}</span>
          </div>
          <div>
            <span className="text-slate-400 dark:text-slate-500 block">Source Provider</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{scholarship.source_name || "Official Portal"}</span>
          </div>
        </div>
      </div>

      {/* POTENTIAL FUNDING IMPACT SECTION */}
      {impact && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-blue-500/20 p-6 shadow-xs space-y-4 transition-colors">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Potential Funding Impact</h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
                Covers ~{impact.gap_coverage_percentage.toFixed(0)}% of Funding Gap
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Simulated scenario demonstrating how this award would bridge your current educational funding gap.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">Current Funding Gap</span>
              <span className="text-xl font-bold font-mono text-slate-900 dark:text-white">{formatINR(impact.current_funding_gap)}</span>
            </div>
            <div className="p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <span className="text-xs text-blue-700 dark:text-blue-400 block font-medium">Scholarship Award</span>
              <span className="text-xl font-bold font-mono text-blue-800 dark:text-blue-300">{formatINR(impact.scholarship_amount)}</span>
            </div>
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <span className="text-xs text-emerald-700 dark:text-emerald-400 block font-medium">Potential Remaining Gap</span>
              <span className="text-xl font-bold font-mono text-emerald-800 dark:text-emerald-300">{formatINR(impact.potential_remaining_gap)}</span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 text-[11px] italic">
            {impact.disclaimer}
          </div>
        </div>
      )}

      {/* DETERMINISTIC ELIGIBILITY SECTION */}
      {elig && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4 transition-colors">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Deterministic Eligibility Rules</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Computed against your active student profile metrics</p>
            </div>
            <div>
              {elig.status === "eligible" && (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  Likely Eligible
                </span>
              )}
              {elig.status === "needs_verification" && (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                  Needs Verification
                </span>
              )}
              {elig.status === "ineligible" && (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
                  Ineligible
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2 text-xs">
            {elig.reasons.map((r, i) => (
              <div key={i} className="flex items-start space-x-2.5 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <span className={`font-bold mt-0.5 ${elig.status === "ineligible" ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                  {elig.status === "ineligible" ? "✗" : "✓"}
                </span>
                <span className="text-slate-700 dark:text-slate-300">{r}</span>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">
            Trust principle: &ldquo;AI assists. Official sources decide. Student approves.&rdquo; All eligibility classifications are advisory.
          </p>
        </div>
      )}

      {/* REQUIRED DOCUMENTS SECTION */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4 transition-colors">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Required Application Documents</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Credentials needed for formal scheme submission</p>
        </div>

        <div className="space-y-2.5">
          {scholarship.requirements && scholarship.requirements.length > 0 ? (
            scholarship.requirements.map((req) => (
              <div key={req.id} className="p-3.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-slate-900 dark:text-white block">{req.name}</span>
                  <span className="text-slate-400 dark:text-slate-500 text-[11px]">Type: {req.type} &bull; {req.document_type}</span>
                </div>
                <span className="px-2.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  {req.is_required ? "Required" : "Optional"}
                </span>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">No specific documents specified in this scheme listing.</p>
          )}
        </div>
      </div>
    </div>
  );
}
