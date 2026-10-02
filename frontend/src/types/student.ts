export interface StudentProfile {
  id: number;
  student_id: number;
  institution: string;
  course: string;
  year: string;
  cgpa: number;
  twelfth_percentage: number;
  category: string;
  state: string;
  gender?: string;
}

export interface FundingProfile {
  id: number;
  student_id: number;
  annual_education_cost: number;
  existing_support: number;
  annual_family_income: number;
  funding_gap: number;
  funding_progress_percentage: number;
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
  name?: string;
  email?: string;
  phone?: string | null;
  institution?: string;
  course?: string;
  year?: string;
  cgpa?: number;
  twelfth_percentage?: number;
  category?: string;
  state?: string;
  annual_education_cost?: number;
  existing_support?: number;
  annual_family_income?: number;
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
  match_score?: number;
  fit_reasons?: string[];
  days_remaining?: number;
  deadline_risk?: string;
  application_status?: string;
  application_id?: number;
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
}

// Block 2: Applications & Requirements
export interface ApplicationRequirementItem {
  id: number;
  application_id: number;
  name: string;
  document_type: string;
  type: string;
  is_required: boolean;
  status: "MISSING" | "AVAILABLE" | "VERIFIED" | "NOT_REQUIRED" | "NEEDS_VERIFICATION";
  document_id?: number | null;
  created_at: string;
  updated_at: string;
}

export interface ApplicationItem {
  id: number;
  student_id: number;
  scholarship_id: number;
  status: string;
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
  proposed_payload: Record<string, any>;
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
  extracted_params: Record<string, any>;
  requires_confirmation: boolean;
  confirmation_message: string;
  action_payload?: Record<string, any> | null;
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
