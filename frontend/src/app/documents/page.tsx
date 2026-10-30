"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  getDocuments,
  getDocumentsReadiness,
  uploadDocumentFile,
  deleteDocument,
  reExtractDocument,
  getDocumentDownloadUrl,
  formatINR,
} from "@/lib/api";
import {
  DocumentItem,
  StudentDocumentsReadinessOverview,
} from "@/types/student";
import AIDocumentReviewModal from "@/components/AIDocumentReviewModal";

const DOCUMENT_CATEGORIES = [
  { value: "INCOME_CERTIFICATE", label: "Income Certificate (Tahsil / Revenue)", hint: "Max validity 1 year, requires revenue authority" },
  { value: "DOMICILE_CERTIFICATE", label: "Domicile / Residence Certificate", hint: "State residency proof" },
  { value: "COMMUNITY_CERTIFICATE", label: "Permanent Community Certificate (BC / MBC / SC / ST)", hint: "Statutory community certificate issued by Revenue Tahsildar / E-Sevai" },
  { value: "SPORTS_CERTIFICATE", label: "Sports Merit Certificate (SDAT / Federation / Form-II/III)", hint: "Required for SDAT scholarships & TNEA Eminent Sports Persons quota" },
  { value: "DISABILITY_CERTIFICATE", label: "UDID Card / Disability Certificate", hint: "Unique Disability ID card or District Medical Board certificate (>= 40% benchmark)" },
  { value: "SPECIAL_CATEGORY_CERTIFICATE", label: "Special Category / Quota Certificate", hint: "First Graduate, Ex-Servicemen, or 7.5% Govt School Bonafide" },
  { value: "ACADEMIC_TRANSCRIPT", label: "College / Semester Transcript", hint: "Current semester marksheet / Grade transcript" },
  { value: "10TH_MARKSHEET", label: "Class X Marksheet / Certificate", hint: "Permanent proof of date of birth & basic schooling" },
  { value: "12TH_MARKSHEET", label: "Class XII Marksheet / Higher Secondary", hint: "Permanent qualifying exam record" },
  { value: "FEE_RECEIPT", label: "Current Academic Fee Receipt", hint: "Proof of institutional tuition payment" },
  { value: "BONAFIDE_CERTIFICATE", label: "Institution Bonafide Certificate", hint: "Current enrollment verification" },
  { value: "ID_PROOF", label: "Identity Proof (Aadhaar / Passport / Voter ID)", hint: "Government identity credential" },
  { value: "OTHER", label: "Other Supporting Document", hint: "Special category or supplementary proof" },
];

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [readinessOverview, setReadinessOverview] = useState<StudentDocumentsReadinessOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingReadiness, setLoadingReadiness] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Active Tab: READINESS (default) | UPLOAD | REPOSITORY
  const [activeTab, setActiveTab] = useState<"READINESS" | "UPLOAD" | "REPOSITORY">("READINESS");

  // Upload Form State
  const [selectedCategory, setSelectedCategory] = useState("INCOME_CERTIFICATE");
  const [notes, setNotes] = useState("");
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Readiness Filters
  const [readinessFilter, setReadinessFilter] = useState<"ALL" | "READY" | "MISSING_DOCUMENTS" | "NEEDS_REVIEW">("ALL");
  const [readinessSearch, setReadinessSearch] = useState("");
  const [expandedScholarshipId, setExpandedScholarshipId] = useState<number | null>(null);

  // Document Ledger Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // AI Assistance & Inspection Modal
  const [inspectingDocId, setInspectingDocId] = useState<number | null>(null);
  const inspectingDoc = inspectingDocId ? documents.find((d) => d.id === inspectingDocId) || null : null;
  const [isReExtracting, setIsReExtracting] = useState(false);

  // Deletion Modal
  const [deletingDocId, setDeletingDocId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [docsData, readinessData] = await Promise.all([
        getDocuments(),
        getDocumentsReadiness().catch((err) => {
          console.warn("Readiness API non-blocking warning:", err);
          return null;
        }),
      ]);
      setDocuments(docsData);
      setReadinessOverview(readinessData);
      // Auto expand first scholarship if available
      if (readinessData?.readiness_items?.length && expandedScholarshipId === null) {
        setExpandedScholarshipId(readinessData.readiness_items[0].scholarship_id);
      }
    } catch (err: unknown) {
      setError((err as Error)?.message || "Failed to load document vault.");
    } finally {
      setLoading(false);
      setLoadingReadiness(false);
    }
  }, [expandedScholarshipId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  // Drag and drop handlers
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = (file: File) => {
    setError(null);
    const validExts = [".pdf", ".jpg", ".jpeg", ".png"];
    const ext = "." + file.name.split(".").pop()?.toLowerCase();

    if (!validExts.includes(ext)) {
      setError(`Invalid file format: ${ext}. Supported formats are PDF, JPG, and PNG only.`);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError(`File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed size is 10 MB.`);
      return;
    }

    setFileToUpload(file);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileToUpload) {
      setError("Please select a file to upload.");
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress("Validating cryptographic signature & storing in private vault...");
      setError(null);

      const uploaded = await uploadDocumentFile(fileToUpload, selectedCategory, notes);

      setUploadProgress("Extracting fields & evaluating verification rules...");
      await loadData();

      setToastMessage(
        `Document "${uploaded.original_filename || uploaded.name}" uploaded successfully! Status: ${
          uploaded.verification_status || uploaded.status
        }.`
      );
      setFileToUpload(null);
      setNotes("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      // Prompt user to inspect AI extraction
      setInspectingDocId(uploaded.id);
    } catch (err: unknown) {
      setError((err as Error)?.message || "Upload failed. Please check file format and size.");
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const handleReExtract = async (docId: number) => {
    try {
      setIsReExtracting(true);
      const updated = await reExtractDocument(docId);
      setToastMessage(`Re-extracted and re-evaluated "${updated.name}".`);
      await loadData();
    } catch (err: unknown) {
      setError((err as Error)?.message || "Re-extraction failed.");
    } finally {
      setIsReExtracting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingDocId) return;
    try {
      setIsDeleting(true);
      await deleteDocument(deletingDocId);
      setToastMessage("Document and associated binary file deleted successfully.");
      setDeletingDocId(null);
      if (inspectingDocId === deletingDocId) setInspectingDocId(null);
      await loadData();
    } catch (err: unknown) {
      setError((err as Error)?.message || "Failed to delete document.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSelectMissingForUpload = (category: string) => {
    setSelectedCategory(category);
    setActiveTab("UPLOAD");
    window.scrollTo({ top: 380, behavior: "smooth" });
  };

  // Filtered readiness items
  const filteredReadinessItems = (readinessOverview?.readiness_items || []).filter((item) => {
    if (readinessFilter !== "ALL" && item.readiness_status !== readinessFilter) {
      return false;
    }
    if (readinessSearch.trim()) {
      const q = readinessSearch.toLowerCase();
      return (
        item.scholarship_name.toLowerCase().includes(q) ||
        item.provider.toLowerCase().includes(q) ||
        item.checklist.some((c) => c.name.toLowerCase().includes(q) || c.document_type.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Filtered documents for ledger
  const filteredDocs = documents.filter((doc) => {
    const matchesSearch =
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.document_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.original_filename && doc.original_filename.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (statusFilter === "ALL") return true;
    if (statusFilter === "AUTOMATED_PASSED")
      return doc.verification_status === "AUTOMATED_CHECKS_PASSED" || doc.status === "VERIFIED";
    if (statusFilter === "NEEDS_REVIEW")
      return doc.verification_status === "NEEDS_HUMAN_REVIEW" || doc.status === "NEEDS_VERIFICATION";
    if (statusFilter === "REJECTED")
      return doc.verification_status === "REJECTED";
    if (statusFilter === "OFFICIALLY_VERIFIED")
      return doc.verification_status === "OFFICIALLY_VERIFIED";
    if (statusFilter === "MISSING")
      return doc.status === "MISSING";

    return true;
  });

  const renderReadinessBadge = (status: "READY" | "MISSING_DOCUMENTS" | "NEEDS_REVIEW") => {
    switch (status) {
      case "READY":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Ready to Prepare / Apply
          </span>
        );
      case "NEEDS_REVIEW":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            Needs Document Review
          </span>
        );
      case "MISSING_DOCUMENTS":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-300 border border-rose-500/30">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            Missing Required Documents
          </span>
        );
    }
  };

  const renderVerificationBadge = (doc: DocumentItem) => {
    const vStatus = doc.verification_status || (doc.status === "VERIFIED" ? "AUTOMATED_CHECKS_PASSED" : doc.status);

    switch (vStatus) {
      case "OFFICIALLY_VERIFIED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-600/10 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
            Officially Verified
          </span>
        );
      case "AUTOMATED_CHECKS_PASSED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Automated Checks Passed
          </span>
        );
      case "NEEDS_HUMAN_REVIEW":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            Needs Review / Confirmation
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-300 border border-rose-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            Rejected
          </span>
        );
      case "PROCESSING":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-spin"></span>
            Processing
          </span>
        );
      case "AVAILABLE":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/30">
            Available
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-stone-500/10 text-stone-400 border border-stone-500/20">
            {doc.status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-16 text-stone-100">
      {/* Page Header */}
      <div className="bg-stone-900 rounded-2xl border border-stone-800 p-6 md:p-8 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center space-x-2 text-xs text-stone-400 mb-1.5">
              <Link href="/" className="hover:text-red-400 transition-colors">
                Dashboard
              </Link>
              <span>/</span>
              <span className="text-stone-200 font-medium">Document Vault & Application Readiness</span>
            </div>
            <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full bg-red-950/60 text-red-400 border border-red-900/50 text-[10px] font-mono font-bold uppercase tracking-wider mb-1.5">
              <span>Evidence Vault & AI Document Assistant</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-stone-100">
              Document Checklist & Application Readiness
            </h1>
            <p className="text-xs sm:text-sm font-serif text-stone-400 max-w-2xl mt-1.5 leading-relaxed">
              Verify your documents against each scholarship&apos;s statutory requirements. AI extracts structured fields with zero fabrication so you can review, confirm, and prepare complete application dossiers.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-center min-w-[100px]">
              <span className="block text-xl font-bold text-stone-100 font-mono">
                {readinessOverview?.total_documents_uploaded ?? documents.length}
              </span>
              <span className="text-[11px] text-stone-400 uppercase font-semibold">In Vault</span>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5 text-center min-w-[100px]">
              <span className="block text-xl font-bold text-emerald-400 font-mono">
                {readinessOverview?.ready_scholarships_count ?? 0}
              </span>
              <span className="text-[11px] text-emerald-300 uppercase font-semibold">Ready to Apply</span>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2.5 text-center min-w-[100px]">
              <span className="block text-xl font-bold text-amber-400 font-mono">
                {readinessOverview?.pending_scholarships_count ?? 0}
              </span>
              <span className="text-[11px] text-amber-300 uppercase font-semibold">Missing Proofs</span>
            </div>
          </div>
        </div>
      </div>

      {/* Privacy, Security & Official Portal Commitment Banner */}
      <div className="bg-stone-900/80 border border-stone-800 rounded-2xl p-5 shadow-xs space-y-3">
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
          <h2 className="text-xs font-bold text-stone-200 uppercase tracking-wider font-mono">
            Privacy, Security & Official Application Principles
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-stone-300">
          <div className="p-3.5 rounded-xl bg-stone-950/60 border border-stone-800 space-y-1">
            <div className="font-bold text-stone-100 flex items-center space-x-1.5">
              <span className="text-red-400">🛡</span>
              <span>Uploads are Completely Optional</span>
            </div>
            <p className="text-stone-400 text-[11px] leading-relaxed">
              You can explore schemes, inspect eligibility, and review document checklists without uploading any files. Uploads are strictly to test application readiness and prepare dossiers.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-stone-950/60 border border-stone-800 space-y-1">
            <div className="font-bold text-stone-100 flex items-center space-x-1.5">
              <span className="text-red-400">🔒</span>
              <span>Owner-Restricted & Encrypted Storage</span>
            </div>
            <p className="text-stone-400 text-[11px] leading-relaxed">
              Documents are stored with unguessable keys, validated with magic bytes and SHA-256 hashes, and isolated strictly to your account. We never expose your sensitive data.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-stone-950/60 border border-stone-800 space-y-1">
            <div className="font-bold text-stone-100 flex items-center space-x-1.5">
              <span className="text-red-400">🏛</span>
              <span>Official Portal Submission Required</span>
            </div>
            <p className="text-stone-400 text-[11px] leading-relaxed">
              <strong>We never auto-submit.</strong> SCHOLARAi organizes your verified documents, but you must visit the official scholarship portal to complete and submit your application.
            </p>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {toastMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 text-sm font-semibold rounded-xl flex items-center justify-between shadow-2xs">
          <div className="flex items-center space-x-2">
            <span className="text-emerald-400 text-base">✓</span>
            <span>{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-emerald-400 font-bold ml-2 text-base leading-none"
          >
            &times;
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-200 text-sm font-semibold rounded-xl flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-rose-400 text-base">⚠</span>
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-rose-400 font-bold ml-2 text-base leading-none"
          >
            &times;
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-stone-800 space-x-2 sm:space-x-4">
        <button
          onClick={() => setActiveTab("READINESS")}
          className={`pb-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors flex items-center space-x-2 ${
            activeTab === "READINESS"
              ? "border-red-600 text-red-400"
              : "border-transparent text-stone-400 hover:text-stone-200"
          }`}
        >
          <span>Scholarship Document Checklists & Readiness</span>
          {readinessOverview?.ready_scholarships_count !== undefined && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-stone-800 text-stone-300">
              {readinessOverview.ready_scholarships_count} ready
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("UPLOAD")}
          className={`pb-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors flex items-center space-x-2 ${
            activeTab === "UPLOAD"
              ? "border-red-600 text-red-400"
              : "border-transparent text-stone-400 hover:text-stone-200"
          }`}
        >
          <span>Upload Document</span>
          {fileToUpload && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>}
        </button>

        <button
          onClick={() => setActiveTab("REPOSITORY")}
          className={`pb-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors flex items-center space-x-2 ${
            activeTab === "REPOSITORY"
              ? "border-red-600 text-red-400"
              : "border-transparent text-stone-400 hover:text-stone-200"
          }`}
        >
          <span>Vault Repository Ledger</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-stone-800 text-stone-300">
            {documents.length}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: Scholarship-Specific Document Checklists & Application Readiness   */}
      {/* ========================================================================= */}
      {activeTab === "READINESS" && (
        <div className="space-y-6">
          {/* Filter and Search Bar */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono text-stone-400 uppercase tracking-wider mr-1">
                Filter by Status:
              </span>
              {(["ALL", "READY", "MISSING_DOCUMENTS", "NEEDS_REVIEW"] as const).map((filterVal) => (
                <button
                  key={filterVal}
                  onClick={() => setReadinessFilter(filterVal)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    readinessFilter === filterVal
                      ? "bg-red-600 text-white"
                      : "bg-stone-800 text-stone-300 hover:bg-stone-700"
                  }`}
                >
                  {filterVal === "ALL" && "All Scholarships"}
                  {filterVal === "READY" && "Ready to Apply"}
                  {filterVal === "MISSING_DOCUMENTS" && "Missing Documents"}
                  {filterVal === "NEEDS_REVIEW" && "Needs Review"}
                </button>
              ))}
            </div>

            <div className="w-full md:w-72">
              <input
                type="text"
                placeholder="Search scholarships or documents..."
                value={readinessSearch}
                onChange={(e) => setReadinessSearch(e.target.value)}
                className="w-full px-3.5 py-1.5 rounded-lg bg-stone-950 border border-stone-800 text-xs text-stone-200 focus:outline-none focus:border-red-500 placeholder-stone-500 font-sans"
              />
            </div>
          </div>

          {loadingReadiness ? (
            <div className="p-16 text-center text-xs text-stone-400">
              <span className="inline-block animate-spin mr-2">⟳</span>
              Evaluating scholarship document checklists against your vault...
            </div>
          ) : filteredReadinessItems.length === 0 ? (
            <div className="p-16 text-center text-xs text-stone-400 border border-dashed border-stone-800 rounded-2xl">
              No scholarships found matching the selected readiness filter.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredReadinessItems.map((item) => {
                const isExpanded = expandedScholarshipId === item.scholarship_id;
                return (
                  <div
                    key={item.scholarship_id}
                    className="bg-stone-900 border border-stone-800 rounded-2xl p-5 md:p-6 shadow-xs space-y-4 transition-colors"
                  >
                    {/* Header Row */}
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base sm:text-lg font-serif font-bold text-stone-100">
                            {item.scholarship_name}
                          </h3>
                          {item.dossier_index && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-stone-800 text-stone-300">
                              {item.dossier_index}
                            </span>
                          )}
                          {item.has_application && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-950/60 text-red-300 border border-red-900/50">
                              Active Application
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-stone-400">{item.provider}</p>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-400 pt-1 font-mono">
                          <span>
                            Award Amount:{" "}
                            <strong className="text-red-400 font-bold">{formatINR(item.amount)}</strong>
                          </span>
                          <span>&bull;</span>
                          <span>
                            Deadline: <strong className="text-stone-200">{item.deadline}</strong>
                          </span>
                          <span>&bull;</span>
                          <span>
                            Required Proofs:{" "}
                            <strong className="text-stone-200">
                              {item.completed_required} of {item.total_required} Uploaded
                            </strong>
                          </span>
                        </div>
                      </div>

                      {/* Status Badge & Actions */}
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 flex-shrink-0">
                        {renderReadinessBadge(item.readiness_status)}

                        {item.official_portal_url && (
                          <a
                            href={item.official_portal_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-800 hover:bg-stone-700 text-stone-200 transition-colors border border-stone-700/60"
                            title="Visit official portal for submission"
                          >
                            <span>Official Portal</span>
                            <span className="text-[10px]">↗</span>
                          </a>
                        )}

                        {item.has_application && item.application_id && (
                          <Link
                            href={`/applications/${item.application_id}`}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors"
                          >
                            Application Workspace
                          </Link>
                        )}

                        <button
                          onClick={() => setExpandedScholarshipId(isExpanded ? null : item.scholarship_id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-800 hover:bg-stone-700 text-stone-300 transition-colors border border-stone-800"
                        >
                          {isExpanded ? "Hide Requirements ▲" : "View Checklist ▼"}
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono text-stone-400">
                        <span>Document Readiness</span>
                        <span>{item.readiness_percentage}% Completed</span>
                      </div>
                      <div className="w-full bg-stone-950 rounded-full h-2 overflow-hidden border border-stone-800">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${
                            item.readiness_percentage === 100
                              ? "bg-emerald-500"
                              : item.readiness_percentage > 50
                              ? "bg-amber-500"
                              : "bg-red-600"
                          }`}
                          style={{ width: `${item.readiness_percentage}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Expandable Document Checklist */}
                    {isExpanded && (
                      <div className="pt-4 border-t border-stone-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-stone-200 uppercase tracking-wider font-mono">
                            Scheme-Specific Required Evidence ({item.checklist.length} items)
                          </h4>
                          <span className="text-[11px] text-stone-400">
                            Based on official Tamil Nadu departmental guidelines
                          </span>
                        </div>

                        <div className="space-y-2.5">
                          {item.checklist.map((check, idx) => (
                            <div
                              key={check.id || idx}
                              className={`p-4 rounded-xl border transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                                check.is_uploaded && check.document_status === "VERIFIED"
                                  ? "bg-stone-950/60 border-stone-800"
                                  : check.is_uploaded
                                  ? "bg-stone-950/60 border-amber-900/30"
                                  : "bg-stone-950/80 border-stone-800/90"
                              }`}
                            >
                              <div className="space-y-1 flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-semibold text-stone-100">
                                    {check.name}
                                  </span>
                                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-stone-800 text-stone-400">
                                    {check.document_type}
                                  </span>
                                  {check.is_required ? (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-950/50 text-red-400 border border-red-900/40">
                                      Mandatory
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-stone-800 text-stone-400">
                                      Optional
                                    </span>
                                  )}
                                </div>

                                {/* Why Requested explanation */}
                                <p className="text-xs text-stone-400 leading-relaxed">
                                  <strong className="text-stone-300">Why requested: </strong>
                                  {check.why_requested}
                                </p>

                                {/* Extracted information preview */}
                                {check.is_uploaded && check.extracted_summary && (
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-emerald-400/90 pt-1 font-mono">
                                    <span>Uploaded: {check.document_name}</span>
                                    {Boolean(check.extracted_summary.student_name) && (
                                      <span>&bull; Name: {String(check.extracted_summary.student_name)}</span>
                                    )}
                                    {Boolean(check.extracted_summary.annual_income) && (
                                      <span>
                                        &bull; Income: {formatINR(Number(check.extracted_summary.annual_income))}
                                      </span>
                                    )}
                                    {Boolean(check.extracted_summary.certificate_number) && (
                                      <span>&bull; Cert #: {String(check.extracted_summary.certificate_number)}</span>
                                    )}
                                    {check.student_confirmed && (
                                      <span className="text-emerald-400 font-bold">✓ Verified by you</span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Action Buttons */}
                              <div className="flex items-center space-x-2 flex-shrink-0">
                                {check.is_uploaded && check.document_id ? (
                                  <>
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                      <span>✓</span> Uploaded
                                    </span>
                                    <button
                                      onClick={() => setInspectingDocId(check.document_id!)}
                                      className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg text-xs font-semibold transition-colors border border-stone-700/60"
                                    >
                                      Review & Confirm
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20">
                                      <span>✕</span> Missing
                                    </span>
                                    <button
                                      onClick={() => handleSelectMissingForUpload(check.document_type)}
                                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-2xs"
                                    >
                                      Upload Proof Now
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: Private Vault & Binary Upload Zone                                 */}
      {/* ========================================================================= */}
      {activeTab === "UPLOAD" && (
        <div className="bg-stone-900 rounded-2xl border border-stone-800 p-6 md:p-8 shadow-xs space-y-6">
          <div>
            <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full bg-red-950/60 text-red-400 border border-red-900/50 text-[10px] font-mono font-bold uppercase tracking-wider mb-1.5">
              <span>Secure Document Ingestion</span>
            </div>
            <h2 className="text-xl font-serif font-bold text-stone-100">Upload Document into Private Vault</h2>
            <p className="text-xs text-stone-400 mt-1">
              Documents are encrypted and stored in private storage with unguessable server-generated keys.
              Supported formats: <strong>PDF, JPG, PNG</strong> (max 10 MB). File integrity verified via SHA-256 and magic-byte checks.
            </p>
          </div>

          <form onSubmit={handleUploadSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-300 uppercase tracking-wider mb-1.5">
                  Document Category *
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-800 bg-stone-950 text-stone-100 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                >
                  {DOCUMENT_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-stone-400 mt-1">
                  {DOCUMENT_CATEGORIES.find((c) => c.value === selectedCategory)?.hint}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 uppercase tracking-wider mb-1.5">
                  Notes or Issuing Context (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Issued by Tahsildar Pune/Chennai, valid for AY 2024-25"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-800 bg-stone-950 text-stone-100 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
                <p className="text-[11px] text-stone-400 mt-1">
                  Reference number, issuing date, or local authority notes for verification records.
                </p>
              </div>
            </div>

            {/* Drag & Drop File Box */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${
                isDragging
                  ? "border-red-500 bg-red-950/30"
                  : fileToUpload
                  ? "border-emerald-500/60 bg-emerald-950/10"
                  : "border-stone-800 hover:border-stone-700 bg-stone-950/50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                className="hidden"
              />

              {fileToUpload ? (
                <div className="space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-full bg-emerald-950/40 text-emerald-400 flex items-center justify-center text-xl font-bold">
                    ✓
                  </div>
                  <div className="text-sm font-bold text-stone-100">{fileToUpload.name}</div>
                  <div className="text-xs text-stone-400 font-mono">
                    {(fileToUpload.size / 1024).toFixed(1)} KB &bull; {fileToUpload.type || "Document"}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFileToUpload(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="text-xs text-rose-400 hover:text-rose-300 font-medium underline pt-1"
                  >
                    Choose a different file
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-full bg-red-950/40 text-red-400 flex items-center justify-center text-xl font-bold">
                    ↑
                  </div>
                  <div className="text-sm font-bold text-stone-200">
                    Drag and drop your document here, or click to browse
                  </div>
                  <div className="text-xs text-stone-400 max-w-md mx-auto">
                    Supported formats: <strong>PDF, JPG, PNG</strong> up to <strong>10 MB</strong>.
                    Files undergo magic-byte signature validation and optical text layer parsing.
                  </div>
                </div>
              )}
            </div>

            {/* Progress Indicator */}
            {isUploading && (
              <div className="space-y-2 p-4 bg-red-950/30 border border-red-900/40 rounded-xl">
                <div className="flex items-center justify-between text-xs text-red-300 font-medium">
                  <span>{uploadProgress || "Uploading..."}</span>
                  <span className="animate-spin text-sm">⟳</span>
                </div>
                <div className="w-full bg-stone-950 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-red-600 h-1.5 rounded-full w-3/4 animate-pulse"></div>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center pt-2">
              <span className="text-[11px] text-stone-400">
                AI will parse text fields from this document so you can review and confirm them.
              </span>
              <button
                type="submit"
                disabled={!fileToUpload || isUploading}
                className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isUploading ? "Uploading & Extracting..." : "Upload & Run AI Assistance"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: Registered Documents Repository Ledger                             */}
      {/* ========================================================================= */}
      {activeTab === "REPOSITORY" && (
        <div className="bg-stone-900 rounded-2xl border border-stone-800 p-6 md:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-800 pb-5">
            <div>
              <h2 className="text-lg font-bold text-stone-100">Registered Documents & Verification Ledger</h2>
              <p className="text-xs text-stone-400 mt-0.5">
                Inspect AI-extracted fields, rule checks, and confirmation logs for each credential
              </p>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3.5 py-1.5 rounded-lg border border-stone-800 bg-stone-950 text-xs text-stone-100 focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-stone-500 font-sans"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-stone-800 bg-stone-950 text-xs text-stone-200 focus:outline-none focus:ring-2 focus:ring-red-500 font-medium"
              >
                <option value="ALL">All Statuses ({documents.length})</option>
                <option value="AUTOMATED_PASSED">Automated Checks Passed</option>
                <option value="NEEDS_REVIEW">Needs Review / Confirmation</option>
                <option value="OFFICIALLY_VERIFIED">Officially Verified</option>
                <option value="REJECTED">Rejected</option>
                <option value="MISSING">Missing</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-xs text-stone-400">
              <span className="inline-block animate-spin mr-2">⟳</span> Loading verified document records...
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="p-12 text-center text-xs text-stone-400 border border-dashed border-stone-800 rounded-xl">
              No documents found matching the selected filter.
            </div>
          ) : (
            <div className="divide-y divide-stone-800">
              {filteredDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-stone-950/40 px-3 -mx-3 rounded-xl transition-colors"
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-stone-100 truncate">
                        {doc.original_filename || doc.name}
                      </h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-stone-800 text-stone-300">
                        {doc.document_type}
                      </span>
                      {doc.file_size && (
                        <span className="text-[11px] text-stone-400 font-mono">
                          {(doc.file_size / 1024).toFixed(1)} KB
                        </span>
                      )}
                      {doc.extracted_data?.student_confirmed && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          ✓ Confirmed by Student
                        </span>
                      )}
                    </div>

                    {doc.notes && (
                      <p className="text-xs text-stone-400 line-clamp-1">
                        {doc.notes}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-stone-400 pt-0.5 font-mono">
                      <span>
                        Active in: <strong className="text-stone-300">{doc.affected_applications_count} application(s)</strong>
                      </span>

                      {doc.potential_funding_affected > 0 && (
                        <span className="text-amber-400 font-semibold font-mono">
                          Funding affected: {formatINR(doc.potential_funding_affected)}
                        </span>
                      )}

                      {doc.expiry_date && (
                        <span>
                          Expires: <strong className="text-stone-300 font-mono">{new Date(doc.expiry_date).toLocaleDateString()}</strong>
                        </span>
                      )}

                      {doc.content_hash && (
                        <span
                          className="font-mono text-[10px] text-stone-500 truncate max-w-xs"
                          title={`SHA-256: ${doc.content_hash}`}
                        >
                          Hash: {doc.content_hash.slice(0, 10)}...
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 flex-shrink-0">
                    {renderVerificationBadge(doc)}

                    {/* Actions */}
                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => setInspectingDocId(doc.id)}
                        className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg text-xs font-semibold transition-colors border border-stone-700/60"
                      >
                        AI Review & Details
                      </button>

                      {doc.storage_key && (
                        <a
                          href={getDocumentDownloadUrl(doc.id, false)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg text-xs font-semibold transition-colors border border-stone-800"
                        >
                          Download
                        </a>
                      )}

                      <button
                        onClick={() => setDeletingDocId(doc.id)}
                        className="px-2.5 py-1.5 text-rose-400 hover:bg-rose-950/40 rounded-lg text-xs font-semibold transition-colors"
                        title="Delete document"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* AI Document Assistance & Student Confirmation Modal */}
      <AIDocumentReviewModal
        document={inspectingDoc}
        isOpen={inspectingDocId !== null}
        onClose={() => setInspectingDocId(null)}
        onConfirmed={async () => {
          setToastMessage("Extracted details confirmed! Application readiness recalculated.");
          setInspectingDocId(null);
          await loadData();
        }}
        onReExtract={handleReExtract}
        isReExtracting={isReExtracting}
      />

      {/* Deletion Confirmation Modal */}
      {deletingDocId !== null && (
        <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 rounded-2xl border border-stone-800 max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-stone-100">Confirm Document Deletion</h3>
            <p className="text-xs text-stone-400 leading-relaxed">
              Are you sure you want to delete this document? The binary file will be permanently removed from private storage, and any dependent scholarship application requirements will be marked as missing.
            </p>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setDeletingDocId(null)}
                disabled={isDeleting}
                className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
