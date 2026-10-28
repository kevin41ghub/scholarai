"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  getApplications,
  updateApplication,
  updateApplicationRequirement,
  formatINR,
  draftApplicationAnswer,
  reviewApplicationAnswer,
  checkEvidenceClaims,
  uploadDocumentFile,
} from "@/lib/api";
import {
  ApplicationItem,
  ApplicationRequirementItem,
  ApplicationDraftResponse,
  ApplicationReviewResponse,
  EvidenceCheckResponse,
} from "@/types/student";

const DOCUMENT_CATEGORIES = [
  { value: "INCOME_CERTIFICATE", label: "Income Certificate (Tahsil / Revenue)", hint: "Max validity 1 year, requires revenue authority" },
  { value: "COMMUNITY_CERTIFICATE", label: "Permanent Community Certificate", hint: "Tahsildar issued category proof" },
  { value: "CASTE_CERTIFICATE", label: "Caste / Category Certificate", hint: "Permanent credential" },
  { value: "BONAFIDE_CERTIFICATE", label: "Institution Bonafide Certificate", hint: "Current enrollment verification" },
  { value: "MARKSHEET", label: "Academic Marksheet / Transcript", hint: "Semester or qualifying examination mark sheet" },
  { value: "ACADEMIC_TRANSCRIPT", label: "College / Semester Transcript", hint: "Current CGPA / Grade sheet" },
  { value: "10TH_MARKSHEET", label: "Class X Marksheet / Certificate", hint: "Permanent proof of date of birth & basic schooling" },
  { value: "12TH_MARKSHEET", label: "Class XII Marksheet / Higher Secondary", hint: "Permanent qualifying exam record" },
  { value: "DEGREE_CERTIFICATE", label: "Degree Certificate", hint: "Undergraduate degree or graduation record" },
  { value: "DOMICILE_CERTIFICATE", label: "Domicile / Residence Certificate", hint: "State residency proof" },
  { value: "ID_PROOF", label: "Identity Proof (Aadhaar / Passport / Voter ID)", hint: "Government identity credential" },
  { value: "FEE_RECEIPT", label: "Current Academic Fee Receipt", hint: "Proof of institutional tuition payment" },
  { value: "STATEMENT_OF_PURPOSE", label: "Statement of Purpose / Declaration", hint: "Personal academic motivation statement" },
  { value: "SPECIAL_CATEGORY_CERTIFICATE", label: "Special Category Certificate", hint: "First Graduate, Differently-Abled, etc." },
  { value: "OTHER", label: "Other Supporting Document", hint: "Special category or supplementary proof" },
];

interface QuickUploadTarget {
  applicationId: number;
  scholarshipName: string;
  requirement: ApplicationRequirementItem;
}

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Expanded application details / drawer state
  const [expandedAppId, setExpandedAppId] = useState<number | null>(null);
  const [statementDrafts, setStatementDrafts] = useState<Record<number, string>>({});
  const [updatingReqId, setUpdatingReqId] = useState<number | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Quick Document Upload Modal State
  const [uploadTarget, setUploadTarget] = useState<QuickUploadTarget | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState<string>("");
  const [uploadNotes, setUploadNotes] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const quickFileInputRef = useRef<HTMLInputElement | null>(null);

  const loadApps = useCallback(async () => {
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
    } catch (err: unknown) {
      setError((err as Error)?.message || "Failed to load applications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadApps();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadApps]);

  const handleStatusChange = async (appId: number, newStatus: string) => {
    try {
      await updateApplication(appId, { status: newStatus });
      setSuccessToast(`Application status updated to ${newStatus}.`);
      await loadApps();
    } catch (err: unknown) {
      setError((err as Error)?.message || "Failed to update application status.");
    }
  };

  const handleSaveStatement = async (appId: number) => {
    try {
      const statement = statementDrafts[appId] || "";
      await updateApplication(appId, { personal_statement: statement });
      setSuccessToast("Personal statement saved successfully.");
      await loadApps();
    } catch (err: unknown) {
      setError((err as Error)?.message || "Failed to save statement.");
    }
  };

  const handleRequirementStatusToggle = async (appId: number, reqId: number, currentStatus: string) => {
    try {
      setUpdatingReqId(reqId);
      const nextStatus = currentStatus === "AVAILABLE" ? "MISSING" : "AVAILABLE";
      await updateApplicationRequirement(appId, reqId, { status: nextStatus });
      setSuccessToast(`Requirement marked as ${nextStatus}. Progress recalculated.`);
      await loadApps();
    } catch (err: unknown) {
      setError((err as Error)?.message || "Failed to update requirement status.");
    } finally {
      setUpdatingReqId(null);
    }
  };

  // Quick Document Upload Handlers
  const handleOpenUploadModal = (app: ApplicationItem, req: ApplicationRequirementItem) => {
    setUploadTarget({
      applicationId: app.id,
      scholarshipName: app.scholarship_name,
      requirement: req,
    });
    setUploadCategory(req.document_type || "OTHER");
    setUploadFile(null);
    setUploadNotes("");
    setUploadError(null);
    setUploadProgress(null);
  };

  const handleCloseUploadModal = () => {
    if (isUploading) return;
    setUploadTarget(null);
    setUploadFile(null);
    setUploadNotes("");
    setUploadError(null);
    setUploadProgress(null);
  };

  const handleFileSelected = (file: File) => {
    setUploadError(null);
    const validExts = [".pdf", ".jpg", ".jpeg", ".png"];
    const ext = "." + file.name.split(".").pop()?.toLowerCase();

    if (!validExts.includes(ext)) {
      setUploadError(`Invalid file format: ${ext}. Only PDF, JPG, and PNG files are supported.`);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError(`File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed size is 10 MB.`);
      return;
    }

    if (file.size === 0) {
      setUploadError("The selected file is empty (0 bytes). Please select a valid document.");
      return;
    }

    setUploadFile(file);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError("Please choose a document file to upload.");
      return;
    }
    if (!uploadCategory) {
      setUploadError("Please select or confirm a document category.");
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress("Validating signature, storing in vault, and evaluating verification rules...");
      setUploadError(null);

      const uploadedDoc = await uploadDocumentFile(uploadFile, uploadCategory, uploadNotes);

      // Refresh applications list to sync updated checklist status and recalculated progress
      await loadApps();

      setSuccessToast(
        `Document "${uploadedDoc.original_filename || uploadedDoc.name}" uploaded successfully! Requirement marked as ${uploadedDoc.verification_status || uploadedDoc.status} and application progress updated.`
      );
      handleCloseUploadModal();
    } catch (err: unknown) {
      setUploadError((err as Error)?.message || "Upload failed. Please check file format, size, and connectivity.");
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  // AI Application Assistant State
  const [aiDraftResults, setAiDraftResults] = useState<Record<number, ApplicationDraftResponse | null>>({});
  const [aiReviewResults, setAiReviewResults] = useState<Record<number, ApplicationReviewResponse | null>>({});
  const [aiClaimResults, setAiClaimResults] = useState<Record<number, EvidenceCheckResponse | null>>({});
  const [aiLoading, setAiLoading] = useState<Record<number, boolean>>({});

  const handleDraftAnswer = async (appId: number) => {
    try {
      setAiLoading((prev) => ({ ...prev, [appId]: true }));
      const question = "Describe your academic background, technical projects, and financial need.";
      const res = await draftApplicationAnswer(appId, question);
      setAiDraftResults((prev) => ({ ...prev, [appId]: res }));
      setAiReviewResults((prev) => ({ ...prev, [appId]: null }));
    } catch (e: unknown) {
      setError((e as Error)?.message || "Failed to generate draft from Evidence Bank.");
    } finally {
      setAiLoading((prev) => ({ ...prev, [appId]: false }));
    }
  };

  const handleReviewAnswer = async (appId: number) => {
    try {
      setAiLoading((prev) => ({ ...prev, [appId]: true }));
      const currentText = statementDrafts[appId] || "";
      const res = await reviewApplicationAnswer(appId, "Personal Statement", currentText);
      setAiReviewResults((prev) => ({ ...prev, [appId]: res }));
    } catch (e: unknown) {
      setError((e as Error)?.message || "Failed to review statement.");
    } finally {
      setAiLoading((prev) => ({ ...prev, [appId]: false }));
    }
  };

  const handleCheckClaims = async (appId: number) => {
    try {
      setAiLoading((prev) => ({ ...prev, [appId]: true }));
      const currentText = statementDrafts[appId] || "";
      const res = await checkEvidenceClaims(appId, currentText);
      setAiClaimResults((prev) => ({ ...prev, [appId]: res }));
    } catch (e: unknown) {
      setError((e as Error)?.message || "Failed to verify claims.");
    } finally {
      setAiLoading((prev) => ({ ...prev, [appId]: false }));
    }
  };

  const handleApproveDraft = (appId: number) => {
    const draft = aiDraftResults[appId];
    if (draft) {
      setStatementDrafts((prev) => ({ ...prev, [appId]: draft.draft_text }));
      setSuccessToast("AI draft applied to personal statement editor. Click 'Save Statement' to persist.");
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white dark:bg-[#191c20] rounded-2xl border border-[#e6dfd3] dark:border-[#2f343d] p-6 md:p-8 shadow-xs transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs text-stone-500 dark:text-stone-400 mb-1.5">
              <Link href="/" className="hover:text-[#86192c] dark:hover:text-[#fb7185] transition-colors">Dashboard</Link>
              <span>/</span>
              <span className="text-stone-800 dark:text-stone-200 font-medium">Application Tracker</span>
            </div>
            <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full bg-[#fff1f2] dark:bg-rose-950/40 text-[#86192c] dark:text-[#fb7185] border border-rose-200 dark:border-rose-900/50 text-[10px] font-mono font-bold uppercase tracking-wider mb-1.5">
              <span>Candidate Applications Portfolio</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-stone-900 dark:text-stone-100">
              Application Portfolio Tracker
            </h1>
            <p className="text-xs sm:text-sm font-serif text-stone-600 dark:text-stone-400 max-w-2xl mt-1.5 leading-relaxed">
              Monitor readiness, unblock document prerequisites, and refine motivation statements with grounded AI evidence checks.
            </p>
          </div>
          <Link
            href="/discover"
            className="px-4 py-2.5 bg-[#86192c] hover:bg-[#9f1239] text-white rounded-xl text-xs font-semibold transition-all shadow-xs self-start md:self-auto cursor-pointer"
          >
            + Browse Intelligence Catalogue
          </Link>
        </div>

        {/* Trust Principle Banner */}
        <div className="mt-5 pt-4 border-t border-[#e6dfd3] dark:border-[#2f343d] flex items-center justify-between text-[11px] font-serif text-stone-600 dark:text-stone-400">
          <span>Operating Principle: <strong>&ldquo;AI assists. Official sources decide. Student approves.&rdquo;</strong> Application tracking is local; formal submission happens exclusively on official government portals.</span>
        </div>
      </div>

      {successToast && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs font-medium rounded-xl flex items-center justify-between">
          <span>✓ {successToast}</span>
          <button onClick={() => setSuccessToast(null)} className="text-emerald-700 dark:text-emerald-400 font-bold ml-2 text-sm">&times;</button>
        </div>
      )}

      {/* Applications List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[30vh] space-y-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Loading active applications...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-6 text-center text-rose-700 dark:text-rose-400 text-sm">
          <p className="font-semibold">{error}</p>
          <button onClick={() => loadApps()} className="mt-3 px-3 py-1.5 bg-rose-600 text-white rounded text-xs font-semibold">
            Retry
          </button>
        </div>
      ) : applications.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-500 dark:text-slate-400">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="font-semibold text-slate-900 dark:text-white">No active scholarship applications.</p>
          <p className="text-xs mt-1">Explore Discover to find matched opportunities and begin tracking your requirements.</p>
          <Link href="/discover" className="mt-4 inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors">
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
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-all"
              >
                {/* Main Application Row */}
                <div className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          {app.scholarship_provider}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                          {app.verification_status}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        {app.scholarship_name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-bold font-mono text-blue-700 dark:text-blue-400">{formatINR(app.scholarship_amount)}</span>
                        <span>&bull;</span>
                        <span>Deadline: {new Date(app.scholarship_deadline).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}</span>
                        <span>&bull;</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          app.deadline_risk.risk_level === "URGENT" ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20" :
                          app.deadline_risk.risk_level === "HIGH" ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20" :
                          "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
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
                        className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-blue-500"
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
                        className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        {isExpanded ? "Hide Requirements ▲" : "Manage Requirements ▼"}
                      </button>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex justify-between items-center text-xs mb-1.5">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Readiness: {completedReqs} of {totalReqs} items verified ({app.progress.toFixed(0)}%)
                      </span>
                      {app.blockers.length > 0 ? (
                        <span className="text-amber-700 dark:text-amber-400 font-medium">
                          Blocked by: {app.blockers.join(", ")}
                        </span>
                      ) : (
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                          All requirements available! Ready for submission.
                        </span>
                      )}
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          app.progress >= 99.9 ? "bg-emerald-600 dark:bg-emerald-500" : "bg-blue-600 dark:bg-blue-500"
                        }`}
                        style={{ width: `${app.progress}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Expanded Checklist & Statement Drawer */}
                {isExpanded && (
                  <div className="bg-slate-50/70 dark:bg-slate-800/40 p-6 border-t border-slate-200 dark:border-slate-800 space-y-6">
                    {/* Requirements Checklist */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2.5">
                        Prerequisites & Document Checklist
                      </h4>
                      <div className="space-y-2">
                        {app.requirements.map((req) => {
                          const isAvailable = req.status === "AVAILABLE" || req.status === "VERIFIED";
                          return (
                            <div
                              key={req.id}
                              className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                            >
                              <div className="flex items-center space-x-2.5 min-w-0">
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                  isAvailable ? "bg-emerald-500" : "bg-amber-500"
                                }`} />
                                <div className="min-w-0">
                                  <span className="font-semibold text-slate-800 dark:text-slate-200">{req.name}</span>
                                  <span className="text-slate-400 dark:text-slate-500 text-[11px] ml-2 font-mono">({req.document_type})</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2.5 flex-shrink-0">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isAvailable ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                                }`}>
                                  {req.status}
                                </span>

                                {!isAvailable ? (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenUploadModal(app, req)}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-[11px] shadow-2xs transition-colors cursor-pointer"
                                    title={`Upload file for ${req.name}`}
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                    </svg>
                                    Upload File
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenUploadModal(app, req)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium text-[10px] transition-colors cursor-pointer"
                                    title={`Replace uploaded file for ${req.name}`}
                                  >
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                    </svg>
                                    Replace
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleRequirementStatusToggle(app.id, req.id, req.status)}
                                  disabled={updatingReqId === req.id}
                                  className="text-blue-600 dark:text-blue-400 hover:underline font-semibold text-[11px] cursor-pointer"
                                >
                                  {req.status === "AVAILABLE" ? "Mark Missing" : "Mark Available"}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* AI Application Assistant Panel */}
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-blue-500/20 shadow-xs space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                              AI Application Assistant
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
                              Evidence Grounded
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Drafts grounded strictly in Evidence Bank &bull; Unsupported claim detection &bull; Student approval required
                          </p>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => handleDraftAnswer(app.id)}
                            disabled={aiLoading[app.id]}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors disabled:opacity-50"
                          >
                            {aiLoading[app.id] ? "Drafting..." : "Draft from Evidence Bank"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReviewAnswer(app.id)}
                            disabled={aiLoading[app.id]}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors disabled:opacity-50"
                          >
                            Review Statement
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCheckClaims(app.id)}
                            disabled={aiLoading[app.id]}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors disabled:opacity-50"
                          >
                            Check Claims
                          </button>
                        </div>
                      </div>

                      {/* AI Draft Display */}
                      {aiDraftResults[app.id] && (
                        <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-600 text-white uppercase tracking-wider">
                              AI Grounded Draft
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                              Student approval required before persisting
                            </span>
                          </div>

                          <p className="text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed bg-white dark:bg-slate-900 p-3.5 rounded border border-slate-200 dark:border-slate-800">
                            {aiDraftResults[app.id]?.draft_text}
                          </p>

                          {aiDraftResults[app.id]?.evidence_used && aiDraftResults[app.id]!.evidence_used.length > 0 && (
                            <div className="text-[11px] text-slate-600 dark:text-slate-400">
                              <span className="font-semibold text-slate-700 dark:text-slate-300">Evidence Citing: </span>
                              {aiDraftResults[app.id]!.evidence_used.map((e) => e.title).join("; ")}
                            </div>
                          )}

                          <div className="pt-2 flex items-center justify-end space-x-2">
                            <button
                              type="button"
                              onClick={() => handleApproveDraft(app.id)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold transition-colors"
                            >
                              Approve & Apply to Statement
                            </button>
                            <button
                              type="button"
                              onClick={() => setAiDraftResults((prev) => ({ ...prev, [app.id]: null }))}
                              className="px-3 py-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                            >
                              Discard
                            </button>
                          </div>
                        </div>
                      )}

                      {/* AI Review Results Display */}
                      {aiReviewResults[app.id] && (
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 dark:text-white">Application Statement Review</span>
                            <span className="font-bold text-blue-700 dark:text-blue-400">
                              Completeness Score: {aiReviewResults[app.id]?.completeness_score.toFixed(0)}/100
                            </span>
                          </div>
                          <p className="text-slate-600 dark:text-slate-400">{aiReviewResults[app.id]?.review_feedback}</p>

                          {aiReviewResults[app.id]?.unsupported_claims && aiReviewResults[app.id]!.unsupported_claims.length > 0 && (
                            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-700 dark:text-rose-400 space-y-1">
                              <p className="font-bold">Unsupported Claims Detected:</p>
                              <ul className="list-disc list-inside space-y-0.5">
                                {aiReviewResults[app.id]!.unsupported_claims.map((c, i) => (
                                  <li key={i}>{c}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {aiReviewResults[app.id]?.recommendations && (
                            <div className="text-[11px] text-slate-600 dark:text-slate-400">
                              <span className="font-semibold text-slate-700 dark:text-slate-300">Recommendations: </span>
                              {aiReviewResults[app.id]!.recommendations.join(" • ")}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Claims Check Result */}
                      {aiClaimResults[app.id] && (
                        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-lg text-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 dark:text-white">Claim Grounding Status</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              aiClaimResults[app.id]?.confidence_level === "HIGH EVIDENCE SUPPORT"
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                                : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                            }`}>
                              {aiClaimResults[app.id]?.confidence_level}
                            </span>
                          </div>
                          {aiClaimResults[app.id]?.unsupported_claims && aiClaimResults[app.id]!.unsupported_claims.length > 0 ? (
                            <div className="text-rose-700 dark:text-rose-400 bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20">
                              <p className="font-bold">Statements needing evidence in Evidence Bank:</p>
                              <ul className="list-disc list-inside mt-1 space-y-0.5">
                                {aiClaimResults[app.id]!.unsupported_claims.map((c, i) => (
                                  <li key={i}>{c}</li>
                                ))}
                              </ul>
                            </div>
                          ) : (
                            <p className="text-emerald-700 dark:text-emerald-400 font-medium">
                              All statements are backed by your current profile and Evidence Bank!
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Personal Statement Draft */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                          Personal Statement / Motivation Letter
                        </h4>
                        <button
                          onClick={() => handleSaveStatement(app.id)}
                          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-2xs"
                        >
                          Save Statement
                        </button>
                      </div>
                      <textarea
                        rows={4}
                        value={statementDrafts[app.id] || ""}
                        onChange={(e) => setStatementDrafts({ ...statementDrafts, [app.id]: e.target.value })}
                        placeholder="Draft your motivation essay, academic achievements, and reasons for scholarship aid..."
                        className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-blue-500 leading-relaxed"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Document Upload Modal */}
      {uploadTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isUploading) {
              handleCloseUploadModal();
            }
          }}
        >
          <div className="bg-white dark:bg-[#191c20] w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-7 space-y-5 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  </span>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Upload Requirement File
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
                  Application: <span className="font-semibold text-slate-700 dark:text-slate-300">{uploadTarget.scholarshipName}</span>
                </p>
              </div>

              <button
                type="button"
                onClick={handleCloseUploadModal}
                disabled={isUploading}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 cursor-pointer text-lg leading-none"
                aria-label="Close modal"
              >
                &times;
              </button>
            </div>

            {/* Target Requirement Callout */}
            <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Target Requirement
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
                  {uploadTarget.requirement.document_type}
                </span>
              </div>
              <p className="font-semibold text-slate-900 dark:text-white text-xs">
                {uploadTarget.requirement.name}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                Uploading this document validates file signatures and cascades unblocking across all dependent applications.
              </p>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              {/* Category Selector (Auto-Selected) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Document Category <span className="text-blue-600 dark:text-blue-400 font-normal lowercase">(auto-selected)</span>
                </label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  disabled={isUploading}
                  className="w-full p-2.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-blue-500 cursor-pointer"
                >
                  {!DOCUMENT_CATEGORIES.some((c) => c.value === uploadCategory) && (
                    <option value={uploadCategory}>
                      {uploadTarget.requirement.name} ({uploadCategory})
                    </option>
                  )}
                  {DOCUMENT_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label} ({cat.value})
                    </option>
                  ))}
                </select>
              </div>

              {/* File Dropzone */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Select Document File <span className="text-rose-500">*</span>
                </label>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => quickFileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
                    isDragging
                      ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/20"
                      : "border-slate-300 dark:border-slate-700 hover:border-blue-500 bg-slate-50/50 dark:bg-slate-800/20"
                  }`}
                >
                  <input
                    ref={quickFileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileSelected(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                    disabled={isUploading}
                  />

                  {uploadFile ? (
                    <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-left">
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <span className="w-8 h-8 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs uppercase flex-shrink-0">
                          {uploadFile.name.split(".").pop() || "DOC"}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate">
                            {uploadFile.name}
                          </p>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500">
                            {(uploadFile.size / 1024).toFixed(1)} KB &bull; Ready to upload
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUploadFile(null);
                          if (quickFileInputRef.current) quickFileInputRef.current.value = "";
                        }}
                        disabled={isUploading}
                        className="text-xs text-rose-600 dark:text-rose-400 hover:underline font-semibold ml-2 flex-shrink-0 cursor-pointer"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5 pointer-events-none">
                      <div className="w-10 h-10 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Click to browse or drag and drop file here
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Supports PDF, JPG, or PNG (up to 10 MB)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Optional Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Notes / Source Authority <span className="text-slate-400 font-normal lowercase">(optional)</span>
                </label>
                <input
                  type="text"
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  disabled={isUploading}
                  placeholder="e.g. Issued by Tahsildar / e-Sevai certified copy"
                  className="w-full p-2.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-blue-500"
                />
              </div>

              {/* Upload Error Banner */}
              {uploadError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs rounded-lg flex items-start space-x-2">
                  <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Upload Progress Status */}
              {isUploading && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-xs rounded-lg flex items-center space-x-2.5">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
                  <span>{uploadProgress || "Uploading and unblocking applications..."}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseUploadModal}
                  disabled={isUploading}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !uploadFile}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center space-x-1.5"
                >
                  {isUploading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Uploading & Unblocking...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      <span>Upload & Link Requirement</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
