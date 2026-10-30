"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getCurrentStudent, updateStudent, getProfileCompletion, formatINR } from "@/lib/api";
import { StudentDetail, ProfileCompletionData } from "@/types/student";

const TN_DISTRICTS = [
  "Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore",
  "Dharmapuri", "Dindigul", "Erode", "Kallakurichi", "Kanchipuram",
  "Kanyakumari", "Karur", "Krishnagiri", "Madurai", "Mayiladuthurai",
  "Nagapattinam", "Namakkal", "Nilgiris", "Perambalur", "Pudukkottai",
  "Ramanathapuram", "Ranipet", "Salem", "Sivaganga", "Tenkasi",
  "Thanjavur", "Theni", "Thoothukudi", "Tiruchirappalli", "Tirunelveli",
  "Tirupathur", "Tiruppur", "Tiruvallur", "Tiruvannamalai", "Tiruvarur",
  "Vellore", "Viluppuram", "Virudhunagar", "Other State / District"
];

const ALL_INDIAN_STATES = [
  "Tamil Nadu", "Andhra Pradesh", "Karnataka", "Kerala", "Telangana",
  "Maharashtra", "Delhi", "Gujarat", "Rajasthan", "Uttar Pradesh",
  "West Bengal", "Bihar", "Madhya Pradesh", "Punjab", "Haryana",
  "Odisha", "Assam", "Goa", "Puducherry", "Other State / UT"
];

type ProfileTab = "personal" | "academic" | "community" | "financial" | "bank" | "identity";

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<ProfileTab>("personal");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completion, setCompletion] = useState<ProfileCompletionData | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form state - no CGPA required!
  const [formData, setFormData] = useState({
    // Personal
    name: "",
    email: "",
    phone: "",
    dob: "",
    gender: "Male",
    state: "Tamil Nadu",
    district: "Chennai",
    native_state: "Tamil Nadu",

    // Academic
    education_level: "Undergraduate",
    course: "",
    stream: "Engineering & Technology",
    institution: "",
    university: "",
    year: "1st Year",
    current_semester: "1st Semester",
    admission_year: "2024",
    qualifying_exam: "HSC / 12th Standard",
    qualifying_marks: "",
    institution_type: "Government-aided",
    admission_quota: "GOVERNMENT_QUOTA",
    hosteller_status: "DAY_SCHOLAR",
    is_first_graduate: false,
    school_type: "Government School (Classes 6-12)",
    school_study_history: "",

    // Community
    category: "BC",
    community_subcategory: "",

    // Financial
    annual_family_income: "0",
    income_range: "Below ₹2.5 Lakhs",
    annual_education_cost: "0",
    existing_support: "0",
    funding_gap: "0",
    financial_circumstances_notes: "",
    income_certificate_status: "NOT_UPLOADED",

    // Bank
    bank_readiness: "NOT_CONFIGURED",
    account_holder_name: "",
    dbt_enabled: false,
    bank_name: "",
    bank_branch: "",

    // Identity
    aadhaar_verification_status: "NOT_PROVIDED",
    aadhaar_masked: "",
    aadhaar_consent_given: false,
  });

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const [studentData, completionData]: [StudentDetail, ProfileCompletionData] = await Promise.all([
        getCurrentStudent(),
        getProfileCompletion().catch(() => null as unknown as ProfileCompletionData),
      ]);

      if (completionData) {
        setCompletion(completionData);
      }

      const p = studentData.profile;
      const f = studentData.funding_profile;

      setFormData({
        name: studentData.name || "",
        email: studentData.email || "",
        phone: studentData.phone || "",
        dob: p?.dob || "",
        gender: p?.gender || "Male",
        state: p?.state || "Tamil Nadu",
        district: p?.district || "Chennai",
        native_state: p?.native_state || "Tamil Nadu",

        education_level: p?.education_level || "Undergraduate",
        course: p?.course || "",
        stream: p?.stream || "Engineering & Technology",
        institution: p?.institution || "",
        university: p?.university || "",
        year: p?.year || "1st Year",
        current_semester: p?.current_semester || "1st Semester",
        admission_year: p?.admission_year || "2024",
        qualifying_exam: p?.qualifying_exam || "HSC / 12th Standard",
        qualifying_marks: p?.qualifying_marks ? String(p.qualifying_marks) : (p?.twelfth_percentage ? String(p.twelfth_percentage) : ""),
        institution_type: p?.institution_type || "Government-aided",
        admission_quota: p?.admission_quota || "GOVERNMENT_QUOTA",
        hosteller_status: p?.hosteller_status || "DAY_SCHOLAR",
        is_first_graduate: Boolean(p?.is_first_graduate),
        school_type: p?.school_type || "Government School (Classes 6-12)",
        school_study_history: p?.school_study_history || "",

        category: p?.category || "BC",
        community_subcategory: p?.community_subcategory || "",

        annual_family_income: f?.annual_family_income ? String(f.annual_family_income) : "0",
        income_range: f?.income_range || "Below ₹2.5 Lakhs",
        annual_education_cost: f?.annual_education_cost ? String(f.annual_education_cost) : "0",
        existing_support: f?.existing_support ? String(f.existing_support) : "0",
        funding_gap: f?.funding_gap ? String(f.funding_gap) : "0",
        financial_circumstances_notes: f?.financial_circumstances_notes || "",
        income_certificate_status: f?.income_certificate_status || "NOT_UPLOADED",

        bank_readiness: p?.bank_readiness || "NOT_CONFIGURED",
        account_holder_name: p?.account_holder_name || studentData.name || "",
        dbt_enabled: Boolean(p?.dbt_enabled),
        bank_name: p?.bank_name || "",
        bank_branch: p?.bank_branch || "",

        aadhaar_verification_status: p?.aadhaar_verification_status || "NOT_PROVIDED",
        aadhaar_masked: p?.aadhaar_masked || "",
        aadhaar_consent_given: Boolean(p?.aadhaar_consent_given),
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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => {
        const next = { ...prev, [name]: value };
        // If cost or support changes, automatically update live funding gap: cost - support
        if (name === "annual_education_cost" || name === "existing_support") {
          const c = parseFloat(name === "annual_education_cost" ? value : prev.annual_education_cost) || 0;
          const s = parseFloat(name === "existing_support" ? value : prev.existing_support) || 0;
          next.funding_gap = String(Math.max(0, c - s));
        }
        // If funding gap changes directly, adjust cost = support + gap
        if (name === "funding_gap") {
          const g = parseFloat(value) || 0;
          const s = parseFloat(prev.existing_support) || 0;
          next.annual_education_cost = String(s + g);
        }
        return next;
      });
    }
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || null,
        dob: formData.dob || null,
        gender: formData.gender,
        state: formData.state,
        district: formData.district,
        native_state: formData.native_state,

        education_level: formData.education_level,
        course: formData.course.trim(),
        stream: formData.stream,
        institution: formData.institution.trim(),
        university: formData.university.trim() || null,
        year: formData.year,
        current_semester: formData.current_semester,
        admission_year: formData.admission_year || null,
        qualifying_exam: formData.qualifying_exam || null,
        qualifying_marks: formData.qualifying_marks ? parseFloat(formData.qualifying_marks) : undefined,
        institution_type: formData.institution_type,
        admission_quota: formData.admission_quota,
        hosteller_status: formData.hosteller_status,
        is_first_graduate: formData.is_first_graduate,
        school_type: formData.school_type,
        school_study_history: formData.school_study_history.trim() || null,

        category: formData.category,
        community_subcategory: formData.community_subcategory.trim() || null,

        annual_family_income: parseFloat(formData.annual_family_income) || 0,
        income_range: formData.income_range,
        annual_education_cost: parseFloat(formData.annual_education_cost) || 0,
        existing_support: parseFloat(formData.existing_support) || 0,
        funding_gap: parseFloat(formData.funding_gap) || 0,
        financial_circumstances_notes: formData.financial_circumstances_notes.trim() || null,
        income_certificate_status: formData.income_certificate_status,

        bank_readiness: formData.bank_readiness,
        account_holder_name: formData.account_holder_name.trim() || null,
        dbt_enabled: formData.dbt_enabled,
        bank_name: formData.bank_name.trim() || null,
        bank_branch: formData.bank_branch.trim() || null,

        aadhaar_verification_status: formData.aadhaar_verification_status,
        aadhaar_masked: formData.aadhaar_masked.trim() || null,
        aadhaar_consent_given: formData.aadhaar_consent_given,
      };

      await updateStudent(payload);
      const updatedCompletion = await getProfileCompletion().catch(() => null);
      if (updatedCompletion) setCompletion(updatedCompletion);

      setSuccessMessage("My Profile updated successfully! Changes are persisted and immediately active in your scholarship recommendations.");
      setTimeout(() => setSuccessMessage(null), 6000);
    } catch (err: unknown) {
      setErrorMessage((err as Error)?.message || "Failed to save profile changes.");
    } finally {
      setSaving(false);
    }
  };

  const costNum = Math.max(0, parseFloat(formData.annual_education_cost) || 0);
  const supportNum = Math.max(0, parseFloat(formData.existing_support) || 0);
  const gapNum = Math.max(0, parseFloat(formData.funding_gap) || 0);
  const coveragePct = costNum > 0 ? Math.min(100, Math.round((supportNum / costNum) * 100)) : 100;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          Loading student profile and eligibility attributes...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-[#121215] rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 shadow-sm transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/40 text-[10px] font-mono font-bold uppercase tracking-wider">
              <span>Settings &rarr; My Profile</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Student Profile & Intelligence Attributes
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-2xl">
              Deterministic scholarship eligibility, statutory quotas, and personal information. All updates persist securely to your account.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/"
              className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-semibold transition-colors"
            >
              &larr; Return to Dashboard
            </Link>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-red-950/30 disabled:opacity-50 transition-all flex items-center space-x-2 cursor-pointer"
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Save All Changes</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Profile Completion Indicator */}
        {completion && (
          <div className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                  Profile Completion Readiness
                </span>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 ml-2">
                  (Calculated from statutory matching fields)
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-sm font-bold text-red-600 dark:text-red-400">
                  {completion.overall_percentage}%
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                  completion.overall_percentage >= 85
                    ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300"
                    : completion.overall_percentage >= 60
                    ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
                    : "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300"
                }`}>
                  {completion.overall_status}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-600 rounded-full transition-all duration-500"
                style={{ width: `${completion.overall_percentage}%` }}
              ></div>
            </div>

            {/* Categorized Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-4">
              {Object.entries(completion.sections).map(([key, sec]) => (
                <button
                  type="button"
                  key={key}
                  onClick={() => setActiveTab(key === "bank_benefit" ? "bank" : (key as ProfileTab))}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    activeTab === (key === "bank_benefit" ? "bank" : key)
                      ? "border-red-600 bg-red-50/50 dark:bg-red-950/30"
                      : "border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 hover:border-zinc-300"
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-bold capitalize text-zinc-900 dark:text-white">
                    <span>{key.replace("_", " & ")}</span>
                    <span className="text-[10px] font-mono text-zinc-500">{sec.percentage}%</span>
                  </div>
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 truncate">
                    {sec.status === "COMPLETE" ? "✓ Complete" : (sec.missing_fields[0] ? `Missing: ${sec.missing_fields[0]}` : sec.status)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Success or Error Feedback */}
        {successMessage && (
          <div className="mt-4 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>{successMessage}</span>
          </div>
        )}
        {errorMessage && (
          <div className="mt-4 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Profile Section Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-zinc-200 dark:border-zinc-800 text-xs font-semibold">
        {[
          { id: "personal", label: "A. Personal Info" },
          { id: "academic", label: "B. Academic Standing" },
          { id: "community", label: "C. Community & Reservation" },
          { id: "financial", label: "D. Family Financials" },
          { id: "bank", label: "E. Bank & DBT Benefits" },
          { id: "identity", label: "F. Identity & Aadhaar" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as ProfileTab)}
            className={`px-4 py-2.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
              activeTab === tab.id
                ? "bg-red-600 text-white shadow-sm shadow-red-950/30"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Profile Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* =================================================================== */}
        {/* SECTION A: PERSONAL INFORMATION */}
        {/* =================================================================== */}
        {activeTab === "personal" && (
          <div className="bg-white dark:bg-[#121215] rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 space-y-6 shadow-sm">
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">A. Personal Identification & Nativity</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Full legal name, contact credentials, and residency attributes for state quotas.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Full Legal Name (as per Certificate) *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. Arjun Kumar"
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Date of Birth (YYYY-MM-DD)
                </label>
                <input
                  type="date"
                  name="dob"
                  value={formData.dob}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Gender *
                </label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other / Transgender</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="student@university.edu"
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+91 98765 43210"
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  State of Residence *
                </label>
                <select
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                >
                  {ALL_INDIAN_STATES.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  District of Residence (Tamil Nadu)
                </label>
                <select
                  name="district"
                  value={formData.district}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                >
                  {TN_DISTRICTS.map((dst) => (
                    <option key={dst} value={dst}>{dst}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Native State / Domicile Origin
                </label>
                <select
                  name="native_state"
                  value={formData.native_state}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                >
                  {ALL_INDIAN_STATES.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-900/40 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                <strong>Nativity Notice:</strong> Tamil Nadu is selected by default for collegiate applications. Selecting Tamil Nadu indicates residency and does not automatically prove statutory domicile without an official Tahsildar Nativity / Domicile Certificate in your Document Vault.
              </span>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* SECTION B: ACADEMIC INFORMATION */}
        {/* =================================================================== */}
        {activeTab === "academic" && (
          <div className="bg-white dark:bg-[#121215] rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 space-y-6 shadow-sm">
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">B. Academic & Institutional Standing</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Current degree program, institution classification, quota allotment, and prior schooling.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Education Level *
                </label>
                <select
                  name="education_level"
                  value={formData.education_level}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                >
                  <option value="Undergraduate">Undergraduate (B.Tech / B.E. / B.Sc / B.A. / B.Com)</option>
                  <option value="Postgraduate">Postgraduate (M.Tech / M.Sc / M.A. / M.Com)</option>
                  <option value="Diploma">Diploma / Polytechnic</option>
                  <option value="Doctoral">Doctoral / Ph.D.</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Discipline / Stream *
                </label>
                <select
                  name="stream"
                  value={formData.stream}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                >
                  <option value="Engineering & Technology">Engineering & Technology</option>
                  <option value="Arts & Science">Arts & Science / Humanities / Commerce</option>
                  <option value="Polytechnic">Polytechnic / Vocational</option>
                  <option value="Medical / Allied Health">Medical & Allied Health Sciences</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Course / Program Name *
                </label>
                <input
                  type="text"
                  name="course"
                  required
                  value={formData.course}
                  onChange={handleChange}
                  placeholder="e.g. B.Sc Computer Science"
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  College / Institution Name *
                </label>
                <input
                  type="text"
                  name="institution"
                  required
                  value={formData.institution}
                  onChange={handleChange}
                  placeholder="e.g. Loyola College (Autonomous), Chennai"
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Affiliated University
                </label>
                <input
                  type="text"
                  name="university"
                  value={formData.university}
                  onChange={handleChange}
                  placeholder="e.g. University of Madras / Anna University"
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Current Year of Study *
                </label>
                <select
                  name="year"
                  value={formData.year}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                >
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                  <option value="Postgraduate">Postgraduate</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Current Semester
                </label>
                <select
                  name="current_semester"
                  value={formData.current_semester}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                >
                  <option value="1st Semester">1st Semester</option>
                  <option value="2nd Semester">2nd Semester</option>
                  <option value="3rd Semester">3rd Semester</option>
                  <option value="4th Semester">4th Semester</option>
                  <option value="5th Semester">5th Semester</option>
                  <option value="6th Semester">6th Semester</option>
                  <option value="7th Semester">7th Semester</option>
                  <option value="8th Semester">8th Semester</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Admission Year
                </label>
                <input
                  type="text"
                  name="admission_year"
                  value={formData.admission_year}
                  onChange={handleChange}
                  placeholder="e.g. 2024"
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Qualifying Examination Marks / %
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  name="qualifying_marks"
                  value={formData.qualifying_marks}
                  onChange={handleChange}
                  placeholder="e.g. 89.2"
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Institution Type *
                </label>
                <select
                  name="institution_type"
                  value={formData.institution_type}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                >
                  <option value="Government">Government Autonomous College</option>
                  <option value="Government-aided">Government-Aided Autonomous College</option>
                  <option value="Private">Private / Self-Financing Autonomous College</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Admission Quota *
                </label>
                <select
                  name="admission_quota"
                  value={formData.admission_quota}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                >
                  <option value="GOVERNMENT_QUOTA">Government Counselling Quota (Single Window / TNEA / DCE)</option>
                  <option value="MANAGEMENT_QUOTA">Management Quota / Direct Admission</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Residential Standing
                </label>
                <select
                  name="hosteller_status"
                  value={formData.hosteller_status}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                >
                  <option value="DAY_SCHOLAR">Day Scholar</option>
                  <option value="HOSTELLER">College Hosteller (Recognized Hostel)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Previous Schooling (Classes 6 to 12)
                </label>
                <select
                  name="school_type"
                  value={formData.school_type}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                >
                  <option value="Government School (Classes 6-12)">Tamil Nadu Government School (Classes 6 to 12)</option>
                  <option value="Government-Aided School">Government-Aided School</option>
                  <option value="Private / Matriculation">Private / Matriculation / CBSE School</option>
                </select>
              </div>

              <div className="flex items-center space-x-3 pt-6">
                <input
                  type="checkbox"
                  id="is_first_graduate"
                  name="is_first_graduate"
                  checked={formData.is_first_graduate}
                  onChange={handleChange}
                  className="w-4 h-4 text-red-600 rounded border-zinc-300 focus:ring-red-500"
                />
                <label htmlFor="is_first_graduate" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  First Generation Graduate in Immediate Family (FG Concession Eligible)
                </label>
              </div>
            </div>

            <div className="p-3.5 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">CGPA-Free Guarantee:</span> SCHOLARAi evaluates eligibility based on qualifying entrance and board marks. CGPA is never required for profile creation or scholarship matching.
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* SECTION C: COMMUNITY AND RESERVATION INFORMATION */}
        {/* =================================================================== */}
        {activeTab === "community" && (
          <div className="bg-white dark:bg-[#121215] rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 space-y-6 shadow-sm">
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-zinc-900 dark:text-white">C. Community & Statutory Reservation</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/40 uppercase">
                  Sensitive Data
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Official social category as recognized by the Government of Tamil Nadu and Central lists.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Community Category *
                </label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                >
                  <option value="BC">BC — Backward Classes</option>
                  <option value="MBC">MBC — Most Backward Classes (including DNC)</option>
                  <option value="OC">OC — Other Communities / Open Category</option>
                  <option value="SC">SC — Scheduled Castes</option>
                  <option value="SCA">SCA — Scheduled Caste Arunthathiyar</option>
                  <option value="ST">ST — Scheduled Tribes</option>
                  <option value="Other / Not specified">Other / Not specified</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Notified Subcategory / Caste (Optional)
                </label>
                <input
                  type="text"
                  name="community_subcategory"
                  value={formData.community_subcategory}
                  onChange={handleChange}
                  placeholder="Optional: Subcaste or Denotified Community"
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 space-y-2 text-xs">
              <div className="flex items-center space-x-2 text-zinc-800 dark:text-zinc-200 font-semibold">
                <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>Privacy & Anti-Inference Protection</span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                SCHOLARAi never infers or guesses caste or community from student names, locations, Aadhaar numbers, or email addresses. Community data is treated as sensitive personal data, restricted solely to authorized scholarship eligibility matching.
              </p>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* SECTION D: FAMILY FINANCIAL INFORMATION */}
        {/* =================================================================== */}
        {activeTab === "financial" && (
          <div className="bg-white dark:bg-[#121215] rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 space-y-6 shadow-sm">
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">D. Family Financial Planning & Need</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Annual parental gross income, tuition expenses, secured funds, and editable funding gap.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Annual Family Gross Income (₹) *
                </label>
                <input
                  type="number"
                  min="0"
                  name="annual_family_income"
                  required
                  value={formData.annual_family_income}
                  onChange={handleChange}
                  placeholder="e.g. 210000"
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Statutory Income Ceiling Bracket
                </label>
                <select
                  name="income_range"
                  value={formData.income_range}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                >
                  <option value="Below ₹2.5 Lakhs">Below ₹2,50,000 (Full TN Post-Matric Waiver Eligible)</option>
                  <option value="₹2.5L - ₹4.5L">₹2,50,001 - ₹4,50,000 (Central Sector CSSS Eligible)</option>
                  <option value="₹4.5L - ₹8.0L">₹4,50,001 - ₹8,00,000 (AICTE Pragati/Saksham Ceiling)</option>
                  <option value="Above ₹8.0L">Above ₹8,00,000 (Non-Income Based Schemes Only)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Income Certificate Status
                </label>
                <select
                  name="income_certificate_status"
                  value={formData.income_certificate_status}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                >
                  <option value="NOT_UPLOADED">Not Uploaded (Self-Reported Only)</option>
                  <option value="UPLOADED">Uploaded in Document Vault</option>
                  <option value="VERIFIED">Verified by Revenue Tahsildar / E-Sevai</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Annual Education Cost (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  name="annual_education_cost"
                  value={formData.annual_education_cost}
                  onChange={handleChange}
                  placeholder="e.g. 65000"
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Existing Secured Support (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  name="existing_support"
                  value={formData.existing_support}
                  onChange={handleChange}
                  placeholder="e.g. 0"
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Net Funding Shortfall / Gap (₹) *
                </label>
                <input
                  type="number"
                  min="0"
                  name="funding_gap"
                  value={formData.funding_gap}
                  onChange={handleChange}
                  placeholder="e.g. 65000"
                  className="w-full px-3.5 py-2.5 bg-red-50/50 dark:bg-red-950/30 border border-red-300 dark:border-red-900/60 rounded-xl text-sm font-bold text-red-600 dark:text-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
              </div>
            </div>

            {/* Dynamic Gap Preview Card */}
            <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-zinc-900 dark:text-white block">
                  Dynamic Gap Calculation & Coverage Preview
                </span>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {formatINR(costNum)} (Need) &minus; {formatINR(supportNum)} (Support) = <strong className="text-zinc-900 dark:text-white font-mono">{formatINR(gapNum)}</strong> remaining gap ({coveragePct}% covered).
                </span>
              </div>
              <div className="w-48">
                <div className="w-full h-2.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${coveragePct}%` }}></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* SECTION E: BANK AND BENEFIT INFORMATION */}
        {/* =================================================================== */}
        {activeTab === "bank" && (
          <div className="bg-white dark:bg-[#121215] rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 space-y-6 shadow-sm">
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">E. Direct Benefit Transfer (DBT) & Bank Readiness</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Bank account readiness for direct statutory scholarship stipends. Bank details are never exposed publicly.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Bank Account Readiness
                </label>
                <select
                  name="bank_readiness"
                  value={formData.bank_readiness}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                >
                  <option value="NOT_CONFIGURED">Not Configured / Setup Required</option>
                  <option value="ACCOUNT_ACTIVE">Bank Account Active (Aadhaar Seeding Pending)</option>
                  <option value="READY">Ready & Aadhaar-DBT Seeded (Optimal for NSP / SSP)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Account Holder Name
                </label>
                <input
                  type="text"
                  name="account_holder_name"
                  value={formData.account_holder_name}
                  onChange={handleChange}
                  placeholder="Must match student certificate name"
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Bank Name (e.g. State Bank of India, Canara Bank)
                </label>
                <input
                  type="text"
                  name="bank_name"
                  value={formData.bank_name}
                  onChange={handleChange}
                  placeholder="e.g. State Bank of India"
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
              </div>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <input
                type="checkbox"
                id="dbt_enabled"
                name="dbt_enabled"
                checked={formData.dbt_enabled}
                onChange={handleChange}
                className="w-4 h-4 text-red-600 rounded border-zinc-300 focus:ring-red-500"
              />
              <label htmlFor="dbt_enabled" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                My bank account is Aadhaar-seeded for NPCI / Direct Benefit Transfer (DBT) payments.
              </label>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* SECTION F: IDENTITY AND AADHAAR INFORMATION */}
        {/* =================================================================== */}
        {activeTab === "identity" && (
          <div className="bg-white dark:bg-[#121215] rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 space-y-6 shadow-sm">
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">F. Identity Verification & Masked Aadhaar</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Official statutory portals require verified identity. SCHOLARAi stores only minimum masked references.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Identity Verification Status *
                </label>
                <select
                  name="aadhaar_verification_status"
                  value={formData.aadhaar_verification_status}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                >
                  <option value="NOT_PROVIDED">Not provided</option>
                  <option value="VERIFICATION_REQUIRED">Verification required</option>
                  <option value="VERIFICATION_PENDING">Verification pending (Document in Vault)</option>
                  <option value="VERIFIED_AUTHORIZED">Verified through an authorized source</option>
                  <option value="VERIFICATION_FAILED">Verification failed</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Masked Aadhaar Reference (e.g. XXXX-XXXX-1234)
                </label>
                <input
                  type="text"
                  name="aadhaar_masked"
                  value={formData.aadhaar_masked}
                  onChange={handleChange}
                  placeholder="XXXX-XXXX-1234"
                  maxLength={14}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-mono text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
              </div>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <input
                type="checkbox"
                id="aadhaar_consent_given"
                name="aadhaar_consent_given"
                checked={formData.aadhaar_consent_given}
                onChange={handleChange}
                className="w-4 h-4 text-red-600 rounded border-zinc-300 focus:ring-red-500"
              />
              <label htmlFor="aadhaar_consent_given" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                I authorize SCHOLARAi to use my masked identity reference and verified certificates exclusively for statutory scholarship matching.
              </label>
            </div>

            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-2 text-xs">
              <span className="font-semibold text-zinc-800 dark:text-zinc-200 block">
                Statutory Regulatory Transparency:
              </span>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                SCHOLARAi does not collect raw Aadhaar biometrics or OTPs. Official identity verification for government schemes (NSP, SSP) is conducted directly on authorized official government portals (Digilocker / UIDAI OTR). Upload your Aadhaar / Nativity proof document in the Document Vault for statutory verification.
              </p>
            </div>
          </div>
        )}

        {/* Bottom Save Bar */}
        <div className="flex items-center justify-between pt-4 border-t border-zinc-200 dark:border-zinc-800">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Unsaved changes are highlighted above.
          </span>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-red-950/30 disabled:opacity-50 transition-all cursor-pointer flex items-center space-x-2"
          >
            {saving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Saving Profile...</span>
              </>
            ) : (
              <span>Save Changes</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
