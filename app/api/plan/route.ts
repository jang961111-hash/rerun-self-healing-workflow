import { NextResponse } from "next/server";
import { jsonCall } from "@/lib/llm";
import { PLAN_SYSTEM } from "@/lib/prompts";
import { PLAN_JSON_SCHEMA } from "@/lib/schema";
import type { WorkflowStep } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { task } = await req.json();
  try {
    const out = await jsonCall<{ steps: WorkflowStep[] }>(
      PLAN_SYSTEM,
      `업무 설명: ${task}`,
      "workflow_plan",
      PLAN_JSON_SCHEMA
    );
    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
