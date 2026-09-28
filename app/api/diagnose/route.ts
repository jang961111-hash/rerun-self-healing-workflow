import { NextResponse } from "next/server";
import { jsonCall } from "@/lib/llm";
import { guard } from "@/lib/guard";
import { DIAGNOSE_SYSTEM } from "@/lib/prompts";
import { DIAGNOSE_JSON_SCHEMA } from "@/lib/schema";
import type { Diagnosis } from "@/lib/types";
import { sign } from "@/lib/approval";

export const maxDuration = 60;

export async function POST(req: Request) {
  const blocked = guard(req);
  if (blocked) return blocked;
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
    // 진단이 만든 수정안임을 서명 — /api/approve 가 이 서명이 있는 수정안만 승인한다
    return NextResponse.json({
      ...out,
      proposal_sig: sign("proposal", out.proposed_prompt),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
