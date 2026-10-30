"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  getDocuments,
  uploadDocumentFile,
  deleteDocument,
  reExtractDocument,
  getDocumentDownloadUrl,
  formatINR,
} from "@/lib/api";
import { DocumentItem } from "@/types/student";

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
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Upload Form State
  const [selectedCategory, setSelectedCategory] = useState("INCOME_CERTIFICATE");
  const [notes, setNotes] = useState("");
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Inspection Drawer
  const [inspectingDocId, setInspectingDocId] = useState<number | null>(null);
  const inspectingDoc = inspectingDocId ? documents.find((d) => d.id === inspectingDocId) || null : null;
  const [isReExtracting, setIsReExtracting] = useState(false);

  // Deletion Modal
  const [deletingDocId, setDeletingDocId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadDocs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getDocuments();
      setDocuments(data);
    } catch (err: unknown) {
      setError((err as Error)?.message || "Failed to load documents repository.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadDocs();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadDocs]);

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
      setError(`Invalid file format: ${ext}. Only PDF, JPG, and PNG are supported.`);
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
      await loadDocs();

      setToastMessage(
        `Document "${uploaded.name}" uploaded successfully! Status: ${uploaded.verification_status || uploaded.status}.`
      );
      setFileToUpload(null);
      setNotes("");
      if (fileInputRef.current) fileInputRef.current.value = "";
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
      await loadDocs();
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
      setToastMessage("Document and associated file deleted successfully.");
      setDeletingDocId(null);
      if (inspectingDocId === deletingDocId) setInspectingDocId(null);
      await loadDocs();
    } catch (err: unknown) {
      setError((err as Error)?.message || "Failed to delete document.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered documents
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

  const sharedBlockers = documents.filter((d) => d.is_shared_blocker);

  // Status badge renderer with transparent explanations
  const renderVerificationBadge = (doc: DocumentItem) => {
    const vStatus = doc.verification_status || (doc.status === "VERIFIED" ? "AUTOMATED_CHECKS_PASSED" : doc.status);

    switch (vStatus) {
      case "OFFICIALLY_VERIFIED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
            Officially Verified
          </span>
        );
      case "AUTOMATED_CHECKS_PASSED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Automated Checks Passed
          </span>
        );
      case "NEEDS_HUMAN_REVIEW":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            Needs Human Review
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-800 dark:text-rose-300 border border-rose-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            Rejected
          </span>
        );
      case "PROCESSING":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-spin"></span>
            Processing
          </span>
        );
      case "AVAILABLE":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/30">
            Available
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-500/10 text-slate-700 dark:text-slate-400 border border-slate-500/20">
            {doc.status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Page Header */}
      <div className="bg-white dark:bg-[#191c20] rounded-2xl border border-[#e6dfd3] dark:border-[#2f343d] p-6 md:p-8 shadow-xs transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center space-x-2 text-xs text-stone-500 dark:text-stone-400 mb-1.5">
              <Link href="/" className="hover:text-[#86192c] dark:hover:text-[#fb7185] transition-colors">Dashboard</Link>
              <span>/</span>
              <span className="text-stone-800 dark:text-stone-200 font-medium">Document Vault & Verification</span>
            </div>
            <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full bg-[#fff1f2] dark:bg-rose-950/40 text-[#86192c] dark:text-[#fb7185] border border-rose-200 dark:border-rose-900/50 text-[10px] font-mono font-bold uppercase tracking-wider mb-1.5">
              <span>Primary Evidence Vault</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-stone-900 dark:text-stone-100">
              Document Vault & Verification Engine
            </h1>
            <p className="text-xs sm:text-sm font-serif text-stone-600 dark:text-stone-400 max-w-2xl mt-1.5 leading-relaxed">
              Upload real academic transcripts, certificates, and income proofs into secure, encrypted private storage.
              Evaluated with real format signatures, text extraction, and transparent rule-based verification.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-[#fbf9f5] dark:bg-[#121417] border border-[#e6dfd3] dark:border-[#2f343d] rounded-xl px-4 py-2.5 text-center">
              <span className="block text-xl font-bold text-stone-900 dark:text-stone-100 font-mono">{documents.length}</span>
              <span className="text-[11px] text-stone-500 dark:text-stone-400 uppercase font-semibold">Total Documents</span>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2.5 text-center">
              <span className="block text-xl font-bold text-amber-700 dark:text-amber-400 font-mono">{sharedBlockers.length}</span>
              <span className="text-[11px] text-amber-800 dark:text-amber-300 uppercase font-semibold">Shared Blockers</span>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5 text-center">
              <span className="block text-xl font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                {documents.filter((d) => d.verification_status === "AUTOMATED_CHECKS_PASSED" || d.status === "VERIFIED").length}
              </span>
              <span className="text-[11px] text-emerald-800 dark:text-emerald-300 uppercase font-semibold">Checks Passed</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {toastMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 dark:text-emerald-200 text-sm font-semibold rounded-xl flex items-center justify-between shadow-2xs">
          <div className="flex items-center space-x-2">
            <span className="text-emerald-600 dark:text-emerald-400 text-base">✓</span>
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-emerald-700 dark:text-emerald-400 font-bold ml-2 text-base leading-none">&times;</button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-900 dark:text-rose-200 text-sm font-semibold rounded-xl flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-rose-600 dark:text-rose-400 text-base">⚠</span>
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-700 dark:text-rose-400 font-bold ml-2 text-base leading-none">&times;</button>
        </div>
      )}

      {/* Shared Blockers Banner */}
      {sharedBlockers.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
            <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              High-Impact Shared Blockers ({sharedBlockers.length})
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sharedBlockers.map((blocker) => (
              <div
                key={blocker.id}
                className="bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-xl p-5 shadow-xs space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                        Shared Blocker
                      </span>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1.5">{blocker.name}</h3>
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">Type: {blocker.document_type}</span>
                    </div>
                    {renderVerificationBadge(blocker)}
                  </div>

                  <div className="mt-3 p-3 bg-white dark:bg-slate-900 rounded-lg text-xs space-y-1 text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-800">
                    <p>
                      <span className="font-semibold text-slate-900 dark:text-white">Impact: </span>
                      Blocks <span className="font-bold text-rose-600 dark:text-rose-400">{blocker.affected_applications_count} active applications</span>.
                    </p>
                    <p>
                      <span className="font-semibold text-slate-900 dark:text-white">Potential Funding Affected: </span>
                      <span className="font-bold font-mono text-red-600 dark:text-red-400">{formatINR(blocker.potential_funding_affected)}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-amber-500/20">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Resolve blocker:</span>
                  <button
                    onClick={() => {
                      setSelectedCategory(blocker.document_type);
                      window.scrollTo({ top: 350, behavior: "smooth" });
                    }}
                    className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-2xs"
                  >
                    Upload Proof Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Real Binary Upload Zone */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-xs space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Upload Document into Private Vault</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Documents are encrypted and stored in private object storage with unguessable server-generated keys.
          </p>
        </div>

        <form onSubmit={handleUploadSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Document Category *
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
              >
                {DOCUMENT_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                {DOCUMENT_CATEGORIES.find((c) => c.value === selectedCategory)?.hint}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Notes or Issuing Context (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Issued by Tahsildar Office Pune, valid for AY 2025-26"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                Any specific reference number or authority notes for verification records.
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
                ? "border-red-500 bg-red-50 dark:bg-red-950/30"
                : fileToUpload
                ? "border-emerald-500/60 bg-emerald-50/20 dark:bg-emerald-950/10"
                : "border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 bg-slate-50/50 dark:bg-slate-800/30"
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
                <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xl font-bold">
                  ✓
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {fileToUpload.name}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  {(fileToUpload.size / 1024).toFixed(1)} KB &bull; {fileToUpload.type || "Document"}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFileToUpload(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 font-medium underline pt-1"
                >
                  Choose a different file
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="w-12 h-12 mx-auto rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center text-xl font-bold">
                  ↑
                </div>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Drag and drop your file here, or click to browse
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  Supported formats: <strong>PDF, JPG, PNG</strong>. Maximum file size: <strong>10 MB</strong>.
                  Files undergo magic-byte signature validation and SHA-256 hash checks.
                </div>
              </div>
            )}
          </div>

          {/* Progress Indicator */}
          {isUploading && (
            <div className="space-y-2 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-xl">
              <div className="flex items-center justify-between text-xs text-red-800 dark:text-red-300 font-medium">
                <span>{uploadProgress || "Uploading..."}</span>
                <span className="animate-spin text-sm">⟳</span>
              </div>
              <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                <div className="bg-red-600 h-1.5 rounded-full w-3/4 animate-pulse"></div>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!fileToUpload || isUploading}
              className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isUploading ? "Uploading & Verifying..." : "Upload & Run Verification Engine"}
            </button>
          </div>
        </form>
      </div>

      {/* Document Ledger / Repository */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Registered Documents & Verification Ledger</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Inspect extracted fields, transparency logs, and rule checks for each credential
            </p>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 font-medium"
            >
              <option value="ALL">All Statuses ({documents.length})</option>
              <option value="AUTOMATED_PASSED">Automated Checks Passed</option>
              <option value="NEEDS_REVIEW">Needs Human Review</option>
              <option value="OFFICIALLY_VERIFIED">Officially Verified</option>
              <option value="REJECTED">Rejected</option>
              <option value="MISSING">Missing</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 dark:text-slate-500">
            <span className="inline-block animate-spin mr-2">⟳</span> Loading verified document records...
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
            No documents found matching the selected filter.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredDocs.map((doc) => (
              <div
                key={doc.id}
                className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 px-3 -mx-3 rounded-xl transition-colors"
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {doc.original_filename || doc.name}
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {doc.document_type}
                    </span>
                    {doc.file_size && (
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                        {(doc.file_size / 1024).toFixed(1)} KB
                      </span>
                    )}
                  </div>

                  {doc.notes && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                      {doc.notes}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
                    <span>
                      Active in: <strong className="text-slate-700 dark:text-slate-300">{doc.affected_applications_count} application(s)</strong>
                    </span>

                    {doc.potential_funding_affected > 0 && (
                      <span className="text-amber-700 dark:text-amber-400 font-semibold font-mono">
                        Funding affected: {formatINR(doc.potential_funding_affected)}
                      </span>
                    )}

                    {doc.expiry_date && (
                      <span>
                        Expires: <strong className="text-slate-700 dark:text-slate-300 font-mono">{new Date(doc.expiry_date).toLocaleDateString()}</strong>
                      </span>
                    )}

                    {doc.content_hash && (
                      <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-xs" title={`SHA-256: ${doc.content_hash}`}>
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
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold transition-colors shadow-2xs"
                    >
                      Inspect Checks
                    </button>

                    {doc.storage_key && (
                      <a
                        href={getDocumentDownloadUrl(doc.id, false)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/50 rounded-lg text-xs font-semibold transition-colors"
                      >
                        Download
                      </a>
                    )}

                    <button
                      onClick={() => setDeletingDocId(doc.id)}
                      className="px-2.5 py-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg text-xs font-semibold transition-colors"
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

      {/* Verification Inspection Drawer / Modal */}
      {inspectingDoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 md:p-8 space-y-6">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Document Verification Transparency Inspector
                </span>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                  {inspectingDoc.name}
                </h3>
                <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  <span className="font-mono">Category: {inspectingDoc.document_type}</span>
                  <span>&bull;</span>
                  <span>Backend: {inspectingDoc.storage_backend || "local"}</span>
                </div>
              </div>

              <button
                onClick={() => setInspectingDocId(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-2xl font-bold leading-none"
              >
                &times;
              </button>
            </div>

            {/* Current Status Overview */}
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">Verification Status:</span>
                <div className="mt-1">{renderVerificationBadge(inspectingDoc)}</div>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">Extraction Engine:</span>
                <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                  {inspectingDoc.extraction_status || "COMPLETED"}
                </span>
              </div>
            </div>

            {/* Extracted Fields Section */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Extracted Structured Fields
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 dark:text-slate-500 block mb-0.5">Student Name:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {String(inspectingDoc.extracted_data?.extracted_fields?.student_name || "Not detected in text layer")}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 dark:text-slate-500 block mb-0.5">Issuing Authority:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {String(inspectingDoc.extracted_data?.extracted_fields?.issuing_authority || "Authority seal requires inspection")}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 dark:text-slate-500 block mb-0.5">Certificate / Ref Number:</span>
                  <span className="font-semibold font-mono text-slate-900 dark:text-white">
                    {String(inspectingDoc.extracted_data?.extracted_fields?.certificate_number || "N/A")}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 dark:text-slate-500 block mb-0.5">Recognized Validity Dates:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {inspectingDoc.extracted_data?.extracted_fields?.issue_date
                      ? `Issue: ${String(inspectingDoc.extracted_data.extracted_fields.issue_date)}`
                      : "Permanent / Undated"}
                    {Boolean(inspectingDoc.extracted_data?.extracted_fields?.expiry_date) &&
                      ` (Exp: ${String(inspectingDoc.extracted_data?.extracted_fields?.expiry_date)})`}
                  </span>
                </div>
              </div>

              {inspectingDoc.extracted_data?.extraction_notes && inspectingDoc.extracted_data.extraction_notes.length > 0 && (
                <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-lg text-xs space-y-1">
                  <span className="font-bold text-red-900 dark:text-red-300 block">Extraction Notes:</span>
                  <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-0.5">
                    {inspectingDoc.extracted_data.extraction_notes.map((note, idx) => (
                      <li key={idx}>{note}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Individual Rule Verification Checks */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Rule-Based Verification Breakdown ({inspectingDoc.verification_results?.length || 0} checks)
              </h4>

              <div className="space-y-2">
                {inspectingDoc.verification_results && inspectingDoc.verification_results.length > 0 ? (
                  inspectingDoc.verification_results.map((check, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-white">{check.check_name}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            check.outcome === "PASSED"
                              ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20"
                              : check.outcome === "WARNING"
                              ? "bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20"
                              : "bg-rose-500/10 text-rose-800 dark:text-rose-300 border border-rose-500/20"
                          }`}
                        >
                          {check.outcome}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-400">{check.reason}</p>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 pt-0.5 font-mono">
                        Method: {check.verification_method} &bull; Timestamp: {new Date(check.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    No verification records registered for this document.
                  </p>
                )}
              </div>

              <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 rounded-lg text-[11px] text-amber-800 dark:text-amber-300">
                <span className="font-bold block mb-0.5">Verification Integrity Notice</span>
                Automated checks establish file integrity, format signatures, and rule consistency. Official government verification requires direct integration with authorized DigiLocker APIs or human administrative verification.
              </div>
            </div>

            {/* Audit History */}
            {inspectingDoc.audit_history && inspectingDoc.audit_history.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Audit History
                </h4>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {inspectingDoc.audit_history.map((event, idx) => (
                    <div
                      key={idx}
                      className="p-2 bg-slate-50 dark:bg-slate-800/40 rounded text-[11px] flex items-center justify-between text-slate-600 dark:text-slate-400 font-mono"
                    >
                      <span>
                        <strong className="text-slate-800 dark:text-slate-200">{event.action}</strong>
                        {event.actor ? ` by ${event.actor}` : ""}
                        {event.reason ? ` - "${event.reason}"` : ""}
                      </span>
                      <span>{new Date(event.timestamp).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleReExtract(inspectingDoc.id)}
                  disabled={isReExtracting}
                  className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {isReExtracting ? "Re-Extracting..." : "Re-Run Verification"}
                </button>
                {inspectingDoc.storage_key && (
                  <a
                    href={getDocumentDownloadUrl(inspectingDoc.id, false)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold transition-colors"
                  >
                    Download File
                  </a>
                )}
              </div>

              <button
                onClick={() => setInspectingDocId(null)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deletion Confirmation Modal */}
      {deletingDocId !== null && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Confirm Document Deletion
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Are you sure you want to delete this document? The binary file will be removed from private storage, and any dependent scholarship application requirements will be marked as missing.
            </p>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setDeletingDocId(null)}
                disabled={isDeleting}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors"
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
