import { NextResponse } from "next/server";
import { jsonCall } from "@/lib/llm";
import { guard } from "@/lib/guard";
import { ProfileContract, EXTRACT_JSON_SCHEMA } from "@/lib/schema";
import { isRunnablePrompt, sign } from "@/lib/approval";

export const maxDuration = 60;

export async function POST(req: Request) {
  const blocked = guard(req);
  if (blocked) return blocked;
  let body: { resumeText?: unknown; prompt?: unknown; approvalToken?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON 본문이 필요합니다" }, { status: 400 });
  }
  const { resumeText, prompt, approvalToken } = body ?? {};
  // 승인 게이트 서버 강제 — 원본(v1)이나 사람이 승인한 수정안만 실행한다
  if (!isRunnablePrompt(prompt, approvalToken)) {
    return NextResponse.json(
      { ok: false, error: "승인되지 않은 프롬프트는 실행할 수 없습니다" },
      { status: 403 }
    );
  }
  try {
    const raw = await jsonCall<unknown>(
      prompt as string,
      `이력서 원문:\n${resumeText}`,
      "candidate_profile",
      EXTRACT_JSON_SCHEMA
    );
    // 데이터 계약 검증 — 실패하면 워크플로우 장애로 보고
    const parsed = ProfileContract.safeParse(raw);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      const error = `출력 계약 검증 실패 — ${issues}`;
      return NextResponse.json({
        ok: false,
        error,
        // 서버가 만든 오류임을 서명 — /api/diagnose 는 이 서명이 있는 오류만 받는다
        error_sig: sign("error", `${resumeText}\n${error}`),
        raw,
      });
    }
    return NextResponse.json({ ok: true, profile: parsed.data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) });
  }
}
