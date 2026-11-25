import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/llm", () => ({ jsonCall: vi.fn() }));

import { jsonCall } from "@/lib/llm";
import { EXTRACT_PROMPT_V1 } from "@/lib/prompts";
import { POST as plan } from "@/app/api/plan/route";
import { POST as extract } from "@/app/api/extract/route";
import { POST as diagnose } from "@/app/api/diagnose/route";
import { POST as match } from "@/app/api/match/route";

const mockJsonCall = vi.mocked(jsonCall);

let ipSeq = 0;
function req(headers: Record<string, string>, body: unknown = { task: "t" }) {
  return new Request("http://demo.local/api/x", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      host: "demo.local",
      "x-forwarded-for": `10.0.0.${++ipSeq}`, // 테스트마다 다른 IP → 한도 간섭 없음
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  // 기존 케이스는 요청마다 다른 IP로 격리한다 → XFF를 믿는 설정에서 돌린다
  vi.stubEnv("RERUN_TRUST_PROXY", "1");
  mockJsonCall.mockReset();
  mockJsonCall.mockResolvedValue({ steps: [] });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("T7 LLM 엔드포인트 보호", () => {
  const routes = [
    ["plan", plan, { task: "t" }],
    ["extract", extract, { resumeText: "r", prompt: EXTRACT_PROMPT_V1 }],
    ["diagnose", diagnose, { prompt: "p", resumeText: "r", error: "e" }],
    ["match", match, { jobPosting: "j", profiles: [] }],
  ] as const;

  it.each(routes)("%s: Origin 없는 요청(curl 등)은 LLM 호출 전에 403", async (_, route, body) => {
    const res = await route(req({}, body));
    expect(res.status).toBe(403);
    expect(mockJsonCall).not.toHaveBeenCalled();
  });

  it.each(routes)("%s: 다른 출처 Origin은 403", async (_, route, body) => {
    const res = await route(req({ origin: "https://evil.example" }, body));
    expect(res.status).toBe(403);
    expect(mockJsonCall).not.toHaveBeenCalled();
  });

  it("같은 출처(데모 화면에서 보낸 요청)는 통과", async () => {
    const res = await plan(req({ origin: "http://demo.local" }));
    expect(res.status).toBe(200);
    expect(mockJsonCall).toHaveBeenCalledTimes(1);
  });

  it("공유 토큰이 설정되면 토큰이 맞는 스크립트 호출도 통과, 틀리면 403", async () => {
    vi.stubEnv("RERUN_API_TOKEN", "s3cret");
    expect((await plan(req({ "x-rerun-token": "s3cret" }))).status).toBe(200);
    expect((await plan(req({ "x-rerun-token": "wrong" }))).status).toBe(403);
  });

  it("같은 IP가 분당 한도를 넘으면 429 + Retry-After, 다른 IP는 영향 없음", async () => {
    vi.stubEnv("RERUN_RATE_LIMIT_PER_MIN", "3");
    const same = { origin: "http://demo.local", "x-forwarded-for": "203.0.113.7" };
    const codes = [];
    for (let i = 0; i < 4; i++) codes.push((await plan(req(same))).status);
    expect(codes).toEqual([200, 200, 200, 429]);

    const limited = await plan(req(same));
    expect(limited.headers.get("Retry-After")).toMatch(/^\d+$/);
    expect(mockJsonCall).toHaveBeenCalledTimes(3);

    const other = await plan(req({ origin: "http://demo.local", "x-forwarded-for": "203.0.113.8" }));
    expect(other.status).toBe(200);
  });
});

describe("MED-2 X-Forwarded-For 위조로 속도 제한 우회", () => {
  // 매 테스트 새 모듈 → 속도 제한 카운터가 비어 있는 상태
  async function freshGuard() {
    vi.resetModules();
    return (await import("@/lib/guard")).guard;
  }
  const hit = (guard: (r: Request) => Response | null, xff: string) =>
    guard(req({ origin: "http://demo.local", "x-forwarded-for": xff }))?.status ?? 200;

  it("RERUN_TRUST_PROXY가 없으면 XFF를 믿지 않는다 — 매번 다른 XFF를 보내도 같은 한도", async () => {
    vi.stubEnv("RERUN_TRUST_PROXY", "");
    vi.stubEnv("RERUN_RATE_LIMIT_PER_MIN", "3");
    const guard = await freshGuard();
    const codes = ["1.1.1.1", "2.2.2.2", "3.3.3.3", "4.4.4.4"].map((ip) => hit(guard, ip));
    expect(codes).toEqual([200, 200, 200, 429]);
  });

  it("RERUN_TRUST_PROXY=1이면 프록시가 덧붙인 맨 오른쪽 값을 쓴다 — 왼쪽 위조는 무시", async () => {
    vi.stubEnv("RERUN_TRUST_PROXY", "1");
    vi.stubEnv("RERUN_RATE_LIMIT_PER_MIN", "3");
    const guard = await freshGuard();
    const codes = ["1.1.1.1", "2.2.2.2", "3.3.3.3", "4.4.4.4"].map((spoof) =>
      hit(guard, `${spoof}, 203.0.113.7`)
    );
    expect(codes).toEqual([200, 200, 200, 429]);
    expect(hit(guard, "9.9.9.9, 203.0.113.8")).toBe(200); // 실제로 다른 클라이언트
  });

  it("RERUN_RATE_LIMIT_PER_MIN=0은 제한 끔", async () => {
    vi.stubEnv("RERUN_RATE_LIMIT_PER_MIN", "0");
    const guard = await freshGuard();
    const codes = Array.from({ length: 40 }, () => hit(guard, "203.0.113.9"));
    expect(codes.every((c) => c === 200)).toBe(true);
  });

  it("숫자가 아닌 값·음수는 기본값 30", async () => {
    vi.stubEnv("RERUN_RATE_LIMIT_PER_MIN", "abc");
    const guard = await freshGuard();
    const codes = Array.from({ length: 31 }, () => hit(guard, "203.0.113.10"));
    expect(codes.filter((c) => c === 200)).toHaveLength(30);
    expect(codes[30]).toBe(429);
  });
});
