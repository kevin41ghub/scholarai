"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getApplications,
  updateApplication,
  updateApplicationRequirement,
  formatINR,
} from "@/lib/api";
import { ApplicationItem } from "@/types/student";

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Expanded application details / drawer state
  const [expandedAppId, setExpandedAppId] = useState<number | null>(null);
  const [statementDrafts, setStatementDrafts] = useState<Record<number, string>>({});
  const [updatingReqId, setUpdatingReqId] = useState<number | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const loadApps = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getApplications();
      setApplications(data);
      // Initialize statement drafts
      const drafts: Record<number, string> = {};
      data.forEach((app) => {
        drafts[app.id] = app.personal_statement || "";
      });
      setStatementDrafts(drafts);
    } catch (err: any) {
      setError(err?.message || "Failed to load applications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApps();
  }, []);

  const handleStatusChange = async (appId: number, newStatus: string) => {
    try {
      await updateApplication(appId, { status: newStatus });
      setSuccessToast(`Application status updated to ${newStatus}.`);
      await loadApps();
    } catch (err: any) {
      setError(err?.message || "Failed to update application status.");
    }
  };

  const handleSaveStatement = async (appId: number) => {
    try {
      const statement = statementDrafts[appId] || "";
      await updateApplication(appId, { personal_statement: statement });
      setSuccessToast("Personal statement saved successfully.");
      await loadApps();
    } catch (err: any) {
      setError(err?.message || "Failed to save statement.");
    }
  };

  const handleRequirementStatusToggle = async (appId: number, reqId: number, currentStatus: string) => {
    try {
      setUpdatingReqId(reqId);
      const nextStatus = currentStatus === "AVAILABLE" ? "MISSING" : "AVAILABLE";
      await updateApplicationRequirement(appId, reqId, { status: nextStatus });
      setSuccessToast(`Requirement marked as ${nextStatus}. Progress updated.`);
      await loadApps();
    } catch (err: any) {
      setError(err?.message || "Failed to update requirement status.");
    } finally {
      setUpdatingReqId(null);
    }
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
              <span className="text-slate-800 font-medium">Application Tracker</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Application State Tracker</h1>
            <p className="text-sm text-slate-600 max-w-2xl mt-1">
              Coordinate and track requirements, personal statements, and deadlines across your active scholarship applications.
            </p>
          </div>
          <Link
            href="/discover"
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-sm self-start md:self-auto"
          >
            + Add / Discover Scholarships
          </Link>
        </div>
      </div>

      {successToast && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-xl flex items-center justify-between">
          <span>{successToast}</span>
          <button onClick={() => setSuccessToast(null)} className="text-emerald-700 font-bold">&times;</button>
        </div>
      )}

      {/* Applications List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[30vh] space-y-3">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-slate-500">Loading your applications...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center text-red-800 text-sm">
          <p className="font-semibold">{error}</p>
          <button onClick={loadApps} className="mt-3 px-3 py-1.5 bg-red-600 text-white rounded text-xs">Retry</button>
        </div>
      ) : applications.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
          <p className="font-semibold text-slate-800">No active applications found.</p>
          <p className="text-xs mt-1">Explore Discover to find opportunities and start your first application.</p>
          <Link href="/discover" className="mt-4 inline-block px-4 py-2 bg-indigo-600 text-white rounded text-xs">
            Discover Scholarships &rarr;
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => {
            const isExpanded = expandedAppId === app.id;
            const completedReqs = app.requirements.filter(r => r.status === "AVAILABLE" || r.status === "VERIFIED").length;
            const totalReqs = app.requirements.length;

            return (
              <div
                key={app.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all"
              >
                {/* Main Application Row */}
                <div className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          {app.scholarship_provider}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          {app.verification_status}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900">
                        {app.scholarship_name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span className="font-bold text-indigo-700">{formatINR(app.scholarship_amount)}</span>
                        <span>&bull;</span>
                        <span>Deadline: {new Date(app.scholarship_deadline).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}</span>
                        <span>&bull;</span>
                        <span className={`px-2 py-0.5 rounded font-bold ${
                          app.deadline_risk.risk_level === "URGENT" ? "bg-red-100 text-red-800" :
                          app.deadline_risk.risk_level === "HIGH" ? "bg-amber-100 text-amber-800" :
                          "bg-slate-100 text-slate-700"
                        }`}>
                          {app.deadline_risk.risk_level}: {app.deadline_risk.days_remaining}d left
                        </span>
                      </div>
                    </div>

                    {/* Status & Action */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <select
                        value={app.status}
                        onChange={(e) => handleStatusChange(app.id, e.target.value)}
                        className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="IN_PROGRESS">IN_PROGRESS</option>
                        <option value="READY">READY</option>
                        <option value="SUBMITTED">SUBMITTED</option>
                        <option value="UNDER_REVIEW">UNDER_REVIEW</option>
                        <option value="APPROVED">APPROVED</option>
                        <option value="REJECTED">REJECTED</option>
                        <option value="WITHDRAWN">WITHDRAWN</option>
                      </select>

                      <button
                        onClick={() => setExpandedAppId(isExpanded ? null : app.id)}
                        className="px-3 py-1.5 border border-slate-200 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50 transition-colors"
                      >
                        {isExpanded ? "Hide Checklist ▲" : "Manage Checklist ▼"}
                      </button>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="flex justify-between items-center text-xs mb-1.5">
                      <span className="font-semibold text-slate-700">
                        Readiness: {completedReqs} of {totalReqs} items completed ({app.progress.toFixed(0)}%)
                      </span>
                      {app.blockers.length > 0 ? (
                        <span className="text-amber-700 font-medium">
                          Blocked by: {app.blockers.join(", ")}
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-bold">
                          All requirements available! Ready to review.
                        </span>
                      )}
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          app.progress >= 99.9 ? "bg-emerald-600" : "bg-indigo-600"
                        }`}
                        style={{ width: `${app.progress}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Expanded Checklist & Statement Drawer */}
                {isExpanded && (
                  <div className="bg-slate-50/70 p-6 border-t border-slate-200 space-y-6">
                    {/* Requirements Checklist */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                        Requirements Checklist
                      </h4>
                      <div className="space-y-2">
                        {app.requirements.map((req) => (
                          <div
                            key={req.id}
                            className="bg-white p-3 rounded-lg border border-slate-200 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center space-x-2">
                              <span className={`w-2 h-2 rounded-full ${
                                req.status === "AVAILABLE" || req.status === "VERIFIED" ? "bg-emerald-500" : "bg-amber-500"
                              }`} />
                              <div>
                                <span className="font-semibold text-slate-800">{req.name}</span>
                                <span className="text-slate-400 text-[11px] ml-2">({req.document_type})</span>
                              </div>
                            </div>

                            <div className="flex items-center space-x-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                req.status === "AVAILABLE" || req.status === "VERIFIED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                              }`}>
                                {req.status}
                              </span>
                              <button
                                onClick={() => handleRequirementStatusToggle(app.id, req.id, req.status)}
                                disabled={updatingReqId === req.id}
                                className="text-indigo-600 hover:text-indigo-800 font-semibold text-[11px] underline"
                              >
                                {req.status === "AVAILABLE" ? "Mark Missing" : "Mark Available"}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Personal Statement Draft */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          Personal Statement / Motivation Note
                        </h4>
                        <button
                          onClick={() => handleSaveStatement(app.id)}
                          className="px-3 py-1 bg-indigo-600 text-white rounded text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                          Save Draft
                        </button>
                      </div>
                      <textarea
                        rows={3}
                        value={statementDrafts[app.id] || ""}
                        onChange={(e) => setStatementDrafts({ ...statementDrafts, [app.id]: e.target.value })}
                        placeholder="Draft your motivation essay, academic achievements, and reasons for scholarship aid..."
                        className="w-full p-3 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
