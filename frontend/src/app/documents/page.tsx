"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getDocuments, updateDocument, formatINR } from "@/lib/api";
import { DocumentItem } from "@/types/student";

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDocs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getDocuments();
      setDocuments(data);
    } catch (err: unknown) {
      setError((err as Error)?.message || "Failed to load documents.");
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

  const handleStatusChange = async (docId: number, newStatus: string) => {
    try {
      setUpdatingId(docId);
      const updated = await updateDocument(docId, { status: newStatus });
      setToastMessage(
        `Updated "${updated.name}" to ${newStatus}. Cascade unblocking evaluated for dependent applications!`
      );
      await loadDocs();
    } catch (err: unknown) {
      setError((err as Error)?.message || "Failed to update document status.");
    } finally {
      setUpdatingId(null);
    }
  };

  // Find shared blockers (missing and affecting multiple applications)
  const sharedBlockers = documents.filter((d) => d.is_shared_blocker);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-xs transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 mb-1.5">
              <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Dashboard</Link>
              <span>/</span>
              <span className="text-slate-800 dark:text-slate-200 font-medium">Document Readiness</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Document Readiness & Shared Blockers
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl mt-1.5 leading-relaxed">
              Track required academic transcripts, certificates, and income proofs. Resolving shared documents unblocks multiple applications simultaneously.
            </p>
          </div>
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-800 dark:text-amber-300 max-w-sm">
            <span className="font-bold block mb-1">Document Status Management</span>
            This interface tracks metadata and readiness verification. Real encrypted binary file upload and cloud storage is scheduled for Phase 3.
          </div>
        </div>
      </div>

      {toastMessage && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs font-semibold rounded-xl flex items-center justify-between shadow-2xs">
          <span>✓ {toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-emerald-700 dark:text-emerald-400 font-bold ml-2 text-sm">&times;</button>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-300 text-xs font-semibold rounded-xl flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-700 dark:text-rose-400 font-bold ml-2 text-sm">&times;</button>
        </div>
      )}

      {/* SHARED BLOCKERS PROMINENT BANNER */}
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
                className="bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-xl p-5 shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                      Shared Blocker
                    </span>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1.5">{blocker.name}</h3>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">Type: {blocker.document_type}</span>
                  </div>
                  <span className="px-2.5 py-1 rounded text-xs font-bold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
                    {blocker.status}
                  </span>
                </div>

                <div className="p-3 bg-white dark:bg-slate-900 rounded-lg text-xs space-y-1 text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-800">
                  <p>
                    <span className="font-semibold text-slate-900 dark:text-white">Impact: </span>
                    Blocks <span className="font-bold text-rose-600 dark:text-rose-400">{blocker.affected_applications_count} active applications</span>.
                  </p>
                  <p>
                    <span className="font-semibold text-slate-900 dark:text-white">Potential Funding Affected: </span>
                    <span className="font-bold font-mono text-blue-700 dark:text-blue-400">{formatINR(blocker.potential_funding_affected)}</span>
                  </p>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Quick resolve:</span>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleStatusChange(blocker.id, "AVAILABLE")}
                      disabled={updatingId === blocker.id}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold transition-colors shadow-2xs disabled:opacity-50"
                    >
                      {updatingId === blocker.id ? "Updating..." : "Mark Available"}
                    </button>
                    <button
                      onClick={() => handleStatusChange(blocker.id, "VERIFIED")}
                      disabled={updatingId === blocker.id}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold transition-colors shadow-2xs disabled:opacity-50"
                    >
                      Mark Verified
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ALL DOCUMENTS REPOSITORY */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4 transition-colors">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Student Credential & Document Ledger</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">All registered credentials and evidence records</p>
          </div>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {documents.length} registered document types
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500">Loading documents...</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {documents.map((doc) => (
              <div key={doc.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{doc.name}</h3>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">({doc.document_type})</span>
                  </div>
                  {doc.notes && <p className="text-xs text-slate-500 dark:text-slate-400">{doc.notes}</p>}

                  <div className="flex items-center space-x-3 text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
                    <span>Used in: <strong className="text-slate-700 dark:text-slate-300">{doc.affected_applications_count} application(s)</strong></span>
                    {doc.potential_funding_affected > 0 && (
                      <>
                        <span>&bull;</span>
                        <span className="text-amber-700 dark:text-amber-400 font-semibold font-mono">
                          Potential funding affected: {formatINR(doc.potential_funding_affected)}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Status Dropdown */}
                <div className="flex items-center space-x-3 flex-shrink-0">
                  <select
                    value={doc.status}
                    onChange={(e) => handleStatusChange(doc.id, e.target.value)}
                    disabled={updatingId === doc.id}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border focus:outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-blue-500 ${
                      doc.status === "VERIFIED" ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/20" :
                      doc.status === "AVAILABLE" ? "bg-blue-500/10 text-blue-800 dark:text-blue-300 border-blue-500/20" :
                      doc.status === "NEEDS_VERIFICATION" ? "bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/20" :
                      "bg-rose-500/10 text-rose-800 dark:text-rose-300 border-rose-500/20"
                    }`}
                  >
                    <option value="MISSING">MISSING</option>
                    <option value="AVAILABLE">AVAILABLE</option>
                    <option value="VERIFIED">VERIFIED</option>
                    <option value="NEEDS_VERIFICATION">NEEDS_VERIFICATION</option>
                    <option value="EXPIRED">EXPIRED</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
