"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { getScholarshipDetail, applyToScholarship, formatINR } from "@/lib/api";
import { ScholarshipDetail } from "@/types/student";

function formatDossierDate(dateStr?: string | null): string {
  if (!dateStr) return "Current Academic Cycle";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatAuthorityLevel(auth?: string | null): string {
  if (!auth) return "Statutory Government Authority";
  if (auth === "STATUTORY_STATE") return "Tamil Nadu State Authority (Statutory)";
  if (auth === "STATUTORY_CENTRAL") return "Union Government of India (Central Scheme)";
  if (auth === "OFFICIAL_PORTAL") return "Official Statutory Portal";
  return auth;
}

function getVerificationBadge(status?: string | null) {
  const norm = (status || "").toUpperCase();
  if (norm === "SOURCE_VERIFIED" || norm === "VERIFIED" || norm === "RECENTLY_VERIFIED") {
    return {
      label: "Official Source Verified",
      bgClass: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800",
      dotClass: "bg-emerald-600",
    };
  }
  if (norm === "PARTIALLY_VERIFIED" || norm === "NEEDS_VERIFICATION") {
    return {
      label: "Partially Verified — Institutional Review Required",
      bgClass: "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800",
      dotClass: "bg-amber-600",
    };
  }
  return {
    label: norm || "Verification Pending",
    bgClass: "bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700",
    dotClass: "bg-stone-400",
  };
}

export default function ScholarshipDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const id = Number(params.id);

  const [scholarship, setScholarship] = useState<ScholarshipDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getScholarshipDetail(id);
      setScholarship(data);
    } catch (err: unknown) {
      setError((err as Error)?.message || "Failed to load scholarship details.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      const timer = setTimeout(() => {
        loadDetail();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [id, loadDetail]);

  const handleStartApplication = async () => {
    if (!user) {
      router.push(`/login?redirect=/discover/${id}`);
      return;
    }
    try {
      setApplying(true);
      setApplyMessage(null);
      const res = await applyToScholarship(id);
      setApplyMessage(res.message);
      await loadDetail();
    } catch (err: unknown) {
      setError((err as Error)?.message || "Failed to initiate application tracking.");
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <div className="w-8 h-8 border-2 border-[#86192c] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-stone-500 dark:text-stone-400 font-serif italic">
          Loading statutory scheme research dossier...
        </p>
      </div>
    );
  }

  if (error || !scholarship) {
    return (
      <div className="max-w-xl mx-auto my-12 bg-white dark:bg-[#191c20] rounded-xl border border-rose-300 dark:border-rose-800 p-8 text-center space-y-4">
        <h2 className="font-serif text-lg font-bold text-stone-900 dark:text-stone-100">Dossier Unavailable</h2>
        <p className="text-xs text-stone-600 dark:text-stone-400 font-serif">{error || "Could not retrieve scheme dossier."}</p>
        <Link
          href="/discover"
          className="inline-block px-4 py-2 bg-[#86192c] text-white rounded-lg text-xs font-semibold"
        >
          &larr; Return to Intelligence Catalogue
        </Link>
      </div>
    );
  }

  const impact = scholarship.funding_impact;
  const elig = scholarship.eligibility;
  const dossier = scholarship.official_dossier;
  const isApplied = scholarship.current_application !== null && scholarship.current_application !== undefined;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* Navigation Breadcrumb */}
      <nav className="flex items-center space-x-2 text-xs font-serif text-stone-500 dark:text-stone-400 border-b border-[#e6dfd3] dark:border-[#2f343d] pb-3">
        <Link href="/" className="hover:text-[#86192c] dark:hover:text-[#fb7185] transition-colors">
          Dispatch
        </Link>
        <span>/</span>
        <Link href="/discover" className="hover:text-[#86192c] dark:hover:text-[#fb7185] transition-colors">
          Scholarship Catalogue
        </Link>
        <span>/</span>
        <span className="text-stone-900 dark:text-stone-100 font-medium truncate">
          {scholarship.dossier_index || "Scheme Dossier"}
        </span>
      </nav>

      {applyMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-medium">{applyMessage}</span>
          </div>
          <Link href="/applications" className="underline font-bold text-emerald-800 dark:text-emerald-300 hover:text-emerald-950">
            Open Application Tracker &rarr;
          </Link>
        </div>
      )}

      {/* Main Research Dossier Masthead */}
      <article className="bg-white dark:bg-[#191c20] rounded-2xl border border-[#e6dfd3] dark:border-[#2f343d] p-6 sm:p-9 shadow-xs space-y-6">
        {/* Dossier Meta Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#f0eae0] dark:border-[#242830] text-xs">
          <div className="flex items-center gap-2.5">
            <span className="font-mono font-bold text-xs text-[#86192c] dark:text-[#fb7185] bg-[#fff1f2] dark:bg-rose-950/40 px-2.5 py-0.5 rounded border border-rose-200 dark:border-rose-900/50">
              {scholarship.dossier_index || "№ TN-GAZETTE"}
            </span>
            <span className="text-stone-400">•</span>
            <span className="font-mono text-stone-600 dark:text-stone-300">
              {scholarship.academic_year || "Academic Year 2024–2026"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {scholarship.benefit_type && (
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase ${
                scholarship.benefit_type === "ADMISSION_BENEFIT"
                  ? "bg-cyan-100 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800"
                  : scholarship.benefit_type === "FEE_CONCESSION"
                  ? "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800"
                  : scholarship.benefit_type === "FINANCIAL_ASSISTANCE"
                  ? "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800"
                  : "bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-800"
              }`}>
                {scholarship.benefit_type.replace(/_/g, " ")}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
              {scholarship.source_verification_status || scholarship.verification_status}
            </span>
            <span className="text-[11px] font-mono text-stone-500 dark:text-stone-400">
              Cycle: {scholarship.application_window_status || "Annual Cycle"}
            </span>
          </div>
        </div>

        {/* Title & Authority Header */}
        <div className="space-y-3">
          <p className="text-xs font-mono uppercase tracking-wider text-stone-500 dark:text-stone-400">
            Statutory Awarding Authority: <strong className="font-semibold text-stone-900 dark:text-stone-100">{scholarship.provider}</strong>
          </p>
          <h1 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            {scholarship.name}
          </h1>
          <p className="font-serif text-sm sm:text-base text-stone-700 dark:text-stone-300 leading-relaxed max-w-3xl">
            {scholarship.description}
          </p>
        </div>

        {/* Stream, Level & Category Metadata Matrix */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-[#fbf9f5] dark:bg-[#121417] border border-[#e6dfd3] dark:border-[#2f343d] text-xs">
          <div>
            <span className="text-stone-400 dark:text-stone-500 block text-[11px] font-mono uppercase">Eligible Stream</span>
            <span className="font-semibold text-stone-800 dark:text-stone-200 mt-0.5 block">
              {scholarship.stream === "BOTH" ? "Arts & Science and Engineering" : scholarship.stream}
            </span>
          </div>
          <div>
            <span className="text-stone-400 dark:text-stone-500 block text-[11px] font-mono uppercase">Study Level</span>
            <span className="font-semibold text-stone-800 dark:text-stone-200 mt-0.5 block">
              {scholarship.study_level === "BOTH" ? "UG & PG Degrees" : scholarship.study_level}
            </span>
          </div>
          <div>
            <span className="text-stone-400 dark:text-stone-500 block text-[11px] font-mono uppercase">TN Domicile</span>
            <span className="font-semibold text-stone-800 dark:text-stone-200 mt-0.5 block">
              {scholarship.tn_residency_required ? "Strictly Required" : "Open Central Allocation"}
            </span>
          </div>
          <div>
            <span className="text-stone-400 dark:text-stone-500 block text-[11px] font-mono uppercase">Target Communities</span>
            <span className="font-semibold text-stone-800 dark:text-stone-200 mt-0.5 block">
              {scholarship.community_category || "All Eligible Categories"}
            </span>
          </div>
        </div>

        {/* Financial Award & Actions Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 p-5 rounded-xl bg-[#f5f1e8] dark:bg-[#202327] border border-[#e6dfd3] dark:border-[#2f343d]">
          <div className="space-y-1">
            <span className="text-[11px] font-mono uppercase tracking-wider text-stone-500 dark:text-stone-400">
              Statutory Financial Support
            </span>
            <div className="font-serif text-3xl font-bold text-[#86192c] dark:text-[#fb7185]">
              {formatINR(scholarship.amount)}
            </div>
            <p className="text-xs font-serif italic text-stone-700 dark:text-stone-300">
              {scholarship.award_display || `${scholarship.award_type || "Financial assistance"} per academic year`}
            </p>
          </div>

          <div className="flex flex-col sm:items-end gap-2 shrink-0">
            {scholarship.status === "INACTIVE" || scholarship.verification_status === "RETIRED_DEMO" ? (
              <div className="text-right space-y-1">
                <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-300 dark:border-stone-700 inline-block">
                  Retired Scheme — Closed to New Applications
                </span>
                <p className="text-[11px] text-stone-500 font-serif">
                  Historical archive only. Not available for new tracking.
                </p>
              </div>
            ) : isApplied ? (
              <div className="text-right space-y-1">
                <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 inline-block">
                  Preparation Active ({scholarship.current_application?.progress.toFixed(0)}% Documented)
                </span>
                <Link
                  href={scholarship.current_application?.id ? `/applications/${scholarship.current_application.id}` : "/applications"}
                  className="block text-xs font-bold text-red-600 dark:text-red-400 hover:underline"
                >
                  Open Application Assistant &rarr;
                </Link>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleStartApplication}
                disabled={applying}
                className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold tracking-wide transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
              >
                {applying ? "Opening Application Assistant..." : user ? "Prepare Application with Assistant" : "Sign In to Prepare Application"}
              </button>
            )}

            {scholarship.application_url && (
              <a
                href={scholarship.application_url}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-stone-600 dark:text-stone-400 hover:text-[#86192c] dark:hover:text-[#fb7185] underline flex items-center gap-1"
              >
                Apply on Official {scholarship.official_portal_name || "Statutory Portal"} ↗
              </a>
            )}
          </div>
        </div>
      </article>

      {/* Autonomous College Policy Card */}
      {scholarship.autonomous_compatibility && (
        <section className="bg-white dark:bg-[#191c20] rounded-xl border border-[#e6dfd3] dark:border-[#2f343d] p-6 shadow-xs space-y-3">
          <div className="flex items-center gap-2 border-b border-[#f0eae0] dark:border-[#242830] pb-2.5">
            <span className="w-2 h-2 rounded-full bg-[#86192c] dark:bg-[#fb7185]"></span>
            <h2 className="font-serif text-base font-bold text-stone-900 dark:text-stone-100">
              Autonomous College Compatibility & Quota Rules
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-stone-700 dark:text-stone-300 font-serif leading-relaxed">
            {scholarship.autonomous_compatibility}
          </p>
          <div className="p-3 rounded-lg bg-[#fbf9f5] dark:bg-[#121417] border border-[#e6dfd3] dark:border-[#2f343d] text-[11px] text-stone-600 dark:text-stone-400 space-y-1">
            <span className="font-semibold text-stone-800 dark:text-stone-200 block">Institutional Verification Notice:</span>
            <p>
              Autonomous colleges in Tamil Nadu operate both Government-Aided shifts and Self-Financing shifts.
              Under Tamil Nadu collegiate regulations, certain fee waivers (e.g. Free Education Scheme) strictly apply to regular aided shifts,
              while technical concessions (e.g. First Graduate) require seat allotment through the Single-Window TNEA counselling code.
            </p>
          </div>
        </section>
      )}

      {/* Official Verification & Source Dossier */}
      <section className="bg-white dark:bg-[#191c20] rounded-2xl border border-[#e6dfd3] dark:border-[#2f343d] p-6 sm:p-8 shadow-xs space-y-6">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#f0eae0] dark:border-[#242830] pb-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#86192c] dark:bg-[#fb7185]"></span>
              <span className="text-[11px] font-mono uppercase tracking-wider text-stone-500 dark:text-stone-400">
                Authoritative Provenance & Gazette Archive
              </span>
            </div>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-stone-900 dark:text-stone-100">
              Official Verification & Source Dossier
            </h2>
            <p className="text-xs font-serif text-stone-600 dark:text-stone-400 max-w-2xl leading-relaxed">
              Verbatim regulatory excerpts, statutory citations, and official verification records retrieved directly from the state and central government scholarship repositories.
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-col sm:items-end gap-2 shrink-0">
            {/* Verification Status Badge */}
            {(() => {
              const badge = getVerificationBadge(dossier?.source_verification_status || scholarship.source_verification_status || scholarship.verification_status);
              return (
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${badge.bgClass}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${badge.dotClass}`}></span>
                  {badge.label}
                </span>
              );
            })()}

            {/* Authority Level */}
            <span className="text-[11px] font-mono text-stone-500 dark:text-stone-400">
              Authority: <strong className="text-stone-700 dark:text-stone-300 font-semibold">{formatAuthorityLevel(dossier?.authority_level)}</strong>
            </span>

            {/* Last Verified Timestamp */}
            <span className="text-[11px] font-mono text-stone-500 dark:text-stone-400">
              Last Verified: <span className="text-stone-700 dark:text-stone-300 font-semibold">{formatDossierDate(dossier?.last_verified_at || scholarship.last_verified_at)}</span>
            </span>
          </div>
        </div>

        {/* State A: Authoritative Text Excerpts Present */}
        {dossier?.has_official_evidence && dossier.chunks && dossier.chunks.length > 0 ? (
          <div className="space-y-5">
            {/* Provenance Strip */}
            <div className="p-4 rounded-xl bg-[#fbf9f5] dark:bg-[#121417] border border-[#e6dfd3] dark:border-[#2f343d] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200">
                    Active Gazette Record
                  </span>
                  <span className="font-semibold text-stone-900 dark:text-stone-100">
                    {dossier.chunks[0].document_title}
                  </span>
                </div>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 font-serif">
                  Repository: {dossier.source_name || scholarship.provider} &bull; {dossier.chunks.length} statutory text excerpt{dossier.chunks.length > 1 ? "s" : ""} on file
                </p>
              </div>

              {dossier.source_url && (
                <a
                  href={dossier.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-[#1e2228] text-[#86192c] dark:text-[#fb7185] border border-[#e6dfd3] dark:border-[#2f343d] hover:bg-stone-50 transition-colors shrink-0"
                >
                  <span>Official Gazette Link</span>
                  <span className="text-xs">↗</span>
                </a>
              )}
            </div>

            {/* List of Verbatim Excerpts */}
            <div className="space-y-4">
              {dossier.chunks.map((chunk, idx) => (
                <article
                  key={chunk.id || idx}
                  className="rounded-xl border border-[#e6dfd3] dark:border-[#2f343d] bg-white dark:bg-[#16181c] p-5 shadow-2xs space-y-3.5 transition-all hover:border-[#cfc6b6] dark:hover:border-[#3d434f]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs border-b border-[#f0eae0] dark:border-[#242830] pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[#86192c] dark:text-[#fb7185]">
                        § {chunk.section}
                      </span>
                      {chunk.page_number && (
                        <span className="text-stone-400 font-mono text-[11px]">
                          p. {chunk.page_number}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                        {chunk.authority_level}
                      </span>
                      {chunk.last_verified_at && (
                        <span className="text-[11px] font-mono text-stone-500 dark:text-stone-400">
                          Verified: {formatDossierDate(chunk.last_verified_at)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Verbatim Excerpt Quote */}
                  <blockquote className="pl-4 border-l-2 border-[#86192c] dark:border-[#fb7185] italic font-serif text-xs sm:text-sm text-stone-800 dark:text-stone-200 leading-relaxed bg-[#fbf9f5]/50 dark:bg-[#121417]/30 py-2.5 pr-3 rounded-r-lg">
                    &ldquo;{chunk.chunk_text}&rdquo;
                  </blockquote>

                  {/* Cryptographic Provenance & Source Citation Strip */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] font-mono text-stone-500 dark:text-stone-400">
                    <div className="flex items-center gap-2">
                      <span className="text-stone-400">Source:</span>
                      <span className="text-stone-700 dark:text-stone-300 font-medium">
                        {chunk.source_name}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {chunk.content_hash && (
                        <span
                          title={`SHA-256 Checksum: ${chunk.content_hash}`}
                          className="text-[10px] text-stone-400 dark:text-stone-500 hover:text-stone-600 cursor-help"
                        >
                          SHA-256: {chunk.content_hash.slice(0, 10)}...
                        </span>
                      )}

                      {chunk.source_url && (
                        <a
                          href={chunk.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#86192c] dark:text-[#fb7185] font-semibold hover:underline inline-flex items-center gap-0.5"
                        >
                          <span>Official Citation</span>
                          <span>↗</span>
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : (
          /* State B: No Text Excerpts Indexed in Local Knowledge Base */
          <div className="p-5 sm:p-6 rounded-xl bg-stone-50 dark:bg-[#14161a] border border-stone-200 dark:border-[#2f343d] space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 flex items-center justify-center shrink-0 font-bold text-sm">
                !
              </div>
              <div className="space-y-1">
                <h3 className="font-serif text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100">
                  No Verbatim Text Excerpts Indexed in Local Knowledge Store
                </h3>
                <p className="text-xs font-serif text-stone-600 dark:text-stone-400 leading-relaxed">
                  While this scheme&apos;s baseline parameters have been catalogued and linked to official government portals, verbatim statutory text excerpts have not yet been ingested into our local knowledge store.
                </p>
                <p className="text-[11px] font-mono text-amber-800 dark:text-amber-300/90 italic pt-1">
                  Principle: AI assists. Official sources decide. We never simulate or hallucinate official excerpts.
                </p>
              </div>
            </div>

            {/* Grounded Metadata Summary */}
            <div className="p-4 rounded-lg bg-white dark:bg-[#1a1d22] border border-stone-200 dark:border-stone-800 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-stone-400 text-[11px] font-mono uppercase block">Awarding Authority</span>
                <span className="font-semibold text-stone-800 dark:text-stone-200 font-serif">
                  {scholarship.provider}
                </span>
              </div>
              <div>
                <span className="text-stone-400 text-[11px] font-mono uppercase block">Statutory Portal</span>
                <span className="font-semibold text-stone-800 dark:text-stone-200 font-serif">
                  {scholarship.official_portal_name || scholarship.source_name || "Official Department Portal"}
                </span>
              </div>
              <div>
                <span className="text-stone-400 text-[11px] font-mono uppercase block">Verification Status</span>
                <span className="font-semibold text-stone-800 dark:text-stone-200 font-mono">
                  {scholarship.source_verification_status || scholarship.verification_status}
                </span>
              </div>
              <div>
                <span className="text-stone-400 text-[11px] font-mono uppercase block">Last Metadata Check</span>
                <span className="font-semibold text-stone-800 dark:text-stone-200 font-mono">
                  {formatDossierDate(scholarship.last_verified_at)}
                </span>
              </div>
            </div>

            {/* Direct Official Link */}
            {(scholarship.official_guideline_url || scholarship.source_url) && (
              <div className="pt-1">
                <a
                  href={scholarship.official_guideline_url || scholarship.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-[#86192c] hover:bg-[#9f1239] text-white transition-colors"
                >
                  <span>Review Official Guidelines on Statutory Portal</span>
                  <span>↗</span>
                </a>
              </div>
            )}
          </div>
        )}

        {/* Unresolved Questions & Department Inquiries */}
        {scholarship.unresolved_questions && (
          <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-600"></span>
              <span className="font-semibold text-amber-900 dark:text-amber-200 font-serif">
                Department Clarification & Policy Caveats:
              </span>
            </div>
            <p className="text-amber-950 dark:text-amber-200/90 font-serif leading-relaxed pl-4">
              {scholarship.unresolved_questions}
            </p>
            <p className="text-[11px] text-amber-800 dark:text-amber-300/80 font-mono pl-4">
              Note: Consult with your college scholarship nodal officer to verify this item during the current academic cycle.
            </p>
          </div>
        )}

        {/* Core Principle Footer */}
        <div className="pt-2 border-t border-[#f0eae0] dark:border-[#242830] flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-stone-400">
          <span>Official Verification & Source Dossier</span>
          <span className="text-[#86192c] dark:text-[#fb7185] font-semibold">
            AI assists. Official sources decide. Student approves.
          </span>
        </div>
      </section>

      {/* Transparent Profile Eligibility Evaluation */}
      {!elig && (
        <section className="bg-white dark:bg-[#191c20] rounded-xl border border-[#e6dfd3] dark:border-[#2f343d] p-6 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#f0eae0] dark:border-[#242830] pb-3">
            <div>
              <h2 className="font-serif text-base font-bold text-stone-900 dark:text-stone-100">
                Personalized Eligibility Evaluation
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 font-serif">
                Sign in to verify whether your department, admission quota, community category, and family income satisfy this scheme
              </p>
            </div>
            <Link
              href={`/login?redirect=/discover/${id}`}
              className="px-3.5 py-1.5 bg-[#86192c] hover:bg-[#9f1239] text-white rounded-lg text-xs font-semibold self-start sm:self-auto transition-colors shadow-xs"
            >
              Sign In to Evaluate
            </Link>
          </div>
          <p className="text-xs text-stone-600 dark:text-stone-400 font-serif leading-relaxed">
            Statutory eligibility criteria and mandatory documentation are detailed below in the Verification Evidence section. Once authenticated, our deterministic intelligence engine will compare your profile against statutory rules.
          </p>
        </section>
      )}

      {elig && (
        <section className="bg-white dark:bg-[#191c20] rounded-xl border border-[#e6dfd3] dark:border-[#2f343d] p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#f0eae0] dark:border-[#242830] pb-3">
            <div>
              <h2 className="font-serif text-base font-bold text-stone-900 dark:text-stone-100">
                Deterministic Eligibility Assessment
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 font-serif">
                Evaluated against your active student profile metrics
              </p>
            </div>
            <div>
              {elig.status === "eligible" && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  Likely Eligible
                </span>
              )}
              {elig.status === "needs_verification" && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                  Verification Required
                </span>
              )}
              {elig.status === "ineligible" && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                  Boundary Ineligible
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2 text-xs">
            {elig.reasons.map((r, i) => (
              <div
                key={i}
                className="flex items-start gap-2.5 p-3 rounded-lg bg-[#fbf9f5] dark:bg-[#121417] border border-[#e6dfd3] dark:border-[#2f343d]"
              >
                <span className={`font-bold mt-0.5 ${elig.status === "ineligible" && i === 1 ? "text-rose-600" : "text-emerald-700 dark:text-emerald-400"}`}>
                  {elig.status === "ineligible" && i === 1 ? "✗" : "✓"}
                </span>
                <span className="text-stone-800 dark:text-stone-200 leading-relaxed font-serif">{r}</span>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-stone-500 dark:text-stone-400 font-serif italic border-t border-[#f0eae0] dark:border-[#242830] pt-3">
            {elig.disclaimer}
          </p>
        </section>
      )}

      {/* Potential Funding Impact Simulation */}
      {impact && (
        <section className="bg-white dark:bg-[#191c20] rounded-xl border border-[#e6dfd3] dark:border-[#2f343d] p-6 shadow-xs space-y-4">
          <div className="border-b border-[#f0eae0] dark:border-[#242830] pb-3 flex items-center justify-between">
            <div>
              <h2 className="font-serif text-base font-bold text-stone-900 dark:text-stone-100">
                Funding Gap Analysis
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 font-serif">
                How this award would reduce your current educational expense gap
              </p>
            </div>
            <span className="text-xs font-bold font-mono px-2.5 py-0.5 rounded bg-[#fff1f2] dark:bg-rose-950/40 text-[#86192c] dark:text-[#fb7185] border border-rose-200 dark:border-rose-900/50">
              Covers ~{impact.gap_coverage_percentage.toFixed(0)}% of Gap
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div className="p-3.5 bg-[#fbf9f5] dark:bg-[#121417] rounded-lg border border-[#e6dfd3] dark:border-[#2f343d]">
              <span className="text-[11px] font-mono uppercase text-stone-500 dark:text-stone-400 block">Current Funding Gap</span>
              <span className="text-xl font-bold font-mono text-stone-900 dark:text-stone-100">{formatINR(impact.current_funding_gap)}</span>
            </div>
            <div className="p-3.5 bg-[#fff1f2] dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-lg">
              <span className="text-[11px] font-mono uppercase text-[#86192c] dark:text-[#fb7185] block">Scholarship Award</span>
              <span className="text-xl font-bold font-mono text-[#86192c] dark:text-[#fb7185]">{formatINR(impact.scholarship_amount)}</span>
            </div>
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 rounded-lg">
              <span className="text-[11px] font-mono uppercase text-emerald-800 dark:text-emerald-300 block">Remaining Gap</span>
              <span className="text-xl font-bold font-mono text-emerald-800 dark:text-emerald-300">{formatINR(impact.potential_remaining_gap)}</span>
            </div>
          </div>

          <p className="text-[11px] text-stone-500 dark:text-stone-400 font-serif italic">
            {impact.disclaimer}
          </p>
        </section>
      )}

      {/* Mandatory Evidentiary Documents */}
      <section className="bg-white dark:bg-[#191c20] rounded-xl border border-[#e6dfd3] dark:border-[#2f343d] p-6 shadow-xs space-y-4">
        <div className="border-b border-[#f0eae0] dark:border-[#242830] pb-3">
          <h2 className="font-serif text-base font-bold text-stone-900 dark:text-stone-100">
            Required Verification Evidence
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 font-serif">
            Certificates and institutional endorsements required by statutory departments
          </p>
        </div>

        <div className="space-y-2.5">
          {scholarship.requirements && scholarship.requirements.length > 0 ? (
            scholarship.requirements.map((req) => (
              <div
                key={req.id}
                className="p-3.5 rounded-lg border border-[#e6dfd3] dark:border-[#2f343d] bg-[#fbf9f5] dark:bg-[#121417] flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-semibold text-stone-900 dark:text-stone-100 block">{req.name}</span>
                  <span className="text-stone-500 dark:text-stone-400 text-[11px] font-mono">
                    Category: {req.document_type} &bull; Required for Submission
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700">
                  {req.is_required ? "MANDATORY" : "OPTIONAL"}
                </span>
              </div>
            ))
          ) : (
            <p className="text-xs text-stone-500 dark:text-stone-400 font-serif">
              Standard collegiate credentials required (Bonafide, Marksheet, and Community Certificate).
            </p>
          )}
        </div>
      </section>

      {/* Official Sources & Direct Links */}
      <section className="bg-[#fbf9f5] dark:bg-[#121417] rounded-xl border border-[#e6dfd3] dark:border-[#2f343d] p-6 space-y-3">
        <h3 className="font-serif text-sm font-bold text-stone-900 dark:text-stone-100">
          Official Gazette & Application Portals
        </h3>
        <p className="text-xs text-stone-600 dark:text-stone-400 font-serif leading-relaxed">
          Students must submit their official applications through the statutory portal designated by the Government of Tamil Nadu or Central Ministry.
        </p>

        <div className="flex flex-wrap gap-4 pt-2">
          {scholarship.official_guideline_url && (
            <a
              href={scholarship.official_guideline_url}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-[#86192c] dark:text-[#fb7185] hover:underline"
            >
              • Official Scheme Guidelines ({scholarship.provider}) ↗
            </a>
          )}
          {scholarship.source_url && (
            <a
              href={scholarship.source_url}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-[#86192c] dark:text-[#fb7185] hover:underline"
            >
              • Statutory Application Portal ({scholarship.source_name || "Official Portal"}) ↗
            </a>
          )}
        </div>
      </section>
    </div>
  );
}
