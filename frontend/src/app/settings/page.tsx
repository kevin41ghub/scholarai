"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { updateStudent, getProfileCompletion, formatINR } from "@/lib/api";
import { ProfileCompletionData } from "@/types/student";

type SettingsTab = "profile" | "appearance" | "funding" | "notifications" | "account";

const TN_DISTRICTS = [
  "Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore",
  "Dharmapuri", "Dindigul", "Erode", "Kallakurichi", "Kanchipuram",
  "Kanyakumari", "Karur", "Krishnagiri", "Madurai", "Mayiladuthurai",
  "Nagapattinam", "Namakkal", "Nilgiris", "Perambalur", "Pudukkottai",
  "Ramanathapuram", "Ranipet", "Salem", "Sivaganga", "Tenkasi",
  "Thanjavur", "Theni", "Thoothukudi", "Tiruchirappalli", "Tirunelveli",
  "Tirupathur", "Tiruppur", "Tiruvallur", "Tiruvannamalai", "Tiruvarur",
  "Vellore", "Viluppuram", "Virudhunagar"
];

function SettingsPageInner() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as SettingsTab) || "profile";

  const { theme, resolvedTheme, setTheme } = useTheme();
  const { student, user, displayEmail, refreshUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  // Profile Form state — strictly no CGPA!
  const [profileForm, setProfileForm] = useState({
    // Personal Information
    name: "",
    email: "",
    phone: "",
    dob: "",
    gender: "Male",
    state: "Tamil Nadu", // Strictly restricted to Tamil Nadu
    district: "Chennai",
    native_state: "Tamil Nadu",
    domicile_status: "Tamil Nadu Domicile",

    // Academic Information
    institution: "",
    course: "",
    stream: "Engineering & Technology",
    education_level: "Undergraduate",
    year: "1st Year",
    admission_quota: "GOVERNMENT_QUOTA",
    hosteller_status: "DAY_SCHOLAR",
    mode_of_study: "Regular / Full-Time",
    studied_govt_school_6_to_12: false,
    is_first_graduate: false,
    board_of_education: "Tamil Nadu State Board",
    qualifying_marks: "",
    school_type: "Tamil Nadu Government School (Classes 6-12)",
    school_study_history: "",

    // Community Information (Statutory Categories Only)
    category: "BC",
    minority_status: "None",
    special_category: "None",

    // Sports & Special Athletic Eligibility
    participates_in_sports: false,
    sport_discipline: "",
    sports_competition_level: "District / Divisional",
    sports_achievement_type: "Winner / Gold Medalist",
    sports_certificate_status: "Have Verified Official Certificate",
    sports_achievement_year: "2024",

    // Disability & Accessibility Accommodations (Confidential & Consent-Based)
    has_disability: false,
    disability_consent_given: false,
    disability_category: "Locomotor Disability",
    disability_percentage: "",
    udid_card_status: "UDID Card Available",
    accessibility_needs: "None / Independent",

    // Financial Information
    annual_family_income: 0,
    income_range: "Below ₹2.5 Lakhs",
    income_certificate_status: "Have Valid E-Sevai Certificate",
    annual_education_cost: 0,
    existing_support: 0,
    funding_gap: 0,
    financial_circumstances_notes: "",

    // Identity & Benefits
    aadhaar_masked: "",
    aadhaar_consent_given: false,
    aadhaar_verification_status: "NOT_PROVIDED",
    dbt_seeding_status: "Don't Know",
    dbt_enabled: false,
    ration_card_type: "Priority (PHH)",
    bank_readiness: "NOT_CONFIGURED",
    account_holder_name: "",
    bank_name: "",
    bank_branch: "",
  });

  const [completion, setCompletion] = useState<ProfileCompletionData | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingFunding, setSavingFunding] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [fundingSuccess, setFundingSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Sync state when student auth data changes
  useEffect(() => {
    if (student) {
      const timer = setTimeout(() => {
        const p = student.profile;
        const f = student.funding_profile;

        setProfileForm({
          name: student.name || "",
          email: student.email || "",
          phone: student.phone || "",
          dob: p?.dob || "",
          gender: p?.gender || "Male",
          state: "Tamil Nadu", // strictly locked to Tamil Nadu
          district: p?.district || "Chennai",
          native_state: p?.native_state || "Tamil Nadu",
          domicile_status: p?.domicile_status || "Tamil Nadu Domicile",

          institution: p?.institution || "",
          course: p?.course || "",
          stream: p?.stream || "Engineering & Technology",
          education_level: p?.education_level || "Undergraduate",
          year: p?.year || "1st Year",
          admission_quota: p?.admission_quota || "GOVERNMENT_QUOTA",
          hosteller_status: p?.hosteller_status || "DAY_SCHOLAR",
          mode_of_study: p?.mode_of_study || "Regular / Full-Time",
          studied_govt_school_6_to_12: Boolean(p?.studied_govt_school_6_to_12),
          is_first_graduate: Boolean(p?.is_first_graduate),
          board_of_education: p?.board_of_education || "Tamil Nadu State Board",
          qualifying_marks: p?.qualifying_marks ? String(p.qualifying_marks) : (p?.twelfth_percentage ? String(p.twelfth_percentage) : ""),
          school_type: p?.school_type || "Tamil Nadu Government School (Classes 6-12)",
          school_study_history: p?.school_study_history || "",

          category: p?.category || "BC",
          minority_status: p?.minority_status || "None",
          special_category: p?.special_category || "None",

          participates_in_sports: Boolean(p?.participates_in_sports),
          sport_discipline: p?.sport_discipline || "",
          sports_competition_level: p?.sports_competition_level || "District / Divisional",
          sports_achievement_type: p?.sports_achievement_type || "Winner / Gold Medalist",
          sports_certificate_status: p?.sports_certificate_status || "Have Verified Official Certificate",
          sports_achievement_year: p?.sports_achievement_year || "",

          has_disability: Boolean(p?.has_disability),
          disability_consent_given: Boolean(p?.disability_consent_given),
          disability_category: p?.disability_category || "Locomotor Disability",
          disability_percentage: p?.disability_percentage !== null && p?.disability_percentage !== undefined ? String(p.disability_percentage) : "",
          udid_card_status: p?.udid_card_status || "UDID Card Available",
          accessibility_needs: p?.accessibility_needs || "None / Independent",

          annual_family_income: f?.annual_family_income || 0,
          income_range: f?.income_range || "Below ₹2.5 Lakhs",
          income_certificate_status: f?.income_certificate_status || "Have Valid E-Sevai Certificate",
          annual_education_cost: f?.annual_education_cost || 0,
          existing_support: f?.existing_support || 0,
          funding_gap: f?.funding_gap || 0,
          financial_circumstances_notes: f?.financial_circumstances_notes || "",

          aadhaar_masked: p?.aadhaar_masked || "",
          aadhaar_consent_given: Boolean(p?.aadhaar_consent_given),
          aadhaar_verification_status: p?.aadhaar_verification_status || "NOT_PROVIDED",
          dbt_seeding_status: p?.dbt_seeding_status || (p?.dbt_enabled ? "Yes" : "Don't Know"),
          dbt_enabled: Boolean(p?.dbt_enabled),
          ration_card_type: p?.ration_card_type || "Priority (PHH)",
          bank_readiness: p?.bank_readiness || "NOT_CONFIGURED",
          account_holder_name: p?.account_holder_name || student.name || "",
          bank_name: p?.bank_name || "",
          bank_branch: p?.bank_branch || "",
        });
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [student]);

  const loadCompletion = useCallback(async () => {
    try {
      const comp = await getProfileCompletion();
      setCompletion(comp);
    } catch {
      // Ignored if unauthenticated or endpoint offline
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCompletion();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadCompletion]);

  // Handle single comprehensive save
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSuccess(null);
    setFormError(null);

    try {
      const qMarks = profileForm.qualifying_marks ? parseFloat(profileForm.qualifying_marks) : null;

      await updateStudent({
        name: profileForm.name.trim(),
        email: profileForm.email.trim(),
        phone: profileForm.phone.trim() || null,
        dob: profileForm.dob || null,
        gender: profileForm.gender,
        state: "Tamil Nadu", // strictly locked to Tamil Nadu
        district: profileForm.district,
        native_state: profileForm.native_state,
        domicile_status: profileForm.domicile_status,

        institution: profileForm.institution.trim(),
        course: profileForm.course.trim(),
        stream: profileForm.stream,
        education_level: profileForm.education_level,
        year: profileForm.year,
        admission_quota: profileForm.admission_quota,
        hosteller_status: profileForm.hosteller_status,
        mode_of_study: profileForm.mode_of_study,
        studied_govt_school_6_to_12: profileForm.studied_govt_school_6_to_12,
        is_first_graduate: profileForm.is_first_graduate,
        board_of_education: profileForm.board_of_education,
        qualifying_marks: qMarks !== null && !isNaN(qMarks) ? qMarks : null,
        school_type: profileForm.school_type,
        school_study_history: profileForm.school_study_history.trim() || null,

        category: profileForm.category,
        minority_status: profileForm.minority_status,
        special_category: profileForm.special_category,

        // Sports & Special Athletic Eligibility
        participates_in_sports: profileForm.participates_in_sports,
        sport_discipline: profileForm.sport_discipline.trim() || null,
        sports_competition_level: profileForm.sports_competition_level,
        sports_achievement_type: profileForm.sports_achievement_type,
        sports_certificate_status: profileForm.sports_certificate_status,
        sports_achievement_year: profileForm.sports_achievement_year.trim() || null,

        // Disability & Accessibility Accommodations (Confidential & Consent-Based)
        has_disability: profileForm.has_disability,
        disability_consent_given: profileForm.disability_consent_given,
        disability_category: profileForm.has_disability ? profileForm.disability_category : null,
        disability_percentage: profileForm.has_disability && profileForm.disability_percentage ? parseFloat(profileForm.disability_percentage) : null,
        udid_card_status: profileForm.has_disability ? profileForm.udid_card_status : "Not Available",
        accessibility_needs: profileForm.has_disability ? profileForm.accessibility_needs : null,

        annual_family_income: Number(profileForm.annual_family_income) || 0,
        income_range: profileForm.income_range,
        income_certificate_status: profileForm.income_certificate_status,
        annual_education_cost: Number(profileForm.annual_education_cost) || 0,
        existing_support: Number(profileForm.existing_support) || 0,
        funding_gap: Number(profileForm.funding_gap) || 0,
        financial_circumstances_notes: profileForm.financial_circumstances_notes.trim() || null,

        aadhaar_masked: profileForm.aadhaar_masked.trim() || null,
        aadhaar_consent_given: profileForm.aadhaar_consent_given,
        aadhaar_verification_status: profileForm.aadhaar_verification_status,
        dbt_seeding_status: profileForm.dbt_seeding_status,
        dbt_enabled: profileForm.dbt_seeding_status === "Yes" || profileForm.dbt_enabled,
        ration_card_type: profileForm.ration_card_type,
        bank_readiness: profileForm.bank_readiness,
        account_holder_name: profileForm.account_holder_name.trim() || null,
        bank_name: profileForm.bank_name.trim() || null,
        bank_branch: profileForm.bank_branch.trim() || null,
      });

      await refreshUser();
      await loadCompletion();
      setProfileSuccess("Student Profile saved successfully. Recommendations and eligibility have been recalculated automatically.");
      setTimeout(() => setProfileSuccess(null), 6000);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setFormError(err.message);
      } else {
        setFormError("Failed to update student profile.");
      }
    } finally {
      setSavingProfile(false);
    }
  };

  const handleFundingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingFunding(true);
    setFundingSuccess(null);
    setFormError(null);

    try {
      await updateStudent({
        annual_education_cost: Number(profileForm.annual_education_cost) || 0,
        existing_support: Number(profileForm.existing_support) || 0,
        annual_family_income: Number(profileForm.annual_family_income) || 0,
        funding_gap: Number(profileForm.funding_gap) || 0,
      });
      await refreshUser();
      await loadCompletion();
      setFundingSuccess("Funding parameters updated. Gap recalculated.");
      setTimeout(() => setFundingSuccess(null), 4000);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setFormError(err.message);
      } else {
        setFormError("Failed to update funding parameters.");
      }
    } finally {
      setSavingFunding(false);
    }
  };

  const calculatedGap = Math.max(
    0,
    (Number(profileForm.annual_education_cost) || 0) - (Number(profileForm.existing_support) || 0)
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Settings & Student Profile
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Manage your complete academic identity, statutory reservation criteria, financial planning parameters, and visual preferences
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-px">
        {[
          { id: "profile", label: "My Profile", icon: "👤" },
          { id: "funding", label: "Funding Preferences", icon: "💰" },
          { id: "appearance", label: "Appearance", icon: "🎨" },
          { id: "notifications", label: "Alerts & Notifications", icon: "🔔" },
          { id: "account", label: "Account & Security", icon: "🔒" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as SettingsTab)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors whitespace-nowrap flex items-center space-x-2 border-b-2 -mb-px cursor-pointer ${
              activeTab === tab.id
                ? "border-red-600 dark:border-red-500 text-red-600 dark:text-red-400 bg-white dark:bg-[#111827]"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {formError && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/80 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{formError}</span>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB: MY PROFILE (COMPLETE COMPREHENSIVE EDITABLE FORM) */}
      {/* =================================================================== */}
      {activeTab === "profile" && (
        <form onSubmit={handleProfileSubmit} className="space-y-6">
          {/* Profile Overview Card with Readiness Indicator */}
          <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/40 text-[10px] font-mono font-bold uppercase tracking-wider mb-1.5">
                  <span>Tamil Nadu Higher Education Intelligence</span>
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Complete Student Profile
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Deterministic scholarship matching relies on these attributes. Update any section and click Save Profile Changes below.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="py-2.5 px-5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-red-950/30 disabled:opacity-50 transition-all cursor-pointer flex items-center space-x-2"
                >
                  {savingProfile ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Saving Profile...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Save Profile Changes</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Profile Completion Indicator */}
            {completion && (
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Statutory Profile Readiness Score
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-red-600 dark:text-red-400">
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
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-600 rounded-full transition-all duration-500"
                    style={{ width: `${completion.overall_percentage}%` }}
                  ></div>
                </div>
              </div>
            )}

            {profileSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>{profileSuccess}</span>
              </div>
            )}
          </div>

          {/* =================================================================== */}
          {/* SECTION 1: PERSONAL INFORMATION */}
          {/* =================================================================== */}
          <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold uppercase mr-2">
                Section 1
              </span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white inline">
                Personal Information
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Full legal name, contact information, and state residency details.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Legal Name (as per Certificate) *
                </label>
                <input
                  type="text"
                  required
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  placeholder="e.g. Priya Sharma"
                  className="w-full px-3.5 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Date of Birth (YYYY-MM-DD)
                </label>
                <input
                  type="date"
                  value={profileForm.dob}
                  onChange={(e) => setProfileForm({ ...profileForm, dob: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Gender *
                </label>
                <select
                  value={profileForm.gender}
                  onChange={(e) => setProfileForm({ ...profileForm, gender: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other / Transgender</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="w-full px-3.5 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  placeholder="student@university.edu"
                  className="w-full px-3.5 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  State of Residence (Strictly Fixed)
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    disabled
                    value="Tamil Nadu"
                    className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 cursor-not-allowed"
                  />
                  <span className="text-[10px] font-bold px-2 py-1 rounded bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/50 whitespace-nowrap">
                    TN Only
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  District (Tamil Nadu) *
                </label>
                <select
                  value={profileForm.district}
                  onChange={(e) => setProfileForm({ ...profileForm, district: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                >
                  {TN_DISTRICTS.map((dst) => (
                    <option key={dst} value={dst}>{dst}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Domicile / Nativity Status
                </label>
                <select
                  value={profileForm.domicile_status}
                  onChange={(e) => setProfileForm({ ...profileForm, domicile_status: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                >
                  <option value="Tamil Nadu Domicile">Tamil Nadu Domicile (Native of TN)</option>
                  <option value="Other State Native (Studying in TN)">Other State Native (Studying in TN)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Native State of Origin
                </label>
                <input
                  type="text"
                  value={profileForm.native_state}
                  onChange={(e) => setProfileForm({ ...profileForm, native_state: e.target.value })}
                  placeholder="e.g. Tamil Nadu"
                  className="w-full px-3.5 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                <strong>Nativity & Jurisdiction Notice:</strong> SCHOLARAi is exclusively available for higher education institutions in Tamil Nadu. Selecting Tamil Nadu as state of residence indicates study/residency and does not treat state selection as legal statutory domicile proof without an official Tahsildar Nativity / Domicile Certificate in your Document Vault.
              </span>
            </div>
          </div>

          {/* =================================================================== */}
          {/* SECTION 2: ACADEMIC INFORMATION (NO CGPA ANYWHERE!) */}
          {/* =================================================================== */}
          <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold uppercase mr-2">
                Section 2
              </span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white inline">
                Academic Information
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                College name, course discipline, study year, admission quota, and prior schooling.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Institution Name *
                </label>
                <input
                  type="text"
                  required
                  value={profileForm.institution}
                  onChange={(e) => setProfileForm({ ...profileForm, institution: e.target.value })}
                  placeholder="e.g. Loyola College (Autonomous), Chennai"
                  className="w-full px-3.5 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Degree / Course Name *
                </label>
                <input
                  type="text"
                  required
                  value={profileForm.course}
                  onChange={(e) => setProfileForm({ ...profileForm, course: e.target.value })}
                  placeholder="e.g. B.Sc Computer Science / B.E. Mechanical"
                  className="w-full px-3.5 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Academic Stream *
                </label>
                <select
                  value={profileForm.stream}
                  onChange={(e) => setProfileForm({ ...profileForm, stream: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                >
                  <option value="Engineering & Technology">Engineering & Technology</option>
                  <option value="Arts & Science">Arts & Science</option>
                  <option value="Medical & Dental">Medical & Dental</option>
                  <option value="Paramedical">Paramedical</option>
                  <option value="Law">Law</option>
                  <option value="Agriculture & Allied">Agriculture & Allied</option>
                  <option value="Management & Commerce">Management & Commerce</option>
                  <option value="Education">Education</option>
                  <option value="Vocational & Diploma">Vocational & Diploma</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Degree Level *
                </label>
                <select
                  value={profileForm.education_level}
                  onChange={(e) => setProfileForm({ ...profileForm, education_level: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                >
                  <option value="Diploma">Diploma</option>
                  <option value="Undergraduate">Undergraduate</option>
                  <option value="Postgraduate">Postgraduate</option>
                  <option value="Doctoral / Ph.D">Doctoral / Ph.D</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Year of Study *
                </label>
                <select
                  value={profileForm.year}
                  onChange={(e) => setProfileForm({ ...profileForm, year: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                >
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                  <option value="5th Year">5th Year</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Admission Quota *
                </label>
                <select
                  value={profileForm.admission_quota}
                  onChange={(e) => setProfileForm({ ...profileForm, admission_quota: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                >
                  <option value="GOVERNMENT_QUOTA">Government Quota (DoTE / TNEA / Centralized Allotment)</option>
                  <option value="MANAGEMENT_QUOTA">Management Quota</option>
                  <option value="CONSORTIUM_OTHER">Consortium / Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Day Scholar / Hosteller *
                </label>
                <select
                  value={profileForm.hosteller_status}
                  onChange={(e) => setProfileForm({ ...profileForm, hosteller_status: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                >
                  <option value="DAY_SCHOLAR">Day Scholar</option>
                  <option value="HOSTELLER">Hosteller (Recognized College Hostel)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mode of Study *
                </label>
                <select
                  value={profileForm.mode_of_study}
                  onChange={(e) => setProfileForm({ ...profileForm, mode_of_study: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                >
                  <option value="Regular / Full-Time">Regular / Full-Time</option>
                  <option value="Lateral Entry">Lateral Entry</option>
                  <option value="Part-Time">Part-Time</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Board of Higher Secondary Education
                </label>
                <select
                  value={profileForm.board_of_education}
                  onChange={(e) => setProfileForm({ ...profileForm, board_of_education: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                >
                  <option value="Tamil Nadu State Board">Tamil Nadu State Board (HSE)</option>
                  <option value="CBSE">CBSE</option>
                  <option value="ICSE">ICSE</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  HSE % / Qualifying Entrance Score
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={profileForm.qualifying_marks}
                  onChange={(e) => setProfileForm({ ...profileForm, qualifying_marks: e.target.value })}
                  placeholder="e.g. 88.5"
                  className="w-full px-3.5 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Institution Classification
                </label>
                <select
                  value={profileForm.school_type}
                  onChange={(e) => setProfileForm({ ...profileForm, school_type: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                >
                  <option value="Tamil Nadu Government School (Classes 6-12)">Tamil Nadu Government School (Classes 6 to 12)</option>
                  <option value="Government-Aided School">Government-Aided School</option>
                  <option value="Private / Matriculation School">Private / Matriculation School</option>
                </select>
              </div>
            </div>

            {/* Checkbox Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <label className="flex items-start space-x-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 cursor-pointer">
                <input
                  type="checkbox"
                  checked={profileForm.studied_govt_school_6_to_12}
                  onChange={(e) => setProfileForm({ ...profileForm, studied_govt_school_6_to_12: e.target.checked })}
                  className="w-4 h-4 mt-0.5 text-red-600 rounded border-slate-300 focus:ring-red-500"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-900 dark:text-white block">
                    Studied Classes 6 to 12 in Tamil Nadu Government School
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Required for ₹1,000/mo Pudhumai Penn (Female) &amp; Tamil Pudhalvan (Male) schemes.
                  </span>
                </div>
              </label>

              <label className="flex items-start space-x-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 cursor-pointer">
                <input
                  type="checkbox"
                  checked={profileForm.is_first_graduate}
                  onChange={(e) => setProfileForm({ ...profileForm, is_first_graduate: e.target.checked })}
                  className="w-4 h-4 mt-0.5 text-red-600 rounded border-slate-300 focus:ring-red-500"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-900 dark:text-white block">
                    First Graduate in Family (FG Concession)
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    No siblings or parents hold a collegiate degree. Qualifies for TNEA tuition waiver.
                  </span>
                </div>
              </label>
            </div>

            <div className="p-3 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">CGPA-Free Guarantee:</span> SCHOLARAi evaluates eligibility based on qualifying entrance and board marks. CGPA is never required for profile creation or scholarship matching.
            </div>
          </div>

          {/* =================================================================== */}
          {/* SECTION 3: COMMUNITY INFORMATION (STATUTORY ONLY - NO CASTE NAMES) */}
          {/* =================================================================== */}
          <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold uppercase mr-2">
                Section 3
              </span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white inline">
                Community Information
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Statutory social categories recognized by Tamil Nadu and Central welfare schemes (BC, MBC/DNC, SC, SCA, ST, OC).
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Community Category *
                </label>
                <select
                  value={profileForm.category}
                  onChange={(e) => setProfileForm({ ...profileForm, category: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                >
                  <option value="BC">BC (Backward Class)</option>
                  <option value="MBC">MBC / DNC (Most Backward Class / De-notified Community)</option>
                  <option value="SC">SC (Scheduled Caste)</option>
                  <option value="SCA">SCA (Scheduled Caste - Arunthathiyar)</option>
                  <option value="ST">ST (Scheduled Tribe)</option>
                  <option value="OC">OC / General (Open Competition)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Minority Status
                </label>
                <select
                  value={profileForm.minority_status}
                  onChange={(e) => setProfileForm({ ...profileForm, minority_status: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                >
                  <option value="None">None</option>
                  <option value="Religious Minority (Muslim)">Religious Minority (Muslim)</option>
                  <option value="Religious Minority (Christian)">Religious Minority (Christian)</option>
                  <option value="Religious Minority (Jain)">Religious Minority (Jain)</option>
                  <option value="Religious Minority (Sikh / Buddhist / Parsi)">Religious Minority (Sikh / Buddhist / Parsi)</option>
                  <option value="Linguistic Minority">Linguistic Minority</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Special Reservation Category
                </label>
                <select
                  value={profileForm.special_category}
                  onChange={(e) => setProfileForm({ ...profileForm, special_category: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                >
                  <option value="None">None</option>
                  <option value="Children of Ex-Servicemen">Children of Ex-Servicemen</option>
                  <option value="Wards of Deceased Defense Personnel">Wards of Deceased Defense Personnel</option>
                  <option value="Differently Abled (PwD)">Differently Abled (PwD)</option>
                  <option value="Sports Person (State/National)">Sports Person (State/National)</option>
                </select>
              </div>
            </div>

            <div className="p-3 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">Statutory Data Minimization &amp; Privacy:</span> SCHOLARAi collects solely the minimum statutory community classification (BC, MBC/DNC, SC, SCA, ST, OC) required under government reservation rules. Caste and sub-caste names are never requested, stored, or exposed on cards, dossiers, or dashboards. Community data is strictly protected and evaluated solely for authorized eligibility matching.
            </div>
          </div>

          {/* =================================================================== */}
          {/* SECTION 4: SPORTS & SPECIAL ATHLETIC ELIGIBILITY */}
          {/* =================================================================== */}
          <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold uppercase mr-2">
                  Section 4
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white inline">
                  Sports &amp; Special Athletic Eligibility
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  SDAT / TNCF sports development scholarships and Tamil Nadu 500-seat engineering quota (TNEA).
                </p>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/40 self-start sm:self-auto">
                SDAT / TNEA Earmarked
              </span>
            </div>

            <label className="flex items-start space-x-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 cursor-pointer">
              <input
                type="checkbox"
                checked={profileForm.participates_in_sports}
                onChange={(e) => setProfileForm({ ...profileForm, participates_in_sports: e.target.checked })}
                className="w-4 h-4 mt-0.5 text-red-600 rounded border-slate-300 focus:ring-red-500"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-900 dark:text-white block">
                  Participates in Competitive Sports / Athletics
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Enable to evaluate eligibility for SDAT / Tamil Nadu Champions Foundation athletic grants and the Eminent Sports Persons reservation quota.
                </span>
              </div>
            </label>

            {profileForm.participates_in_sports && (
              <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Sport / Athletic Discipline *
                    </label>
                    <input
                      type="text"
                      value={profileForm.sport_discipline}
                      onChange={(e) => setProfileForm({ ...profileForm, sport_discipline: e.target.value })}
                      placeholder="e.g. Athletics, Cricket, Badminton, Football, Chess"
                      className="w-full px-3.5 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Highest Competition Level *
                    </label>
                    <select
                      value={profileForm.sports_competition_level}
                      onChange={(e) => setProfileForm({ ...profileForm, sports_competition_level: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                    >
                      <option value="School / Zonal">School / Zonal Level</option>
                      <option value="District / Divisional">District / Divisional Level</option>
                      <option value="State">State Championship / State Games</option>
                      <option value="National">National Championship / Khelo India</option>
                      <option value="International">International Championship / Games</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Achievement / Representation Type *
                    </label>
                    <select
                      value={profileForm.sports_achievement_type}
                      onChange={(e) => setProfileForm({ ...profileForm, sports_achievement_type: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                    >
                      <option value="Winner / Gold Medalist">Winner / Gold Medalist</option>
                      <option value="Runner-up / Silver Medalist">Runner-up / Silver Medalist</option>
                      <option value="Third Place / Bronze Medalist">Third Place / Bronze Medalist</option>
                      <option value="State/National Representation">Official State / National Representation</option>
                      <option value="Participation">Participation / Squad Member</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Official Sports Certificate Status *
                    </label>
                    <select
                      value={profileForm.sports_certificate_status}
                      onChange={(e) => setProfileForm({ ...profileForm, sports_certificate_status: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                    >
                      <option value="Have Verified Official Certificate">Have Verified Official Certificate (Form-II/III)</option>
                      <option value="Certificate Available / Pending Verification">Certificate Available / Pending Scrutiny</option>
                      <option value="Not Available">Not Available / In Progress</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Year of Highest Achievement
                    </label>
                    <input
                      type="text"
                      value={profileForm.sports_achievement_year}
                      onChange={(e) => setProfileForm({ ...profileForm, sports_achievement_year: e.target.value })}
                      placeholder="e.g. 2024"
                      className="w-full px-3.5 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                  <div className="text-xs">
                    <strong className="text-slate-900 dark:text-white block">Sports Credential Verification</strong>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Upload your official Form-II/III or State/National federation certificate in your Document Vault for SDAT scholarship and TNEA quota processing.
                    </span>
                  </div>
                  <a
                    href="/documents"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white text-xs font-semibold whitespace-nowrap inline-flex items-center gap-1.5 self-start sm:self-auto"
                  >
                    <span>Manage Sports Certificates</span>
                    <span>&rarr;</span>
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* =================================================================== */}
          {/* SECTION 5: DISABILITY & ACCESSIBILITY (CONFIDENTIAL & CONSENT-BASED) */}
          {/* =================================================================== */}
          <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold uppercase mr-2">
                  Section 5
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white inline">
                  Disability &amp; Accessibility Accommodations
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Confidential evaluation for AICTE Saksham (₹50,000/yr), DEPwD Post-Matric, and Tamil Nadu Differently Abled Welfare assistance.
                </p>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40 self-start sm:self-auto">
                🔒 Privacy Protected
              </span>
            </div>

            <label className="flex items-start space-x-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 cursor-pointer">
              <input
                type="checkbox"
                checked={profileForm.has_disability}
                onChange={(e) => setProfileForm({
                  ...profileForm,
                  has_disability: e.target.checked,
                  disability_consent_given: e.target.checked,
                })}
                className="w-4 h-4 mt-0.5 text-red-600 rounded border-slate-300 focus:ring-red-500"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-900 dark:text-white block">
                  Consider for Schemes &amp; Accommodations for Differently Abled Students (RPwD Act 2016)
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Voluntary consent. If enabled, SCHOLARAi evaluates eligibility for benchmark disability scholarships and fee concessions.
                </span>
              </div>
            </label>

            {profileForm.has_disability && (
              <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Disability Category *
                    </label>
                    <select
                      value={profileForm.disability_category}
                      onChange={(e) => setProfileForm({ ...profileForm, disability_category: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                    >
                      <option value="Locomotor Disability">Locomotor Disability</option>
                      <option value="Visual Impairment (Blind / Low Vision)">Visual Impairment (Blind / Low Vision)</option>
                      <option value="Hearing Impairment (Deaf / Hard of Hearing)">Hearing Impairment (Deaf / Hard of Hearing)</option>
                      <option value="Speech and Language Disability">Speech and Language Disability</option>
                      <option value="Intellectual / Learning Disability">Intellectual / Learning Disability</option>
                      <option value="Multiple Disabilities">Multiple Disabilities</option>
                      <option value="Other Benchmark Disability">Other Benchmark Disability</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Disability Percentage (%) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={profileForm.disability_percentage}
                      onChange={(e) => setProfileForm({ ...profileForm, disability_percentage: e.target.value })}
                      placeholder="e.g. 40"
                      className="w-full px-3.5 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                    />
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                      Statutory benchmark under RPwD Act 2016 is &gt;= 40% certified disability.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      UDID Card Status *
                    </label>
                    <select
                      value={profileForm.udid_card_status}
                      onChange={(e) => setProfileForm({ ...profileForm, udid_card_status: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                    >
                      <option value="UDID Card Available">UDID Card Available (Swavlamban Card)</option>
                      <option value="State Disability Certificate Available">State Medical Board Certificate Available</option>
                      <option value="Applied for UDID / In Progress">Applied for UDID / In Progress</option>
                      <option value="Not Available">Not Available</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Accessibility Accommodations Needed
                    </label>
                    <select
                      value={profileForm.accessibility_needs}
                      onChange={(e) => setProfileForm({ ...profileForm, accessibility_needs: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                    >
                      <option value="None / Independent">None / Independent</option>
                      <option value="Screen Reader Support">Screen Reader Support</option>
                      <option value="Accessible Exam Scribe">Accessible Exam Scribe / Extra Time</option>
                      <option value="High Contrast / Large Text">High Contrast / Large Text</option>
                      <option value="Assistive Software / Audio">Assistive Software / Audio</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                  <div className="text-xs">
                    <strong className="text-slate-900 dark:text-white block">UDID Card / Medical Certificate Vault</strong>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Disability schemes require proof via unique UDID card or District Medical Board certificate.
                    </span>
                  </div>
                  <a
                    href="/documents"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white text-xs font-semibold whitespace-nowrap inline-flex items-center gap-1.5 self-start sm:self-auto"
                  >
                    <span>Upload UDID Card</span>
                    <span>&rarr;</span>
                  </a>
                </div>

                <div className="p-3 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">Confidentiality &amp; Non-Discrimination:</span> In strict compliance with the Rights of Persons with Disabilities (RPwD) Act 2016, disability attributes are voluntary, confidential, and used exclusively for statutory welfare scheme matching.
                </div>
              </div>
            )}
          </div>

          {/* =================================================================== */}
          {/* SECTION 6: FINANCIAL INFORMATION */}
          {/* =================================================================== */}
          <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold uppercase mr-2">
                Section 6
              </span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white inline">
                Financial Information
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Parental gross annual income, certificate verification status, and funding gap calculation.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Annual Family Income (₹) *
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={profileForm.annual_family_income}
                  onChange={(e) => setProfileForm({ ...profileForm, annual_family_income: parseFloat(e.target.value) || 0 })}
                  placeholder="e.g. 210000"
                  className="w-full px-3.5 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Income Certificate Status *
                </label>
                <select
                  value={profileForm.income_certificate_status}
                  onChange={(e) => setProfileForm({ ...profileForm, income_certificate_status: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                >
                  <option value="Have Valid E-Sevai Certificate">Have Valid E-Sevai Certificate</option>
                  <option value="Applied / In Progress">Applied / In Progress</option>
                  <option value="Renewal Required">Renewal Required</option>
                  <option value="Not Available">Not Available</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Student Funding Gap (₹) (Editable) *
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={profileForm.funding_gap}
                  onChange={(e) => {
                    const gap = parseFloat(e.target.value) || 0;
                    setProfileForm({
                      ...profileForm,
                      funding_gap: gap,
                      annual_education_cost: (profileForm.existing_support || 0) + gap,
                    });
                  }}
                  className="w-full px-3.5 py-2 bg-red-50/50 dark:bg-red-950/30 border border-red-300 dark:border-red-900/60 rounded-lg text-sm font-bold text-red-600 dark:text-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Annual Education Cost (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={profileForm.annual_education_cost}
                  onChange={(e) => {
                    const cost = parseFloat(e.target.value) || 0;
                    const support = profileForm.existing_support || 0;
                    setProfileForm({
                      ...profileForm,
                      annual_education_cost: cost,
                      funding_gap: Math.max(0, cost - support),
                    });
                  }}
                  className="w-full px-3.5 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Existing Secured Support (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={profileForm.existing_support}
                  onChange={(e) => {
                    const support = parseFloat(e.target.value) || 0;
                    const cost = profileForm.annual_education_cost || 0;
                    setProfileForm({
                      ...profileForm,
                      existing_support: support,
                      funding_gap: Math.max(0, cost - support),
                    });
                  }}
                  className="w-full px-3.5 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Income Bracket Ceiling
                </label>
                <select
                  value={profileForm.income_range}
                  onChange={(e) => setProfileForm({ ...profileForm, income_range: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                >
                  <option value="Below ₹2.5 Lakhs">Below ₹2,50,000 (Full TN Waiver Bracket)</option>
                  <option value="₹2.5L - ₹4.5L">₹2,50,001 - ₹4,50,000 (Central CSSS Bracket)</option>
                  <option value="₹4.5L - ₹8.0L">₹4,50,001 - ₹8,00,000 (AICTE Pragati Bracket)</option>
                  <option value="Above ₹8.0L">Above ₹8,00,000 (Non-Income Based Only)</option>
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Financial Notes or Explanation
                </label>
                <textarea
                  rows={2}
                  value={profileForm.financial_circumstances_notes}
                  onChange={(e) => setProfileForm({ ...profileForm, financial_circumstances_notes: e.target.value })}
                  placeholder="Optional details regarding parental occupation, agricultural dependency, or single parent status"
                  className="w-full px-3.5 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
              </div>
            </div>

            {/* Gap Preview */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Dynamic Gap Calculation &amp; Coverage Preview
                </span>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  Cost ({formatINR(profileForm.annual_education_cost)}) &minus; Support ({formatINR(profileForm.existing_support)}) = Remaining Gap <strong className="text-slate-900 dark:text-white font-mono">{formatINR(profileForm.funding_gap || calculatedGap)}</strong>
                </p>
              </div>
              <span className="text-xl font-bold font-mono text-red-600 dark:text-red-400">
                {formatINR(profileForm.funding_gap || calculatedGap)}
              </span>
            </div>
          </div>

          {/* =================================================================== */}
          {/* SECTION 7: IDENTITY & BENEFITS */}
          {/* =================================================================== */}
          <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold uppercase mr-2">
                Section 7
              </span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white inline">
                Identity &amp; Benefits
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Masked Aadhaar reference, Direct Benefit Transfer (DBT) bank seeding, and ration smart card details.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Masked Aadhaar Number (Format: XXXX-XXXX-1234)
                </label>
                <input
                  type="text"
                  maxLength={14}
                  value={profileForm.aadhaar_masked}
                  onChange={(e) => setProfileForm({ ...profileForm, aadhaar_masked: e.target.value })}
                  placeholder="XXXX-XXXX-1234"
                  className="w-full px-3.5 py-2 font-mono bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                  Optional masked reference. Never enter raw Aadhaar credentials.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Bank Account Seeded with Aadhaar for DBT?
                </label>
                <select
                  value={profileForm.dbt_seeding_status}
                  onChange={(e) => setProfileForm({
                    ...profileForm,
                    dbt_seeding_status: e.target.value,
                    dbt_enabled: e.target.value === "Yes",
                  })}
                  className="w-full px-3 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                >
                  <option value="Yes">Yes (Seeded &amp; Active for DBT)</option>
                  <option value="No">No</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Don't Know">Don&apos;t Know</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Ration Card / Smart Card Type
                </label>
                <select
                  value={profileForm.ration_card_type}
                  onChange={(e) => setProfileForm({ ...profileForm, ration_card_type: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                >
                  <option value="Priority (PHH)">Priority (PHH)</option>
                  <option value="Antyodaya (AAY)">Antyodaya (AAY)</option>
                  <option value="Non-Priority (NPHH)">Non-Priority (NPHH)</option>
                  <option value="Not Available / Don't Know">Not Available / Don&apos;t Know</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Bank Account Holder Name
                </label>
                <input
                  type="text"
                  value={profileForm.account_holder_name}
                  onChange={(e) => setProfileForm({ ...profileForm, account_holder_name: e.target.value })}
                  placeholder="Must match student certificate name"
                  className="w-full px-3.5 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Bank Name
                </label>
                <input
                  type="text"
                  value={profileForm.bank_name}
                  onChange={(e) => setProfileForm({ ...profileForm, bank_name: e.target.value })}
                  placeholder="e.g. State Bank of India, Canara Bank"
                  className="w-full px-3.5 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Bank Branch Location
                </label>
                <input
                  type="text"
                  value={profileForm.bank_branch}
                  onChange={(e) => setProfileForm({ ...profileForm, bank_branch: e.target.value })}
                  placeholder="e.g. Nungambakkam, Chennai"
                  className="w-full px-3.5 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-start space-x-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 cursor-pointer">
                <input
                  type="checkbox"
                  checked={profileForm.aadhaar_consent_given}
                  onChange={(e) => setProfileForm({ ...profileForm, aadhaar_consent_given: e.target.checked })}
                  className="w-4 h-4 mt-0.5 text-red-600 rounded border-slate-300 focus:ring-red-500"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-900 dark:text-white block">
                    Student Consent for Identity &amp; Statutory Scheme Matching
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    I authorize SCHOLARAi to utilize my declared profile attributes and masked references strictly for deterministic scholarship eligibility matching.
                  </span>
                </div>
              </label>
            </div>

            <div className="p-3 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">Regulatory Transparency:</span> SCHOLARAi does not request or store raw Aadhaar OTPs or biometric data. Official verification for DBT disbursements takes place on authorized government portals (NSP, SSP, UMIS).
            </div>
          </div>

          {/* Unified Save Profile Bar */}
          <div className="p-4 bg-white dark:bg-[#111827] rounded-xl border border-slate-200/90 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block">
                Ready to persist your updated profile?
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                All sections are saved together without overwriting other details. Recommendations update immediately.
              </span>
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="py-2.5 px-6 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-red-950/30 disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center space-x-2"
            >
              {savingProfile ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Saving Profile...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Save Student Profile</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* =================================================================== */}
      {/* TAB: APPEARANCE */}
      {/* =================================================================== */}
      {activeTab === "appearance" && (
        <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Interface Theme</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Select your preferred appearance mode. Your choice is persisted across browser reloads.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Light Theme Card */}
            <div
              onClick={() => setTheme("light")}
              className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                theme === "light"
                  ? "border-red-600 dark:border-red-500 bg-red-50 dark:bg-red-950/30 shadow-xs"
                  : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <span>Light Mode</span>
                </span>
                <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                  theme === "light" ? "border-red-600 bg-red-600" : "border-slate-300 dark:border-slate-600"
                }`}>
                  {theme === "light" && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
                </span>
              </div>
              <div className="h-16 rounded-lg bg-white border border-slate-200 p-2 space-y-1.5 shadow-xs">
                <div className="h-2 w-12 bg-slate-200 rounded"></div>
                <div className="h-2 w-full bg-slate-100 rounded"></div>
                <div className="h-2 w-20 bg-red-600 rounded"></div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2.5">
                Refined scholastic parchment with crisp contrast.
              </p>
            </div>

            {/* Dark Theme Card */}
            <div
              onClick={() => setTheme("dark")}
              className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                theme === "dark"
                  ? "border-red-600 dark:border-red-500 bg-red-50 dark:bg-red-950/30 shadow-xs"
                  : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                  <span>Dark Mode</span>
                </span>
                <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                  theme === "dark" ? "border-red-500 bg-red-500" : "border-slate-300 dark:border-slate-600"
                }`}>
                  {theme === "dark" && <span className="w-1.5 h-1.5 rounded-full bg-slate-900"></span>}
                </span>
              </div>
              <div className="h-16 rounded-lg bg-[#090D16] border border-slate-800 p-2 space-y-1.5 shadow-xs">
                <div className="h-2 w-12 bg-slate-700 rounded"></div>
                <div className="h-2 w-full bg-slate-800 rounded"></div>
                <div className="h-2 w-20 bg-red-500 rounded"></div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2.5">
                Deep obsidian slate engineered for night studying.
              </p>
            </div>

            {/* System Theme Card */}
            <div
              onClick={() => setTheme("system")}
              className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                theme === "system"
                  ? "border-red-600 dark:border-red-500 bg-red-50 dark:bg-red-950/30 shadow-xs"
                  : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span>System Synced</span>
                </span>
                <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                  theme === "system" ? "border-red-600 dark:border-red-500 bg-red-600 dark:bg-red-500" : "border-slate-300 dark:border-slate-600"
                }`}>
                  {theme === "system" && <span className="w-1.5 h-1.5 rounded-full bg-white dark:bg-slate-900"></span>}
                </span>
              </div>
              <div className="h-16 rounded-lg bg-gradient-to-r from-white to-[#090D16] border border-slate-300 dark:border-slate-700 p-2 space-y-1.5 shadow-xs">
                <div className="h-2 w-12 bg-slate-400 rounded"></div>
                <div className="h-2 w-full bg-slate-400/50 rounded"></div>
                <div className="h-2 w-20 bg-red-50 dark:bg-red-950/300 rounded"></div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2.5">
                Automatically synchronizes with your device settings (currently {resolvedTheme}).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB: FUNDING PREFERENCES */}
      {/* =================================================================== */}
      {activeTab === "funding" && (
        <form onSubmit={handleFundingSubmit} className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Funding Planning &amp; Gap Calculation</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Calculates your annual funding shortfall and benchmarks scholarship coverage
              </p>
            </div>
            {fundingSuccess && (
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                {fundingSuccess}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Annual Education Cost (₹)
              </label>
              <input
                type="number"
                min="0"
                value={profileForm.annual_education_cost}
                onChange={(e) => {
                  const cost = parseFloat(e.target.value) || 0;
                  const support = profileForm.existing_support || 0;
                  setProfileForm({
                    ...profileForm,
                    annual_education_cost: cost,
                    funding_gap: Math.max(0, cost - support),
                  });
                }}
                className="w-full px-3.5 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Existing Secured Support (₹)
              </label>
              <input
                type="number"
                min="0"
                value={profileForm.existing_support}
                onChange={(e) => {
                  const support = parseFloat(e.target.value) || 0;
                  const cost = profileForm.annual_education_cost || 0;
                  setProfileForm({
                    ...profileForm,
                    existing_support: support,
                    funding_gap: Math.max(0, cost - support),
                  });
                }}
                className="w-full px-3.5 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Annual Family Income (₹)
              </label>
              <input
                type="number"
                min="0"
                value={profileForm.annual_family_income}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, annual_family_income: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3.5 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Net Funding Gap (₹) (Editable)
              </label>
              <input
                type="number"
                min="0"
                value={profileForm.funding_gap}
                onChange={(e) => {
                  const gap = parseFloat(e.target.value) || 0;
                  setProfileForm({
                    ...profileForm,
                    funding_gap: gap,
                    annual_education_cost: (profileForm.existing_support || 0) + gap,
                  });
                }}
                className="w-full px-3.5 py-2 bg-red-50/50 dark:bg-red-950/30 border border-red-300 dark:border-red-900/60 rounded-lg text-sm font-bold text-red-600 dark:text-red-400"
              />
            </div>
          </div>

          {/* Dynamic Gap Preview */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Synchronized Gap Preview
              </span>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                Funding gap = Total Cost ({formatINR(profileForm.annual_education_cost)}) &minus; Support ({formatINR(profileForm.existing_support)})
              </p>
            </div>
            <span className="text-xl font-bold font-mono text-red-600 dark:text-red-400">
              {formatINR(profileForm.funding_gap || calculatedGap)}
            </span>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <button
              type="submit"
              disabled={savingFunding}
              className="py-2 px-5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
            >
              {savingFunding ? "Saving..." : "Save Financial Parameters"}
            </button>
          </div>
        </form>
      )}

      {/* =================================================================== */}
      {/* TAB: NOTIFICATIONS */}
      {/* =================================================================== */}
      {activeTab === "notifications" && (
        <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Alert Preferences</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              How SCHOLARAi alerts you regarding application deadlines and document readiness
            </p>
          </div>

          <div className="space-y-3">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-900 dark:text-white">In-App Intelligence Alerts</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Real-time alerts for approaching scholarship deadlines (&lt;7 days) and shared document blockers.
                </p>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                ACTIVE
              </span>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4 opacity-75">
              <div>
                <p className="text-xs font-semibold text-slate-900 dark:text-white">Email Notification Dispatch</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Weekly application digest and urgent deadline warnings delivered to your inbox.
                </p>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                SCHEDULED (PHASE 2)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB: ACCOUNT & SECURITY */}
      {/* =================================================================== */}
      {activeTab === "account" && (
        <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Account Details</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Manage your authenticated session and security preferences
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Primary Account Email
              </span>
              <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm mt-1 block">
                {displayEmail || user?.email || "Authenticated User"}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Account Status
              </span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 text-sm mt-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Active &amp; Verified
              </span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-900 dark:text-white">Sign Out</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">End your current session on this device</p>
            </div>
            <button
              onClick={logout}
              className="py-2 px-4 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-500 dark:text-slate-400">Loading settings...</p>
      </div>
    }>
      <SettingsPageInner />
    </Suspense>
  );
}
