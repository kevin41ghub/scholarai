"use client";

import { useState } from "react";
import { DocumentItem } from "@/types/student";
import { confirmExtractedDocument, formatINR, getDocumentDownloadUrl } from "@/lib/api";

interface AIDocumentReviewModalProps {
  document: DocumentItem | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmed: () => void;
  onReExtract: (docId: number) => Promise<void>;
  isReExtracting: boolean;
}

function AIDocumentReviewModalContent({
  document,
  onClose,
  onConfirmed,
  onReExtract,
  isReExtracting,
}: {
  document: DocumentItem;
  onClose: () => void;
  onConfirmed: () => void;
  onReExtract: (docId: number) => Promise<void>;
  isReExtracting: boolean;
}) {
  const fields = (document.extracted_data?.extracted_fields || {}) as Record<string, unknown>;

  const [studentName, setStudentName] = useState(() => String(fields.student_name || ""));
  const [annualIncome, setAnnualIncome] = useState<string>(() =>
    fields.annual_income !== undefined && fields.annual_income !== null ? String(fields.annual_income) : ""
  );
  const [certificateNumber, setCertificateNumber] = useState(() => String(fields.certificate_number || ""));
  const [issueDate, setIssueDate] = useState(() => String(fields.issue_date || ""));
  const [expiryDate, setExpiryDate] = useState(() => String(fields.expiry_date || ""));
  const [cgpa, setCgpa] = useState(() =>
    fields.cgpa !== undefined && fields.cgpa !== null ? String(fields.cgpa) : ""
  );
  const [percentage, setPercentage] = useState(() =>
    fields.percentage !== undefined && fields.percentage !== null ? String(fields.percentage) : ""
  );
  const [issuingAuthority, setIssuingAuthority] = useState(() => String(fields.issuing_authority || ""));
  const [applyToProfile, setApplyToProfile] = useState(true);
  const [studentConsent, setStudentConsent] = useState(() => Boolean(document.extracted_data?.student_confirmed));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isIncomeDoc = document.document_type.includes("INCOME");
  const isAcademicDoc =
    document.document_type.includes("MARKSHEET") ||
    document.document_type.includes("TRANSCRIPT") ||
    document.document_type.includes("ACADEMIC");

  const handleSaveConfirmation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentConsent) {
      setError("Please check the confirmation box to verify that these details match your physical document.");
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      const confirmedFields: Record<string, unknown> = {};
      if (studentName.trim()) confirmedFields.student_name = studentName.trim();
      if (certificateNumber.trim()) confirmedFields.certificate_number = certificateNumber.trim();
      if (issueDate.trim()) confirmedFields.issue_date = issueDate.trim();
      if (expiryDate.trim()) confirmedFields.expiry_date = expiryDate.trim();
      if (issuingAuthority.trim()) confirmedFields.issuing_authority = issuingAuthority.trim();

      if (isIncomeDoc && annualIncome.trim()) {
        const inc = parseFloat(annualIncome.replace(/,/g, ""));
        if (!isNaN(inc)) confirmedFields.annual_income = inc;
      }

      if (isAcademicDoc) {
        if (cgpa.trim()) {
          const val = parseFloat(cgpa);
          if (!isNaN(val)) confirmedFields.cgpa = val;
        }
        if (percentage.trim()) {
          const val = parseFloat(percentage);
          if (!isNaN(val)) confirmedFields.percentage = val;
        }
      }

      await confirmExtractedDocument(document.id, {
        confirmed_fields: confirmedFields,
        apply_to_profile: applyToProfile,
      });

      setSuccessMsg("Details successfully confirmed and saved to your application evidence record!");
      setTimeout(() => {
        onConfirmed();
      }, 700);
    } catch (err: unknown) {
      setError((err as Error)?.message || "Failed to confirm extracted details.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6 text-stone-100 my-auto">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-stone-800 pb-4">
        <div>
          <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full bg-red-950/60 text-red-400 border border-red-900/50 text-[10px] font-mono font-bold uppercase tracking-wider mb-1.5">
            <span>AI Document Assistance & Inspection</span>
          </div>
          <h3 className="text-xl font-serif font-bold text-stone-100">
            {document.original_filename || document.name}
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-400 mt-1 font-mono">
            <span>Category: {document.document_type}</span>
            <span>&bull;</span>
            {document.file_size && (
              <span>{(document.file_size / 1024).toFixed(1)} KB</span>
            )}
            {document.content_hash && (
              <>
                <span>&bull;</span>
                <span title={`SHA-256: ${document.content_hash}`}>
                  Hash: {document.content_hash.slice(0, 10)}...
                </span>
              </>
            )}
          </div>
        </div>

        <button
          onClick={onClose}
          className="text-stone-400 hover:text-stone-100 text-2xl font-bold leading-none p-1 transition-colors"
          aria-label="Close"
        >
          &times;
        </button>
      </div>

      {/* Core Principle Notice */}
      <div className="p-4 bg-stone-950/60 border border-stone-800 rounded-xl text-xs space-y-1.5 text-stone-300">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-red-500"></span>
          <span className="font-bold text-stone-100 uppercase tracking-wider text-[11px]">
            AI Assists. Official Sources Decide. Student Approves.
          </span>
        </div>
        <p className="leading-relaxed">
          SCHOLARAi extracts readable text and OCR layers from your uploaded document to accelerate application preparation.
          <strong> We never invent or fabricate information.</strong> Please review each extracted field below to verify that it precisely matches your physical official certificate.
        </p>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3 bg-red-950/50 border border-red-800 text-red-200 text-xs rounded-xl flex items-center space-x-2">
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-emerald-950/50 border border-emerald-800 text-emerald-200 text-xs rounded-xl flex items-center space-x-2">
          <span>✓</span>
          <span>{successMsg}</span>
        </div>
      )}

      {/* Student Review & Confirmation Form */}
      <form onSubmit={handleSaveConfirmation} className="space-y-5">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-stone-200 uppercase tracking-wider font-mono">
              Extracted Fields & Student Verification
            </h4>
            {document.extracted_data?.student_confirmed && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <span>✓</span> Confirmed by Student
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Student Name */}
            <div>
              <label className="block text-[11px] font-semibold text-stone-300 mb-1">
                Candidate Name on Certificate
              </label>
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="e.g. Arjun Kumar"
                className="w-full px-3 py-2 rounded-lg bg-stone-950 border border-stone-800 text-stone-100 focus:outline-none focus:border-red-500 text-xs font-sans"
              />
              <span className="text-[10px] text-stone-500 mt-0.5 block">
                Verify spelling against your official government identity proof.
              </span>
            </div>

            {/* Certificate / Ref Number */}
            <div>
              <label className="block text-[11px] font-semibold text-stone-300 mb-1">
                Certificate / Reference Number
              </label>
              <input
                type="text"
                value={certificateNumber}
                onChange={(e) => setCertificateNumber(e.target.value)}
                placeholder="e.g. TN/REV/2025/10492"
                className="w-full px-3 py-2 rounded-lg bg-stone-950 border border-stone-800 text-stone-100 focus:outline-none focus:border-red-500 text-xs font-mono"
              />
              <span className="text-[10px] text-stone-500 mt-0.5 block">
                Required by portal authorities to cross-check verification databases.
              </span>
            </div>

            {/* Issuing Authority */}
            <div>
              <label className="block text-[11px] font-semibold text-stone-300 mb-1">
                Issuing Authority
              </label>
              <input
                type="text"
                value={issuingAuthority}
                onChange={(e) => setIssuingAuthority(e.target.value)}
                placeholder="e.g. Revenue Department / Tahsildar Chennai"
                className="w-full px-3 py-2 rounded-lg bg-stone-950 border border-stone-800 text-stone-100 focus:outline-none focus:border-red-500 text-xs font-sans"
              />
            </div>

            {/* Annual Income (For Income Certificates) */}
            {isIncomeDoc && (
              <div>
                <label className="block text-[11px] font-semibold text-stone-300 mb-1">
                  Annual Family Income (INR)
                </label>
                <input
                  type="number"
                  value={annualIncome}
                  onChange={(e) => setAnnualIncome(e.target.value)}
                  placeholder="e.g. 195000"
                  className="w-full px-3 py-2 rounded-lg bg-stone-950 border border-stone-800 text-stone-100 focus:outline-none focus:border-red-500 text-xs font-mono"
                />
                {annualIncome && !isNaN(Number(annualIncome)) && (
                  <span className="text-[10px] text-emerald-400 mt-0.5 block font-mono">
                    Formatted: {formatINR(Number(annualIncome))}
                  </span>
                )}
              </div>
            )}

            {/* Academic Scores (For Marksheets/Transcripts) */}
            {isAcademicDoc && (
              <>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-300 mb-1">
                    CGPA / SGPA
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="10"
                    value={cgpa}
                    onChange={(e) => setCgpa(e.target.value)}
                    placeholder="e.g. 8.75"
                    className="w-full px-3 py-2 rounded-lg bg-stone-950 border border-stone-800 text-stone-100 focus:outline-none focus:border-red-500 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-300 mb-1">
                    Percentage (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={percentage}
                    onChange={(e) => setPercentage(e.target.value)}
                    placeholder="e.g. 88.5"
                    className="w-full px-3 py-2 rounded-lg bg-stone-950 border border-stone-800 text-stone-100 focus:outline-none focus:border-red-500 text-xs font-mono"
                  />
                </div>
              </>
            )}

            {/* Issue Date */}
            <div>
              <label className="block text-[11px] font-semibold text-stone-300 mb-1">
                Issue Date
              </label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-stone-950 border border-stone-800 text-stone-100 focus:outline-none focus:border-red-500 text-xs font-mono"
              />
            </div>

            {/* Expiry Date */}
            <div>
              <label className="block text-[11px] font-semibold text-stone-300 mb-1">
                Validity / Expiry Date (Optional)
              </label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-stone-950 border border-stone-800 text-stone-100 focus:outline-none focus:border-red-500 text-xs font-mono"
              />
              <span className="text-[10px] text-stone-500 mt-0.5 block">
                Leave blank if the certificate has permanent statutory validity.
              </span>
            </div>
          </div>
        </div>

        {/* Extraction Notes & Technical Signals */}
        {document.extracted_data?.extraction_notes && document.extracted_data.extraction_notes.length > 0 && (
          <div className="p-3 bg-stone-950/70 border border-stone-800/80 rounded-xl text-xs space-y-1">
            <span className="font-bold text-stone-300 block text-[11px] uppercase tracking-wider font-mono">
              Extraction Notes & Technical Audit:
            </span>
            <ul className="list-disc list-inside text-stone-400 space-y-0.5 text-[11px]">
              {document.extracted_data.extraction_notes.map((note, idx) => (
                <li key={idx}>{note}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Rule-Based Verification Results */}
        {document.verification_results && document.verification_results.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-[11px] font-bold text-stone-300 uppercase tracking-wider font-mono">
              Rule-Based Format Verification ({document.verification_results.length} checks)
            </h5>
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {document.verification_results.map((check, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg border border-stone-800 bg-stone-950/50 text-[11px] flex items-center justify-between"
                >
                  <div>
                    <span className="font-semibold text-stone-200">{check.check_name}</span>
                    <p className="text-stone-400 text-[10px]">{check.reason}</p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      check.outcome === "PASSED"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : check.outcome === "WARNING"
                        ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                        : "bg-red-500/10 text-red-400 border border-red-500/20"
                    }`}
                  >
                    {check.outcome}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Student Consent & Sync Options */}
        <div className="pt-2 border-t border-stone-800 space-y-2.5">
          <label className="flex items-start space-x-2.5 cursor-pointer text-xs">
            <input
              type="checkbox"
              checked={applyToProfile}
              onChange={(e) => setApplyToProfile(e.target.checked)}
              className="mt-0.5 rounded bg-stone-950 border-stone-700 text-red-600 focus:ring-red-500"
            />
            <span className="text-stone-300">
              <strong>Apply confirmed values to my student profile:</strong> Updates your saved profile with the confirmed annual income, CGPA, or marks for future eligibility matching.
            </span>
          </label>

          <label className="flex items-start space-x-2.5 cursor-pointer text-xs">
            <input
              type="checkbox"
              checked={studentConsent}
              onChange={(e) => setStudentConsent(e.target.checked)}
              className="mt-0.5 rounded bg-stone-950 border-stone-700 text-red-600 focus:ring-red-500"
            />
            <span className="text-stone-200 font-semibold">
              I have inspected and confirm that these extracted details accurately reflect my physical document issued by the official authority.
            </span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-stone-800">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => onReExtract(document.id)}
              disabled={isReExtracting}
              className="px-3.5 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {isReExtracting ? "Re-Extracting..." : "Re-Run Extraction"}
            </button>
            {document.storage_key && (
              <a
                href={getDocumentDownloadUrl(document.id, false)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl text-xs font-semibold transition-colors"
              >
                Download File
              </a>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!studentConsent || isSaving}
              className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {isSaving ? "Saving Confirmation..." : "Confirm & Save Extracted Details"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function AIDocumentReviewModal({
  document,
  isOpen,
  onClose,
  onConfirmed,
  onReExtract,
  isReExtracting,
}: AIDocumentReviewModalProps) {
  if (!isOpen || !document) return null;

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <AIDocumentReviewModalContent
        key={document.id}
        document={document}
        onClose={onClose}
        onConfirmed={onConfirmed}
        onReExtract={onReExtract}
        isReExtracting={isReExtracting}
      />
    </div>
  );
}
