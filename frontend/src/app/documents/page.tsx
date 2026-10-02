"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDocuments, updateDocument, formatINR } from "@/lib/api";
import { DocumentItem } from "@/types/student";

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDocs = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getDocuments();
      setDocuments(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load documents.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocs();
  }, []);

  const handleStatusChange = async (docId: number, newStatus: string) => {
    try {
      setUpdatingId(docId);
      const updated = await updateDocument(docId, { status: newStatus });
      setToastMessage(
        `Updated "${updated.name}" to ${newStatus}. Cascade unblocking evaluated for dependent applications!`
      );
      await loadDocs();
    } catch (err: any) {
      setError(err?.message || "Failed to update document status.");
    } finally {
      setUpdatingId(null);
    }
  };

  // Find shared blockers (missing and affecting multiple applications)
  const sharedBlockers = documents.filter((d) => d.is_shared_blocker);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs text-slate-500 mb-1">
              <Link href="/" className="hover:text-indigo-600 transition-colors">Dashboard</Link>
              <span>/</span>
              <span className="text-slate-800 font-medium">Document State Management</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Documents & Evidence Status</h1>
            <p className="text-sm text-slate-600 max-w-2xl mt-1">
              Manage document readiness across your scholarship portfolio. Resolving shared documents unblocks multiple applications simultaneously.
            </p>
          </div>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 max-w-xs">
            <span className="font-bold block mb-0.5">Document State Notice</span>
            This block manages metadata and readiness status. Real encrypted binary file upload will be enabled in Phase 3.
          </div>
        </div>
      </div>

      {toastMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center justify-between shadow-sm">
          <span>✓ {toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-emerald-700 font-bold ml-2">&times;</button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 text-xs font-semibold rounded-xl flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-700 font-bold ml-2">&times;</button>
        </div>
      )}

      {/* SHARED BLOCKERS PROMINENT BANNER */}
      {sharedBlockers.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              High-Impact Shared Blockers
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sharedBlockers.map((blocker) => (
              <div
                key={blocker.id}
                className="bg-amber-50/90 border border-amber-300 rounded-xl p-5 shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900 uppercase tracking-wider">
                      Shared Blocker
                    </span>
                    <h3 className="text-base font-bold text-amber-950 mt-1">{blocker.name}</h3>
                    <span className="text-xs text-amber-800">Type: {blocker.document_type}</span>
                  </div>
                  <span className="px-2.5 py-1 rounded text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                    {blocker.status}
                  </span>
                </div>

                <div className="p-3 bg-white/80 rounded-lg text-xs space-y-1 text-slate-700">
                  <p>
                    <span className="font-semibold text-amber-950">Impact: </span>
                    Blocks <span className="font-bold text-rose-700">{blocker.affected_applications_count} active applications</span>.
                  </p>
                  <p>
                    <span className="font-semibold text-amber-950">Potential Funding Affected: </span>
                    <span className="font-bold text-indigo-700">{formatINR(blocker.potential_funding_affected)}</span>
                  </p>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-500">Quick status resolve:</span>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleStatusChange(blocker.id, "AVAILABLE")}
                      disabled={updatingId === blocker.id}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
                    >
                      {updatingId === blocker.id ? "Updating..." : "Mark as Available"}
                    </button>
                    <button
                      onClick={() => handleStatusChange(blocker.id, "VERIFIED")}
                      disabled={updatingId === blocker.id}
                      className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
                    >
                      Mark as Verified
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ALL DOCUMENTS REPOSITORY */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Student Document Readiness Checklist</h2>
            <p className="text-xs text-slate-500">All registered credentials and evidence records</p>
          </div>
          <span className="text-xs font-medium text-slate-500">
            {documents.length} registered document types
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading documents...</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {documents.map((doc) => (
              <div key={doc.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-bold text-slate-900">{doc.name}</h3>
                    <span className="text-[10px] text-slate-400 font-mono">({doc.document_type})</span>
                  </div>
                  {doc.notes && <p className="text-xs text-slate-500">{doc.notes}</p>}

                  <div className="flex items-center space-x-3 text-[11px] text-slate-500 pt-0.5">
                    <span>Used in: <strong className="text-slate-700">{doc.affected_applications_count} application(s)</strong></span>
                    {doc.potential_funding_affected > 0 && (
                      <>
                        <span>&bull;</span>
                        <span className="text-amber-800 font-semibold">
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      doc.status === "VERIFIED" ? "bg-emerald-50 text-emerald-800 border-emerald-300" :
                      doc.status === "AVAILABLE" ? "bg-indigo-50 text-indigo-800 border-indigo-300" :
                      doc.status === "NEEDS_VERIFICATION" ? "bg-amber-50 text-amber-800 border-amber-300" :
                      "bg-rose-50 text-rose-800 border-rose-300"
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
