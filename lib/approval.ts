import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { EXTRACT_PROMPT_V1 } from "./prompts";

// 승인 게이트의 서버 측 강제 (DB·계정 없이 동작하는 서명 방식)
// - /api/diagnose 가 만든 수정안에만 proposal 서명을 붙인다 → 임의 프롬프트는 승인 대상이 될 수 없다
// - /api/approve 가 proposal 서명을 확인한 뒤 approval 토큰을 발급한다
// - /api/extract 는 원본(v1) 또는 approval 토큰이 붙은 프롬프트만 실행한다
// error: /api/extract 가 만든 계약 실패 문구(이력서 원문에 묶음) — /api/diagnose 입력 검증용
type Kind = "proposal" | "approval" | "error";

let fallbackSecret: Buffer | null = null;

// 서버리스 인스턴스끼리 같은 키를 쓰도록 환경변수에서 파생한다.
// 둘 다 없으면(테스트·CI) 프로세스마다 임의 키를 쓴다.
function secret(): Buffer {
  const explicit = process.env.RERUN_SIGNING_SECRET;
  if (explicit) return Buffer.from(explicit);
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) return createHash("sha256").update(`rerun-approval:${apiKey}`).digest();
  fallbackSecret ??= randomBytes(32);
  return fallbackSecret;
}

export function sign(kind: Kind, payload: string): string {
  return createHmac("sha256", secret()).update(`${kind}\n${payload}`).digest("hex");
}

export function verify(kind: Kind, payload: unknown, sig: unknown): boolean {
  if (typeof payload !== "string" || typeof sig !== "string") return false;
  const expected = Buffer.from(sign(kind, payload), "hex");
  const given = Buffer.from(sig, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// 추출 단계에서 실행해도 되는 프롬프트인가
export function isRunnablePrompt(prompt: unknown, approvalToken: unknown): boolean {
  if (prompt === EXTRACT_PROMPT_V1) return true;
  return verify("approval", prompt, approvalToken);
}
