import { describe, expect, it } from "vitest";
import { ProfileContract } from "@/lib/schema";

// 데이터 계약(ProfileContract)은 LLM 없이 결정적으로 판정된다
const base = {
  name: "최지우",
  email: "a@example.com",
  experience_years: 4,
  skills: ["React"],
  summary: "요약",
};

describe("ProfileContract", () => {
  it("정상 프로필을 통과시킨다", () => {
    expect(ProfileContract.safeParse(base).success).toBe(true);
  });

  it("email null은 허용한다", () => {
    expect(ProfileContract.safeParse({ ...base, email: null }).success).toBe(true);
  });

  it("experience_years null은 거부한다 (지원자 4의 결정적 실패 지점)", () => {
    const r = ProfileContract.safeParse({ ...base, experience_years: null });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toBe("experience_years는 숫자여야 합니다 (null 수신)");
  });

  it("음수 연차와 문자열 연차, 빈 이름을 거부한다", () => {
    expect(ProfileContract.safeParse({ ...base, experience_years: -1 }).success).toBe(false);
    expect(ProfileContract.safeParse({ ...base, experience_years: "4" }).success).toBe(false);
    expect(ProfileContract.safeParse({ ...base, name: "" }).success).toBe(false);
  });

  // B1: 오류 문구가 실제 값과 무관하게 "(null 수신)"으로 고정되던 문제
  const msg = (v: unknown) =>
    ProfileContract.safeParse({ ...base, experience_years: v }).error?.issues[0].message ?? "";

  it("음수 연차의 오류 문구는 null이 아니라 실제 값을 말한다", () => {
    expect(msg(-1)).not.toContain("null");
    expect(msg(-1)).toContain("-1");
  });

  it("문자열 연차의 오류 문구는 받은 타입과 값을 말한다", () => {
    expect(msg("4")).not.toContain("null");
    expect(msg("4")).toContain('"4"');
  });

  it("값이 아예 없으면 undefined로 보고한다", () => {
    const { experience_years: _, ...rest } = base;
    const m = ProfileContract.safeParse(rest).error?.issues[0].message ?? "";
    expect(m).toContain("undefined");
  });
});
