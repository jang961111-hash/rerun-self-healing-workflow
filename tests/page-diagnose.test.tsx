// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Home from "@/app/page";
import { RESUMES } from "@/lib/data";

// 네트워크(fetch)를 가짜로 바꿔 OpenAI·서버 없이 UI 흐름만 돌린다
const REAL_ERROR =
  "출력 계약 검증 실패 — experience_years: experience_years는 숫자여야 합니다 (null 수신)";
const FAIL_IDX = 3; // 지원자 4

let diagnoseBodies: { error?: string }[];

beforeEach(() => {
  diagnoseBodies = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      const json = (x: unknown) => new Response(JSON.stringify(x));
      if (url === "/api/plan") {
        return json({
          steps: ["load", "extract", "match", "report"].map((id) => ({
            id,
            name: id,
            description: id,
          })),
        });
      }
      if (url === "/api/extract") {
        const idx = RESUMES.findIndex((r) => r.text === body.resumeText);
        if (idx === FAIL_IDX) return json({ ok: false, error: REAL_ERROR });
        return json({
          ok: true,
          profile: { name: `p${idx}`, email: null, experience_years: 3, skills: [], summary: "" },
        });
      }
      if (url === "/api/diagnose") {
        diagnoseBodies.push(body);
        return json({
          root_cause: "원인",
          explanation: "설명",
          proposed_prompt: "v2",
          risk_note: "주의",
          proposal_sig: "sig",
        });
      }
      throw new Error("예상 밖 요청: " + url);
    })
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("T5: 자동 진단 요청에 실제 추출 실패 오류가 전달된다 (폴백 문구 아님)", async () => {
  render(<Home />);
  fireEvent.click(screen.getByRole("button", { name: "워크플로우 생성" }));
  fireEvent.click(await screen.findByRole("button", { name: "실행" }));
  await screen.findByRole("button", { name: "수정안 승인하고 재실행" });

  expect(diagnoseBodies).toHaveLength(1);
  expect(diagnoseBodies[0].error).toBe(REAL_ERROR);
});

it("T5: '진단 다시 보기'도 같은 실제 오류를 전달한다", async () => {
  render(<Home />);
  fireEvent.click(screen.getByRole("button", { name: "워크플로우 생성" }));
  fireEvent.click(await screen.findByRole("button", { name: "실행" }));
  fireEvent.click(await screen.findByRole("button", { name: "반려 (원본 유지)" }));
  fireEvent.click(await screen.findByRole("button", { name: "진단 다시 보기" }));
  await waitFor(() => expect(diagnoseBodies).toHaveLength(2));
  expect(diagnoseBodies[1].error).toBe(REAL_ERROR);
});
