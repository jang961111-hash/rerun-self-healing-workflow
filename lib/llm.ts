import OpenAI from "openai";

// 첫 호출 때 만든다 — 모듈 로드 시점에 만들면 키 없는 환경(next build, CI)에서
// import만으로 예외가 나 빌드가 실패한다
let client: OpenAI | null = null;
const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

// json_schema strict 모드로 JSON 응답을 강제한다.
export async function jsonCall<T>(
  system: string,
  user: string,
  schemaName: string,
  schema: Record<string, unknown>
): Promise<T> {
  client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const res = await client.chat.completions.create({
    model: MODEL,
    temperature: 0,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: schemaName, strict: true, schema },
    },
  });
  const content = res.choices[0]?.message?.content;
  if (!content) throw new Error("LLM 응답이 비어 있습니다");
  return JSON.parse(content) as T;
}
