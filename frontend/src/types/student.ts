export interface StudentProfile {
  id: number;
  student_id: number;
  institution?: string;
  course?: string;
  year?: string;
  cgpa?: number | null;
  twelfth_percentage?: number | null;
  category: string;
  state: string;
  gender?: string;
  dob?: string | null;
  district?: string | null;
  native_state?: string | null;
  education_level?: string | null;
  stream?: string | null;
  university?: string | null;
  admission_year?: string | null;
  current_semester?: string | null;
  qualifying_exam?: string | null;
  qualifying_marks?: number | null;
  institution_type?: string | null;
  admission_quota?: "GOVERNMENT_QUOTA" | "MANAGEMENT_QUOTA" | string | null;
  hosteller_status?: "DAY_SCHOLAR" | "HOSTELLER" | string | null;
  mode_of_study?: string | null;
  studied_govt_school_6_to_12?: boolean | null;
  board_of_education?: string | null;
  is_first_graduate?: boolean | null;
  school_type?: string | null;
  school_study_history?: string | null;
  community_subcategory?: string | null;
  minority_status?: string | null;
  special_category?: string | null;
  domicile_status?: string | null;

  // Sports & Athletic Achievements
  participates_in_sports?: boolean | null;
  sport_discipline?: string | null;
  sports_competition_level?: string | null;
  sports_achievement_type?: string | null;
  sports_certificate_status?: string | null;
  sports_achievement_year?: string | null;

  // Disability & Accessibility Accommodations (Confidential & Consent-Based)
  has_disability?: boolean | null;
  disability_consent_given?: boolean | null;
  disability_category?: string | null;
  disability_percentage?: number | null;
  udid_card_status?: string | null;
  accessibility_needs?: string | null;

  bank_readiness?: string | null;
  account_holder_name?: string | null;
  dbt_enabled?: boolean | null;
  dbt_seeding_status?: string | null;
  ration_card_type?: string | null;
  bank_name?: string | null;
  bank_branch?: string | null;
  aadhaar_verification_status?: string | null;
  aadhaar_masked?: string | null;
  aadhaar_consent_given?: boolean | null;
}

export interface FundingProfile {
  id: number;
  student_id: number;
  annual_education_cost: number;
  existing_support: number;
  annual_family_income: number;
  funding_gap: number;
  funding_progress_percentage: number;
  income_range?: string | null;
  income_certificate_status?: string | null;
  financial_circumstances_notes?: string | null;
}

export interface StudentDetail {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  profile: StudentProfile;
  funding_profile: FundingProfile;
}

export interface FundingOverview {
  annual_education_cost: number;
  existing_support: number;
  funding_gap: number;
  funding_progress_percentage: number;
  annual_family_income: number;
}

export interface StudentUpdatePayload {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  dob?: string | null;
  district?: string | null;
  native_state?: string | null;
  gender?: string | null;
  state?: string | null;

  institution?: string | null;
  course?: string | null;
  year?: string | null;
  education_level?: string | null;
  stream?: string | null;
  university?: string | null;
  admission_year?: string | null;
  current_semester?: string | null;
  qualifying_exam?: string | null;
  qualifying_marks?: number | null;
  institution_type?: string | null;
  admission_quota?: "GOVERNMENT_QUOTA" | "MANAGEMENT_QUOTA" | string | null;
  hosteller_status?: "DAY_SCHOLAR" | "HOSTELLER" | string | null;
  mode_of_study?: string | null;
  studied_govt_school_6_to_12?: boolean | null;
  board_of_education?: string | null;
  is_first_graduate?: boolean | null;
  school_type?: string | null;
  school_study_history?: string | null;

  cgpa?: number | null;
  twelfth_percentage?: number | null;

  category?: string | null;
  community_subcategory?: string | null;
  minority_status?: string | null;
  special_category?: string | null;
  domicile_status?: string | null;

  // Sports & Special Athletic Eligibility
  participates_in_sports?: boolean | null;
  sport_discipline?: string | null;
  sports_competition_level?: string | null;
  sports_achievement_type?: string | null;
  sports_certificate_status?: string | null;
  sports_achievement_year?: string | null;

  // Disability & Accessibility Accommodations (Confidential & Consent-Based)
  has_disability?: boolean | null;
  disability_consent_given?: boolean | null;
  disability_category?: string | null;
  disability_percentage?: number | null;
  udid_card_status?: string | null;
  accessibility_needs?: string | null;

  annual_education_cost?: number | null;
  existing_support?: number | null;
  annual_family_income?: number | null;
  funding_gap?: number | null;
  income_range?: string | null;
  financial_circumstances_notes?: string | null;
  income_certificate_status?: string | null;

  bank_readiness?: string | null;
  account_holder_name?: string | null;
  dbt_enabled?: boolean | null;
  dbt_seeding_status?: string | null;
  ration_card_type?: string | null;
  bank_name?: string | null;
  bank_branch?: string | null;

  aadhaar_verification_status?: string | null;
  aadhaar_masked?: string | null;
  aadhaar_consent_given?: boolean | null;
}

export interface ProfileCompletionSectionItem {
  status: "COMPLETE" | "INCOMPLETE" | "NEEDS_UPDATING" | "VERIFICATION_REQUIRED";
  percentage: number;
  missing_fields: string[];
  summary: string;
}

export interface ProfileCompletionData {
  overall_percentage: number;
  overall_status: string;
  sections: {
    personal: ProfileCompletionSectionItem;
    academic: ProfileCompletionSectionItem;
    community: ProfileCompletionSectionItem;
    financial: ProfileCompletionSectionItem;
    bank_benefit: ProfileCompletionSectionItem;
    identity: ProfileCompletionSectionItem;
  };
}

export interface ScholarshipRecommendationItem {
  id: number;
  name: string;
  provider: string;
  amount: number;
  currency: string;
  benefit_type?: "SCHOLARSHIP" | "ADMISSION_BENEFIT" | "FEE_CONCESSION" | "FINANCIAL_ASSISTANCE" | string;
  award_display?: string | null;
  eligibility_summary?: string | null;
  recommendation_category: "LIKELY_ELIGIBLE" | "POTENTIALLY_ELIGIBLE" | "CURRENTLY_INELIGIBLE" | "WINDOW_NEEDS_VERIFICATION";
  match_score: number;
  why_matched: string[];
  satisfied_requirements: string[];
  missing_information: string[];
  requirements_needing_verification: string[];
  required_documents?: string[];
  requirements?: ScholarshipRequirement[];
  dossier_index?: string | null;
  stream?: string | null;
  study_level?: string | null;
  category_tag?: string | null;
  institution_types?: string | null;
  autonomous_compatibility?: string | null;
  tn_residency_required?: boolean | string | null;
  community_category?: string | null;
  income_ceiling?: number | null;
  income_criteria_raw?: string | null;
  award_type?: string | null;
  official_portal_name?: string | null;
  unresolved_questions?: string | null;
  deadline: string;
  academic_year?: string | null;
  official_source_url?: string | null;
  official_application_portal_url?: string | null;
  last_verified_at?: string | null;
  days_remaining?: number | null;
  disclaimer: string;
}

export interface PersonalizedRecommendationsData {
  student_name: string;
  student_profile_summary: Record<string, unknown>;
  total_recommendations: number;
  likely_eligible: ScholarshipRecommendationItem[];
  potentially_eligible: ScholarshipRecommendationItem[];
  currently_ineligible: ScholarshipRecommendationItem[];
  window_needs_verification: ScholarshipRecommendationItem[];
  disclaimer: string;
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  phase: string;
  environment: string;
  database: string;
  trust_principle?: string;
}

// Block 2: Scholarships
export interface EligibilityRule {
  id: number;
  rule_type: string;
  criteria_value: string;
  operator: string;
  description: string;
  is_mandatory: boolean;
}

export interface ScholarshipRequirement {
  id: number;
  name: string;
  document_type: string;
  type: string;
  is_required: boolean;
  description?: string;
}

export interface ScholarshipListItem {
  id: number;
  name: string;
  provider: string;
  description: string;
  amount: number;
  currency: string;
  deadline: string;
  verification_status: string;
  eligibility_summary?: string;
  application_effort?: string;
  status: string;
  match_status?: "eligible" | "possibly_eligible" | "ineligible" | "needs_verification";
  recommendation_category?: string;
  match_score?: number;
  fit_reasons?: string[];
  days_remaining?: number;
  deadline_risk?: string;
  application_status?: string;
  application_id?: number;
  benefit_type?: string;
  // Tamil Nadu Editorial Intelligence Fields
  dossier_index?: string;
  stream?: "ARTS_SCIENCE" | "ENGINEERING" | "BOTH";
  study_level?: "UG" | "PG" | "BOTH";
  category_tag?: string;
  institution_types?: string;
  autonomous_compatibility?: string;
  tn_residency_required?: boolean;
  community_category?: string;
  income_ceiling?: number | null;
  income_criteria_raw?: string | null;
  award_type?: string;
  award_display?: string;
  official_portal_name?: string;
  official_guideline_url?: string;
  academic_year?: string;
  source_verification_status?: string;
  application_window_status?: string;
  unresolved_questions?: string;
  disqualification_reasons?: string[];
}

export interface FundingImpact {
  current_funding_gap: number;
  scholarship_amount: number;
  potential_remaining_gap: number;
  gap_coverage_percentage: number;
  disclaimer: string;
}

export interface EligibilityResult {
  status: "eligible" | "possibly_eligible" | "ineligible" | "needs_verification";
  score: number;
  reasons: string[];
  matched_rules: string[];
  unmatched_rules: string[];
  verification_notes: string[];
  disclaimer: string;
}

export interface OfficialDossierChunk {
  id: number;
  document_id: number;
  document_title: string;
  section: string;
  chunk_text: string;
  source_name: string;
  source_url: string;
  source_type: string;
  authority_level: string;
  verification_status: string;
  last_verified_at?: string | null;
  retrieved_at?: string | null;
  content_hash?: string | null;
  page_number?: number | null;
}

export interface OfficialDossier {
  has_official_evidence: boolean;
  source_name?: string | null;
  source_url?: string | null;
  official_portal_name?: string | null;
  official_guideline_url?: string | null;
  authority_level?: string | null;
  verification_status: string;
  source_verification_status?: string | null;
  last_verified_at?: string | null;
  dossier_index?: string | null;
  chunks_count: number;
  chunks: OfficialDossierChunk[];
  unresolved_questions?: string | null;
  autonomous_compatibility?: string | null;
}

export interface ScholarshipDetail extends Omit<ScholarshipListItem, "deadline_risk"> {
  application_url?: string;
  source_url?: string;
  source_name?: string;
  last_verified_at?: string;
  eligibility_rules: EligibilityRule[];
  requirements: ScholarshipRequirement[];
  eligibility?: EligibilityResult;
  funding_impact?: FundingImpact;
  deadline_risk?: {
    risk_level: string;
    days_remaining: number;
    hours_remaining: number;
    message: string;
    badge_variant: string;
  };
  current_application?: {
    id: number;
    status: string;
    progress: number;
    started_at: string;
  };
  official_dossier?: OfficialDossier | null;
}

// Block 2: Applications & Requirements
export interface ApplicationRequirementItem {
  id: number;
  application_id: number;
  name: string;
  document_type: string;
  type: string;
  is_required: boolean;
  status: "MISSING" | "UPLOADED" | "PROCESSING" | "AVAILABLE" | "VERIFIED" | "NOT_REQUIRED" | "NEEDS_VERIFICATION" | "REJECTED";
  document_id?: number | null;
  verification_status?: string | null;
  document_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApplicationItem {
  id: number;
  student_id: number;
  scholarship_id: number;
  status: string;
  status_reason?: string | null;
  status_history?: Array<{
    previous_status?: string;
    new_status?: string;
    event_type?: string;
    timestamp: string;
    actor: string;
    reason: string;
  }> | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  required_documents_total?: number;
  required_documents_completed?: number;
  is_ready_for_submission?: boolean;
  preparation_status?: string;
  submission_status?: string;
  submission_mode?: string;
  external_application_id?: string | null;
  external_submission_at?: string | null;
  external_receipt_document_id?: number | null;
  student_consented_at?: string | null;
  official_portal_url?: string | null;
  official_portal_name?: string | null;
  progress: number;
  personal_statement?: string | null;
  started_at: string;
  submitted_at?: string | null;
  created_at: string;
  updated_at: string;
  scholarship_name: string;
  scholarship_provider: string;
  scholarship_amount: number;
  scholarship_deadline: string;
  verification_status: string;
  deadline_risk: {
    risk_level: string;
    days_remaining: number;
    hours_remaining: number;
    message: string;
    badge_variant: string;
  };
  missing_requirements_count: number;
  requirements: ApplicationRequirementItem[];
  blockers: string[];
  next_action?: string | null;
}

export interface PortfolioSummary {
  active_applications_count: number;
  at_risk_count: number;
  blocked_count: number;
  potential_funding_under_pursuit: number;
  primary_shared_blocker?: {
    document_type: string;
    document_name: string;
    document_status: string;
    document_id?: number;
    blocked_applications_count: number;
    potential_funding_affected: number;
    affected_applications: Array<{
      application_id: number;
      scholarship_name: string;
      scholarship_amount: number;
    }>;
  };
  top_next_best_action?: ActionItem;
  upcoming_deadlines: Array<{
    application_id: number;
    scholarship_name: string;
    deadline: string;
    days_remaining: number;
    risk_level: string;
    progress: number;
    amount: number;
  }>;
}

// Block 2: Documents
export interface VerificationCheckItem {
  check_name: string;
  passed: boolean;
  outcome: "PASSED" | "WARNING" | "FAILED";
  reason: string;
  verification_method: string;
  timestamp: string;
}

export interface DocumentItem {
  id: number;
  student_id: number;
  name: string;
  document_type: string;
  status: "MISSING" | "AVAILABLE" | "VERIFIED" | "NEEDS_VERIFICATION" | "EXPIRED";
  uploaded_at?: string | null;
  verified_at?: string | null;
  expiry_date?: string | null;
  notes?: string | null;

  // Real storage & security fields
  storage_backend?: string;
  storage_key?: string | null;
  file_size?: number | null;
  mime_type?: string | null;
  content_hash?: string | null;
  original_filename?: string | null;

  // Extraction and transparent verification
  extraction_status?: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "NEEDS_MANUAL_PROCESSING";
  verification_status?: "UPLOADED" | "PROCESSING" | "AUTOMATED_CHECKS_PASSED" | "NEEDS_HUMAN_REVIEW" | "REJECTED" | "UNABLE_TO_VERIFY" | "OFFICIALLY_VERIFIED";
  extracted_data?: {
    extraction_status?: string;
    raw_text_length?: number;
    page_count?: number;
    extracted_fields?: Record<string, unknown>;
    extraction_notes?: string[];
  } | null;
  verification_results?: VerificationCheckItem[] | null;
  failure_reasons?: string[] | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  audit_history?: Array<{
    action: string;
    actor?: string;
    timestamp: string;
    reason?: string;
    [key: string]: unknown;
  }> | null;

  created_at: string;
  updated_at: string;
  affected_applications_count: number;
  potential_funding_affected: number;
  is_shared_blocker: boolean;
}

// Block 2: Actions
export interface ActionItem {
  id?: number;
  title: string;
  reason: string;
  urgency: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  deadline?: string | null;
  effort_estimate: string;
  potential_funding_impact: number;
  blocker_impact?: string | null;
  action_type: string;
  target_type?: string;
  target_id?: number;
  is_completed?: boolean;
}

// Block 2: Planner
export interface PlannerOverview {
  funding_overview: {
    annual_education_cost: number;
    existing_support: number;
    funding_gap: number;
    target_funding: number;
    potential_funding_identified: number;
    potential_remaining_gap: number;
    funding_progress: number;
  };
  goal_preferences: {
    purpose: string;
    timeline: string;
    available_hours_per_week: number;
    priorities: string;
  };
  suggested_weekly_plan: {
    total_hours: number;
    allocations: Array<{
      task: string;
      allocated_hours: number;
      reason: string;
      category: string;
    }>;
    methodology_disclaimer: string;
  };
  funding_strategy: {
    active_applications_count: number;
    potential_combined_coverage: number;
    distinctions: Array<{
      concept: string;
      meaning: string;
    }>;
    concurrent_award_rule: string;
  };
}

// ==========================================
// Block 3: Advanced Intelligence Interfaces
// ==========================================

export interface User {
  id: number;
  email: string;
  role?: "STUDENT" | "REVIEWER" | "ADMIN";
  is_active: boolean;
  is_demo: boolean;
  student_id: number;
  student_name: string;
}

export interface AuthResponse {
  message: string;
  user: User;
  session_token: string;
}

export interface EvidenceItem {
  id: number;
  student_id: number;
  title: string;
  category: "ACADEMIC" | "PROJECT" | "INTERNSHIP" | "WORK_EXPERIENCE" | "AWARD" | "CERTIFICATION" | "LEADERSHIP" | "VOLUNTEERING" | "EXTRACURRICULAR" | "FINANCIAL" | "CAREER_GOAL" | "PERSONAL" | "OTHER";
  description: string;
  date?: string | null;
  organization?: string | null;
  evidence_text?: string | null;
  source_document_id?: number | null;
  source_type: string;
  source_name: string;
  verification_status: "USER_PROVIDED" | "VERIFIED" | "NEEDS_VERIFICATION" | "REJECTED";
  confidence: "HIGH_EVIDENCE_SUPPORT" | "PARTIAL_EVIDENCE" | "NEEDS_VERIFICATION";
  used_in_applications?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EvidenceCreatePayload {
  title: string;
  category: string;
  description: string;
  date?: string;
  organization?: string;
  evidence_text?: string;
  source_document_id?: number | null;
  source_type?: string;
  source_name?: string;
}

export interface ActionConfirmation {
  action_type: string;
  description: string;
  proposed_payload: Record<string, unknown>;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
}

export interface ChatMessageResponse {
  reply: string;
  trust_category: string;
  sources_cited: string[];
  suggested_prompts: string[];
  pending_action_confirmation?: ActionConfirmation | null;
  tools_used: string[];
  model_provider: string;
}

export interface KnowledgeSourceItem {
  id: number;
  name: string;
  source_url: string;
  source_type: string;
  authority_level: string;
  verification_status: string;
  last_verified_at?: string | null;
  monitoring_status: string;
  last_checked?: string | null;
  last_changed?: string | null;
  change_summary?: string | null;
  change_severity: string;
}

export interface KnowledgeChunkItem {
  id: number;
  document_id: number;
  chunk_text: string;
  section: string;
  page_number?: number | null;
  source_url: string;
  source_name?: string | null;
  authority_level?: string;
  verification_status?: string;
  last_verified_at?: string | null;
}

export interface KnowledgeSearchResponse {
  query: string;
  chunks: KnowledgeChunkItem[];
  sources_cited: string[];
  total_found: number;
}

export interface ApplicationDraftResponse {
  draft_text: string;
  evidence_used: Array<{
    id: number;
    title: string;
    category: string;
    source: string;
    status: string;
  }>;
  sources_used: string[];
  trust_label: string;
  student_approval_required: boolean;
  claims_detected: string[];
}

export interface ApplicationReviewResponse {
  review_feedback: string;
  unsupported_claims: string[];
  vague_statements: string[];
  strengths: string[];
  completeness_score: number;
  recommendations: string[];
}

export interface EvidenceCheckResponse {
  claims_evaluated: number;
  supported_claims: string[];
  unsupported_claims: string[];
  confidence_level: string;
}

export interface NotificationItem {
  id: number;
  student_id: number;
  type: "DEADLINE" | "DOCUMENT" | "ELIGIBILITY" | "SCHOLARSHIP_CHANGE" | "APPLICATION" | "FUNDING" | "SYSTEM";
  title: string;
  message: string;
  severity: "INFO" | "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  related_application_id?: number | null;
  related_scholarship_id?: number | null;
  read: boolean;
  created_at: string;
}

export interface NotificationSummary {
  unread_count: number;
  notifications: NotificationItem[];
}

export interface VoiceInterpretResponse {
  interpreted_text: string;
  detected_language: string;
  intent: string;
  extracted_params: Record<string, unknown>;
  requires_confirmation: boolean;
  confirmation_message: string;
  action_payload?: Record<string, unknown> | null;
}

export interface MonitoringCheckResponse {
  source_id: number;
  source_name: string;
  change_detected: boolean;
  change_category?: string | null;
  previous_value?: string | null;
  new_value?: string | null;
  affected_applications: string[];
  affected_requirements: string[];
  notification_created: boolean;
  recommended_next_action?: string | null;
}

// ==========================================
// Administrative Intelligence Interfaces
// ==========================================

export interface AdminOverview {
  total_users: number;
  total_students: number;
  total_scholarships: number;
  active_scholarships: number;
  retired_scholarships: number;
  verified_scholarships?: number;
  partially_verified_scholarships?: number;
  total_applications: number;
  applications_by_status: Record<string, number>;
  pending_review_count: number;
  ready_for_submission_count: number;
  in_progress_count: number;
  ai_status: {
    provider: string;
    model: string;
    base_url?: string | null;
    configured: boolean;
    connectivity: "CONNECTED" | "FAILED" | "DEMO_MODE" | "NOT_CONFIGURED" | string;
    latency_ms?: number | null;
    message: string;
    error_details?: string | null;
  };
  database_health?: {
    status: string;
    engine: string;
    connection?: string;
  };
  storage_health?: {
    status: string;
    backend: string;
    accessible: boolean;
  };
  recent_activity: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    status?: string;
    timestamp: string;
  }>;
}

export interface AdminScholarshipItem {
  id: number;
  name: string;
  provider: string;
  amount: number;
  deadline?: string | null;
  status: string;
  verification_status: string;
  dossier_index?: string | null;
  official_portal_url?: string | null;
  official_guideline_source?: string | null;
  applications_count: number;
}

export interface AdminScholarshipListResponse {
  total: number;
  scholarships: AdminScholarshipItem[];
}

export interface AdminApplicationItem {
  id: number;
  student_id: number;
  student_name: string;
  student_email: string;
  scholarship_id: number;
  scholarship_name: string;
  status: string;
  status_reason?: string | null;
  readiness_score: number;
  is_ready_for_submission: boolean;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  started_at: string;
  submitted_at?: string | null;
  requirements_met: number;
  requirements_total: number;
}

export interface AdminApplicationListResponse {
  total: number;
  applications: AdminApplicationItem[];
}

export interface AIDiagnostic {
  provider: string;
  model: string;
  base_url?: string | null;
  configured: boolean;
  connectivity: string;
  latency_ms?: number | null;
  message: string;
  error_details?: string | null;
  catalog_rag_enabled: boolean;
  active_sources_count: number;
}

export interface AuditLogItem {
  id: string;
  timestamp: string;
  event_type: string;
  actor: string;
  target_type: string;
  target_id?: number | null;
  description: string;
  details?: Record<string, unknown>;
}

export interface AdminUserItem {
  id: number;
  email: string;
  role: string;
  is_active: boolean;
  is_demo: boolean;
  student_id: number;
  student_name: string;
  institution?: string | null;
  course?: string | null;
  category?: string | null;
  cgpa?: number | null;
  applications_count: number;
  created_at: string;
}

export interface AdminUserListResponse {
  total: number;
  users: AdminUserItem[];
}

export interface AdminDocumentItem {
  id: number;
  student_id: number;
  student_name: string;
  student_email: string;
  document_type: string;
  filename: string;
  mime_type?: string | null;
  file_size_bytes?: number | null;
  sha256_hash?: string | null;
  status: string;
  verification_status: string;
  uploaded_at?: string | null;
}

export interface AdminDocumentListResponse {
  total: number;
  documents: AdminDocumentItem[];
}

export interface ApplicationFormFieldItem {
  key: string;
  label: string;
  field_group: string;
  value?: string | number | boolean | null;
  suggested_value?: string | number | boolean | null;
  source: string;
  verification_status: string;
  is_required: boolean;
  is_confirmed: boolean;
  guidance?: string | null;
  warning?: string | null;
}

export interface ApplicationAssistantWorkspace {
  application_id: number;
  scholarship_id: number;
  scholarship_name: string;
  scholarship_provider: string;
  official_portal_name?: string | null;
  official_portal_url?: string | null;
  official_guideline_url?: string | null;
  scholarship_deadline: string;
  award_display?: string | null;
  eligibility_summary?: string | null;
  submission_mode: "OFFICIAL_API" | "AUTHORIZED_BROWSER_AUTOMATION" | "STUDENT_COMPLETED_EXTERNAL_SUBMISSION" | "NOT_INTEGRATED" | string;
  preparation_status: "DRAFT" | "IN_PROGRESS" | "ACTION_REQUIRED" | "READY_FOR_REVIEW" | "READY_TO_SUBMIT" | string;
  submission_status: "NOT_SUBMITTED" | "MANUAL_SUBMISSION_REQUIRED" | "SUBMISSION_IN_PROGRESS" | "SUBMITTED_EXTERNALLY" | "SUBMISSION_FAILED" | "REQUIRES_CONFIRMATION" | string;
  status: string;
  progress: number;
  status_reason?: string | null;
  student_consented: boolean;
  student_consented_at?: string | null;
  external_application_id?: string | null;
  external_submission_at?: string | null;
  external_receipt_document_id?: number | null;
  fields: ApplicationFormFieldItem[];
  documents: ApplicationRequirementItem[];
  instructions: string[];
  missing_mandatory_fields: string[];
  unconfirmed_fields: string[];
  discrepancies: string[];
  is_ready_for_student_approval: boolean;
  is_ready_for_external_submission: boolean;
  status_history: Array<{
    event_type?: string;
    previous_status?: string;
    new_status?: string;
    actor?: string;
    timestamp: string;
    reason?: string;
    confirmation_number?: string;
    portal?: string;
  }>;
}

export interface RecordExternalSubmissionPayload {
  confirmation_number: string;
  submitted_at?: string;
  receipt_document_id?: number | null;
  submission_notes?: string;
}

export interface OfficialApiSubmissionPayload {
  idempotency_key?: string;
  confirm_accuracy?: boolean;
}
