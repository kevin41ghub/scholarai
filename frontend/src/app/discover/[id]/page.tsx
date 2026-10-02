"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getScholarshipDetail, applyToScholarship, formatINR } from "@/lib/api";
import { ScholarshipDetail } from "@/types/student";

export default function ScholarshipDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);

  const [scholarship, setScholarship] = useState<ScholarshipDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getScholarshipDetail(id);
      setScholarship(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load scholarship details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadDetail();
    }
  }, [id]);

  const handleStartApplication = async () => {
    try {
      setApplying(true);
      setApplyMessage(null);
      const res = await applyToScholarship(id);
      setApplyMessage(res.message);
      // Reload detail to reflect applied status
      await loadDetail();
    } catch (err: any) {
      setError(err?.message || "Failed to start application.");
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-500 font-medium">Evaluating scheme details and funding impact...</p>
      </div>
    );
  }

  if (error || !scholarship) {
    return (
      <div className="max-w-xl mx-auto my-12 bg-white rounded-xl border border-red-200 p-8 text-center">
        <h2 className="text-base font-bold text-slate-900">Scholarship Not Found</h2>
        <p className="text-xs text-slate-600 mt-2">{error || "Could not retrieve scheme details."}</p>
        <Link href="/discover" className="mt-4 inline-block px-4 py-2 bg-indigo-600 text-white rounded text-xs">
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
      <div className="flex items-center space-x-2 text-xs text-slate-500">
        <Link href="/" className="hover:text-indigo-600 transition-colors">Dashboard</Link>
        <span>/</span>
        <Link href="/discover" className="hover:text-indigo-600 transition-colors">Discover</Link>
        <span>/</span>
        <span className="text-slate-800 font-medium truncate">{scholarship.name}</span>
      </div>

      {applyMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between">
          <span className="font-medium">{applyMessage}</span>
          <Link href="/applications" className="underline text-xs font-bold">
            View in Applications &rarr;
          </Link>
        </div>
      )}

      {/* Main Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {scholarship.provider}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                {scholarship.verification_status}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
              {scholarship.name}
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">
              {scholarship.description}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <div className="text-right">
              <span className="text-xs text-slate-500 block">Award Amount</span>
              <span className="text-3xl font-extrabold text-indigo-700">{formatINR(scholarship.amount)}</span>
            </div>

            {isApplied ? (
              <div className="mt-2 text-right">
                <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 inline-block">
                  Application In Progress ({scholarship.current_application?.progress.toFixed(0)}%)
                </span>
                <Link
                  href="/applications"
                  className="block text-xs text-indigo-600 hover:text-indigo-800 font-semibold mt-1"
                >
                  Manage Application &rarr;
                </Link>
              </div>
            ) : (
              <button
                onClick={handleStartApplication}
                disabled={applying}
                className="mt-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                {applying ? "Starting..." : "Start Application"}
              </button>
            )}
          </div>
        </div>

        {/* Scheme Info Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100 text-xs">
          <div>
            <span className="text-slate-400 block">Deadline</span>
            <span className="font-semibold text-slate-800">
              {new Date(scholarship.deadline).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block">Deadline Urgency</span>
            <span className="font-semibold text-slate-800">
              {scholarship.deadline_risk?.risk_level || "MEDIUM"} ({scholarship.deadline_risk?.days_remaining}d left)
            </span>
          </div>
          <div>
            <span className="text-slate-400 block">Application Effort</span>
            <span className="font-semibold text-slate-800">{scholarship.application_effort || "Medium"}</span>
          </div>
          <div>
            <span className="text-slate-400 block">Source Provider</span>
            <span className="font-semibold text-slate-800">{scholarship.source_name || "Official Portal (Demo)"}</span>
          </div>
        </div>
      </div>

      {/* POTENTIAL FUNDING IMPACT SECTION */}
      {impact && (
        <div className="bg-white rounded-xl border border-indigo-200 p-6 shadow-sm space-y-4">
          <div className="border-b border-indigo-50 pb-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Potential Funding Impact</h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                Covers ~{impact.gap_coverage_percentage.toFixed(0)}% of Gap
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Simulated scenario showing how this award could bridge your remaining educational need
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div className="p-3 bg-slate-50 rounded-lg">
              <span className="text-xs text-slate-500 block">Current Funding Gap</span>
              <span className="text-xl font-bold text-slate-900">{formatINR(impact.current_funding_gap)}</span>
            </div>
            <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-lg">
              <span className="text-xs text-indigo-700 block">Scholarship Award</span>
              <span className="text-xl font-bold text-indigo-900">{formatINR(impact.scholarship_amount)}</span>
            </div>
            <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-lg">
              <span className="text-xs text-emerald-700 block">Potential Remaining Gap</span>
              <span className="text-xl font-bold text-emerald-900">{formatINR(impact.potential_remaining_gap)}</span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 text-slate-500 text-[11px] italic">
            {impact.disclaimer}
          </div>
        </div>
      )}

      {/* DETERMINISTIC ELIGIBILITY SECTION */}
      {elig && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Eligibility Rule Evaluation</h2>
              <p className="text-xs text-slate-500">Deterministic check based on your active student profile</p>
            </div>
            <div>
              {elig.status === "eligible" && (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Likely Eligible
                </span>
              )}
              {elig.status === "needs_verification" && (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  Needs Verification
                </span>
              )}
              {elig.status === "ineligible" && (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                  Ineligible
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2 text-xs">
            {elig.reasons.map((r, i) => (
              <div key={i} className="flex items-start space-x-2 p-2 rounded bg-slate-50">
                <span className={elig.status === "ineligible" ? "text-rose-600 font-bold" : "text-emerald-600 font-bold"}>
                  {elig.status === "ineligible" ? "✗" : "✓"}
                </span>
                <span className="text-slate-700">{r}</span>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-slate-400 italic">
            Trust principle: &ldquo;AI assists. Official sources decide. Student approves.&rdquo; All eligibility results are advisory.
          </p>
        </div>
      )}

      {/* REQUIRED DOCUMENTS SECTION */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-900">Required Application Documents</h2>
          <p className="text-xs text-slate-500">Items required for submission</p>
        </div>

        <div className="space-y-2">
          {scholarship.requirements && scholarship.requirements.length > 0 ? (
            scholarship.requirements.map((req) => (
              <div key={req.id} className="p-3 rounded-lg border border-slate-100 flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-slate-900 block">{req.name}</span>
                  <span className="text-slate-400 text-[11px]">Type: {req.type} &bull; {req.document_type}</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                  {req.is_required ? "Required" : "Optional"}
                </span>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-500">No specific documents specified in demo record.</p>
          )}
        </div>
      </div>
    </div>
  );
}
