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
