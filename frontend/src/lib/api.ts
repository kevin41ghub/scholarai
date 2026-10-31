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
  OfficialDossier,
  AdminOverview,
  AdminScholarshipListResponse,
  AdminApplicationListResponse,
  AIDiagnostic,
  AuditLogItem,
  AdminUserListResponse,
  AdminDocumentListResponse,
  ApplicationAssistantWorkspace,
  RecordExternalSubmissionPayload,
  OfficialApiSubmissionPayload,
  ProfileCompletionData,
  PersonalizedRecommendationsData,
  StudentDocumentsReadinessOverview,
  DocumentConfirmPayload,
} from "@/types/student";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  isNetworkError: boolean;
  constructor(message: string, status: number, isNetworkError: boolean = false) {
    super(message);
    this.status = status;
    this.isNetworkError = isNetworkError;
  }
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const isFormData = typeof FormData !== "undefined" && options?.body instanceof FormData;
  const defaultHeaders: Record<string, string> = isFormData
    ? {}
    : { "Content-Type": "application/json" };

  let response: Response;
  try {
    response = await fetch(url, {
      credentials: "include",
      ...options,
      headers: {
        ...defaultHeaders,
        ...(options?.headers || {}),
      },
    });
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      throw err;
    }
    const rawMsg = (err as Error)?.message || "Failed to fetch";
    const isNetwork =
      rawMsg.toLowerCase().includes("failed to fetch") ||
      rawMsg.toLowerCase().includes("networkerror") ||
      rawMsg.toLowerCase().includes("load failed") ||
      rawMsg.toLowerCase().includes("aborted");

    if (isNetwork) {
      throw new ApiError(
        "Unable to connect to the SCHOLARAi scholarship backend. If the service was dormant, Render free tier takes ~30-50 seconds to initialize. Please retry in a few moments.",
        0,
        true
      );
    }
    throw new ApiError(rawMsg, 0, false);
  }

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
    throw new ApiError(errorDetail, response.status, false);
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
  stream?: string;
  category_tag?: string;
  study_level?: string;
  eligibility_filter?: string;
  status_filter?: string;
  source_status?: string;
  verification_filter?: string;
  sort_by?: string;
}): Promise<ScholarshipListItem[]> {
  const queryParams = new URLSearchParams();
  if (params?.query) queryParams.set("query", params.query);
  if (params?.stream) queryParams.set("stream", params.stream);
  if (params?.category_tag) queryParams.set("category_tag", params.category_tag);
  if (params?.study_level) queryParams.set("study_level", params.study_level);
  if (params?.eligibility_filter) queryParams.set("eligibility_filter", params.eligibility_filter);
  if (params?.status_filter) {
    queryParams.set("status_filter", params.status_filter);
  } else {
    // Default to ACTIVE scholarships to exclude retired demo records from student discovery
    queryParams.set("status_filter", "ACTIVE");
  }
  if (params?.source_status) queryParams.set("source_status", params.source_status);
  if (params?.verification_filter) queryParams.set("verification_filter", params.verification_filter);
  if (params?.sort_by) queryParams.set("sort_by", params.sort_by);

  const qs = queryParams.toString();
  return request<ScholarshipListItem[]>(`/api/v1/scholarships${qs ? `?${qs}` : ""}`, { cache: "no-store" });
}

export async function getScholarshipDetail(id: number): Promise<ScholarshipDetail> {
  return request<ScholarshipDetail>(`/api/v1/scholarships/${id}`, { cache: "no-store" });
}

export async function getScholarshipDossier(id: number): Promise<OfficialDossier> {
  return request<OfficialDossier>(`/api/v1/scholarships/${id}/dossier`, { cache: "no-store" });
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

export async function submitApplication(id: number): Promise<ApplicationItem> {
  return request<ApplicationItem>(`/api/v1/applications/${id}/submit`, {
    method: "POST",
  });
}

export async function withdrawApplication(id: number, reason?: string): Promise<ApplicationItem> {
  return request<ApplicationItem>(`/api/v1/applications/${id}/withdraw`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function reconcileApplication(id: number): Promise<ApplicationItem> {
  return request<ApplicationItem>(`/api/v1/applications/${id}/reconcile`, {
    method: "POST",
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

export async function getDocument(id: number): Promise<DocumentItem> {
  return request<DocumentItem>(`/api/v1/documents/${id}`, { cache: "no-store" });
}

export async function uploadDocumentFile(
  file: File,
  documentType: string,
  notes?: string
): Promise<DocumentItem> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("document_type", documentType);
  if (notes) {
    formData.append("notes", notes);
  }
  return request<DocumentItem>("/api/v1/documents/upload", {
    method: "POST",
    body: formData,
  });
}

export async function reExtractDocument(id: number): Promise<DocumentItem> {
  return request<DocumentItem>(`/api/v1/documents/${id}/re-extract`, {
    method: "POST",
  });
}

export async function updateDocument(id: number, payload: { status?: string; notes?: string }): Promise<DocumentItem> {
  return request<DocumentItem>(`/api/v1/documents/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteDocument(id: number): Promise<{ message: string; id: number }> {
  return request<{ message: string; id: number }>(`/api/v1/documents/${id}`, {
    method: "DELETE",
  });
}

export async function reviewDocument(
  id: number,
  action: "APPROVE" | "REJECT" | "REQUEST_CHANGES",
  reason: string
): Promise<DocumentItem> {
  return request<DocumentItem>(`/api/v1/documents/${id}/review`, {
    method: "POST",
    body: JSON.stringify({ action, reason }),
  });
}

export async function getDocumentsReadiness(): Promise<StudentDocumentsReadinessOverview> {
  return request<StudentDocumentsReadinessOverview>("/api/v1/documents/readiness", { cache: "no-store" });
}

export async function confirmExtractedDocument(
  id: number,
  payload: DocumentConfirmPayload
): Promise<DocumentItem> {
  return request<DocumentItem>(`/api/v1/documents/${id}/confirm-extracted`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getDocumentDownloadUrl(id: number, inline: boolean = false): string {
  return `${API_BASE_URL}/api/v1/documents/${id}/download?inline=${inline}`;
}

// Block 2: Actions
export async function getActions(): Promise<ActionItem[]> {
  return request<ActionItem[]>("/api/v1/actions", { cache: "no-store" });
}

export async function toggleAction(id: number): Promise<ActionItem> {
  return request<ActionItem>(`/api/v1/actions/${id}/toggle`, {
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

export function formatINR(amount?: number | string | null): string {
  const num = typeof amount === "string" ? parseFloat(amount) : (amount ?? 0);
  const safeNum = isNaN(num) ? 0 : num;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(safeNum);
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

export async function registerUser(payload: Record<string, unknown>): Promise<AuthResponse> {
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

// ==========================================
// Administrative Intelligence API Methods
// ==========================================

export async function getAdminOverview(): Promise<AdminOverview> {
  return request<AdminOverview>("/api/v1/admin/overview");
}

export async function getAdminScholarships(params?: {
  search?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<AdminScholarshipListResponse> {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.status) query.set("status", params.status);
  if (params?.limit) query.set("limit", params.limit.toString());
  if (params?.offset) query.set("offset", params.offset.toString());
  const qs = query.toString();
  return request<AdminScholarshipListResponse>(`/api/v1/admin/scholarships${qs ? `?${qs}` : ""}`);
}

export async function retireScholarship(id: number): Promise<{ message: string; id: number; status: string }> {
  return request<{ message: string; id: number; status: string }>(`/api/v1/admin/scholarships/${id}/retire`, {
    method: "POST",
  });
}

export async function getAdminApplications(params?: {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<AdminApplicationListResponse> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.search) query.set("search", params.search);
  if (params?.limit) query.set("limit", params.limit.toString());
  if (params?.offset) query.set("offset", params.offset.toString());
  const qs = query.toString();
  return request<AdminApplicationListResponse>(`/api/v1/admin/applications${qs ? `?${qs}` : ""}`);
}

export async function getApplicationAdminHistory(id: number): Promise<{
  application_id: number;
  current_status: string;
  status_reason?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  history: Array<Record<string, unknown>>;
}> {
  return request(`/api/v1/admin/applications/${id}/history`);
}

export async function reviewApplicationAdmin(
  id: number,
  payload: { action: "UNDER_REVIEW" | "APPROVE" | "REJECT" | string; reason: string }
): Promise<{
  message: string;
  application_id: number;
  status: string;
  status_reason?: string;
}> {
  return request(`/api/v1/admin/applications/${id}/review`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getAIDiagnostic(): Promise<AIDiagnostic> {
  return request<AIDiagnostic>("/api/v1/admin/ai/diagnostic");
}

export async function getAdminAuditLogs(limit: number = 50): Promise<AuditLogItem[]> {
  return request<AuditLogItem[]>(`/api/v1/admin/audit-logs?limit=${limit}`);
}

export async function importScholarships(payload: {
  items: Array<Record<string, unknown>>;
  dry_run?: boolean;
}): Promise<{
  total: number;
  created: number;
  updated: number;
  skipped: number;
  rejected: number;
  dry_run: boolean;
  errors: string[];
  items: Array<{
    index: number;
    name: string;
    dossier_index?: string;
    action: string;
    status: string;
    details?: string;
    errors: string[];
  }>;
}> {
  return request("/api/v1/scholarships/import", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getAdminUsers(params?: {
  search?: string;
  role?: string;
  limit?: number;
  offset?: number;
}): Promise<AdminUserListResponse> {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.role) query.set("role", params.role);
  if (params?.limit) query.set("limit", params.limit.toString());
  if (params?.offset) query.set("offset", params.offset.toString());
  const qs = query.toString();
  return request<AdminUserListResponse>(`/api/v1/admin/users${qs ? `?${qs}` : ""}`);
}

export async function getAdminDocuments(params?: {
  search?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<AdminDocumentListResponse> {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.status) query.set("status", params.status);
  if (params?.limit) query.set("limit", params.limit.toString());
  if (params?.offset) query.set("offset", params.offset.toString());
  const qs = query.toString();
  return request<AdminDocumentListResponse>(`/api/v1/admin/documents${qs ? `?${qs}` : ""}`);
}

// Block: Real Application Assistant
export async function getApplicationAssistantWorkspace(id: number): Promise<ApplicationAssistantWorkspace> {
  return request<ApplicationAssistantWorkspace>(`/api/v1/applications/${id}/assistant`, { cache: "no-store" });
}

export async function updateApplicationFormFields(
  id: number,
  fields: Record<string, unknown>
): Promise<ApplicationAssistantWorkspace> {
  return request<ApplicationAssistantWorkspace>(`/api/v1/applications/${id}/assistant/fields`, {
    method: "PUT",
    body: JSON.stringify({ fields }),
  });
}

export async function approveApplicationAssistant(
  id: number,
  consent: boolean = true
): Promise<ApplicationAssistantWorkspace> {
  return request<ApplicationAssistantWorkspace>(`/api/v1/applications/${id}/assistant/approve`, {
    method: "POST",
    body: JSON.stringify({ consent }),
  });
}

export async function launchOfficialPortal(id: number): Promise<ApplicationAssistantWorkspace> {
  return request<ApplicationAssistantWorkspace>(`/api/v1/applications/${id}/assistant/launch-portal`, {
    method: "POST",
  });
}

export async function recordExternalSubmission(
  id: number,
  payload: RecordExternalSubmissionPayload
): Promise<ApplicationItem> {
  return request<ApplicationItem>(`/api/v1/applications/${id}/assistant/record-external-submission`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function submitApplicationViaApi(
  id: number,
  payload?: OfficialApiSubmissionPayload
): Promise<ApplicationItem> {
  return request<ApplicationItem>(`/api/v1/applications/${id}/assistant/submit-api`, {
    method: "POST",
    body: JSON.stringify(payload || { confirm_accuracy: true }),
  });
}

export async function exportApplicationDossier(id: number): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>(`/api/v1/applications/${id}/assistant/export-dossier`, { cache: "no-store" });
}

// Student Profile Completion and Personalized Recommendations
export async function getProfileCompletion(): Promise<ProfileCompletionData> {
  return request<ProfileCompletionData>("/api/v1/student/me/completion", { cache: "no-store" });
}

export async function getPersonalizedRecommendations(): Promise<PersonalizedRecommendationsData> {
  return request<PersonalizedRecommendationsData>("/api/v1/scholarships/recommendations", { cache: "no-store" });
}
