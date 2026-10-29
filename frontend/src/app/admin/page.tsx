"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
  getAdminOverview,
  getAdminScholarships,
  retireScholarship,
  getAdminApplications,
  getApplicationAdminHistory,
  reviewApplicationAdmin,
  getAIDiagnostic,
  getAdminAuditLogs,
} from "@/lib/api";
import {
  AdminOverview,
  AdminScholarshipItem,
  AdminApplicationItem,
  AIDiagnostic,
  AuditLogItem,
} from "@/types/student";

export default function AdminDashboardPage() {
  const { user, loading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<"overview" | "scholarships" | "applications" | "ai" | "audit">("overview");
  const [refreshing, setRefreshing] = useState(false);

  // Overview data
  const [overview, setOverview] = useState<AdminOverview | null>(null);

  // Scholarships data
  const [scholarships, setScholarships] = useState<AdminScholarshipItem[]>([]);
  const [scSearch, setScSearch] = useState("");
  const [scStatus, setScStatus] = useState<string>("ALL");
  const [retiringId, setRetiringId] = useState<number | null>(null);

  // Applications data
  const [applications, setApplications] = useState<AdminApplicationItem[]>([]);
  const [appSearch, setAppSearch] = useState("");
  const [appStatus, setAppStatus] = useState<string>("ALL");

  // Review modal state
  const [selectedApp, setSelectedApp] = useState<AdminApplicationItem | null>(null);
  const [reviewAction, setReviewAction] = useState<"UNDER_REVIEW" | "APPROVE" | "REJECT">("UNDER_REVIEW");
  const [reviewReason, setReviewReason] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [appHistory, setAppHistory] = useState<Array<Record<string, unknown>>>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // AI Diagnostic data
  const [aiDiagnostic, setAiDiagnostic] = useState<AIDiagnostic | null>(null);
  const [testingAi, setTestingAi] = useState(false);

  // Audit Logs data
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);

  // Load Overview
  const loadOverviewData = useCallback(async () => {
    try {
      const data = await getAdminOverview();
      setOverview(data);
    } catch (e) {
      console.error("Failed to load admin overview:", e);
    }
  }, []);

  // Load Scholarships
  const loadScholarshipsData = useCallback(async () => {
    try {
      const data = await getAdminScholarships({
        search: scSearch || undefined,
        status: scStatus === "ALL" ? undefined : scStatus,
      });
      setScholarships(data.scholarships || []);
    } catch (e) {
      console.error("Failed to load scholarships:", e);
    }
  }, [scSearch, scStatus]);

  // Load Applications
  const loadApplicationsData = useCallback(async () => {
    try {
      const data = await getAdminApplications({
        search: appSearch || undefined,
        status: appStatus === "ALL" ? undefined : appStatus,
      });
      setApplications(data.applications || []);
    } catch (e) {
      console.error("Failed to load applications:", e);
    }
  }, [appSearch, appStatus]);

  // Load AI Diagnostic
  const loadAiDiagnosticData = useCallback(async () => {
    setTestingAi(true);
    try {
      const data = await getAIDiagnostic();
      setAiDiagnostic(data);
    } catch (e) {
      console.error("Failed to load AI diagnostic:", e);
    } finally {
      setTestingAi(false);
    }
  }, []);

  // Load Audit Logs
  const loadAuditLogsData = useCallback(async () => {
    try {
      const data = await getAdminAuditLogs(60);
      setAuditLogs(data || []);
    } catch (e) {
      console.error("Failed to load audit logs:", e);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (user?.role === "ADMIN") {
      const timer = setTimeout(() => {
        Promise.allSettled([
          loadOverviewData(),
          loadScholarshipsData(),
          loadApplicationsData(),
          loadAiDiagnosticData(),
          loadAuditLogsData(),
        ]);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [user?.role, loadOverviewData, loadScholarshipsData, loadApplicationsData, loadAiDiagnosticData, loadAuditLogsData]);

  // Re-fetch tab specific data when switching
  useEffect(() => {
    if (user?.role === "ADMIN") {
      const timer = setTimeout(() => {
        if (activeTab === "scholarships") loadScholarshipsData();
        if (activeTab === "applications") loadApplicationsData();
        if (activeTab === "ai") loadAiDiagnosticData();
        if (activeTab === "audit") loadAuditLogsData();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [activeTab, user?.role, loadScholarshipsData, loadApplicationsData, loadAiDiagnosticData, loadAuditLogsData]);

  const handleRefreshAll = async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled([
        loadOverviewData(),
        loadScholarshipsData(),
        loadApplicationsData(),
        loadAiDiagnosticData(),
        loadAuditLogsData(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleRetire = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to retire scholarship "${name}"? It will be marked INACTIVE. Existing student applications will be preserved.`)) {
      return;
    }
    setRetiringId(id);
    try {
      await retireScholarship(id);
      await loadScholarshipsData();
      await loadOverviewData();
    } catch (e) {
      console.error("Failed to retire scholarship:", e);
      alert("Failed to retire scholarship.");
    } finally {
      setRetiringId(null);
    }
  };

  const openReviewModal = async (app: AdminApplicationItem) => {
    setSelectedApp(app);
    setReviewAction(app.status === "SUBMITTED" ? "UNDER_REVIEW" : "APPROVE");
    setReviewReason("");
    setLoadingHistory(true);
    try {
      const res = await getApplicationAdminHistory(app.id);
      setAppHistory(res.history || []);
    } catch {
      setAppHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp) return;
    if (!reviewReason.trim()) {
      alert("Please enter a review reason or justification.");
      return;
    }
    setSubmittingReview(true);
    try {
      await reviewApplicationAdmin(selectedApp.id, {
        action: reviewAction,
        reason: reviewReason,
      });
      setSelectedApp(null);
      await loadApplicationsData();
      await loadOverviewData();
      await loadAuditLogsData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to record institutional review.";
      alert(`Review action rejected: ${message}`);
    } finally {
      setSubmittingReview(false);
    }
  };

  // Auth Protection Gate
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center space-x-3 text-sm text-zinc-400">
          <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse"></span>
          <span>Authenticating Administrator Permissions...</span>
        </div>
      </div>
    );
  }

  if (!user || user.role !== "ADMIN") {
    return (
      <div className="max-w-2xl mx-auto my-16 p-8 bg-zinc-900 border border-red-900/50 rounded-2xl text-center space-y-4 shadow-xl">
        <div className="w-12 h-12 rounded-full bg-red-950/80 border border-red-700/50 flex items-center justify-center mx-auto text-red-500">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-white">Administrative Privileges Required</h1>
        <p className="text-sm text-zinc-400 leading-relaxed">
          The SCHOLARAi Governance Portal is restricted to verified institution administrators and reviewers (<code className="text-red-400 font-mono">role=&quot;ADMIN&quot;</code>). Your account (<strong className="text-zinc-200">{user?.email || "Guest"}</strong>) has role <span className="text-zinc-300 font-semibold">{user?.role || "UNAUTHENTICATED"}</span>.
        </p>
        <div className="pt-2 flex justify-center space-x-3">
          <Link
            href="/login"
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            Sign In with Administrator Account
          </Link>
          <Link
            href="/"
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-semibold transition-colors"
          >
            Return to Student Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Banner / Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center space-x-2 text-xs text-zinc-500 mb-1">
            <Link href="/" className="hover:text-red-400 transition-colors">Platform</Link>
            <span>/</span>
            <span className="text-zinc-200 font-medium">Administration & Governance</span>
          </div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-tight">
              SCHOLARAi Governance Portal
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-red-950/80 text-red-400 border border-red-800/60 font-mono uppercase">
              Role: Admin
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Institutional catalogue lifecycle, application readiness validation, authority reviews, and AI diagnostics.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleRefreshAll}
            disabled={refreshing}
            className="inline-flex items-center space-x-2 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-semibold text-zinc-300 hover:text-white transition-all cursor-pointer disabled:opacity-50"
          >
            <svg className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>{refreshing ? "Refreshing..." : "Refresh Metrics"}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Bar */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="p-4 bg-zinc-900/90 rounded-xl border border-zinc-800">
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Registered Users</p>
            <p className="text-2xl font-bold text-white mt-1">{overview.total_users}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">{overview.total_students} student profiles</p>
          </div>

          <div className="p-4 bg-zinc-900/90 rounded-xl border border-zinc-800">
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Active Catalogue</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{overview.active_scholarships}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">{overview.retired_scholarships} retired legacy</p>
          </div>

          <div className="p-4 bg-zinc-900/90 rounded-xl border border-zinc-800">
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Total Applications</p>
            <p className="text-2xl font-bold text-white mt-1">{overview.total_applications}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">Across all students</p>
          </div>

          <div className="p-4 bg-zinc-900/90 rounded-xl border border-zinc-800">
            <p className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">Pending Authority Review</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">{overview.pending_review_count}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">Submitted / Under Review</p>
          </div>

          <div className="p-4 bg-zinc-900/90 rounded-xl border border-zinc-800">
            <p className="text-[11px] font-semibold text-sky-400 uppercase tracking-wider">Ready for Submission</p>
            <p className="text-2xl font-bold text-sky-400 mt-1">{overview.ready_for_submission_count}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">100% requirements verified</p>
          </div>

          <div className="p-4 bg-zinc-900/90 rounded-xl border border-zinc-800">
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">AI Diagnostics</p>
            <div className="flex items-center space-x-1.5 mt-1">
              <span className={`w-2 h-2 rounded-full ${
                overview.ai_status.connectivity === "CONNECTED"
                  ? "bg-emerald-500"
                  : overview.ai_status.connectivity === "DEMO_MODE"
                  ? "bg-amber-500"
                  : "bg-red-500"
              }`}></span>
              <span className="text-sm font-bold text-white uppercase font-mono">
                {overview.ai_status.connectivity}
              </span>
            </div>
            <p className="text-[10px] text-zinc-500 mt-0.5 font-mono truncate">{overview.ai_status.model}</p>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex border-b border-zinc-800 space-x-1 sm:space-x-2 overflow-x-auto pb-px">
        {[
          { key: "overview", label: "Overview & Analytics" },
          { key: "scholarships", label: "Scholarships Catalogue" },
          { key: "applications", label: "Review Queue & Status" },
          { key: "ai", label: "AI Diagnostics & Grounding" },
          { key: "audit", label: "System Audit Trail" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === tab.key
                ? "bg-zinc-900 text-white border-t-2 border-red-600 border-x border-zinc-800"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Overview & Analytics */}
      {activeTab === "overview" && overview && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Status Distribution */}
            <div className="p-5 bg-zinc-900/90 border border-zinc-800 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Application Pipeline Distribution</h3>
                <span className="text-xs text-zinc-500">Live Database Counters</span>
              </div>

              <div className="space-y-3">
                {Object.entries(overview.applications_by_status).map(([st, count]) => {
                  const total = overview.total_applications || 1;
                  const pct = Math.round((count / total) * 100);
                  const colorMap: Record<string, string> = {
                    IN_PROGRESS: "bg-zinc-500",
                    READY: "bg-sky-500",
                    SUBMITTED: "bg-indigo-500",
                    UNDER_REVIEW: "bg-amber-500",
                    APPROVED: "bg-emerald-500",
                    REJECTED: "bg-rose-500",
                    WITHDRAWN: "bg-zinc-700",
                  };
                  return (
                    <div key={st} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono text-zinc-300 font-semibold">{st}</span>
                        <span className="text-zinc-400">{count} applications ({pct}%)</span>
                      </div>
                      <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${colorMap[st] || "bg-zinc-500"} transition-all duration-300`}
                          style={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent Pipeline Activity */}
            <div className="p-5 bg-zinc-900/90 border border-zinc-800 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Recent Application Updates</h3>
                <span className="text-xs text-zinc-500">State Transitions</span>
              </div>

              <div className="space-y-3">
                {overview.recent_activity.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-6 text-center">No recent application activities recorded.</p>
                ) : (
                  overview.recent_activity.map((act) => (
                    <div
                      key={act.id}
                      className="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-lg flex items-start justify-between gap-3 text-xs"
                    >
                      <div>
                        <p className="font-semibold text-zinc-200">{act.title}</p>
                        <p className="text-zinc-400 text-[11px] mt-0.5">{act.description}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-zinc-800 text-zinc-300">
                        {act.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Scholarships Catalogue Management */}
      {activeTab === "scholarships" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-zinc-900 p-3 rounded-xl border border-zinc-800">
            <div className="relative flex-1">
              <svg className="w-4 h-4 absolute left-3 top-2.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search scholarships by title or provider..."
                value={scSearch}
                onChange={(e) => setScSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-red-600"
              />
            </div>

            <div className="flex items-center space-x-2">
              <select
                value={scStatus}
                onChange={(e) => setScStatus(e.target.value)}
                className="px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-300 focus:outline-none focus:ring-1 focus:ring-red-600"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE / Retired</option>
              </select>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950/70 border-b border-zinc-800 text-zinc-400 uppercase font-mono text-[10px]">
                  <tr>
                    <th className="px-4 py-3">ID / Name</th>
                    <th className="px-4 py-3">Provider</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Verification</th>
                    <th className="px-4 py-3">Applications</th>
                    <th className="px-4 py-3">Official Sources</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                  {scholarships.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                        No scholarships match current criteria.
                      </td>
                    </tr>
                  ) : (
                    scholarships.map((sc) => (
                      <tr key={sc.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-white">{sc.name}</p>
                          <p className="text-[10px] text-zinc-500 font-mono mt-0.5">#{sc.id} {sc.dossier_index && `• ${sc.dossier_index}`}</p>
                        </td>
                        <td className="px-4 py-3 text-zinc-300 max-w-[200px] truncate">{sc.provider}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                            sc.status === "ACTIVE"
                              ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/40"
                              : "bg-zinc-800 text-zinc-400 border border-zinc-700/40"
                          }`}>
                            {sc.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[11px] font-mono text-zinc-400">
                            {sc.verification_status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono font-semibold text-white">
                          {sc.applications_count}
                        </td>
                        <td className="px-4 py-3 space-y-1">
                          {sc.official_portal_url && (
                            <a
                              href={sc.official_portal_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-[11px] text-red-400 hover:underline truncate max-w-[180px]"
                            >
                              Official Portal
                            </a>
                          )}
                          {sc.official_guideline_source && (
                            <a
                              href={sc.official_guideline_source}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-[11px] text-zinc-400 hover:underline truncate max-w-[180px]"
                            >
                              Guidelines
                            </a>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {sc.status === "ACTIVE" ? (
                            <button
                              onClick={() => handleRetire(sc.id, sc.name)}
                              disabled={retiringId === sc.id}
                              className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-red-950/80 text-zinc-300 hover:text-red-400 border border-zinc-700 hover:border-red-800 text-[11px] font-semibold transition-all cursor-pointer disabled:opacity-50"
                            >
                              {retiringId === sc.id ? "Retiring..." : "Retire"}
                            </button>
                          ) : (
                            <span className="text-[11px] text-zinc-500 italic">Retired</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Application Review Queue */}
      {activeTab === "applications" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-zinc-900 p-3 rounded-xl border border-zinc-800">
            <div className="relative flex-1">
              <svg className="w-4 h-4 absolute left-3 top-2.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search applicant name, email, or scholarship..."
                value={appSearch}
                onChange={(e) => setAppSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-red-600"
              />
            </div>

            <div className="flex items-center space-x-2">
              <select
                value={appStatus}
                onChange={(e) => setAppStatus(e.target.value)}
                className="px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-300 focus:outline-none focus:ring-1 focus:ring-red-600"
              >
                <option value="ALL">All Statuses</option>
                <option value="SUBMITTED">SUBMITTED (Awaiting Review)</option>
                <option value="UNDER_REVIEW">UNDER_REVIEW</option>
                <option value="READY">READY (Student Action)</option>
                <option value="IN_PROGRESS">IN_PROGRESS</option>
                <option value="APPROVED">APPROVED</option>
                <option value="REJECTED">REJECTED</option>
                <option value="WITHDRAWN">WITHDRAWN</option>
              </select>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950/70 border-b border-zinc-800 text-zinc-400 uppercase font-mono text-[10px]">
                  <tr>
                    <th className="px-4 py-3">App ID</th>
                    <th className="px-4 py-3">Student Applicant</th>
                    <th className="px-4 py-3">Scholarship</th>
                    <th className="px-4 py-3">Readiness</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Reviewed By</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                  {applications.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                        No applications match current filters.
                      </td>
                    </tr>
                  ) : (
                    applications.map((app) => (
                      <tr key={app.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="px-4 py-3 font-mono font-semibold text-white">#{app.id}</td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-white">{app.student_name}</p>
                          <p className="text-[11px] text-zinc-400 truncate">{app.student_email}</p>
                        </td>
                        <td className="px-4 py-3 text-zinc-200 max-w-[220px] truncate">{app.scholarship_name}</td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <span className="text-[11px] font-mono font-bold text-white">
                              {app.readiness_score}%
                            </span>
                            <span className="text-[10px] text-zinc-500 block">
                              {app.requirements_met}/{app.requirements_total} reqs met
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                            app.status === "APPROVED"
                              ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/40"
                              : app.status === "UNDER_REVIEW" || app.status === "SUBMITTED"
                              ? "bg-amber-950/60 text-amber-400 border border-amber-800/40"
                              : app.status === "READY"
                              ? "bg-sky-950/60 text-sky-400 border border-sky-800/40"
                              : app.status === "REJECTED"
                              ? "bg-rose-950/60 text-rose-400 border border-rose-800/40"
                              : "bg-zinc-800 text-zinc-400 border border-zinc-700/40"
                          }`}>
                            {app.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-400 text-[11px]">
                          {app.reviewed_by ? (
                            <div>
                              <p className="text-zinc-300 font-medium">{app.reviewed_by}</p>
                              {app.reviewed_at && (
                                <p className="text-[10px] text-zinc-500 font-mono">
                                  {new Date(app.reviewed_at).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-zinc-600 italic">Not reviewed</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => openReviewModal(app)}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-semibold transition-colors cursor-pointer"
                          >
                            Review & History
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: AI Diagnostics & Grounding */}
      {activeTab === "ai" && (
        <div className="space-y-6">
          <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white">AI Provider Diagnostic & Grounding Status</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Real-time connectivity probing, model identification, and knowledge-base RAG integration check.
                </p>
              </div>
              <button
                onClick={loadAiDiagnosticData}
                disabled={testingAi}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                <svg className={`w-3.5 h-3.5 ${testingAi ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>{testingAi ? "Testing Connectivity..." : "Probe AI Connectivity"}</span>
              </button>
            </div>

            {aiDiagnostic && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-800/80">
                  <p className="text-[11px] text-zinc-500 font-semibold uppercase">Configured Provider</p>
                  <p className="text-lg font-bold text-white mt-1 font-mono">{aiDiagnostic.provider}</p>
                  <p className="text-xs text-zinc-400 mt-1">Configured: <strong className={aiDiagnostic.configured ? "text-emerald-400" : "text-rose-400"}>{aiDiagnostic.configured ? "YES" : "NO"}</strong></p>
                </div>

                <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-800/80">
                  <p className="text-[11px] text-zinc-500 font-semibold uppercase">Active Model</p>
                  <p className="text-lg font-bold text-white mt-1 font-mono truncate">{aiDiagnostic.model}</p>
                  <p className="text-xs text-zinc-400 mt-1">Base URL: <span className="text-zinc-500 font-mono text-[11px]">{aiDiagnostic.base_url || "Standard Google SDK"}</span></p>
                </div>

                <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-800/80">
                  <p className="text-[11px] text-zinc-500 font-semibold uppercase">Real-Time Probe Status</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className={`w-3 h-3 rounded-full ${
                      aiDiagnostic.connectivity === "CONNECTED"
                        ? "bg-emerald-500"
                        : aiDiagnostic.connectivity === "DEMO_MODE"
                        ? "bg-amber-500"
                        : "bg-red-500"
                    }`}></span>
                    <span className="text-lg font-bold text-white font-mono uppercase">{aiDiagnostic.connectivity}</span>
                  </div>
                  {aiDiagnostic.latency_ms !== null && aiDiagnostic.latency_ms !== undefined && (
                    <p className="text-xs text-zinc-400 mt-1">Round-trip Latency: <span className="font-mono text-zinc-200">{aiDiagnostic.latency_ms} ms</span></p>
                  )}
                </div>

                <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-800/80 md:col-span-2 lg:col-span-3">
                  <p className="text-[11px] text-zinc-500 font-semibold uppercase">Diagnostic Message</p>
                  <p className="text-xs text-zinc-200 mt-1 leading-relaxed">{aiDiagnostic.message}</p>
                  {aiDiagnostic.error_details && (
                    <div className="mt-2 p-3 bg-red-950/40 border border-red-900/60 rounded text-[11px] font-mono text-red-300 break-all">
                      {aiDiagnostic.error_details}
                    </div>
                  )}
                </div>

                <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-800/80 md:col-span-2 lg:col-span-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] text-zinc-500 font-semibold uppercase">Knowledge Base RAG Grounding</p>
                    <p className="text-sm text-zinc-300 mt-0.5">
                      {aiDiagnostic.catalog_rag_enabled ? (
                        <span className="text-emerald-400 font-semibold">Active & Grounded with {aiDiagnostic.active_sources_count} Official Statutory Sources</span>
                      ) : (
                        <span className="text-amber-400 font-semibold">RAG Chunks Not Initialized</span>
                      )}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 text-xs font-mono font-semibold rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                    Strict Hallucination Prevention
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Full Audit Trail */}
      {activeTab === "audit" && (
        <div className="space-y-4">
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl space-y-3">
            <h3 className="text-sm font-bold text-white">Chronological System Audit Trail</h3>
            <p className="text-xs text-zinc-400">
              Immutable event log of state transitions, document uploads, application reviews, and scholarship modifications.
            </p>

            <div className="divide-y divide-zinc-800/60 text-xs">
              {auditLogs.length === 0 ? (
                <p className="py-8 text-center text-zinc-500">No audit events found.</p>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                          {log.event_type}
                        </span>
                        <span className="font-semibold text-white">
                          {log.target_type} #{log.target_id}
                        </span>
                        <span className="text-zinc-500 font-mono text-[11px]">
                          by {log.actor}
                        </span>
                      </div>
                      <p className="text-zinc-400 text-xs">{log.description}</p>
                    </div>
                    <span className="font-mono text-[10px] text-zinc-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-xs p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 text-xs text-zinc-300">
            <div className="flex items-start justify-between border-b border-zinc-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-white">Review Application #{selectedApp.id}</h2>
                <p className="text-zinc-400 mt-0.5">{selectedApp.student_name} • {selectedApp.scholarship_name}</p>
              </div>
              <button
                onClick={() => setSelectedApp(null)}
                className="text-zinc-500 hover:text-white font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Current State Info */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-zinc-950 rounded-lg border border-zinc-800/80">
              <div>
                <span className="text-[10px] text-zinc-500 font-semibold uppercase block">Current Status</span>
                <span className="font-mono font-bold text-white text-xs">{selectedApp.status}</span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 font-semibold uppercase block">Readiness</span>
                <span className="font-mono font-bold text-white text-xs">{selectedApp.readiness_score}% ({selectedApp.requirements_met}/{selectedApp.requirements_total} reqs)</span>
              </div>
            </div>

            {/* Warning if unsubmitted */}
            {["NOT_STARTED", "IN_PROGRESS", "READY"].includes(selectedApp.status) && (
              <div className="p-3 rounded bg-amber-950/30 border border-amber-900/50 text-amber-300 text-xs">
                <strong>Notice:</strong> This application has not been submitted yet (current status: {selectedApp.status}). Only submitted applications can be reviewed, approved, or rejected by authorities.
              </div>
            )}

            {/* Review Form */}
            {!["NOT_STARTED", "IN_PROGRESS", "READY", "WITHDRAWN"].includes(selectedApp.status) && (
              <form onSubmit={handleSubmitReview} className="space-y-4">
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1.5">Authority Action *</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { action: "UNDER_REVIEW", label: "Place Under Review", color: "hover:border-amber-500" },
                      { action: "APPROVE", label: "Approve Application", color: "hover:border-emerald-500" },
                      { action: "REJECT", label: "Reject Application", color: "hover:border-rose-500" },
                    ].map((item) => (
                      <button
                        key={item.action}
                        type="button"
                        onClick={() => setReviewAction(item.action as typeof reviewAction)}
                        className={`p-2.5 rounded-lg border text-center font-semibold transition-all cursor-pointer ${
                          reviewAction === item.action
                            ? "bg-zinc-800 text-white border-red-500 ring-1 ring-red-500"
                            : `bg-zinc-950 text-zinc-400 border-zinc-800 ${item.color}`
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">Official Notes / Justification *</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Enter official review remarks, meeting reference, or rationale..."
                    value={reviewReason}
                    onChange={(e) => setReviewReason(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-red-600"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-2 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setSelectedApp(null)}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {submittingReview ? "Saving Decision..." : "Commit Authority Decision"}
                  </button>
                </div>
              </form>
            )}

            {/* Audit History Timeline */}
            <div className="border-t border-zinc-800 pt-3 space-y-2">
              <h4 className="font-semibold text-white text-xs">Application Status History</h4>
              {loadingHistory ? (
                <p className="text-zinc-500 text-xs">Loading history...</p>
              ) : appHistory.length === 0 ? (
                <p className="text-zinc-500 text-xs">No status transitions recorded yet.</p>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {appHistory.map((h, i) => (
                    <div key={i} className="p-2 bg-zinc-950 rounded border border-zinc-800/70 text-[11px] space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-red-400">
                          {String(h.from_status || "")} → {String(h.to_status || "")}
                        </span>
                        <span className="text-zinc-500 font-mono text-[10px]">
                          {h.timestamp ? new Date(String(h.timestamp)).toLocaleString() : ""}
                        </span>
                      </div>
                      <p className="text-zinc-300">{String(h.reason || "")}</p>
                      <p className="text-zinc-500 text-[10px]">Actor: {String(h.actor || "system")}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
