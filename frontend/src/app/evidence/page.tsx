"use client";

import { useState, useEffect } from "react";
import { getEvidence, createEvidence, updateEvidence, deleteEvidence } from "@/lib/api";
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
    source_name: "User Provided",
  });

  const loadEvidence = async () => {
    setLoading(true);
    try {
      const data = await getEvidence(selectedCategory === "ALL" ? undefined : selectedCategory);
      setEvidenceList(data);
    } catch (e) {
      console.error("Failed to load evidence", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvidence();
  }, [selectedCategory]);

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
        source_name: "User Provided",
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

  const handleToggleVerification = async (item: EvidenceItem) => {
    const nextStatus = item.verification_status === "VERIFIED" ? "NEEDS_VERIFICATION" : "VERIFIED";
    try {
      const updated = await updateEvidence(item.id, { verification_status: nextStatus });
      setEvidenceList((prev) => prev.map((e) => (e.id === item.id ? updated : e)));
    } catch (e) {
      console.error(e);
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Verified Evidence Bank</h1>
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800">
              Reusable Assets
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Grounded factual library of your academic, project, and leadership credentials used to substantiate scholarship applications.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 shadow-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Add Evidence Item</span>
        </button>
      </div>

      {/* Trust Principle Disclaimer Banner */}
      <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/60 text-slate-700 text-xs flex items-start space-x-3">
        <span className="p-1 rounded bg-indigo-600 text-white font-bold text-[10px] uppercase">Trust Rule</span>
        <div>
          <p className="font-semibold text-slate-900">
            &ldquo;AI assists. Official sources decide. Student approves.&rdquo;
          </p>
          <p className="text-slate-600 mt-0.5">
            The AI assistant retrieves approved evidence items to draft application questions. It will NEVER fabricate credentials or invent competition wins not present in this bank.
          </p>
        </div>
      </div>

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Total Indexed Items</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{evidenceList.length}</p>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-medium text-emerald-600">Verified Credentials</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{verifiedCount}</p>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-medium text-indigo-600">User-Provided Facts</p>
          <p className="text-2xl font-bold text-indigo-700 mt-1">{userProvidedCount}</p>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-medium text-amber-600">Needs Verification</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{needsVerifCount}</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <svg className="w-5 h-5 absolute left-3 top-2.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search evidence items by title, organization, or keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-1.5 pt-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                selectedCategory === cat
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {cat.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Evidence Cards Grid */}
      {loading ? (
        <div className="p-12 text-center text-sm text-slate-500">Loading Evidence Bank...</div>
      ) : filteredEvidence.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200 shadow-sm space-y-2">
          <p className="text-sm font-semibold text-slate-800">No evidence items found</p>
          <p className="text-xs text-slate-500">Click &ldquo;Add Evidence Item&rdquo; to add projects, certifications, or coursework.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredEvidence.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 tracking-wider">
                    {item.category.replace("_", " ")}
                  </span>
                  <div className="flex items-center space-x-1.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        item.verification_status === "VERIFIED"
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          : item.verification_status === "USER_PROVIDED"
                          ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                          : "bg-amber-50 text-amber-800 border border-amber-200"
                      }`}
                    >
                      {item.verification_status.replace("_", " ")}
                    </span>
                  </div>
                </div>

                <h3 className="font-bold text-slate-900 mt-2 text-base">{item.title}</h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">{item.description}</p>

                {item.evidence_text && (
                  <div className="mt-3 p-2.5 rounded bg-slate-50 border border-slate-100 text-[11px] text-slate-600">
                    <span className="font-semibold text-slate-700">Transcript/Proof Detail: </span>
                    {item.evidence_text}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Source: <strong className="text-slate-700">{item.source_name}</strong></span>
                  {item.date && <span>Period: {item.date}</span>}
                </div>

                {item.used_in_applications && (
                  <p className="text-[11px] text-indigo-700 bg-indigo-50/50 p-1.5 rounded">
                    <strong>Used in:</strong> {item.used_in_applications}
                  </p>
                )}

                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => handleToggleVerification(item)}
                    className="text-xs font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
                  >
                    {item.verification_status === "VERIFIED" ? "Mark Needs Verification" : "Mark as Verified"}
                  </button>

                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-xs text-rose-600 hover:text-rose-800 font-semibold transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900">Add Evidence to Bank</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Computer Vision Research Project"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    {CATEGORIES.filter((c) => c !== "ALL").map((c) => (
                      <option key={c} value={c}>{c.replace("_", " ")}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Date / Year</label>
                  <input
                    type="text"
                    placeholder="e.g. 2025-2026"
                    value={formData.date || ""}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Organization / Institution</label>
                <input
                  type="text"
                  placeholder="e.g. Demo Engineering College"
                  value={formData.organization || ""}
                  onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description / Key Accomplishments *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Detailed description of what you designed, built, or accomplished..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold disabled:opacity-50"
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
