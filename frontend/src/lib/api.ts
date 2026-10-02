import {
  StudentDetail,
  FundingOverview,
  StudentUpdatePayload,
  HealthResponse,
  ScholarshipListItem,
  ScholarshipDetail,
  EligibilityResult,
  ApplicationItem,
  ApplicationRequirementItem,
  PortfolioSummary,
  DocumentItem,
  ActionItem,
  PlannerOverview,
  User,
  AuthResponse,
  EvidenceItem,
  EvidenceCreatePayload,
  ChatMessageResponse,
  ActionConfirmation,
  KnowledgeSourceItem,
  KnowledgeSearchResponse,
  ApplicationDraftResponse,
  ApplicationReviewResponse,
  EvidenceCheckResponse,
  NotificationSummary,
  NotificationItem,
  VoiceInterpretResponse,
  MonitoringCheckResponse,
} from "@/types/student";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });

  if (!response.ok) {
    let errorDetail = "An unexpected error occurred";
    try {
      const errorJson = await response.json();
      if (typeof errorJson.detail === "string") {
        errorDetail = errorJson.detail;
      } else if (Array.isArray(errorJson.detail)) {
        errorDetail = errorJson.detail.map((d: { msg?: string }) => d.msg || "Invalid field").join(", ");
      }
    } catch {
      errorDetail = `Request failed with status ${response.status}: ${response.statusText}`;
    }
    throw new ApiError(errorDetail, response.status);
  }

  return response.json();
}

// Health & Student (Phase 1)
export async function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/api/health");
}

export async function getCurrentStudent(): Promise<StudentDetail> {
  return request<StudentDetail>("/api/v1/student/me", { cache: "no-store" });
}

export async function getFundingOverview(): Promise<FundingOverview> {
  return request<FundingOverview>("/api/v1/student/funding", { cache: "no-store" });
}

export async function updateStudent(payload: StudentUpdatePayload): Promise<StudentDetail> {
  return request<StudentDetail>("/api/v1/student/me", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

// Block 2: Scholarships
export async function getScholarships(params?: {
  query?: string;
  eligibility_filter?: string;
  status_filter?: string;
  verification_filter?: string;
  sort_by?: string;
}): Promise<ScholarshipListItem[]> {
  const queryParams = new URLSearchParams();
  if (params?.query) queryParams.set("query", params.query);
  if (params?.eligibility_filter) queryParams.set("eligibility_filter", params.eligibility_filter);
  if (params?.status_filter) queryParams.set("status_filter", params.status_filter);
  if (params?.verification_filter) queryParams.set("verification_filter", params.verification_filter);
  if (params?.sort_by) queryParams.set("sort_by", params.sort_by);

  const qs = queryParams.toString();
  return request<ScholarshipListItem[]>(`/api/v1/scholarships${qs ? `?${qs}` : ""}`, { cache: "no-store" });
}

export async function getScholarshipDetail(id: number): Promise<ScholarshipDetail> {
  return request<ScholarshipDetail>(`/api/v1/scholarships/${id}`, { cache: "no-store" });
}

export async function checkScholarshipEligibility(id: number): Promise<EligibilityResult> {
  return request<EligibilityResult>(`/api/v1/scholarships/${id}/eligibility`, { cache: "no-store" });
}

export async function applyToScholarship(id: number): Promise<{ message: string; application_id: number; is_new: boolean }> {
  return request<{ message: string; application_id: number; is_new: boolean }>(`/api/v1/scholarships/${id}/apply`, {
    method: "POST",
  });
}

// Block 2: Applications
export async function getApplications(): Promise<ApplicationItem[]> {
  return request<ApplicationItem[]>("/api/v1/applications", { cache: "no-store" });
}

export async function getApplicationDetail(id: number): Promise<ApplicationItem> {
  return request<ApplicationItem>(`/api/v1/applications/${id}`, { cache: "no-store" });
}

export async function getPortfolioSummary(): Promise<PortfolioSummary> {
  return request<PortfolioSummary>("/api/v1/applications/portfolio-summary", { cache: "no-store" });
}

export async function createApplication(scholarshipId: number): Promise<ApplicationItem> {
  return request<ApplicationItem>("/api/v1/applications", {
    method: "POST",
    body: JSON.stringify({ scholarship_id: scholarshipId }),
  });
}

export async function updateApplication(id: number, payload: { status?: string; personal_statement?: string }): Promise<ApplicationItem> {
  return request<ApplicationItem>(`/api/v1/applications/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function updateApplicationRequirement(
  appId: number,
  reqId: number,
  payload: { status?: string; document_id?: number }
): Promise<ApplicationRequirementItem> {
  return request<ApplicationRequirementItem>(`/api/v1/applications/${appId}/requirements/${reqId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

// Block 2: Documents
export async function getDocuments(): Promise<DocumentItem[]> {
  return request<DocumentItem[]>("/api/v1/documents", { cache: "no-store" });
}

export async function updateDocument(id: number, payload: { status?: string; notes?: string }): Promise<DocumentItem> {
  return request<DocumentItem>(`/api/v1/documents/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

// Block 2: Actions
export async function getActions(): Promise<ActionItem[]> {
  return request<ActionItem[]>("/api/v1/actions", { cache: "no-store" });
}

export async function toggleAction(id: number): Promise<any> {
  return request<any>(`/api/v1/actions/${id}/toggle`, {
    method: "PATCH",
  });
}

// Block 2: Planner
export async function getPlanner(): Promise<PlannerOverview> {
  return request<PlannerOverview>("/api/v1/planner", { cache: "no-store" });
}

export async function updatePlanner(payload: {
  target_funding?: number;
  available_hours_per_week?: number;
  purpose?: string;
  timeline?: string;
  priorities?: string;
}): Promise<PlannerOverview> {
  return request<PlannerOverview>("/api/v1/planner", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

// ==========================================
// Block 3: Auth API Methods
// ==========================================

export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function registerUser(payload: Record<string, any>): Promise<AuthResponse> {
  return request<AuthResponse>("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function logoutUser(): Promise<{ message: string }> {
  return request<{ message: string }>("/api/v1/auth/logout", {
    method: "POST",
  });
}

export async function getMe(): Promise<User> {
  return request<User>("/api/v1/auth/me");
}

// ==========================================
// Block 3: Evidence Bank API Methods
// ==========================================

export async function getEvidence(category?: string, status?: string): Promise<EvidenceItem[]> {
  const params = new URLSearchParams();
  if (category) params.append("category", category);
  if (status) params.append("status", status);
  const q = params.toString() ? `?${params.toString()}` : "";
  return request<EvidenceItem[]>(`/api/v1/evidence${q}`);
}

export async function createEvidence(payload: EvidenceCreatePayload): Promise<EvidenceItem> {
  return request<EvidenceItem>("/api/v1/evidence", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateEvidence(id: number, payload: Partial<EvidenceItem>): Promise<EvidenceItem> {
  return request<EvidenceItem>(`/api/v1/evidence/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteEvidence(id: number): Promise<void> {
  return request<void>(`/api/v1/evidence/${id}`, {
    method: "DELETE",
  });
}

// ==========================================
// Block 3: Knowledge & RAG API Methods
// ==========================================

export async function getKnowledgeSources(): Promise<KnowledgeSourceItem[]> {
  return request<KnowledgeSourceItem[]>("/api/v1/knowledge/sources");
}

export async function searchKnowledge(q: string, scholarshipId?: number): Promise<KnowledgeSearchResponse> {
  const params = new URLSearchParams();
  params.append("q", q);
  if (scholarshipId) params.append("scholarship_id", scholarshipId.toString());
  return request<KnowledgeSearchResponse>(`/api/v1/knowledge/search?${params.toString()}`);
}

// ==========================================
// Block 3: AI Assistant API Methods
// ==========================================

export async function sendAssistantMessage(
  message: string,
  history?: Array<{ role: string; content: string }>,
  confirmedAction?: ActionConfirmation | null
): Promise<ChatMessageResponse> {
  return request<ChatMessageResponse>("/api/v1/assistant/chat", {
    method: "POST",
    body: JSON.stringify({
      message,
      conversation_history: history,
      confirmed_action: confirmedAction,
    }),
  });
}

// ==========================================
// Block 3: AI Application Assistance Methods
// ==========================================

export async function draftApplicationAnswer(
  applicationId: number,
  question: string,
  evidenceIds?: number[]
): Promise<ApplicationDraftResponse> {
  return request<ApplicationDraftResponse>(`/api/v1/applications/${applicationId}/draft`, {
    method: "POST",
    body: JSON.stringify({
      question,
      selected_evidence_ids: evidenceIds,
    }),
  });
}

export async function reviewApplicationAnswer(
  applicationId: number,
  question: string,
  answerText: string
): Promise<ApplicationReviewResponse> {
  return request<ApplicationReviewResponse>(`/api/v1/applications/${applicationId}/review`, {
    method: "POST",
    body: JSON.stringify({
      question,
      answer_text: answerText,
    }),
  });
}

export async function checkEvidenceClaims(
  applicationId: number,
  draftText: string
): Promise<EvidenceCheckResponse> {
  return request<EvidenceCheckResponse>(`/api/v1/applications/${applicationId}/evidence-check`, {
    method: "POST",
    body: JSON.stringify({
      draft_text: draftText,
    }),
  });
}

// ==========================================
// Block 3: Notifications API Methods
// ==========================================

export async function getNotifications(): Promise<NotificationSummary> {
  return request<NotificationSummary>("/api/v1/notifications");
}

export async function markNotificationRead(id: number): Promise<NotificationItem> {
  return request<NotificationItem>(`/api/v1/notifications/${id}/read`, {
    method: "PATCH",
  });
}

export async function markAllNotificationsRead(): Promise<{ message: string }> {
  return request<{ message: string }>("/api/v1/notifications/mark-all-read", {
    method: "POST",
  });
}

// ==========================================
// Block 3: Voice Decoder API Methods
// ==========================================

export async function interpretVoice(
  transcription: string,
  language: string = "en"
): Promise<VoiceInterpretResponse> {
  return request<VoiceInterpretResponse>("/api/v1/voice/interpret", {
    method: "POST",
    body: JSON.stringify({
      transcription,
      language,
    }),
  });
}

// ==========================================
// Block 3: Monitoring API Methods
// ==========================================

export async function getMonitoredSources(): Promise<KnowledgeSourceItem[]> {
  return request<KnowledgeSourceItem[]>("/api/v1/monitoring");
}

export async function runMonitoringCheck(
  scholarshipId?: number,
  simulateChangeType?: string
): Promise<MonitoringCheckResponse> {
  return request<MonitoringCheckResponse>("/api/v1/monitoring/check", {
    method: "POST",
    body: JSON.stringify({
      scholarship_id: scholarshipId,
      simulate_change_type: simulateChangeType,
    }),
  });
}
