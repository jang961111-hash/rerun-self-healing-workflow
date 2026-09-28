import { NextResponse } from "next/server";
import { sign, verify } from "@/lib/approval";

// 사람이 승인 버튼을 눌렀을 때만 호출된다.
// AI 진단이 만든 수정안(proposal 서명 확인)에 한해 실행용 승인 토큰을 발급한다.
export async function POST(req: Request) {
  const { proposed_prompt, proposal_sig } = await req.json();
  if (!verify("proposal", proposed_prompt, proposal_sig)) {
    return NextResponse.json(
      { error: "진단이 제안한 수정안이 아니므로 승인할 수 없습니다" },
      { status: 403 }
    );
  }
  return NextResponse.json({ approval_token: sign("approval", proposed_prompt) });
}
