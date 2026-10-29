"use client";

import { useEffect, useState, useCallback } from "react";
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
    name: "",
    email: "",
    phone: "",
    institution: "",
    course: "",
    year: "",
    cgpa: "",
    twelfth_percentage: "",
    category: "",
    state: "",
    gender: "Male",
    admission_quota: "GOVERNMENT_QUOTA",
    hosteller_status: "DAY_SCHOLAR",
    is_first_graduate: false,
    annual_education_cost: "",
    existing_support: "",
    annual_family_income: "",
  });

  const fetchProfile = useCallback(async () => {
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
        gender: data.profile?.gender || "Male",
        admission_quota: data.profile?.admission_quota || "GOVERNMENT_QUOTA",
        hosteller_status: data.profile?.hosteller_status || "DAY_SCHOLAR",
        is_first_graduate: Boolean(data.profile?.is_first_graduate),
        annual_education_cost: data.funding_profile?.annual_education_cost?.toString() || "0",
        existing_support: data.funding_profile?.existing_support?.toString() || "0",
        annual_family_income: data.funding_profile?.annual_family_income?.toString() || "0",
      });
    } catch (err: unknown) {
      setErrorMessage((err as Error)?.message || "Failed to load student profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProfile();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchProfile]);

  // Compute live funding gap preview
  const numCost = Math.max(0, parseFloat(formData.annual_education_cost) || 0);
  const numSupport = Math.max(0, parseFloat(formData.existing_support) || 0);
  const liveFundingGap = Math.max(0, numCost - numSupport);
  const liveCoverage = numCost > 0 ? Math.min(100, (numSupport / numCost) * 100) : 100;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
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
      gender: formData.gender,
      admission_quota: formData.admission_quota,
      hosteller_status: formData.hosteller_status,
      is_first_graduate: formData.is_first_graduate,
      annual_education_cost: numCost,
      existing_support: numSupport,
      annual_family_income: parseFloat(formData.annual_family_income) || 0,
    };

    try {
      await updateStudent(payload);
      setSuccessMessage("Profile and funding details saved successfully!");
    } catch (err: unknown) {
      setErrorMessage((err as Error)?.message || "Failed to save profile changes.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-8 h-8 border-3 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Loading authenticated student profile...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 mb-1.5">
            <Link href="/" className="hover:text-red-600 dark:hover:text-red-400 transition-colors">Dashboard</Link>
            <span>/</span>
            <span className="text-slate-800 dark:text-slate-200 font-medium">Academic Profile</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Academic Profile & Funding Ledger
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Maintain your academic credentials and financial parameters to ensure accurate deterministic eligibility matching.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center px-4 py-2 border border-slate-200 dark:border-slate-700 text-xs font-semibold rounded-lg text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-2xs self-start sm:self-auto"
        >
          &larr; Return to Dashboard
        </Link>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs font-medium flex items-center space-x-3">
          <svg className="w-5 h-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-300 text-xs font-medium flex items-center space-x-3">
          <svg className="w-5 h-5 flex-shrink-0 text-rose-600 dark:text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Section 1: Personal Information */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4 transition-colors">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">1. Personal Identity</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Primary contact and account representation</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-600 dark:focus:ring-red-500"
                placeholder="e.g. Priya Sharma"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-600 dark:focus:ring-red-500"
                placeholder="e.g. student@university.edu"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Phone Number
              </label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-600 dark:focus:ring-red-500"
                placeholder="e.g. +91 98765 43210"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Academic Information */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4 transition-colors">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">2. Academic Credentials</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Enrolled institution, degree path, and verified merit metrics</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Institution / University <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="institution"
                required
                value={formData.institution}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-600 dark:focus:ring-red-500"
                placeholder="e.g. Indian Institute of Technology"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Course of Study <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="course"
                required
                value={formData.course}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-600 dark:focus:ring-red-500"
                placeholder="e.g. B.Tech Computer Science & Engineering"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Academic Year <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="year"
                required
                value={formData.year}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-600 dark:focus:ring-red-500"
                placeholder="e.g. 3rd Year"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Current CGPA (0.0 – 10.0 scale) <span className="text-rose-500">*</span>
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
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-600 dark:focus:ring-red-500 font-mono"
                placeholder="e.g. 8.5"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                12th Standard Percentage (0 – 100%) <span className="text-rose-500">*</span>
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
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-600 dark:focus:ring-red-500 font-mono"
                placeholder="e.g. 91.4"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Reservation Category <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="category"
                required
                value={formData.category}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-600 dark:focus:ring-red-500"
                placeholder="e.g. General, OBC, SC, ST, EWS"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Domicile State <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="state"
                required
                value={formData.state}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-600 dark:focus:ring-red-500"
                placeholder="e.g. Tamil Nadu, Karnataka, Maharashtra"
              />
            </div>

            {/* Admission Quota */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Admission Quota / Seat Allotment <span className="text-rose-500">*</span>
              </label>
              <select
                name="admission_quota"
                value={formData.admission_quota}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-600 dark:focus:ring-red-500"
              >
                <option value="GOVERNMENT_QUOTA">Government Quota (Single-Window TNEA / Collegiate Counselling)</option>
                <option value="MANAGEMENT_QUOTA">Management Quota (Self-Financing Seat)</option>
              </select>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Autonomous fee concessions (First Graduate, Free Education) require single-window allotment.
              </p>
            </div>

            {/* Hosteller Status */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Residential / Hostel Status <span className="text-rose-500">*</span>
              </label>
              <select
                name="hosteller_status"
                value={formData.hosteller_status}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-600 dark:focus:ring-red-500"
              >
                <option value="DAY_SCHOLAR">Day Scholar (Commuting from Home)</option>
                <option value="HOSTELLER">Hosteller (College/Approved Hostel Resident)</option>
              </select>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Used to evaluate statutory hostel maintenance allowances.
              </p>
            </div>

            {/* First Graduate in Immediate Family */}
            <div className="sm:col-span-2 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-start gap-3">
              <input
                type="checkbox"
                id="is_first_graduate"
                name="is_first_graduate"
                checked={formData.is_first_graduate}
                onChange={handleChange}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"
              />
              <div className="space-y-0.5">
                <label htmlFor="is_first_graduate" className="text-xs font-bold text-slate-900 dark:text-white cursor-pointer block">
                  First Graduate in Immediate Family (FG Scheme Eligible)
                </label>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed font-serif">
                  Check if neither parent nor any elder sibling has graduated or holds a degree. Tamil Nadu DOTE grants an annual tuition waiver (₹25,000–₹27,500) for eligible engineering candidates admitted under government counselling, backed by a Revenue Tahsildar First Graduate Certificate.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Financial Details & Live Funding Gap Preview */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-6 transition-colors">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">3. Financial Ledger & Need</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Education expenses and existing support determine your accurate funding gap
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Annual Education Cost (₹) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="500"
                min="0"
                name="annual_education_cost"
                required
                value={formData.annual_education_cost}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-600 dark:focus:ring-red-500 font-mono"
                placeholder="120000"
              />
              <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">
                Formatted: {formatINR(numCost)}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Existing Support / Scholarships (₹) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="500"
                min="0"
                name="existing_support"
                required
                value={formData.existing_support}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-600 dark:focus:ring-red-500 font-mono"
                placeholder="60000"
              />
              <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">
                Formatted: {formatINR(numSupport)}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Annual Family Income (₹) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="1000"
                min="0"
                name="annual_family_income"
                required
                value={formData.annual_family_income}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-600 dark:focus:ring-red-500 font-mono"
                placeholder="240000"
              />
              <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">
                Formatted: {formatINR(parseFloat(formData.annual_family_income) || 0)}
              </span>
            </div>
          </div>

          {/* LIVE FUNDING GAP PREVIEW BOX */}
          <div className="p-5 rounded-xl bg-red-500/5 dark:bg-red-500/10 border border-red-500/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse"></span>
                <span className="text-xs font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wider">
                  Live Funding Gap Preview
                </span>
              </div>
              <span className="text-xs font-medium text-red-600 dark:text-red-400 font-mono">
                max(0, Cost &minus; Support)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">Annual Cost</span>
                <span className="text-lg font-bold font-mono text-slate-800 dark:text-slate-200">{formatINR(numCost)}</span>
              </div>
              <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">Existing Support</span>
                <span className="text-lg font-bold font-mono text-slate-800 dark:text-slate-200">{formatINR(numSupport)}</span>
              </div>
              <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-red-500/30">
                <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">Calculated Funding Gap</span>
                <span className="text-lg font-bold font-mono text-red-600 dark:text-red-400">{formatINR(liveFundingGap)}</span>
              </div>
            </div>

            <div className="pt-2">
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1 font-medium">
                <span>Coverage Ratio</span>
                <span className="font-bold font-mono text-red-600 dark:text-red-400">{liveCoverage.toFixed(1)}%</span>
              </div>
              <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-600 dark:bg-red-50 dark:bg-red-950/300 rounded-full transition-all duration-300"
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
            className="px-5 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-2xs flex items-center space-x-2 disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Saving to Database...</span>
              </>
            ) : (
              <span>Save Academic Profile</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
