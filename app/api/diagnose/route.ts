import { NextResponse } from "next/server";
import { jsonCall } from "@/lib/llm";
import { guard } from "@/lib/guard";
import { DIAGNOSE_SYSTEM, EXTRACT_PROMPT_V1 } from "@/lib/prompts";
import { RESUMES } from "@/lib/data";
import { DIAGNOSE_JSON_SCHEMA } from "@/lib/schema";
import type { Diagnosis } from "@/lib/types";
import { sign, verify } from "@/lib/approval";

export const maxDuration = 60;

export async function POST(req: Request) {
  const blocked = guard(req);
  if (blocked) return blocked;
  const { prompt, resumeId, error, errorSig } = await req.json();
  // 진단 입력은 전부 서버가 아는 값이어야 한다 — 아니면 수정안(proposed_prompt)을
  // 원하는 방향으로 유도한 뒤 승인·실행하는 우회가 가능하다
  const resume = RESUMES.find((r) => r.id === resumeId);
  if (prompt !== EXTRACT_PROMPT_V1 || !resume) {
    return NextResponse.json(
      { error: "진단할 수 없는 입력입니다 (원본 프롬프트·등록된 이력서만 허용)" },
      { status: 400 }
    );
  }
  if (!verify("error", `${resume.text}\n${error}`, errorSig)) {
    return NextResponse.json(
      { error: "서버가 확인하지 않은 오류 문구입니다" },
      { status: 400 }
    );
  }
  const resumeText = resume.text;
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
