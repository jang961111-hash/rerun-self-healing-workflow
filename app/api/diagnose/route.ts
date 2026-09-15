import { NextResponse } from "next/server";
import { jsonCall } from "@/lib/llm";
import { DIAGNOSE_SYSTEM } from "@/lib/prompts";
import { DIAGNOSE_JSON_SCHEMA } from "@/lib/schema";
import type { Diagnosis } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { prompt, resumeText, error } = await req.json();
  try {
    const out = await jsonCall<Diagnosis>(
      DIAGNOSE_SYSTEM,
      [
        "## 실패한 단계의 현재 프롬프트",
        prompt,
        "## 입력 문서 (이력서 원문)",
        resumeText,
        "## 발생한 오류",
        error,
      ].join("\n\n"),
      "diagnosis",
      DIAGNOSE_JSON_SCHEMA
    );
    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
