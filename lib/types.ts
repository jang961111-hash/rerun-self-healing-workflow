export type StepStatus = "pending" | "running" | "ok" | "failed";

export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
}

export interface CandidateProfile {
  name: string;
  email: string | null;
  experience_years: number;
  skills: string[];
  summary: string;
}

export interface ExtractResult {
  ok: boolean;
  profile?: CandidateProfile;
  error?: string;
  raw?: unknown;
}

export interface Diagnosis {
  root_cause: string;
  explanation: string;
  proposed_prompt: string;
  risk_note: string;
}

export interface MatchRow {
  name: string;
  score: number;
  verdict: "적합" | "검토 필요" | "부적합";
  reasons: string[];
}

export interface AuditEvent {
  ts: string;
  type: string;
  actor: "system" | "ai" | "human";
  detail: string;
}
