import { NextResponse } from "next/server";
import { jsonCall } from "@/lib/llm";
import { ProfileContract, EXTRACT_JSON_SCHEMA } from "@/lib/schema";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { resumeText, prompt } = await req.json();
  try {
    const raw = await jsonCall<unknown>(
      prompt,
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
      return NextResponse.json({
        ok: false,
        error: `출력 계약 검증 실패 — ${issues}`,
        raw,
      });
    }
    return NextResponse.json({ ok: true, profile: parsed.data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) });
  }
}
