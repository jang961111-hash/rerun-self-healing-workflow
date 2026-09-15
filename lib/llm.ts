import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

// json_schema strict 모드로 JSON 응답을 강제한다.
export async function jsonCall<T>(
  system: string,
  user: string,
  schemaName: string,
  schema: Record<string, unknown>
): Promise<T> {
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
