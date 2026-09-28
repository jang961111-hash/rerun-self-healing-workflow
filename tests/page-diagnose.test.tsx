// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Home from "@/app/page";
import { RESUMES } from "@/lib/data";

// 네트워크(fetch)를 가짜로 바꿔 OpenAI·서버 없이 UI 흐름만 돌린다
const REAL_ERROR =
  "출력 계약 검증 실패 — experience_years: experience_years는 숫자여야 합니다 (null 수신)";
const FAIL_IDX = 3; // 지원자 4

let extractBodies: { resumeText?: string; prompt?: string; approvalToken?: string }[];
let approveBodies: { proposed_prompt?: string; proposal_sig?: string }[];
let planResponse: () => Response;
let diagnoseBodies: { error?: string; errorSig?: string; resumeId?: number }[];

beforeEach(() => {
  diagnoseBodies = [];
  extractBodies = [];
  approveBodies = [];
  planResponse = () =>
    new Response(
      JSON.stringify({
        steps: ["load", "extract", "match", "report"].map((id) => ({ id, name: id, description: id })),
      })
    );
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      const json = (x: unknown) => new Response(JSON.stringify(x));
      if (url === "/api/plan") return planResponse();
      if (url === "/api/extract") {
        extractBodies.push(body);
        const idx = RESUMES.findIndex((r) => r.text === body.resumeText);
        if (idx === FAIL_IDX && body.prompt !== "v2") return json({ ok: false, error: REAL_ERROR, error_sig: "esig" });
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
      if (url === "/api/approve") {
        approveBodies.push(body);
        return json({ approval_token: "tok" });
      }
      if (url === "/api/match") {
        return json({
          rows: [{ name: "최지우", score: 70, verdict: "적합", reasons: ["r"] }],
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
  // MED-1: 원문 대신 이력서 id와 서버 서명을 보낸다
  expect(diagnoseBodies[0].resumeId).toBe(RESUMES[FAIL_IDX].id);
  expect(diagnoseBodies[0].errorSig).toBe("esig");
});

it("T5: '진단 다시 보기'도 같은 실제 오류를 전달한다", async () => {
  render(<Home />);
  fireEvent.click(screen.getByRole("button", { name: "워크플로우 생성" }));
  fireEvent.click(await screen.findByRole("button", { name: "실행" }));
  fireEvent.click(await screen.findByRole("button", { name: "반려 (원본 유지)" }));
  fireEvent.click(await screen.findByRole("button", { name: "진단 다시 보기" }));
  await waitFor(() => expect(diagnoseBodies).toHaveLength(2));
  expect(diagnoseBodies[1].error).toBe(REAL_ERROR);
  expect(diagnoseBodies[1].errorSig).toBe("esig");
});

it("승인 버튼: 서버 승인 토큰을 받아 v2 재실행 요청에 싣는다", async () => {
  render(<Home />);
  fireEvent.click(screen.getByRole("button", { name: "워크플로우 생성" }));
  fireEvent.click(await screen.findByRole("button", { name: "실행" }));
  fireEvent.click(await screen.findByRole("button", { name: "수정안 승인하고 재실행" }));
  await screen.findByRole("table");

  expect(approveBodies).toEqual([{ proposed_prompt: "v2", proposal_sig: "sig" }]);
  const v2 = extractBodies.filter((b) => b.prompt === "v2");
  expect(v2).toHaveLength(RESUMES.length - FAIL_IDX); // 실패 지점부터 끝까지 재실행
  expect(v2.every((b) => b.approvalToken === "tok")).toBe(true);
  // v1 실행에는 토큰이 없다
  expect(extractBodies.filter((b) => b.prompt !== "v2").every((b) => !b.approvalToken)).toBe(true);
});

it("서버가 JSON이 아닌 오류(502 등)를 돌려줘도 UI가 멈추지 않고 배너로 알린다", async () => {
  planResponse = () => new Response("<html>Bad Gateway</html>", { status: 502 });
  render(<Home />);
  fireEvent.click(screen.getByRole("button", { name: "워크플로우 생성" }));
  expect(await screen.findByText(/워크플로우 생성 실패: HTTP 502/)).toBeTruthy();
  // 정의 단계로 돌아와 다시 시도할 수 있다
  expect(screen.getByRole("button", { name: "워크플로우 생성" })).toBeTruthy();
});
