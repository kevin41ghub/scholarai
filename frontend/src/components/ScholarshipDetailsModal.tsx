"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { formatINR, getScholarshipDetail } from "@/lib/api";
import {
  ScholarshipRecommendationItem,
  ScholarshipDetail,
  DocumentItem,
  ScholarshipRequirement,
} from "@/types/student";

interface ScholarshipDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  scholarship: ScholarshipRecommendationItem | null;
  studentDocuments?: DocumentItem[];
}

export default function ScholarshipDetailsModal({
  isOpen,
  onClose,
  scholarship,
  studentDocuments = [],
}: ScholarshipDetailsModalProps) {
  const [detail, setDetail] = useState<ScholarshipDetail | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Fetch full detail if extra data is missing or to guarantee complete data
  useEffect(() => {
    if (!isOpen || !scholarship?.id) {
      return;
    }

    let isMounted = true;
    getScholarshipDetail(scholarship.id)
      .then((data) => {
        if (isMounted) {
          setDetail(data);
        }
      })
      .catch((err) => {
        console.warn("Could not fetch extra scholarship detail:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, scholarship?.id]);

  // Trap escape key & focus management
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    // Focus close button on open
    const focusTimer = setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 50);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearTimeout(focusTimer);
    };
  }, [isOpen, onClose]);

  // Prevent background body scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen || !scholarship) return null;

  // Merge recommendation item with loaded full detail for maximum coverage
  const sName = detail?.name || scholarship.name;
  const sProvider = detail?.provider || scholarship.provider;
  const sAmount = detail?.amount ?? scholarship.amount;
  const sBenefitType = detail?.benefit_type || scholarship.benefit_type || "SCHOLARSHIP";
  const sAwardDisplay = detail?.award_display || scholarship.award_display || "Variable Statutory Aid";
  const sCategory = scholarship.recommendation_category;
  const sScore = scholarship.match_score;
  const sDossierIndex = detail?.dossier_index || scholarship.dossier_index;
  const sAcademicYear = detail?.academic_year || scholarship.academic_year || "2024-2026 Academic Cycle";
  const sOverview = detail?.description || scholarship.eligibility_summary || "Official state guidelines specify criteria for this scheme.";
  const sStream = detail?.stream || scholarship.stream || "BOTH";
  const sStudyLevel = detail?.study_level || scholarship.study_level || "BOTH";
  const sTnResidency = detail?.tn_residency_required ?? scholarship.tn_residency_required ?? true;
  const sCommunity = detail?.community_category || scholarship.community_category || "ALL";
  const sIncomeCriteria = detail?.income_criteria_raw || scholarship.income_criteria_raw || (detail?.income_ceiling || scholarship.income_ceiling ? `Annual family income not exceeding ${formatINR(detail?.income_ceiling || scholarship.income_ceiling || 0)}` : "No statutory annual income limit specified");
  const sInstitutionTypes = detail?.institution_types || scholarship.institution_types || "Autonomous Arts & Science and Autonomous Engineering Colleges";
  const sCompatibility = detail?.autonomous_compatibility || scholarship.autonomous_compatibility;
  const sUnresolved = detail?.unresolved_questions || scholarship.unresolved_questions;
  const sOfficialSource = detail?.official_guideline_url || detail?.source_url || scholarship.official_source_url;
  const sOfficialPortal = detail?.application_url || scholarship.official_application_portal_url;
  const sOfficialPortalName = detail?.official_portal_name || scholarship.official_portal_name || "Official Department Portal";
  const sDaysRemaining = detail?.deadline_risk?.days_remaining ?? scholarship.days_remaining;

  // Documents checklist
  const requirementsList: ScholarshipRequirement[] = detail?.requirements && detail.requirements.length > 0
    ? detail.requirements
    : (scholarship.requirements && scholarship.requirements.length > 0
        ? scholarship.requirements
        : (scholarship.required_documents || []).map((docName, idx) => ({
            id: idx + 1,
            name: docName,
            document_type: docName.toUpperCase().replace(/\s+/g, "_"),
            type: "DOCUMENT",
            is_required: true,
          })));

  // Benefit badge colors
  const getBenefitBadgeClass = (bType: string) => {
    switch (bType) {
      case "ADMISSION_BENEFIT":
        return "bg-cyan-950/70 text-cyan-300 border-cyan-800";
      case "FEE_CONCESSION":
        return "bg-indigo-950/70 text-indigo-300 border-indigo-800";
      case "FINANCIAL_ASSISTANCE":
        return "bg-blue-950/70 text-blue-300 border-blue-800";
      default:
        return "bg-red-950/70 text-red-300 border-red-800";
    }
  };

  // Recommendation category badge colors
  const getCategoryBadgeClass = (cat: string) => {
    switch (cat) {
      case "LIKELY_ELIGIBLE":
        return "bg-emerald-950/70 text-emerald-300 border-emerald-800";
      case "POTENTIALLY_ELIGIBLE":
        return "bg-amber-950/70 text-amber-300 border-amber-800";
      case "WINDOW_NEEDS_VERIFICATION":
        return "bg-purple-950/70 text-purple-300 border-purple-800";
      default:
        return "bg-zinc-800 text-zinc-300 border-zinc-700";
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="scholarship-modal-title"
        className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-[#0B0D11] border border-neutral-800 rounded-2xl shadow-2xl text-neutral-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ================================================================= */}
        {/* MODAL HEADER (Sticky) */}
        {/* ================================================================= */}
        <div className="shrink-0 p-5 sm:p-6 border-b border-neutral-800/90 bg-[#101318]/95 backdrop-blur-md">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                {sDossierIndex && (
                  <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
                    {sDossierIndex}
                  </span>
                )}
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700/80 font-bold">
                  {sAcademicYear}
                </span>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full font-mono uppercase border ${getBenefitBadgeClass(sBenefitType)}`}>
                  {sBenefitType.replace(/_/g, " ")}
                </span>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full font-mono uppercase border ${getCategoryBadgeClass(sCategory)}`}>
                  {sCategory.replace(/_/g, " ")} ({sScore}%)
                </span>
              </div>

              <h2
                id="scholarship-modal-title"
                className="font-serif text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug"
              >
                {sName}
              </h2>

              <p className="text-xs text-neutral-400">
                Statutory Awarding Authority:{" "}
                <strong className="text-neutral-200">{sProvider}</strong>
              </p>
            </div>

            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Close scholarship details modal"
              className="w-8 h-8 rounded-full border border-neutral-700 bg-neutral-900 text-neutral-400 hover:text-white hover:bg-red-600/20 hover:border-red-500/60 flex items-center justify-center text-lg font-semibold transition-all shrink-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              &times;
            </button>
          </div>
        </div>

        {/* ================================================================= */}
        {/* MODAL BODY (Scrollable) */}
        {/* ================================================================= */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-xs sm:text-sm">
          {/* SECTION A: Scheme Overview */}
          <section className="space-y-3">
            <div className="flex items-center space-x-2 border-b border-neutral-800 pb-2">
              <span className="w-2 h-2 rounded-full bg-red-600"></span>
              <h3 className="font-bold text-neutral-100 text-sm uppercase tracking-wider">
                A. Scheme Overview &amp; Statutory Mandate
              </h3>
            </div>

            {/* Award highlight box */}
            <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block">
                  Statutory Award Entitlement
                </span>
                <span className="text-2xl font-bold font-mono text-red-400">
                  {formatINR(sAmount)}
                </span>
                <p className="text-xs text-neutral-300 italic mt-0.5">
                  {sAwardDisplay}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block">
                  Classification
                </span>
                <span className="text-xs font-semibold text-neutral-200 font-mono">
                  {sBenefitType.replace(/_/g, " ")}
                </span>
              </div>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed">
              {sOverview}
            </p>

            {/* Scheme Metadata Matrix */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <div className="p-2.5 rounded-lg bg-neutral-900/60 border border-neutral-800/80">
                <span className="text-[10px] font-mono uppercase text-neutral-400 block">
                  Eligible Domicile &amp; State
                </span>
                <span className="font-semibold text-neutral-200 text-xs">
                  {sTnResidency ? "Tamil Nadu Domicile Strictly Required" : "Open Central Allocation / All India"}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-neutral-900/60 border border-neutral-800/80">
                <span className="text-[10px] font-mono uppercase text-neutral-400 block">
                  Target Community Category
                </span>
                <span className="font-semibold text-neutral-200 text-xs">
                  {sCommunity}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-neutral-900/60 border border-neutral-800/80">
                <span className="text-[10px] font-mono uppercase text-neutral-400 block">
                  Academic Discipline &amp; Level
                </span>
                <span className="font-semibold text-neutral-200 text-xs">
                  Stream: {sStream === "BOTH" ? "Arts & Science and Engineering" : sStream} &bull; {sStudyLevel === "BOTH" ? "UG & PG" : sStudyLevel}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-neutral-900/60 border border-neutral-800/80">
                <span className="text-[10px] font-mono uppercase text-neutral-400 block">
                  Family Income Limit
                </span>
                <span className="font-semibold text-neutral-200 text-xs">
                  {sIncomeCriteria}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-neutral-900/60 border border-neutral-800/80 sm:col-span-2">
                <span className="text-[10px] font-mono uppercase text-neutral-400 block">
                  Institutional Scope &amp; Quota
                </span>
                <span className="font-semibold text-neutral-200 text-xs">
                  {sInstitutionTypes}
                </span>
              </div>
            </div>
          </section>

          {/* SECTION B: Why It Matches Your Saved Profile */}
          <section className="space-y-3">
            <div className="flex items-center space-x-2 border-b border-neutral-800 pb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <h3 className="font-bold text-neutral-100 text-sm uppercase tracking-wider">
                B. Why It Matches Your Saved Profile
              </h3>
            </div>

            {/* Satisfied match rules */}
            {scholarship.satisfied_requirements && scholarship.satisfied_requirements.length > 0 ? (
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block">
                  ✓ Verified Criteria Satisfied by Profile:
                </span>
                <div className="space-y-1">
                  {scholarship.satisfied_requirements.map((req, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-900/40 text-emerald-300 text-xs flex items-start space-x-2"
                    >
                      <span className="font-bold text-emerald-400 mt-0.5">✓</span>
                      <span className="leading-relaxed">{req}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-neutral-400 italic">
                Deterministic matching checks are pending or criteria do not align with saved profile.
              </p>
            )}

            {/* Missing information */}
            {scholarship.missing_information && scholarship.missing_information.length > 0 && (
              <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-900/50 space-y-2">
                <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider flex items-center space-x-1.5">
                  <span>⚠ Profile Attributes Required to Finalize Fit:</span>
                </span>
                <ul className="space-y-1 pl-4 list-disc text-xs text-amber-200">
                  {scholarship.missing_information.map((m, idx) => (
                    <li key={idx}>{m}</li>
                  ))}
                </ul>
                <div className="pt-1">
                  <Link
                    href="/settings?tab=profile"
                    className="text-xs font-semibold text-amber-400 hover:text-amber-300 underline"
                  >
                    Update My Profile in Settings &rarr;
                  </Link>
                </div>
              </div>
            )}

            {/* Ineligible reasons */}
            {sCategory === "CURRENTLY_INELIGIBLE" && (
              <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-900/50 space-y-1.5">
                <span className="text-[11px] font-bold text-rose-300 uppercase tracking-wider block">
                  ✗ Statutory Boundary Ineligibility:
                </span>
                <p className="text-xs text-rose-200 leading-relaxed">
                  Your current profile metrics (e.g. community category, institutional quota, schooling type, or gender) do not satisfy the statutory prerequisites for this scheme.
                </p>
              </div>
            )}
          </section>

          {/* SECTION C: Document & Policy Verification Required */}
          <section className="space-y-3">
            <div className="flex items-center space-x-2 border-b border-neutral-800 pb-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <h3 className="font-bold text-neutral-100 text-sm uppercase tracking-wider">
                C. Document &amp; Policy Verification Required
              </h3>
            </div>

            {scholarship.requirements_needing_verification && scholarship.requirements_needing_verification.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block">
                  Required Endorsements &amp; Policy Checks:
                </span>
                <div className="space-y-1">
                  {scholarship.requirements_needing_verification.map((v, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-neutral-900/60 border border-neutral-800 text-neutral-300 text-xs flex items-start space-x-2"
                    >
                      <span className="text-blue-400 font-bold mt-0.5">•</span>
                      <span className="leading-relaxed">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Autonomous compatibility */}
            {sCompatibility && (
              <div className="p-3.5 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-1.5">
                <span className="text-[11px] font-semibold text-neutral-300 uppercase tracking-wider block">
                  Autonomous College Coverage &amp; Single-Window Quota Rules:
                </span>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  {sCompatibility}
                </p>
              </div>
            )}

            {/* Unresolved questions / department caveats */}
            {sUnresolved && (
              <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-900/40 space-y-1">
                <span className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider block">
                  Department Caveat &amp; Institutional Verification:
                </span>
                <p className="text-xs text-amber-200/90 leading-relaxed">
                  {sUnresolved}
                </p>
              </div>
            )}
          </section>

          {/* SECTION D: Mandatory Documents Checklist */}
          <section className="space-y-3">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                <h3 className="font-bold text-neutral-100 text-sm uppercase tracking-wider">
                  D. Mandatory Documents Checklist
                </h3>
              </div>
              <Link
                href="/documents"
                className="text-[11px] text-red-400 hover:text-red-300 hover:underline font-semibold"
              >
                Open Document Vault &rarr;
              </Link>
            </div>

            <p className="text-xs text-neutral-400">
              Each document requirement is reconciled in real-time with your uploaded credentials in the SCHOLARAi Document Vault.
            </p>

            <div className="space-y-2">
              {requirementsList.map((req) => {
                // Find matching document in vault by document_type
                const matchingDoc = studentDocuments.find(
                  (d) =>
                    d.document_type.toUpperCase() === req.document_type.toUpperCase() ||
                    req.name.toLowerCase().includes(d.name.toLowerCase()) ||
                    d.name.toLowerCase().includes(req.name.toLowerCase())
                );

                const isUploaded = !!matchingDoc && matchingDoc.status !== "MISSING";
                const isVerified =
                  matchingDoc?.verification_status === "AUTOMATED_CHECKS_PASSED" ||
                  matchingDoc?.verification_status === "OFFICIALLY_VERIFIED" ||
                  matchingDoc?.status === "VERIFIED";

                return (
                  <div
                    key={req.id || req.name}
                    className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 max-w-md">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-neutral-200 text-xs">
                          {req.name}
                        </span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                          req.is_required
                            ? "bg-red-950 text-red-300 border border-red-800"
                            : "bg-neutral-800 text-neutral-400"
                        }`}>
                          {req.is_required ? "MANDATORY" : "OPTIONAL"}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-neutral-500 block">
                        Category: {req.document_type}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 self-start sm:self-auto shrink-0">
                      {isUploaded ? (
                        <div className="flex items-center space-x-2">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-800">
                            ✓ AVAILABLE IN VAULT
                          </span>
                          {isVerified ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-950/60 text-blue-300 border border-blue-800">
                              VERIFIED
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-950/60 text-amber-300 border border-amber-800">
                              PENDING CHECK
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold bg-neutral-800 text-neutral-400 border border-neutral-700">
                            ✗ NOT UPLOADED
                          </span>
                          <Link
                            href="/documents"
                            className="text-[11px] text-red-400 hover:text-red-300 underline font-semibold"
                          >
                            Upload &rarr;
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* SECTION E: Official Sources */}
          <section className="space-y-3">
            <div className="flex items-center space-x-2 border-b border-neutral-800 pb-2">
              <span className="w-2 h-2 rounded-full bg-red-600"></span>
              <h3 className="font-bold text-neutral-100 text-sm uppercase tracking-wider">
                E. Official Sources &amp; Verification Gazette
              </h3>
            </div>

            <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-mono text-neutral-400">
                  Application Cycle Status:
                </span>
                {sDaysRemaining !== null && sDaysRemaining !== undefined ? (
                  <span className="font-mono font-bold text-red-400">
                    {sDaysRemaining} days remaining in current cycle
                  </span>
                ) : (
                  <span className="font-mono text-neutral-300">
                    Annual Cycle &bull; Window verified with college office
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
                {sOfficialSource && (
                  <a
                    href={sOfficialSource}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1.5 text-xs font-semibold text-red-400 hover:text-red-300 hover:underline"
                  >
                    <span>Official Scheme Guidelines ({sProvider})</span>
                    <span>↗</span>
                  </a>
                )}
                {sOfficialPortal && (
                  <a
                    href={sOfficialPortal}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1.5 text-xs font-semibold text-neutral-300 hover:text-white hover:underline"
                  >
                    <span>Statutory Application Portal ({sOfficialPortalName})</span>
                    <span>↗</span>
                  </a>
                )}
              </div>
            </div>

            <p className="text-[11px] text-neutral-400 font-serif italic border-t border-neutral-800/80 pt-3">
              Operating Principle: &ldquo;AI assists. Official sources decide. Student approves.&rdquo; SCHOLARAi organizes statutory deadlines and verifies documents. Official award determinations are executed exclusively by the statutory department.
            </p>
          </section>
        </div>

        {/* ================================================================= */}
        {/* MODAL FOOTER (Sticky) */}
        {/* ================================================================= */}
        <div className="shrink-0 p-4 sm:p-5 border-t border-neutral-800/90 bg-[#101318]/95 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-semibold transition-all cursor-pointer"
          >
            Close Window
          </button>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {sOfficialPortal && (
              <a
                href={sOfficialPortal}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 rounded-xl text-xs font-semibold transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap"
              >
                <span>Official Portal</span>
                <span>↗</span>
              </a>
            )}

            <Link
              href={`/discover/${scholarship.id}`}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all flex items-center space-x-1.5 whitespace-nowrap"
            >
              <span>Prepare with Assistant</span>
              <span>&rarr;</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
