import { z } from "zod";

// 워크플로우의 데이터 계약(contract).
// LLM 추출 결과는 이 계약을 통과해야 다음 단계로 넘어갈 수 있다.
// experience_years는 매칭 단계의 필수 입력이므로 null을 허용하지 않는다 —
// 이것이 지원자 4(자유 서식, 연차 미명시)에서 결정적 실패를 만드는 지점이다.
export const ProfileContract = z.object({
  name: z.string().min(1),
  email: z.string().nullable(),
  experience_years: z
    .number({ error: "experience_years는 숫자여야 합니다 (null 수신)" })
    .min(0),
  skills: z.array(z.string()),
  summary: z.string(),
});

// LLM 응답 강제용 json_schema (LLM 레벨에서는 null 반환이 합법 —
// 계약 위반 검증은 위 zod가 담당한다)
export const EXTRACT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    email: { type: ["string", "null"] },
    experience_years: { type: ["number", "null"] },
    skills: { type: "array", items: { type: "string" } },
    summary: { type: "string" },
  },
  required: ["name", "email", "experience_years", "skills", "summary"],
};

export const PLAN_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    steps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string", enum: ["load", "extract", "match", "report"] },
          name: { type: "string" },
          description: { type: "string" },
        },
        required: ["id", "name", "description"],
      },
    },
  },
  required: ["steps"],
};

export const DIAGNOSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    root_cause: { type: "string" },
    explanation: { type: "string" },
    proposed_prompt: { type: "string" },
    risk_note: { type: "string" },
  },
  required: ["root_cause", "explanation", "proposed_prompt", "risk_note"],
};

export const MATCH_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    rows: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          score: { type: "number" },
          verdict: { type: "string", enum: ["적합", "검토 필요", "부적합"] },
          reasons: { type: "array", items: { type: "string" } },
        },
        required: ["name", "score", "verdict", "reasons"],
      },
    },
  },
  required: ["rows"],
};
