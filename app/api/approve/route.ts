import { NextResponse } from "next/server";
import { sign, verify } from "@/lib/approval";
import { guard } from "@/lib/guard";

// 사람이 승인 버튼을 눌렀을 때만 호출된다.
// AI 진단이 만든 수정안(proposal 서명 확인)에 한해 실행용 승인 토큰을 발급한다.
export async function POST(req: Request) {
  const blocked = guard(req);
  if (blocked) return blocked;
  let body: { proposed_prompt?: unknown; proposal_sig?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON 본문이 필요합니다" }, { status: 400 });
  }
  const { proposed_prompt, proposal_sig } = body ?? {};
  if (!verify("proposal", proposed_prompt, proposal_sig)) {
    return NextResponse.json(
      { error: "진단이 제안한 수정안이 아니므로 승인할 수 없습니다" },
      { status: 403 }
    );
  }
  return NextResponse.json({ approval_token: sign("approval", proposed_prompt as string) });
}
