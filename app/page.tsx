"use client";

import { useRef, useState } from "react";
import { JOB_POSTING, RESUMES, DEFAULT_TASK_NL } from "@/lib/data";
import { EXTRACT_PROMPT_V1 } from "@/lib/prompts";
import type {
  AuditEvent,
  CandidateProfile,
  Diagnosis,
  MatchRow,
  WorkflowStep,
} from "@/lib/types";

type Phase =
  | "define"
  | "planning"
  | "planned"
  | "running"
  | "diagnosing"
  | "awaiting_approval"
  | "rejected"
  | "rerunning"
  | "matching"
  | "done";

interface CandState {
  status: "pending" | "running" | "ok" | "failed" | "skipped";
  profile?: CandidateProfile;
  error?: string;
  promptVersion?: number;
}

export default function Home() {
  const [task, setTask] = useState(DEFAULT_TASK_NL);
  const [phase, setPhase] = useState<Phase>("define");
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [cands, setCands] = useState<CandState[]>(
    RESUMES.map(() => ({ status: "pending" }))
  );
  const [failedIdx, setFailedIdx] = useState<number | null>(null);
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [promptVersion, setPromptVersion] = useState(1);
  const [rows, setRows] = useState<MatchRow[] | null>(null);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [banner, setBanner] = useState<string | null>(null);
  const profilesRef = useRef<(CandidateProfile | null)[]>(
    RESUMES.map(() => null)
  );

  function log(type: string, actor: AuditEvent["actor"], detail: string) {
    setAudit((a) => [...a, { ts: new Date().toISOString(), type, actor, detail }]);
  }

  async function post<T>(url: string, body: unknown): Promise<T> {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return r.json();
  }

  async function generatePlan() {
    setPhase("planning");
    log("WORKFLOW_DEFINE_REQUESTED", "human", `자연어 업무 정의: "${task}"`);
    const out = await post<{ steps?: WorkflowStep[]; error?: string }>(
      "/api/plan",
      { task }
    );
    if (!out.steps) {
      setBanner(`워크플로우 생성 실패: ${out.error}`);
      setPhase("define");
      return;
    }
    setSteps(out.steps);
    log("WORKFLOW_PLANNED", "ai", `4단계 워크플로우 생성: ${out.steps.map((s) => s.name).join(" → ")}`);
    setPhase("planned");
  }

  async function extractOne(idx: number, prompt: string, version: number) {
    setCands((c) => c.map((x, i) => (i === idx ? { ...x, status: "running" } : x)));
    const out = await post<{
      ok: boolean;
      profile?: CandidateProfile;
      error?: string;
    }>("/api/extract", { resumeText: RESUMES[idx].text, prompt });
    if (out.ok && out.profile) {
      profilesRef.current[idx] = out.profile;
      setCands((c) =>
        c.map((x, i) =>
          i === idx
            ? { status: "ok", profile: out.profile, promptVersion: version }
            : x
        )
      );
      log("STEP_OK", "system", `${RESUMES[idx].label}(${out.profile.name}) 추출 성공 — 계약 검증 통과 (프롬프트 v${version})`);
      return true;
    }
    setCands((c) =>
      c.map((x, i) => (i === idx ? { status: "failed", error: out.error } : x))
    );
    log("STEP_FAILED", "system", `${RESUMES[idx].label} 추출 단계 실패 — ${out.error}`);
    return false;
  }

  async function runMatch() {
    setPhase("matching");
    log("MATCH_STARTED", "system", "매칭 단계 시작 — 채용공고 대조 평가");
    const out = await post<{ rows?: MatchRow[]; error?: string }>("/api/match", {
      jobPosting: JOB_POSTING,
      profiles: profilesRef.current.filter(Boolean),
    });
    if (!out.rows) {
      setBanner(`매칭 실패: ${out.error}`);
      return;
    }
    const sorted = [...out.rows].sort((a, b) => b.score - a.score);
    setRows(sorted);
    log("RUN_SUCCEEDED", "system", "전체 워크플로우 성공 — 스크리닝 리포트 생성 완료");
    setPhase("done");
  }

  async function runWorkflow() {
    setPhase("running");
    setBanner(null);
    log("RUN_STARTED", "system", "워크플로우 실행 시작 (추출 프롬프트 v1)");
    for (let i = 0; i < RESUMES.length; i++) {
      const ok = await extractOne(i, EXTRACT_PROMPT_V1, 1);
      if (!ok) {
        setFailedIdx(i);
        setCands((c) =>
          c.map((x, j) => (j > i ? { ...x, status: "skipped" } : x))
        );
        await diagnose(i);
        return;
      }
    }
    await runMatch();
  }

  async function diagnose(idx: number) {
    setPhase("diagnosing");
    log("DIAGNOSIS_STARTED", "ai", "AI 자가진단 시작 — 실패 지점의 프롬프트·입력·오류 분석");
    const out = await post<Diagnosis & { error?: string }>("/api/diagnose", {
      prompt: EXTRACT_PROMPT_V1,
      resumeText: RESUMES[idx].text,
      error: cands[idx]?.error ?? "출력 계약 검증 실패",
    });
    if (out.error) {
      setBanner(`진단 실패: ${out.error}`);
      return;
    }
    setDiagnosis(out);
    log("PATCH_PROPOSED", "ai", `수정안 제안 — ${out.root_cause} (적용은 사람 승인 대기)`);
    setPhase("awaiting_approval");
  }

  async function approve() {
    if (!diagnosis || failedIdx === null) return;
    log("PATCH_APPROVED", "human", "사람이 수정안을 검토하고 승인함 — 이 시점에만 패치가 적용됨");
    setPromptVersion(2);
    setPhase("rerunning");
    log("RERUN_STARTED", "system", "실패 단계 재실행 (추출 프롬프트 v2) — 성공한 단계 결과는 재사용");
    const ok = await extractOne(failedIdx, diagnosis.proposed_prompt, 2);
    if (!ok) {
      setBanner("재실행도 실패했습니다. 진단을 다시 시도하세요.");
      return;
    }
    // 뒤에 남은(스킵된) 후보 마저 처리
    for (let i = failedIdx + 1; i < RESUMES.length; i++) {
      const ok2 = await extractOne(i, diagnosis.proposed_prompt, 2);
      if (!ok2) {
        setBanner("후속 후보 처리 중 실패");
        return;
      }
    }
    await runMatch();
  }

  function reject() {
    log("PATCH_REJECTED", "human", "사람이 수정안을 반려함 — 워크플로우 설정은 원본(v1) 그대로 유지");
    setPhase("rejected");
  }

  function exportAudit() {
    const payload = {
      exported_at: new Date().toISOString(),
      workflow: { task, steps, prompt_version: promptVersion },
      events: audit,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `audit-log-${Date.now()}.json`;
    a.click();
    log("AUDIT_EXPORTED", "human", "감사 로그 JSON 내보내기");
  }

  const statusIcon = (s: CandState["status"]) =>
    s === "ok" ? "✓" : s === "failed" ? "✕" : s === "running" ? "…" : s === "skipped" ? "–" : "·";

  return (
    <main className="wrap">
      <header className="hero">
        <div className="badge">Wanted AI Championship 2026</div>
        <h1>
          RE:RUN <span className="thin">— 스스로 고치는 업무 자동화</span>
        </h1>
        <p className="sub">
          자연어로 정의한 반복업무가 실패하면, AI가 원인을 진단하고 수정안을{" "}
          <b>제안</b>합니다. 적용은 오직 <b>사람의 승인</b>으로만 이뤄집니다.
        </p>
      </header>

      {banner && <div className="banner">{banner}</div>}

      {/* 1. 업무 정의 */}
      <section className="card">
        <h2>
          <span className="num">1</span> 반복업무를 한 문장으로 정의
        </h2>
        <textarea
          value={task}
          onChange={(e) => setTask(e.target.value)}
          rows={2}
          disabled={phase !== "define"}
        />
        {phase === "define" && (
          <button className="primary" onClick={generatePlan}>
            워크플로우 생성
          </button>
        )}
        {phase === "planning" && <p className="dim">AI가 워크플로우를 설계하는 중…</p>}
      </section>

      {/* 2. 파이프라인 */}
      {steps.length > 0 && (
        <section className="card">
          <h2>
            <span className="num">2</span> 생성된 워크플로우
            <span className="chip">추출 프롬프트 v{promptVersion}</span>
          </h2>
          <div className="pipeline">
            {steps.map((s, i) => (
              <div key={s.id} className="step">
                <div className="stepName">{s.name}</div>
                <div className="stepDesc">{s.description}</div>
                {i < steps.length - 1 && <div className="arrow">→</div>}
              </div>
            ))}
          </div>
          {phase === "planned" && (
            <button className="primary" onClick={runWorkflow}>
              실행
            </button>
          )}
          {phase === "rejected" && (
            <p className="dim">
              수정안이 반려되어 원본 설정(v1)이 유지됩니다. 실패 원인이 해결되지
              않았으므로 재실행 시 같은 지점에서 다시 실패합니다.{" "}
              <button className="ghost" onClick={() => failedIdx !== null && diagnose(failedIdx)}>
                진단 다시 보기
              </button>
            </p>
          )}
        </section>
      )}

      {/* 3. 실행 현황 */}
      {(phase === "running" ||
        phase === "diagnosing" ||
        phase === "awaiting_approval" ||
        phase === "rejected" ||
        phase === "rerunning" ||
        phase === "matching" ||
        phase === "done") && (
        <section className="card">
          <h2>
            <span className="num">3</span> 실행 현황 — 이력서 추출 단계
          </h2>
          <div className="candGrid">
            {RESUMES.map((r, i) => {
              const c = cands[i];
              return (
                <div key={r.id} className={`cand ${c.status}`}>
                  <div className="candHead">
                    <span className={`dot ${c.status}`}>{statusIcon(c.status)}</span>
                    {r.label}
                    {c.promptVersion === 2 && <span className="chip v2">v2로 복구</span>}
                  </div>
                  {c.profile && (
                    <div className="candBody">
                      {c.profile.name} · 경력 {c.profile.experience_years}년 ·{" "}
                      {c.profile.skills.slice(0, 3).join(", ")}
                      {!c.profile.email && <span className="warn"> · 이메일 누락</span>}
                    </div>
                  )}
                  {c.status === "failed" && <div className="candErr">{c.error}</div>}
                  {c.status === "skipped" && <div className="dim">대기 (앞 단계 실패로 중단)</div>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 4. 진단 + 승인 게이트 */}
      {phase === "diagnosing" && (
        <section className="card ai">
          <h2>
            <span className="num">4</span> AI 자가진단 중…
          </h2>
          <p className="dim">실패한 단계의 설정·입력·오류를 분석하고 있습니다.</p>
        </section>
      )}
      {diagnosis && (phase === "awaiting_approval" || phase === "rejected") && (
        <section className="card ai">
          <h2>
            <span className="num">4</span> AI 자가진단 결과
          </h2>
          <div className="diagRow">
            <b>근본 원인</b>
            <p>{diagnosis.root_cause}</p>
          </div>
          <div className="diagRow">
            <b>설명</b>
            <p>{diagnosis.explanation}</p>
          </div>
          <div className="diffWrap">
            <div className="diff before">
              <div className="diffTitle">현재 설정 (v1)</div>
              <pre>{EXTRACT_PROMPT_V1}</pre>
            </div>
            <div className="diff after">
              <div className="diffTitle">AI 제안 수정안 (v2)</div>
              <pre>{diagnosis.proposed_prompt}</pre>
            </div>
          </div>
          <div className="diagRow">
            <b>부작용 주의</b>
            <p>{diagnosis.risk_note}</p>
          </div>
          {phase === "awaiting_approval" && (
            <div className="gate">
              <div className="gateLabel">
                🔒 사람 승인 게이트 — AI는 여기서 멈춰 있습니다. 승인 전에는 어떤
                수정도 적용되지 않습니다.
              </div>
              <div className="gateBtns">
                <button className="approve" onClick={approve}>
                  수정안 승인하고 재실행
                </button>
                <button className="rejectBtn" onClick={reject}>
                  반려 (원본 유지)
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 5. 리포트 */}
      {rows && (
        <section className="card">
          <h2>
            <span className="num">5</span> 스크리닝 리포트
          </h2>
          <table>
            <thead>
              <tr>
                <th>순위</th>
                <th>이름</th>
                <th>적합도</th>
                <th>판정</th>
                <th>근거</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.name}>
                  <td>{i + 1}</td>
                  <td>{r.name}</td>
                  <td>
                    <b>{r.score}</b>
                  </td>
                  <td>
                    <span className={`verdict v-${r.verdict}`}>{r.verdict}</span>
                  </td>
                  <td className="reasons">
                    {r.reasons.map((x, j) => (
                      <div key={j}>· {x}</div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* 6. 감사 로그 */}
      {audit.length > 0 && (
        <section className="card">
          <h2>
            <span className="num">6</span> 감사 로그
            <button className="ghost" onClick={exportAudit}>
              JSON 내보내기
            </button>
          </h2>
          <div className="audit">
            {audit.map((e, i) => (
              <div key={i} className={`evt actor-${e.actor}`}>
                <span className="ts">{e.ts.slice(11, 19)}</span>
                <span className={`actor ${e.actor}`}>
                  {e.actor === "human" ? "사람" : e.actor === "ai" ? "AI" : "시스템"}
                </span>
                <span className="etype">{e.type}</span>
                <span className="edetail">{e.detail}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <footer className="foot">
        데모 데이터는 전원 가명 처리된 목업입니다 · AI 도구: OpenAI GPT (실행) ·
        Claude Code (개발)
      </footer>
    </main>
  );
}
