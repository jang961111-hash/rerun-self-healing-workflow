import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

// next build는 라우트 모듈을 평가한다. 키 없는 환경(CI)에서 import만으로
// 예외가 나면 빌드 전체가 실패한다.
it("OPENAI_API_KEY 없이도 lib/llm을 import할 수 있다 (빌드·CI 환경)", async () => {
  vi.stubEnv("OPENAI_API_KEY", "");
  await expect(import("@/lib/llm")).resolves.toHaveProperty("jsonCall");
});
