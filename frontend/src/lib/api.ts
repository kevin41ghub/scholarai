import {
  StudentDetail,
  FundingOverview,
  StudentUpdatePayload,
  HealthResponse,
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

export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}
