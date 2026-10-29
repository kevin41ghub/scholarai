"use client";

import { useEffect, useState, useCallback, useRef, use } from "react";
import Link from "next/link";
import {
  getApplicationAssistantWorkspace,
  updateApplicationFormFields,
  approveApplicationAssistant,
  recordExternalSubmission,
  submitApplicationViaApi,
  exportApplicationDossier,
  uploadDocumentFile,
  draftApplicationAnswer,
  checkEvidenceClaims,
} from "@/lib/api";
import {
  ApplicationAssistantWorkspace,
  ApplicationRequirementItem,
} from "@/types/student";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ApplicationAssistantPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const applicationId = parseInt(resolvedParams.id, 10);

  const [workspace, setWorkspace] = useState<ApplicationAssistantWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Field editing state
  const [fieldValues, setFieldValues] = useState<Record<string, { value: string | number | boolean | null; is_confirmed: boolean }>>({});
  const [savingFields, setSavingFields] = useState(false);
  const [activeTab, setActiveTab] = useState<"fields" | "documents" | "statement" | "submission">("fields");
  const [activeGroup, setActiveGroup] = useState<string>("personal");

  // Approval state
  const [consenting, setConsenting] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);

  // External submission recording state
  const [confirmationNumber, setConfirmationNumber] = useState("");
  const [submissionDate, setSubmissionDate] = useState(new Date().toISOString().split("T")[0]);
  const [submissionNotes, setSubmissionNotes] = useState("");
  const [selectedReceiptDocId, setSelectedReceiptDocId] = useState<number | undefined>(undefined);
  const [recordingSubmission, setRecordingSubmission] = useState(false);
  const [copiedDossier, setCopiedDossier] = useState(false);

  // Quick document upload modal
  const [uploadModalReq, setUploadModalReq] = useState<ApplicationRequirementItem | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // AI Statement drafting
  const [aiDrafting, setAiDrafting] = useState(false);
  const [aiChecking, setAiChecking] = useState(false);
  const [claimResults, setClaimResults] = useState<{ supported: string[]; unsupported: string[]; confidence: string } | null>(null);

  const loadWorkspace = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getApplicationAssistantWorkspace(applicationId);
      setWorkspace(data);

      // Initialize field editing values
      const initialMap: Record<string, { value: string | number | boolean | null; is_confirmed: boolean }> = {};
      data.fields.forEach((f) => {
        initialMap[f.key] = {
          value: f.value !== null && f.value !== undefined ? f.value : (f.suggested_value || ""),
          is_confirmed: f.is_confirmed,
        };
      });
      setFieldValues(initialMap);
      setConsentChecked(data.student_consented);
      if (data.external_application_id) {
        setConfirmationNumber(data.external_application_id);
      }
    } catch (err: unknown) {
      setError((err as Error)?.message || "Failed to load application workspace.");
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadWorkspace();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadWorkspace]);

  const handleFieldChange = (key: string, value: string | number | boolean | null) => {
    setFieldValues((prev) => ({
      ...prev,
      [key]: {
        value,
        is_confirmed: prev[key]?.is_confirmed ?? false,
      },
    }));
  };

  const handleToggleConfirm = (key: string) => {
    setFieldValues((prev) => ({
      ...prev,
      [key]: {
        value: prev[key]?.value ?? "",
        is_confirmed: !prev[key]?.is_confirmed,
      },
    }));
  };

  const handleSaveFields = async () => {
    try {
      setSavingFields(true);
      const updated = await updateApplicationFormFields(applicationId, fieldValues);
      setWorkspace(updated);
      setSuccessToast("Application draft fields saved successfully.");
    } catch (err: unknown) {
      setError((err as Error)?.message || "Failed to save field changes.");
    } finally {
      setSavingFields(false);
    }
  };

  const handleApprovePackage = async () => {
    if (!consentChecked) {
      alert("Please check the declaration checkbox to confirm accuracy before approving.");
      return;
    }
    try {
      setConsenting(true);
      const updated = await approveApplicationAssistant(applicationId, true);
      setWorkspace(updated);
      setSuccessToast("Application package successfully approved! You may now proceed to external portal submission.");
      setActiveTab("submission");
    } catch (err: unknown) {
      setError((err as Error)?.message || "Failed to record approval.");
    } finally {
      setConsenting(false);
    }
  };

  const handleRecordExternalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationNumber.trim()) {
      alert("Please enter the official confirmation or acknowledgment number from the portal.");
      return;
    }
    try {
      setRecordingSubmission(true);
      await recordExternalSubmission(applicationId, {
        confirmation_number: confirmationNumber.trim(),
        submitted_at: submissionDate ? new Date(submissionDate).toISOString() : undefined,
        receipt_document_id: selectedReceiptDocId,
        submission_notes: submissionNotes.trim() || undefined,
      });
      await loadWorkspace();
      setSuccessToast("External submission successfully confirmed and recorded in your permanent portfolio!");
    } catch (err: unknown) {
      setError((err as Error)?.message || "Failed to record external submission.");
    } finally {
      setRecordingSubmission(false);
    }
  };

  const handleExecuteApiSubmit = async () => {
    if (!confirm("Are you sure you want to transmit this application package via the official API?")) {
      return;
    }
    try {
      setRecordingSubmission(true);
      await submitApplicationViaApi(applicationId, { confirm_accuracy: true });
      await loadWorkspace();
      setSuccessToast("Official API transmission succeeded! Confirmation recorded.");
    } catch (err: unknown) {
      setError((err as Error)?.message || "API submission failed.");
    } finally {
      setRecordingSubmission(false);
    }
  };

  const handleExportDossier = async () => {
    try {
      const data = await exportApplicationDossier(applicationId);
      const formatted = JSON.stringify(data, null, 2);
      await navigator.clipboard.writeText(formatted);
      setCopiedDossier(true);
      setTimeout(() => setCopiedDossier(false), 3000);
      setSuccessToast("Application dossier copied to clipboard! You can paste fields into the official portal.");
    } catch (err: unknown) {
      setError((err as Error)?.message || "Failed to export dossier.");
    }
  };

  const handleDraftWithAi = async () => {
    try {
      setAiDrafting(true);
      const prompt = "Draft an application personal statement highlighting academic background, projects, and financial need.";
      const res = await draftApplicationAnswer(applicationId, prompt);
      handleFieldChange("personal_statement", res.draft_text);
      setSuccessToast("Grounded statement generated from your Achievements & Credentials! Review and edit below.");
    } catch (err: unknown) {
      setError((err as Error)?.message || "AI drafting failed.");
    } finally {
      setAiDrafting(false);
    }
  };

  const handleCheckClaims = async () => {
    const text = String(fieldValues["personal_statement"]?.value || "");
    if (!text || text.length < 20) {
      alert("Please write or generate a statement before checking claims.");
      return;
    }
    try {
      setAiChecking(true);
      const res = await checkEvidenceClaims(applicationId, text);
      setClaimResults({
        supported: res.supported_claims,
        unsupported: res.unsupported_claims,
        confidence: res.confidence_level,
      });
    } catch (err: unknown) {
      setError((err as Error)?.message || "Claim verification check failed.");
    } finally {
      setAiChecking(false);
    }
  };

  const handleQuickUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !uploadModalReq) return;
    try {
      setUploading(true);
      setUploadError(null);
      await uploadDocumentFile(uploadFile, uploadModalReq.document_type, "Uploaded via Application Assistant");
      setUploadModalReq(null);
      setUploadFile(null);
      await loadWorkspace();
      setSuccessToast(`Document for ${uploadModalReq.name} uploaded successfully!`);
    } catch (err: unknown) {
      setUploadError((err as Error)?.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-10 h-10 border-3 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
          Initializing Real Application Assistant...
        </p>
      </div>
    );
  }

  if (error || !workspace) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-white dark:bg-zinc-900 border border-red-500/30 rounded-2xl text-center space-y-4">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Application Workspace Unavailable</h2>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">{error || "Could not load application workspace."}</p>
        <Link
          href="/applications"
          className="inline-block px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition-colors"
        >
          &larr; Return to Applications
        </Link>
      </div>
    );
  }

  const fieldsByGroup = {
    personal: workspace.fields.filter((f) => f.field_group === "personal"),
    academic: workspace.fields.filter((f) => f.field_group === "academic"),
    financial: workspace.fields.filter((f) => f.field_group === "financial"),
    eligibility: workspace.fields.filter((f) => f.field_group === "eligibility"),
    bank: workspace.fields.filter((f) => f.field_group === "bank"),
    statement: workspace.fields.filter((f) => f.field_group === "statement"),
  };

  const isExternallySubmitted = workspace.submission_status === "SUBMITTED_EXTERNALLY";

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-emerald-600 text-white text-xs font-semibold shadow-lg flex items-center space-x-3">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          <span>{successToast}</span>
          <button onClick={() => setSuccessToast(null)} className="ml-2 underline opacity-80 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {/* Breadcrumb Navigation */}
      <nav className="flex items-center space-x-2 text-xs text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 pb-3">
        <Link href="/" className="hover:text-red-600 dark:hover:text-red-400 transition-colors">
          Dashboard
        </Link>
        <span>/</span>
        <Link href="/applications" className="hover:text-red-600 dark:hover:text-red-400 transition-colors">
          Applications
        </Link>
        <span>/</span>
        <span className="text-zinc-900 dark:text-zinc-100 font-semibold truncate">
          Application Assistant: {workspace.scholarship_name}
        </span>
      </nav>

      {/* Scheme Header & Telemetry Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 md:p-8 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {workspace.scholarship_provider}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                {workspace.official_portal_name || "Statutory Scheme"}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                Award: {workspace.award_display || "Variable Support"}
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl font-serif font-bold text-zinc-900 dark:text-zinc-100">
              {workspace.scholarship_name}
            </h1>

            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {workspace.eligibility_summary || "Official statutory scholarship program."}
            </p>
          </div>

          {/* Status Badges */}
          <div className="flex flex-col sm:items-end gap-2.5 shrink-0">
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">Preparation:</span>
              <span
                className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                  workspace.preparation_status === "READY_TO_SUBMIT"
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                    : workspace.preparation_status === "READY_FOR_REVIEW"
                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                    : "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30"
                }`}
              >
                {workspace.preparation_status.replace(/_/g, " ")}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">External Status:</span>
              <span
                className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                  isExternallySubmitted
                    ? "bg-emerald-600 text-white border-emerald-700 shadow-xs"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700"
                }`}
              >
                {isExternallySubmitted ? "SUBMITTED EXTERNALLY" : workspace.submission_status.replace(/_/g, " ")}
              </span>
            </div>

            {workspace.official_portal_url && (
              <a
                href={workspace.official_portal_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-1.5 text-xs font-bold text-red-600 dark:text-red-400 hover:underline pt-1"
              >
                <span>Launch Official Portal</span>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>
        </div>

        {/* Core Principle Disclaimer Banner */}
        <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 dark:bg-red-950/20 text-xs flex items-start space-x-3">
          <span className="px-2 py-0.5 rounded bg-red-600 text-white font-bold text-[10px] uppercase tracking-wider shrink-0">
            Trust Principle
          </span>
          <div className="space-y-0.5">
            <p className="font-semibold text-zinc-950 dark:text-zinc-50">
              &ldquo;AI assists. Official sources decide. Student approves.&rdquo;
            </p>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              SCHOLARAi helps you prepare, validate, and corroborate your application. It never pretends to be the external scholarship authority. External submission requires official portal filing or authorized provider transmission.
            </p>
          </div>
        </div>

        {/* Discrepancy Warnings (if any) */}
        {workspace.discrepancies.length > 0 && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-1.5">
            <div className="flex items-center space-x-2 font-bold">
              <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Potential Eligibility Discrepancies Detected</span>
            </div>
            <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
              {workspace.discrepancies.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Progress Bar & Actions Bar */}
        <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
              Document & Field Readiness: {workspace.progress.toFixed(0)}%
            </span>
            <span className="text-zinc-500 dark:text-zinc-400">
              {workspace.missing_mandatory_fields.length === 0
                ? "All mandatory fields filled"
                : `${workspace.missing_mandatory_fields.length} mandatory fields remaining`}
            </span>
          </div>
          <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                workspace.progress === 100 ? "bg-emerald-500" : "bg-red-600"
              }`}
              style={{ width: `${workspace.progress}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* External Submission Confirmed Card (Shown if submitted) */}
      {isExternallySubmitted && (
        <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-950 dark:text-emerald-200 space-y-3">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
              ✓
            </div>
            <div>
              <h3 className="text-base font-bold text-emerald-900 dark:text-emerald-100">
                Official External Submission Confirmed
              </h3>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                Official Confirmation Reference: <span className="font-mono font-bold">{workspace.external_application_id}</span>
              </p>
            </div>
          </div>
          <p className="text-xs text-emerald-800 dark:text-emerald-200 leading-relaxed">
            Your application was recorded as submitted on {workspace.external_submission_at ? new Date(workspace.external_submission_at).toLocaleDateString() : "record"}.
            Keep your official acknowledgment slip safe for institutional nodal verification.
          </p>
        </div>
      )}

      {/* Workspace Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
        <button
          onClick={() => setActiveTab("fields")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            activeTab === "fields"
              ? "bg-red-600 text-white shadow-xs"
              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          1. Form Fields Checklist
        </button>
        <button
          onClick={() => setActiveTab("documents")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            activeTab === "documents"
              ? "bg-red-600 text-white shadow-xs"
              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          2. Document Vault Checklist ({workspace.documents.filter((d) => d.status === "AVAILABLE" || d.status === "VERIFIED").length}/{workspace.documents.length})
        </button>
        <button
          onClick={() => setActiveTab("statement")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            activeTab === "statement"
              ? "bg-red-600 text-white shadow-xs"
              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          3. AI Personal Statement
        </button>
        <button
          onClick={() => setActiveTab("submission")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            activeTab === "submission"
              ? "bg-red-600 text-white shadow-xs"
              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          4. Review &amp; Official Submission
        </button>
      </div>

      {/* TAB 1: FIELD-BY-FIELD CHECKLIST */}
      {activeTab === "fields" && (
        <div className="space-y-6">
          {/* Field Group Sub-Nav */}
          <div className="flex flex-wrap gap-2">
            {[
              { id: "personal", label: "Personal Info" },
              { id: "academic", label: "Academic Info" },
              { id: "financial", label: "Financial / Income" },
              { id: "eligibility", label: "Eligibility & Quota" },
              { id: "bank", label: "Bank Account (DBT)" },
            ].map((grp) => (
              <button
                key={grp.id}
                onClick={() => setActiveGroup(grp.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  activeGroup === grp.id
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200"
                }`}
              >
                {grp.label}
              </button>
            ))}
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-6 shadow-xs">
            <div className="space-y-4">
              {(fieldsByGroup[activeGroup as keyof typeof fieldsByGroup] || []).map((field) => {
                const currentVal = fieldValues[field.key]?.value ?? "";
                const isConfirmed = fieldValues[field.key]?.is_confirmed ?? false;

                return (
                  <div
                    key={field.key}
                    className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                          {field.label} {field.is_required && <span className="text-red-500">*</span>}
                        </label>
                      </div>

                      <div className="flex items-center space-x-2 text-[10px]">
                        <span className="px-2 py-0.5 rounded font-mono font-semibold bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                          Source: {field.source.replace(/_/g, " ")}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded font-bold ${
                            field.verification_status === "OFFICIALLY_VERIFIED"
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                              : "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300"
                          }`}
                        >
                          {field.verification_status.replace(/_/g, " ")}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      <input
                        type="text"
                        value={currentVal === null || currentVal === undefined ? "" : String(currentVal)}
                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                        placeholder={`Enter ${field.label}...`}
                        className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-600"
                      />

                      <button
                        type="button"
                        onClick={() => handleToggleConfirm(field.key)}
                        className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border ${
                          isConfirmed
                            ? "bg-emerald-600 text-white border-emerald-700"
                            : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50"
                        }`}
                      >
                        {isConfirmed ? "✓ Confirmed" : "Confirm"}
                      </button>
                    </div>

                    {field.guidance && (
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal">
                        {field.guidance}
                      </p>
                    )}

                    {field.warning && (
                      <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                        ⚠ {field.warning}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                You can save your draft answers and resume preparing at any time.
              </p>
              <button
                type="button"
                onClick={handleSaveFields}
                disabled={savingFields}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {savingFields ? "Saving Draft..." : "Save Draft Answers"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DOCUMENT VAULT CHECKLIST */}
      {activeTab === "documents" && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-6 shadow-xs">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Required Documents Checklist
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Corroborated directly by authenticated files stored in your permanent Document Vault.
            </p>
          </div>

          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {workspace.documents.map((req) => (
              <div key={req.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      {req.name} {req.is_required && <span className="text-red-500">*</span>}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        req.status === "VERIFIED"
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                          : req.status === "AVAILABLE"
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : "bg-red-500/10 text-red-700 dark:text-red-400"
                      }`}
                    >
                      {req.status === "VERIFIED"
                        ? "Document Verified"
                        : req.status === "AVAILABLE"
                        ? "Uploaded & Active"
                        : "Missing Document"}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Category: <span className="font-mono">{req.document_type}</span>
                    {req.document_name && ` — Attached: ${req.document_name}`}
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      setUploadModalReq(req);
                      setUploadFile(null);
                      setUploadError(null);
                    }}
                    className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-900 dark:text-zinc-100 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                  >
                    {req.status === "MISSING" ? "Upload Certificate" : "Replace Certificate"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: AI PERSONAL STATEMENT */}
      {activeTab === "statement" && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                AI Personal Statement &amp; Need Justification
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Grounded strictly in your verified Achievements &amp; Credentials. Hallucinations are actively detected and rejected.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleDraftWithAi}
                disabled={aiDrafting}
                className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {aiDrafting ? "Drafting with AI..." : "Draft from Achievements & Credentials"}
              </button>
              <button
                type="button"
                onClick={handleCheckClaims}
                disabled={aiChecking}
                className="px-3.5 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-900 dark:text-zinc-100 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
              >
                {aiChecking ? "Checking..." : "Check Claims"}
              </button>
            </div>
          </div>

          <textarea
            rows={8}
            value={String(fieldValues["personal_statement"]?.value || "")}
            onChange={(e) => handleFieldChange("personal_statement", e.target.value)}
            placeholder="Write or generate your personal statement explaining your academic achievements and financial need..."
            className="w-full p-4 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-sans bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-600 leading-relaxed"
          />

          {/* Claim Verification Results */}
          {claimResults && (
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span>Claim Verification Status:</span>
                <span
                  className={`px-2.5 py-0.5 rounded text-[10px] ${
                    claimResults.confidence === "HIGH EVIDENCE SUPPORT"
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                  }`}
                >
                  {claimResults.confidence}
                </span>
              </div>

              {claimResults.unsupported.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-red-600 dark:text-red-400">
                    Unsupported Claims Detected:
                  </p>
                  <ul className="list-disc pl-5 text-[11px] text-zinc-600 dark:text-zinc-400 space-y-0.5">
                    {claimResults.unsupported.map((u, i) => (
                      <li key={i}>{u}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                  ✓ All assertions in your personal statement are substantiated by your profile and credentials records.
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSaveFields}
              disabled={savingFields}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              {savingFields ? "Saving..." : "Save Statement"}
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: REVIEW & OFFICIAL SUBMISSION */}
      {activeTab === "submission" && (
        <div className="space-y-6">
          {/* Step-by-Step Statutory Portal Instructions */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4 shadow-xs">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Official Submission Instructions: {workspace.official_portal_name || "Official Portal"}
            </h2>
            <div className="space-y-2">
              {workspace.instructions.map((inst, idx) => (
                <div key={idx} className="flex items-start space-x-2 text-xs text-zinc-600 dark:text-zinc-400">
                  <span className="font-bold text-red-600 dark:text-red-400 shrink-0">&bull;</span>
                  <p className="leading-relaxed">{inst}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center space-x-3 pt-2">
              {workspace.official_portal_url && (
                <a
                  href={workspace.official_portal_url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer inline-flex items-center space-x-2"
                >
                  <span>Open Official Portal</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}

              <button
                type="button"
                onClick={handleExportDossier}
                className="px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-900 dark:text-zinc-100 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                {copiedDossier ? "✓ Dossier Copied!" : "Copy Pre-Filled Dossier (JSON)"}
              </button>
            </div>
          </div>

          {/* Student Consent & Review Approval Card */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4 shadow-xs">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Student Application Approval Declaration
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Review and authorize your application package. In alignment with SCHOLARAi principles, your explicit consent is mandatory before any submission record is created.
            </p>

            <label className="flex items-start space-x-3 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 cursor-pointer">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-0.5 rounded text-red-600 focus:ring-red-600"
              />
              <span className="text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed font-medium">
                I hereby declare that all information entered in this application dossier is accurate, truthful, and verified against my official institutional records. I authorize SCHOLARAi to preserve this application package for audit and compliance.
              </span>
            </label>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                {workspace.student_consented ? "✓ Approved by student" : "Awaiting student declaration"}
              </span>

              {!workspace.student_consented && (
                <button
                  type="button"
                  onClick={handleApprovePackage}
                  disabled={consenting || !consentChecked || !workspace.is_ready_for_student_approval}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {consenting ? "Authorizing..." : "Approve Application Package"}
                </button>
              )}
            </div>
          </div>

          {/* External Submission Proof Form (STUDENT_COMPLETED_EXTERNAL_SUBMISSION) */}
          {workspace.submission_mode === "STUDENT_COMPLETED_EXTERNAL_SUBMISSION" && (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4 shadow-xs">
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Record External Submission Proof
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Once you finish submitting on the official portal, enter your official Acknowledgment Number and upload the receipt slip.
                </p>
              </div>

              <form onSubmit={handleRecordExternalSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                      Official Acknowledgment / Application Number *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. NSP-2024-TN-1092837 or UMIS-882194"
                      value={confirmationNumber}
                      onChange={(e) => setConfirmationNumber(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-mono focus:ring-2 focus:ring-red-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                      Date Submitted on Official Portal *
                    </label>
                    <input
                      type="date"
                      required
                      value={submissionDate}
                      onChange={(e) => setSubmissionDate(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-red-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Attach Acknowledgment Receipt (Optional from Vault)
                  </label>
                  <select
                    value={selectedReceiptDocId || ""}
                    onChange={(e) => setSelectedReceiptDocId(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-red-600"
                  >
                    <option value="">-- No Document Attached --</option>
                    {workspace.documents.map((d) => (
                      <option key={d.id} value={d.document_id || ""}>
                        {d.name} {d.document_name ? `(${d.document_name})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Notes / Reference Details
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Submitted at College Scholarship Center, verified by Nodal Officer."
                    value={submissionNotes}
                    onChange={(e) => setSubmissionNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-red-600"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={recordingSubmission}
                    className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    {recordingSubmission ? "Recording Proof..." : "Record External Submission Proof"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Direct API Submission (OFFICIAL_API) */}
          {workspace.submission_mode === "OFFICIAL_API" && (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4 shadow-xs">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Direct Provider API Submission
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                This provider supports direct authorized API transmission. SCHOLARAi will transmit your verified application package using secure idempotency controls.
              </p>
              <button
                type="button"
                onClick={handleExecuteApiSubmit}
                disabled={recordingSubmission || !workspace.student_consented}
                className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {recordingSubmission ? "Transmitting..." : "Submit to Provider API"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* QUICK UPLOAD MODAL */}
      {uploadModalReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Upload Certificate: {uploadModalReq.name}
              </h3>
              <button onClick={() => setUploadModalReq(null)} className="text-zinc-400 hover:text-zinc-600">
                ✕
              </button>
            </div>

            <form onSubmit={handleQuickUpload} className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-red-600 rounded-xl p-6 text-center cursor-pointer transition-colors"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                />
                <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  {uploadFile ? uploadFile.name : "Click to select certificate file"}
                </p>
                <p className="text-[11px] text-zinc-500 mt-1">PDF, JPG, or PNG (Max 10 MB)</p>
              </div>

              {uploadError && <p className="text-xs text-red-600 dark:text-red-400">{uploadError}</p>}

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setUploadModalReq(null)}
                  className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !uploadFile}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold disabled:opacity-50"
                >
                  {uploading ? "Uploading..." : "Save to Vault"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
