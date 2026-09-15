import { chromium } from "playwright";
const shot = (page, n) => page.screenshot({ path: `docs/evidence/screens/${n}.png`, fullPage: true });
const t0 = Date.now();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto("http://localhost:3210");
await shot(page, "01-landing");

// 1. 워크플로우 생성 (A1)
await page.getByRole("button", { name: "워크플로우 생성" }).click();
await page.getByRole("button", { name: "실행" }).waitFor({ timeout: 60000 });
await shot(page, "02-pipeline");
console.log("A1 ✓ 자연어→워크플로우 생성");

// 2. 실행 → 지원자4 실패 (A2)
await page.getByRole("button", { name: "실행" }).click();
await page.locator(".cand.failed").waitFor({ timeout: 120000 });
const errText = await page.locator(".candErr").textContent();
if (!errText.includes("출력 계약 검증 실패")) throw new Error("예상 실패 아님: " + errText);
console.log("A2 ✓ 결정적 실패 발생:", errText.slice(0, 60));

// 3. 진단 → 승인 게이트 노출 (A3)
await page.locator(".gate").waitFor({ timeout: 120000 });
await shot(page, "03-failure-and-diagnosis");
const diff = await page.locator(".diff.after pre").textContent();
console.log("A3 ✓ 진단+수정안 diff 표시 (v2 프롬프트 " + diff.length + "자)");

// 4. 반려 → 원본 유지 확인 (A4 핵심)
await page.getByRole("button", { name: "반려 (원본 유지)" }).click();
await page.getByText("원본 설정(v1)이 유지됩니다", { exact: false }).waitFor({ timeout: 5000 });
const v1chip = await page.locator(".chip", { hasText: "v1" }).count();
if (v1chip < 1) throw new Error("반려 후에도 v1 칩이 없음");
await shot(page, "04-rejected-original-kept");
console.log("A4 ✓ 반려 시 원본(v1) 유지 확인");

// 5. 진단 다시 보기 → 승인 → 복구 → 리포트 (A5)
await page.getByRole("button", { name: "진단 다시 보기" }).click();
await page.locator(".gate").waitFor({ timeout: 120000 });
await shot(page, "05-approval-gate");
await page.getByRole("button", { name: "수정안 승인하고 재실행" }).click();
await page.locator("table").waitFor({ timeout: 180000 });
await shot(page, "06-report");
const report = await page.locator("table").textContent();
if (!report.includes("최지우")) throw new Error("최지우가 리포트에 없음");
const v2chip = await page.locator(".chip.v2").count();
console.log(`A5 ✓ 승인→재실행→리포트 (v2 복구 칩 ${v2chip}개, 최지우 랭크인)`);

// 6. 감사 로그 (A6)
const audit = await page.locator(".audit").textContent();
for (const k of ["STEP_FAILED", "PATCH_PROPOSED", "PATCH_REJECTED", "PATCH_APPROVED", "RUN_SUCCEEDED"])
  if (!audit.includes(k)) throw new Error("감사 로그 누락: " + k);
await page.locator(".audit").scrollIntoViewIfNeeded();
await shot(page, "07-audit-log");
console.log("A6 ✓ 감사 로그에 실패→제안→반려→승인→성공 전 이벤트 존재");

const sec = ((Date.now() - t0) / 1000).toFixed(0);
console.log(`A7 ${sec <= 240 ? "✓" : "✗"} 전체 사이클 ${sec}초 (반려 우회 포함, 목표 240초)`);
await browser.close();
