// 无 OPENAI_API_KEY 或调用失败时返回 null——调用方（searchSemantic）负责退化。

import OpenAI from "openai";

export async function embedText(text: string): Promise<number[] | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const client = new OpenAI({ baseURL: process.env.OPENAI_BASE_URL });
    const resp = await client.embeddings.create({ model: "text-embedding-3-small", input: text });
    return resp.data[0]?.embedding ?? null;
  } catch (err) {
    console.error("[embeddings] failed, semantic search will degrade to keyword:", (err as Error).message);
    return null;
  }
}
