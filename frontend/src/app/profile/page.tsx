"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCurrentStudent, updateStudent, formatINR } from "@/lib/api";
import { StudentDetail, StudentUpdatePayload } from "@/types/student";

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    // Personal
    name: "",
    email: "",
    phone: "",
    // Academic
    institution: "",
    course: "",
    year: "",
    cgpa: "",
    twelfth_percentage: "",
    category: "",
    state: "",
    // Financial
    annual_education_cost: "",
    existing_support: "",
    annual_family_income: "",
  });

  useEffect(() => {
    async function fetchProfile() {
      try {
        setLoading(true);
        const data: StudentDetail = await getCurrentStudent();
        setFormData({
          name: data.name || "",
          email: data.email || "",
          phone: data.phone || "",
          institution: data.profile?.institution || "",
          course: data.profile?.course || "",
          year: data.profile?.year || "",
          cgpa: data.profile?.cgpa?.toString() || "",
          twelfth_percentage: data.profile?.twelfth_percentage?.toString() || "",
          category: data.profile?.category || "",
          state: data.profile?.state || "",
          annual_education_cost: data.funding_profile?.annual_education_cost?.toString() || "0",
          existing_support: data.funding_profile?.existing_support?.toString() || "0",
          annual_family_income: data.funding_profile?.annual_family_income?.toString() || "0",
        });
      } catch (err: any) {
        setErrorMessage(err?.message || "Failed to load profile from backend.");
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);

  // Compute live funding gap preview
  const numCost = Math.max(0, parseFloat(formData.annual_education_cost) || 0);
  const numSupport = Math.max(0, parseFloat(formData.existing_support) || 0);
  const liveFundingGap = Math.max(0, numCost - numSupport);
  const liveCoverage = numCost > 0 ? Math.min(100, (numSupport / numCost) * 100) : 100;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    // Validation
    const cgpaVal = parseFloat(formData.cgpa);
    if (isNaN(cgpaVal) || cgpaVal < 0 || cgpaVal > 10) {
      setErrorMessage("CGPA must be a valid number between 0.0 and 10.0.");
      setSaving(false);
      return;
    }

    const twelfthVal = parseFloat(formData.twelfth_percentage);
    if (isNaN(twelfthVal) || twelfthVal < 0 || twelfthVal > 100) {
      setErrorMessage("12th percentage must be a valid number between 0.0% and 100.0%.");
      setSaving(false);
      return;
    }

    if (numCost < 0 || numSupport < 0) {
      setErrorMessage("Financial values cannot be negative.");
      setSaving(false);
      return;
    }

    const payload: StudentUpdatePayload = {
      name: formData.name,
      email: formData.email,
      phone: formData.phone || null,
      institution: formData.institution,
      course: formData.course,
      year: formData.year,
      cgpa: cgpaVal,
      twelfth_percentage: twelfthVal,
      category: formData.category,
      state: formData.state,
      annual_education_cost: numCost,
      existing_support: numSupport,
      annual_family_income: parseFloat(formData.annual_family_income) || 0,
    };

    try {
      await updateStudent(payload);
      setSuccessMessage("Profile and funding details successfully saved to database!");
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to save profile changes.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-slate-500 font-medium">Loading profile from database...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs text-slate-500 mb-1">
            <Link href="/" className="hover:text-indigo-600 transition-colors">Dashboard</Link>
            <span>/</span>
            <span className="text-slate-800 font-medium">Edit Profile</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Student Profile & Funding</h1>
          <p className="text-sm text-slate-500">
            Keep your personal, academic, and financial information accurate to receive reliable scholarship matching.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-sm self-start sm:self-auto"
        >
          &larr; Back to Dashboard
        </Link>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center space-x-3">
          <svg className="w-5 h-5 flex-shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center space-x-3">
          <svg className="w-5 h-5 flex-shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="font-medium">{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Section 1: Personal Information */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-semibold text-slate-900">1. Personal Information</h2>
            <p className="text-xs text-slate-500">Official student contact details</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. Arjun Kumar"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. arjun.kumar@demo.edu"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Phone Number
              </label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. +91 98765 43210"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Academic Information */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-semibold text-slate-900">2. Academic Information</h2>
            <p className="text-xs text-slate-500">Institution, scores, and eligibility category</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Institution / College <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="institution"
                required
                value={formData.institution}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. Demo Engineering College"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Course of Study <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="course"
                required
                value={formData.course}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. B.Tech Computer Science"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Academic Year <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="year"
                required
                value={formData.year}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. 2nd Year"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Current CGPA (0.0 – 10.0 scale) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="10"
                name="cgpa"
                required
                value={formData.cgpa}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. 8.4"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                12th Standard Percentage (0 – 100%) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                name="twelfth_percentage"
                required
                value={formData.twelfth_percentage}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. 89.2"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reservation Category <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="category"
                required
                value={formData.category}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. OBC, General, SC, ST, EWS"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Domicile State <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="state"
                required
                value={formData.state}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. Karnataka"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Financial Details & Live Funding Gap Preview */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-semibold text-slate-900">3. Financial Details</h2>
            <p className="text-xs text-slate-500">
              Education expenses and existing support determine your precise funding gap
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Annual Education Cost (₹) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="500"
                min="0"
                name="annual_education_cost"
                required
                value={formData.annual_education_cost}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="120000"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Formatted: {formatINR(numCost)}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Existing Support / Scholarships (₹) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="500"
                min="0"
                name="existing_support"
                required
                value={formData.existing_support}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="60000"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Formatted: {formatINR(numSupport)}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Annual Family Income (₹) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="1000"
                min="0"
                name="annual_family_income"
                required
                value={formData.annual_family_income}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="240000"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Formatted: {formatINR(parseFloat(formData.annual_family_income) || 0)}
              </span>
            </div>
          </div>

          {/* LIVE FUNDING GAP PREVIEW BOX */}
          <div className="p-5 rounded-xl bg-indigo-50/70 border border-indigo-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse"></span>
                <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
                  Live Funding Gap Preview
                </span>
              </div>
              <span className="text-xs font-medium text-indigo-700">
                Formula: max(0, Cost &minus; Support)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="bg-white/80 p-3 rounded-lg border border-indigo-100">
                <span className="text-xs text-slate-500 block">Annual Cost</span>
                <span className="text-lg font-bold text-slate-800">{formatINR(numCost)}</span>
              </div>
              <div className="bg-white/80 p-3 rounded-lg border border-indigo-100">
                <span className="text-xs text-slate-500 block">Existing Support</span>
                <span className="text-lg font-bold text-slate-800">{formatINR(numSupport)}</span>
              </div>
              <div className="bg-white/90 p-3 rounded-lg border border-indigo-200">
                <span className="text-xs text-slate-500 block">Calculated Funding Gap</span>
                <span className="text-lg font-bold text-indigo-700">{formatINR(liveFundingGap)}</span>
              </div>
            </div>

            <div className="pt-2">
              <div className="flex justify-between text-xs text-slate-600 mb-1">
                <span>Coverage Ratio</span>
                <span className="font-semibold text-indigo-700">{liveCoverage.toFixed(1)}%</span>
              </div>
              <div className="w-full h-2 bg-indigo-200/60 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                  style={{ width: `${liveCoverage}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-4 pt-2">
          <Link
            href="/"
            className="px-5 py-2.5 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm flex items-center space-x-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Saving to Database...</span>
              </>
            ) : (
              <span>Save & Update Profile</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
