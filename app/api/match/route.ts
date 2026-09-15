import { NextResponse } from "next/server";
import { jsonCall } from "@/lib/llm";
import { MATCH_SYSTEM } from "@/lib/prompts";
import { MATCH_JSON_SCHEMA } from "@/lib/schema";
import type { MatchRow } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { jobPosting, profiles } = await req.json();
  try {
    const out = await jsonCall<{ rows: MatchRow[] }>(
      MATCH_SYSTEM,
      [
        "## 채용공고",
        jobPosting,
        "## 지원자 프로필 (구조화 추출 결과)",
        JSON.stringify(profiles, null, 2),
      ].join("\n\n"),
      "match_report",
      MATCH_JSON_SCHEMA
    );
    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
