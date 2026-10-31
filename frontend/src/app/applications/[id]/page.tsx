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
  launchOfficialPortal,
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

  // Guided Official Portal Copilot state
  const [selectedPortalSectionIndex, setSelectedPortalSectionIndex] = useState(0);
  const [copiedFieldKey, setCopiedFieldKey] = useState<string | null>(null);
  const [copiedSectionId, setCopiedSectionId] = useState<string | null>(null);
  const [showPreLaunchModal, setShowPreLaunchModal] = useState(false);
  const [launchingPortal, setLaunchingPortal] = useState(false);

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
    const current = fieldValues[key]?.value;
    if ((current === null || current === undefined || String(current).trim() === "") && !fieldValues[key]?.is_confirmed) {
      alert("Please provide a valid value for this field before confirming it.");
      return;
    }
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

  const handleCopyField = async (key: string, value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedFieldKey(key);
      setTimeout(() => setCopiedFieldKey(null), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedFieldKey(key);
      setTimeout(() => setCopiedFieldKey(null), 2000);
    }
  };

  const handleCopySection = async (sectionId: string, text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSectionId(sectionId);
      setTimeout(() => setCopiedSectionId(null), 2000);
      setSuccessToast("Section answers copied to clipboard!");
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedSectionId(sectionId);
      setTimeout(() => setCopiedSectionId(null), 2000);
      setSuccessToast("Section answers copied to clipboard!");
    }
  };

  const handleConfirmAndLaunchPortal = async () => {
    if (!workspace?.official_portal_url) return;
    try {
      setLaunchingPortal(true);
      const updated = await launchOfficialPortal(applicationId);
      setWorkspace(updated);
      window.open(workspace.official_portal_url, "_blank", "noopener,noreferrer");
      setShowPreLaunchModal(false);
      setSuccessToast("Official portal opened in a new tab! Use the guided field copilot below to copy answers.");
    } catch (err: unknown) {
      setError((err as Error)?.message || "Failed to launch portal.");
      window.open(workspace.official_portal_url, "_blank", "noopener,noreferrer");
      setShowPreLaunchModal(false);
    } finally {
      setLaunchingPortal(false);
    }
  };

  const handleExportDossier = async () => {
    try {
      if (workspace?.missing_mandatory_fields && workspace.missing_mandatory_fields.length > 0) {
        const confirmExport = confirm(
          `Notice: You have ${workspace.missing_mandatory_fields.length} mandatory field(s) missing:\n• ${workspace.missing_mandatory_fields.join("\n• ")}\n\nPlease review and complete all required fields before external portal submission. Do you want to export the partial dossier anyway?`
        );
        if (!confirmExport) return;
      }
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
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1.5 ${
            activeTab === "submission"
              ? "bg-red-600 text-white shadow-xs"
              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          <span>4. Guided Portal Filing &amp; Submission</span>
          {workspace?.submission_status === "SUBMISSION_IN_PROGRESS" && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          )}
          {workspace?.submission_status === "SUBMITTED_EXTERNALLY" && (
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
          )}
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
                            field.verification_status === "OFFICIALLY_VERIFIED" || field.verification_status === "DOCUMENT_VERIFIED"
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                              : (!currentVal || field.verification_status === "NOT_PROVIDED")
                              ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                              : "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300"
                          }`}
                        >
                          {(!currentVal || field.verification_status === "NOT_PROVIDED")
                            ? "Needs Information"
                            : field.verification_status.replace(/_/g, " ")}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      {field.key === "gender" ? (
                        <select
                          value={currentVal === null || currentVal === undefined ? "" : String(currentVal)}
                          onChange={(e) => handleFieldChange(field.key, e.target.value)}
                          className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-600"
                        >
                          <option value="">{field.placeholder || "-- Select Gender --"}</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Transgender">Transgender</option>
                        </select>
                      ) : field.key === "community_category" ? (
                        <select
                          value={currentVal === null || currentVal === undefined ? "" : String(currentVal)}
                          onChange={(e) => handleFieldChange(field.key, e.target.value)}
                          className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-600"
                        >
                          <option value="">{field.placeholder || "-- Select Category --"}</option>
                          <option value="BC">BC (Backward Classes)</option>
                          <option value="MBC/DNC">MBC/DNC (Most Backward / Denotified)</option>
                          <option value="SC">SC (Scheduled Caste)</option>
                          <option value="SCA">SCA (SC Arunthathiyar)</option>
                          <option value="ST">ST (Scheduled Tribe)</option>
                          <option value="OC">OC (Open / General Category)</option>
                        </select>
                      ) : field.key === "institution_type" ? (
                        <select
                          value={currentVal === null || currentVal === undefined ? "" : String(currentVal)}
                          onChange={(e) => handleFieldChange(field.key, e.target.value)}
                          className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-600"
                        >
                          <option value="">{field.placeholder || "-- Select Classification --"}</option>
                          <option value="Government">Government</option>
                          <option value="Government-aided">Government-aided</option>
                          <option value="Private">Private</option>
                        </select>
                      ) : field.key === "admission_quota" ? (
                        <select
                          value={currentVal === null || currentVal === undefined ? "" : String(currentVal)}
                          onChange={(e) => handleFieldChange(field.key, e.target.value)}
                          className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-600"
                        >
                          <option value="">{field.placeholder || "-- Select Admission Quota --"}</option>
                          <option value="GOVERNMENT_QUOTA">Government Single Window Quota</option>
                          <option value="MANAGEMENT_QUOTA">Management / Institutional Quota</option>
                        </select>
                      ) : field.key === "hosteller_status" ? (
                        <select
                          value={currentVal === null || currentVal === undefined ? "" : String(currentVal)}
                          onChange={(e) => handleFieldChange(field.key, e.target.value)}
                          className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-600"
                        >
                          <option value="">{field.placeholder || "-- Select Accommodation Status --"}</option>
                          <option value="DAY_SCHOLAR">Day Scholar</option>
                          <option value="HOSTELLER">Resident Hosteller</option>
                        </select>
                      ) : field.key === "first_graduate" ? (
                        <select
                          value={currentVal === null || currentVal === undefined ? "" : String(currentVal)}
                          onChange={(e) => handleFieldChange(field.key, e.target.value)}
                          className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-600"
                        >
                          <option value="">{field.placeholder || "-- Select First Graduate Status --"}</option>
                          <option value="Yes">Yes — First Graduate in Family</option>
                          <option value="No">No</option>
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={currentVal === null || currentVal === undefined ? "" : String(currentVal)}
                          onChange={(e) => handleFieldChange(field.key, e.target.value)}
                          placeholder={field.placeholder || `Enter ${field.label}...`}
                          className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-600"
                        />
                      )}

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

                    {field.is_required && (!currentVal || String(currentVal).trim() === "") && (
                      <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                        ⚠ Mandatory field — required for application completion.
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

      {/* TAB 4: GUIDED OFFICIAL PORTAL FILING & SUBMISSION */}
      {activeTab === "submission" && (
        <div className="space-y-6">
          {/* Status & Filing Progress Banner */}
          {workspace.submission_status === "SUBMITTED_EXTERNALLY" && (
            <div className="p-4 rounded-2xl border border-emerald-300 dark:border-emerald-800/80 bg-emerald-50 dark:bg-emerald-950/30 flex items-start space-x-3 shadow-xs">
              <span className="text-lg">✓</span>
              <div className="space-y-1">
                <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                  Application Officially Submitted Externally
                </p>
                <p className="text-xs text-emerald-800 dark:text-emerald-300">
                  Official Acknowledgment Number: <span className="font-mono font-bold">{workspace.external_application_id}</span>
                  {workspace.external_submission_at && (
                    <span> • Submitted on {new Date(workspace.external_submission_at).toLocaleDateString()}</span>
                  )}
                </p>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                  Your submission proof and receipt slip are securely preserved in your SCHOLARAi audit record.
                </p>
              </div>
            </div>
          )}

          {workspace.submission_status === "SUBMISSION_IN_PROGRESS" && (
            <div className="p-4 rounded-2xl border border-amber-300 dark:border-amber-800/80 bg-amber-50 dark:bg-amber-950/30 flex items-start justify-between shadow-xs">
              <div className="flex items-start space-x-3">
                <span className="w-2.5 h-2.5 mt-1 rounded-full bg-amber-500 animate-pulse shrink-0" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    Official Portal Filing in Progress
                  </p>
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    The official portal has been launched in another tab. Use the guided field copilot below to copy verified answers and complete statutory form filling.
                  </p>
                </div>
              </div>
              {workspace.official_portal_url && (
                <button
                  type="button"
                  onClick={() => window.open(workspace.official_portal_url!, "_blank", "noopener,noreferrer")}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shrink-0 ml-4 cursor-pointer"
                >
                  Re-Open Portal ↗
                </button>
              )}
            </div>
          )}

          {workspace.submission_status !== "SUBMITTED_EXTERNALLY" && workspace.submission_status !== "SUBMISSION_IN_PROGRESS" && (
            workspace.preparation_status === "READY_TO_SUBMIT" ? (
              <div className="p-4 rounded-2xl border border-blue-300 dark:border-blue-800/80 bg-blue-50 dark:bg-blue-950/30 flex items-start space-x-3 shadow-xs">
                <span className="text-base text-blue-600 dark:text-blue-400">ℹ</span>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-blue-900 dark:text-blue-200">
                    Application Preparation Complete — Ready for Official Portal Filing
                  </p>
                  <p className="text-xs text-blue-800 dark:text-blue-300">
                    All mandatory fields and required certificates are confirmed. Review your answers below and click &quot;Launch Official Portal&quot; to begin guided form filling.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex items-start space-x-3 shadow-xs">
                <span className="text-base text-zinc-500">ℹ</span>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    Application Preparation in Progress
                  </p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    Missing mandatory fields: <span className="font-bold">{workspace.missing_mandatory_fields.length}</span> •
                    Unconfirmed fields: <span className="font-bold">{workspace.unconfirmed_fields.length}</span>.
                    You can still review the portal field mappings below or fix missing fields in Step 1.
                  </p>
                </div>
              </div>
            )
          )}

          {/* Official Portal Copilot Command Center */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-5 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    Official Portal: {workspace.official_portal_name || "Statutory Portal"}
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                    {workspace.portal_type || "NSP"}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Verified field mapping and one-click clipboard assistance for official submission.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {workspace.portal_type === "TNDCE_OFFLINE" ? (
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={handleExportDossier}
                      className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer inline-flex items-center space-x-1.5"
                    >
                      <span>Download Offline Dossier (JSON)</span>
                    </button>
                    {workspace.official_guideline_url && (
                      <a
                        href={workspace.official_guideline_url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-2.5 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-bold transition-all"
                      >
                        Official Circular ↗
                      </a>
                    )}
                  </div>
                ) : workspace.portal_type === "UNSUPPORTED" ? (
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 italic">
                    Offline / Archived Fellowship
                  </div>
                ) : (
                  <>
                    {workspace.official_portal_url && (
                      <button
                        type="button"
                        onClick={() => setShowPreLaunchModal(true)}
                        className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer inline-flex items-center space-x-2"
                      >
                        <span>🚀 Launch Official Portal in New Tab</span>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleExportDossier}
                      className="px-3.5 py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      {copiedDossier ? "✓ Dossier Copied!" : "Export Dossier"}
                    </button>

                    {workspace.official_guideline_url && (
                      <a
                        href={workspace.official_guideline_url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3.5 py-2.5 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-bold transition-all"
                      >
                        Guidelines ↗
                      </a>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Portal Statutory Guidance Notes */}
            {workspace.portal_guidance_notes && workspace.portal_guidance_notes.length > 0 && (
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200/80 dark:border-zinc-800 space-y-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                {workspace.portal_guidance_notes.map((note, idx) => (
                  <div key={idx} className="flex items-start space-x-2">
                    <span className="text-red-600 dark:text-red-400 font-bold">•</span>
                    <span className="leading-relaxed">{note}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Step-by-Step Guided Form Sections Copilot */}
          {workspace.portal_sections && workspace.portal_sections.length > 0 ? (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-6 shadow-xs">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider text-xs">
                  Section-by-Section Form Copilot
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Click any field to copy its exact value directly into the official portal form.
                </p>
              </div>

              {/* Section Tabs */}
              <div className="flex items-center space-x-2 overflow-x-auto pb-2 border-b border-zinc-200 dark:border-zinc-800 scrollbar-thin">
                {workspace.portal_sections.map((sec, idx) => (
                  <button
                    key={sec.section_id}
                    type="button"
                    onClick={() => setSelectedPortalSectionIndex(idx)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center space-x-2 cursor-pointer ${
                      selectedPortalSectionIndex === idx
                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs"
                        : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <span>{sec.section_title}</span>
                    {sec.is_complete && (
                      <span className="text-[10px] text-emerald-500 font-bold">✓</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Active Section Content */}
              {(() => {
                const activeSec = workspace.portal_sections[selectedPortalSectionIndex] || workspace.portal_sections[0];
                if (!activeSec) return null;

                return (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800">
                      <div>
                        <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                          {activeSec.section_title}
                        </h4>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                          {activeSec.section_description}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopySection(activeSec.section_id, activeSec.grouped_copy_text)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center space-x-1.5 ${
                          copiedSectionId === activeSec.section_id
                            ? "bg-emerald-600 text-white"
                            : "bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200"
                        }`}
                      >
                        <span>{copiedSectionId === activeSec.section_id ? "✓ Section Copied!" : "📋 Copy Section Answers"}</span>
                      </button>
                    </div>

                    {/* Field Mappings in Active Section */}
                    {activeSec.fields.length === 0 ? (
                      <div className="p-6 text-center text-xs text-zinc-500 dark:text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                        No direct online form fields for this section. Review the statutory circular or instructions.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {activeSec.fields.map((field) => {
                          const hasValue = field.value !== null && field.value !== undefined && String(field.value).trim() !== "";
                          const isCopied = copiedFieldKey === field.key;

                          return (
                            <div
                              key={field.key}
                              className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors bg-white dark:bg-zinc-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div className="space-y-1 min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                                    {field.official_field_label}
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                                    {field.portal_input_type}
                                  </span>
                                  {field.verification_status === "DOCUMENT_VERIFIED" && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                                      ✓ Doc Verified
                                    </span>
                                  )}
                                  {field.verification_status === "PROFILE_PROVIDED" && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                                      Profile
                                    </span>
                                  )}
                                  {field.verification_status === "STUDENT_PROVIDED" && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                                      Student Confirmed
                                    </span>
                                  )}
                                  {!hasValue && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300">
                                      Missing
                                    </span>
                                  )}
                                </div>

                                <div className="pt-0.5">
                                  {hasValue ? (
                                    <p className="text-xs font-mono font-bold text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-950/50 px-2.5 py-1 rounded border border-zinc-200/60 dark:border-zinc-800 inline-block max-w-full truncate select-all">
                                      {field.value}
                                    </p>
                                  ) : (
                                    <p className="text-xs italic text-red-600 dark:text-red-400">
                                      [Not Provided — return to Step 1 Form Fields to enter]
                                    </p>
                                  )}
                                </div>

                                {field.guidance_tip && (
                                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                    {field.guidance_tip}
                                  </p>
                                )}
                              </div>

                              <div className="shrink-0 flex items-center space-x-2">
                                <button
                                  type="button"
                                  onClick={() => handleCopyField(field.key, field.copy_value)}
                                  disabled={!hasValue}
                                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 ${
                                    isCopied
                                      ? "bg-emerald-600 text-white"
                                      : hasValue
                                      ? "bg-red-600 hover:bg-red-700 text-white shadow-xs"
                                      : "bg-zinc-200 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
                                  }`}
                                  title="Copy raw value for direct pasting"
                                >
                                  <span>{isCopied ? "✓ Copied" : "Copy"}</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          ) : null}

          {/* Official Submission Instructions Card */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-3 shadow-xs">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Statutory Instructions: {workspace.official_portal_name || "Official Portal"}
            </h3>
            <div className="space-y-2">
              {workspace.instructions.map((inst, idx) => (
                <div key={idx} className="flex items-start space-x-2 text-xs text-zinc-600 dark:text-zinc-400">
                  <span className="font-bold text-red-600 dark:text-red-400 shrink-0">•</span>
                  <p className="leading-relaxed">{inst}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Student Consent & Review Approval Card */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4 shadow-xs">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Student Application Approval Declaration
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Review and authorize your application package. In alignment with SCHOLARAi principles, your explicit consent is mandatory before recording your verified portfolio submission.
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
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Record Official Submission Acknowledgment
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Once you finish submitting on the official portal, enter your official Acknowledgment / Application Number and link your receipt document.
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
                    Attach Acknowledgment Receipt Slip (Optional from Vault)
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
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Direct Provider API Submission
              </h3>
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

      {/* PRE-LAUNCH CHECKLIST MODAL */}
      {showPreLaunchModal && workspace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in fade-in duration-200">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Official Portal Pre-Launch Verification
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Verify readiness before opening {workspace.official_portal_name || "the portal"}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPreLaunchModal(false)}
                className="text-zinc-400 hover:text-zinc-600 text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
              {/* Check 1: Mandatory Fields */}
              <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    1. Mandatory Profile Information
                  </span>
                  {workspace.missing_mandatory_fields.length === 0 ? (
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">✓ Complete</span>
                  ) : (
                    <span className="text-xs font-bold text-red-600 dark:text-red-400">
                      {workspace.missing_mandatory_fields.length} Missing
                    </span>
                  )}
                </div>
                {workspace.missing_mandatory_fields.length === 0 ? (
                  <p className="text-[11px] text-zinc-500">All required statutory fields have values.</p>
                ) : (
                  <div className="space-y-1 pt-1">
                    <p className="text-[11px] text-red-600 dark:text-red-400">
                      Missing: {workspace.missing_mandatory_fields.join(", ")}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPreLaunchModal(false);
                        setActiveTab("fields");
                      }}
                      className="text-[11px] font-bold text-red-600 hover:underline cursor-pointer"
                    >
                      → Return to Step 1 Form Fields to complete
                    </button>
                  </div>
                )}
              </div>

              {/* Check 2: Unconfirmed Answers */}
              <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    2. Answer Confirmation
                  </span>
                  {workspace.unconfirmed_fields.length === 0 ? (
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">✓ All Confirmed</span>
                  ) : (
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                      {workspace.unconfirmed_fields.length} Pending
                    </span>
                  )}
                </div>
                {workspace.unconfirmed_fields.length === 0 ? (
                  <p className="text-[11px] text-zinc-500">Every answer has been verified by you.</p>
                ) : (
                  <p className="text-[11px] text-zinc-500">
                    Unconfirmed: {workspace.unconfirmed_fields.slice(0, 3).join(", ")}
                    {workspace.unconfirmed_fields.length > 3 ? "..." : ""}
                  </p>
                )}
              </div>

              {/* Check 3: Mandatory Documents */}
              {(() => {
                const missingDocs = workspace.documents.filter(
                  (d) => d.is_required && d.status !== "AVAILABLE" && d.status !== "VERIFIED"
                );
                return (
                  <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                        3. Required Certificates in Vault
                      </span>
                      {missingDocs.length === 0 ? (
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">✓ Ready</span>
                      ) : (
                        <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                          {missingDocs.length} Missing
                        </span>
                      )}
                    </div>
                    {missingDocs.length === 0 ? (
                      <p className="text-[11px] text-zinc-500">All required certificates are available in your vault.</p>
                    ) : (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400">
                        Missing: {missingDocs.map((d) => d.name).join(", ")}
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Statutory Notice */}
              <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-[11px] text-red-900 dark:text-red-300 space-y-1">
                <p className="font-bold">Statutory Non-Automation Policy:</p>
                <p className="leading-relaxed">
                  Official government portals (NSP, TN SSP, Pudhumai Penn) require Aadhaar OTP and CAPTCHA validation. SCHOLARAi will never submit on your behalf. Keep this tab open side-by-side to copy your answers into the portal form.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setShowPreLaunchModal(false)}
                className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAndLaunchPortal}
                disabled={launchingPortal}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {launchingPortal ? "Launching..." : "Confirm & Launch Portal in New Tab ↗"}
              </button>
            </div>
          </div>
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
