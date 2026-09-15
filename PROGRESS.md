# PROGRESS — RE:RUN (원티드 AI Championship 2026)

## 2026-09-15 (D-5, 제출 9/20 23:59 KST)

### 완료
- **0단계 병목 진단**: 통과 판정. OpenAI 키 보유(발급 대기 없음), 외부 실시간 의존 없음,
  참가자격 문제 없음(만19세+ 일반인). 리스크: 배포 링크가 심사기간(9/21~10/5) 내내
  생존해야 함 → Vercel(콜드스타트 없음)로 해결.
- **CONTRACT.md**: 코드 작성 전 성공 판정 기준표(A1~A8) + 제출 요건(S1~S7) 확정.
- **MVP 전체 구현** (Next.js + TS + OpenAI + zod):
  자연어→워크플로우 계획 / 추출(데이터 계약 검증) / 실패 감지 / AI 자가진단(diff 제안) /
  🔒 사람 승인 게이트(반려 시 원본 유지) / 재실행 복구 / 매칭 리포트 / 감사 로그 JSON export.
- **검증 실측** (모두 실제 LLM 호출):
  - API 레벨: 지원자4 결정적 실패 10/10, 진단→v2 복구, 전체 사이클 e2e
    → docs/evidence/first-full-cycle-2026-09-15.json
  - UI 레벨(Playwright): A1~A7 전부 통과, 전체 사이클 27초
    → docs/evidence/screens/01~07.png (라이브 실패 대비 백업 자료 겸용)
- **GitHub**: https://github.com/jang961111-hash/rerun-self-healing-workflow (public, main)
- **문서**: README, docs/demo-script.md(영상 대본), docs/submission-form.md(제출 텍스트 초안)

### 남음
- [ ] (Jay) 참가 신청 폼 제출 — **9/18 23:59 마감, 오늘 권장**
- [ ] (Jay) Vercel 배포 (GitHub import + OPENAI_API_KEY env 입력)
- [ ] (Claude) 배포 URL에서 A8 리허설 5연속 + 제출폼 초안에 링크 기입
- [ ] (Jay) 데모 영상 녹화 (대본: docs/demo-script.md) — 필수 여부는 미확인, 투표 20% 대비 권장
- [ ] (Jay, 선택) 실무자 인터뷰 1~2명 텍스트 → 발표자료 인용 반영 (원칙 6)
- [ ] (Jay) 제출 폼 작성 — docs/submission-form.md 복붙 + 링크 2개

### 6원칙 준수 상태
1 사이클만 구현 ✓ / HR 템플릿 1개 ✓ / 백업 자료 확보 ✓ / 승인 게이트 UI 명시 ✓ /
증빙(프롬프트 원문·타임스탬프 로그·기준표 대조) ✓ / 인터뷰는 Jay 입력 대기
