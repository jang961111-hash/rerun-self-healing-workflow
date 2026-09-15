// 가명 처리된 목업 데이터 — 실존 인물·기업과 무관
export const JOB_POSTING = `[채용공고] 프론트엔드 개발자 (경력)

회사: (주)클라우드너리 — B2B SaaS 스타트업
포지션: Frontend Engineer

주요 업무
- React/TypeScript 기반 웹 서비스 개발
- 디자인 시스템 구축 및 운영

자격 요건 (필수)
- 경력 3년 이상
- React, TypeScript 실무 경험

우대 사항
- Next.js 프로덕션 운영 경험
- 테스트 자동화(Jest, Playwright 등) 경험
- 스타트업 근무 경험`;

export interface ResumeDoc {
  id: number;
  label: string;
  text: string;
}

export const RESUMES: ResumeDoc[] = [
  {
    id: 1,
    label: "지원자 1",
    text: `이름: 김하늘
이메일: haneul.kim@example.com
경력 5년

[경력]
- (주)테크브릿지 프론트엔드 개발자 (2021.03 ~ 현재)
  React + TypeScript 기반 커머스 어드민 개발, Next.js 전환 리드

[기술]
React, TypeScript, Next.js, React Query, Jest

[자기소개]
디자인 시스템을 0부터 구축해 4개 제품에 적용했습니다.`,
  },
  {
    id: 2,
    label: "지원자 2",
    text: `이름: 이도윤
이메일: doyoon.lee@example.com
경력 2년

[경력]
- (주)모비딕랩 웹 개발자 (2024.06 ~ 현재)
  Vue 3 기반 사내 대시보드 개발

[기술]
Vue, JavaScript, Pinia

[자기소개]
빠른 실행력이 강점입니다. React는 사이드 프로젝트로 학습 중입니다.`,
  },
  {
    id: 3,
    label: "지원자 3",
    text: `이름: 박서연
이메일: seoyeon.park@example.com
경력 4년

[경력]
- (주)핀레버 프론트엔드 개발자 (2022.09 ~ 현재)
  React/TypeScript 금융 대시보드 개발, Playwright E2E 테스트 도입

[기술]
React, TypeScript, Playwright, Storybook

[자기소개]
테스트 커버리지 20%→85% 개선을 주도했습니다.`,
  },
  {
    id: 4,
    label: "지원자 4",
    text: `이름: 최지우
연락처: 010-0000-0000 (이메일 기재 없음)

[재직 이력]
- 스타트업 '누리컴퍼니' 프런트 담당
  재직 기간: 이천이십이년 삼월부터 지금까지 근무 중
  리액트와 타입스크립트로 예약 서비스 웹을 처음부터 만들었습니다.
  넥스트제이에스로 마이그레이션도 직접 했습니다.

[기술]
React, TypeScript, Next.js

[자기소개]
이력서 양식이 낯설어 자유 서식으로 제출합니다. 제품을 처음부터 끝까지
만들어 배포해 본 경험이 가장 큰 자산입니다.`,
  },
  {
    id: 5,
    label: "지원자 5",
    text: `이름: 정민준
이메일: minjun.jung@example.com
경력 7년

[경력]
- (주)데이터포지 백엔드 개발자 (2019.05 ~ 현재)
  Spring Boot 기반 API 서버 개발, 관리자 화면은 jQuery로 유지보수

[기술]
Java, Spring, MySQL, jQuery

[자기소개]
백엔드가 주력이며 프론트엔드 전환을 희망합니다.`,
  },
];

export const DEFAULT_TASK_NL =
  "지원자 이력서 5건을 채용공고와 대조해서, 자격요건 충족 여부를 확인하고 적합도 순위와 사유를 정리한 스크리닝 리포트를 만들어줘.";
