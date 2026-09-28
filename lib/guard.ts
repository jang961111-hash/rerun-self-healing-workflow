import { NextResponse } from "next/server";

// LLM 엔드포인트 최소 보호 (계정·DB 없는 데모용)
// 1) 출처 확인: 데모 화면(같은 출처)에서 온 요청만 받는다. 스크립트 호출은
//    RERUN_API_TOKEN을 설정하고 x-rerun-token 헤더로 보낼 때만 허용한다.
// 2) 속도 제한: 클라이언트당 분당 RERUN_RATE_LIMIT_PER_MIN회(기본 30, 0 = 제한 끔).
//    메모리 기반이라 서버리스 인스턴스마다 따로 센다 — 비용 폭주를 늦추는 안전장치이지 인증이 아니다.
//    클라이언트 구분: RERUN_TRUST_PROXY=1일 때만 X-Forwarded-For의 맨 오른쪽 값(신뢰 프록시가
//    붙인 값)을 쓴다. 설정이 없으면 헤더를 믿지 않고 인스턴스 전체를 한 버킷으로 센다.
const WINDOW_MS = 60_000;
const DEFAULT_LIMIT = 30;
const hits = new Map<string, { start: number; count: number }>();

function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const host =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function clientKey(req: Request): string {
  const trust = process.env.RERUN_TRUST_PROXY;
  if (trust !== "1" && trust !== "true") return "global";
  // 맨 왼쪽 값은 클라이언트가 마음대로 넣을 수 있다. 맨 오른쪽은 신뢰 프록시가 붙인 값이다.
  const xff = req.headers.get("x-forwarded-for")?.split(",").map((v) => v.trim()).filter(Boolean);
  return xff?.at(-1) || req.headers.get("x-real-ip") || "global";
}

function rateLimit(): number {
  const raw = process.env.RERUN_RATE_LIMIT_PER_MIN;
  if (raw === undefined || raw.trim() === "") return DEFAULT_LIMIT;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : DEFAULT_LIMIT;
}

function rateLimited(ip: string, now: number): number | null {
  const limit = rateLimit();
  if (limit === 0) return null; // 0 = 제한 끔 (로컬 개발용)
  if (hits.size > 10_000) {
    for (const [k, v] of hits) if (now - v.start >= WINDOW_MS) hits.delete(k);
  }
  const h = hits.get(ip);
  if (!h || now - h.start >= WINDOW_MS) {
    hits.set(ip, { start: now, count: 1 });
    return null;
  }
  if (h.count >= limit) return Math.ceil((h.start + WINDOW_MS - now) / 1000);
  h.count++;
  return null;
}

// 통과하면 null, 막으면 그대로 돌려줄 응답
export function guard(req: Request): NextResponse | null {
  const token = process.env.RERUN_API_TOKEN;
  const hasToken = !!token && req.headers.get("x-rerun-token") === token;
  if (!hasToken && !sameOrigin(req)) {
    return NextResponse.json(
      { ok: false, error: "허용되지 않은 출처의 요청입니다" },
      { status: 403 }
    );
  }
  const retryAfter = rateLimited(clientKey(req), Date.now());
  if (retryAfter !== null) {
    return NextResponse.json(
      { ok: false, error: `요청이 너무 많습니다. ${retryAfter}초 뒤 다시 시도하세요` },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }
  return null;
}
