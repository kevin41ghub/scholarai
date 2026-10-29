"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getEvidence, createEvidence, deleteEvidence } from "@/lib/api";
import { EvidenceItem, EvidenceCreatePayload } from "@/types/student";

const CATEGORIES = [
  "ALL",
  "ACADEMIC",
  "PROJECT",
  "INTERNSHIP",
  "WORK_EXPERIENCE",
  "AWARD",
  "CERTIFICATION",
  "LEADERSHIP",
  "VOLUNTEERING",
  "FINANCIAL",
  "OTHER"
];

export default function EvidenceBankPage() {
  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState<EvidenceCreatePayload>({
    title: "",
    category: "PROJECT",
    description: "",
    date: "",
    organization: "",
    source_type: "USER_PROVIDED",
    source_name: "Student Portfolio",
  });

  const loadEvidence = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getEvidence(selectedCategory === "ALL" ? undefined : selectedCategory);
      setEvidenceList(data);
    } catch (e) {
      console.error("Failed to load evidence", e);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadEvidence();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadEvidence]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.description) return;
    setSubmitting(true);
    try {
      await createEvidence(formData);
      setShowAddModal(false);
      setFormData({
        title: "",
        category: "PROJECT",
        description: "",
        date: "",
        organization: "",
        source_type: "USER_PROVIDED",
        source_name: "Student Portfolio",
      });
      await loadEvidence();
    } catch (err) {
      console.error(err);
      alert("Failed to save evidence record.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this evidence record? Applications citing this evidence will be affected.")) {
      return;
    }
    try {
      await deleteEvidence(id);
      setEvidenceList((prev) => prev.filter((item) => item.id !== id));
    } catch (e) {
      console.error(e);
      alert("Failed to delete record.");
    }
  };

  const filteredEvidence = evidenceList.filter((e) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      e.title.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q) ||
      (e.organization && e.organization.toLowerCase().includes(q))
    );
  });

  const verifiedCount = evidenceList.filter((e) => e.verification_status === "VERIFIED").length;
  const userProvidedCount = evidenceList.filter((e) => e.verification_status === "USER_PROVIDED").length;
  const needsVerifCount = evidenceList.filter((e) => e.verification_status === "NEEDS_VERIFICATION").length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center space-x-2 text-xs text-zinc-500 dark:text-zinc-400 mb-1.5">
            <Link href="/" className="hover:text-red-600 dark:hover:text-red-400 transition-colors">Dashboard</Link>
            <span>/</span>
            <span className="text-zinc-900 dark:text-zinc-100 font-medium">Evidence Bank</span>
          </div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Grounded Evidence Bank</h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/50">
              Reusable Application Assets
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Factual repository of academic credentials, projects, and achievements used by SCHOLARAi to substantiate scholarship applications and prevent hallucinations.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs transition-all self-start md:self-auto cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Add Evidence Item</span>
        </button>
      </div>

      {/* Trust Principle Disclaimer Banner */}
      <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 dark:bg-red-950/20 text-zinc-800 dark:text-zinc-200 text-xs flex items-start space-x-3">
        <span className="px-2 py-0.5 rounded bg-red-600 text-white font-bold text-[10px] uppercase tracking-wider">
          Trust Rule
        </span>
        <div>
          <p className="font-semibold text-zinc-950 dark:text-zinc-50">
            &ldquo;AI assists. Official sources decide. Student approves.&rdquo;
          </p>
          <p className="text-zinc-600 dark:text-zinc-400 mt-0.5 leading-relaxed">
            The AI assistant directly cites verified evidence items when drafting essays and personal statements. Evidence verification status is determined automatically by uploaded, authenticated documents or authoritative institutional records.
          </p>
        </div>
      </div>

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Total Evidence Items</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">{evidenceList.length}</p>
        </div>
        <div className="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Document-Verified</p>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">{verifiedCount}</p>
        </div>
        <div className="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Student Self-Reported</p>
          <p className="text-2xl font-bold text-zinc-800 dark:text-zinc-200 mt-1">{userProvidedCount}</p>
        </div>
        <div className="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">Needs Proof</p>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-400 mt-1">{needsVerifCount}</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="space-y-3 bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs transition-colors">
        <div className="relative">
          <svg className="w-4 h-4 absolute left-3 top-3 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search evidence items by title, organization, or keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-600 dark:focus:ring-red-500"
          />
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                selectedCategory === cat
                  ? "bg-red-600 text-white shadow-xs"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              {cat.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Evidence Cards Grid */}
      {loading ? (
        <div className="p-12 text-center text-sm text-zinc-500 dark:text-zinc-400">Loading Grounded Evidence Bank...</div>
      ) : filteredEvidence.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-2">
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">No evidence items found.</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Click &ldquo;Add Evidence Item&rdquo; to register projects, certifications, or leadership roles for AI application drafting.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredEvidence.map((item) => (
            <div
              key={item.id}
              className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                    {item.category.replace("_", " ")}
                  </span>
                  <div className="flex items-center space-x-1.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.verification_status === "VERIFIED"
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                          : item.verification_status === "USER_PROVIDED"
                          ? "bg-zinc-500/10 text-zinc-700 dark:text-zinc-400 border border-zinc-500/20"
                          : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                      }`}
                    >
                      {item.verification_status === "VERIFIED"
                        ? "Document Verified"
                        : item.verification_status === "USER_PROVIDED"
                        ? "Self-Reported Fact"
                        : "Needs Document Proof"}
                    </span>
                  </div>
                </div>

                <h3 className="font-bold text-zinc-900 dark:text-white mt-2.5 text-base">{item.title}</h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2 leading-relaxed">{item.description}</p>

                {item.evidence_text && (
                  <div className="mt-3 p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 text-[11px] text-zinc-600 dark:text-zinc-400">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">Grounded Citation / Proof: </span>
                    {item.evidence_text}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                  <span>Source: <strong className="text-zinc-700 dark:text-zinc-300">{item.source_name}</strong></span>
                  {item.date && <span>Period: {item.date}</span>}
                </div>

                {item.source_document_id && (
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-500/5 dark:bg-emerald-950/20 p-1.5 rounded border border-emerald-500/20 flex items-center justify-between">
                    <span>Backing Document Linked</span>
                    <Link href="/documents" className="font-semibold underline hover:text-emerald-800 dark:hover:text-emerald-300">
                      View Documents
                    </Link>
                  </p>
                )}

                {item.used_in_applications && (
                  <p className="text-[11px] text-red-700 dark:text-red-400 bg-red-500/5 dark:bg-red-950/20 p-1.5 rounded border border-red-500/20">
                    <strong>Referenced in:</strong> {item.used_in_applications}
                  </p>
                )}

                <div className="flex items-center justify-between pt-2">
                  <Link
                    href={`/assistant?context=evidence&evidence_id=${item.id}`}
                    className="inline-flex items-center space-x-1 text-xs font-semibold text-red-600 dark:text-red-400 hover:text-red-700 transition-colors"
                  >
                    <span>Draft Essay with this</span>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>

                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-xs text-zinc-400 hover:text-rose-600 font-semibold transition-colors cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Evidence Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Add Evidence to Grounding Bank</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Computer Vision Research Project"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-red-600 dark:focus:ring-red-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-red-600 dark:focus:ring-red-500 focus:outline-none"
                  >
                    {CATEGORIES.filter((c) => c !== "ALL").map((c) => (
                      <option key={c} value={c}>{c.replace("_", " ")}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Date / Period</label>
                  <input
                    type="text"
                    placeholder="e.g. 2025-2026"
                    value={formData.date || ""}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-red-600 dark:focus:ring-red-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Organization / Institution</label>
                <input
                  type="text"
                  placeholder="e.g. Loyola College (Autonomous) or Institution Name"
                  value={formData.organization || ""}
                  onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-red-600 dark:focus:ring-red-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Description / Key Accomplishments *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Factual summary of work done, technologies used, or outcome achieved..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-red-600 dark:focus:ring-red-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold disabled:opacity-50 shadow-xs transition-colors cursor-pointer"
                >
                  {submitting ? "Saving..." : "Save to Evidence Bank"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
