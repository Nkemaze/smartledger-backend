import { env } from "@config/env";

type LlmMessage = { role: "user" | "assistant"; content: string };

const GEMINI_DEFAULT_MODEL = "gemini-2.0-flash";
const ANTHROPIC_DEFAULT_MODEL = "claude-sonnet-4-5";

/**
 * Thin, provider-agnostic LLM client used by the advisor chat.
 *
 * - `LLM_PROVIDER=gemini`   -> Google Gemini REST API (free tier, no SDK needed)
 * - `LLM_PROVIDER=anthropic` -> Anthropic Messages API (default)
 *
 * The model can be overridden with LLM_MODEL; otherwise a sensible per-provider
 * default is used. Any non-2xx response throws so the caller can fall back.
 */
export async function generateReply(system: string, messages: LlmMessage[]): Promise<string> {
  if (env.llm.provider === "gemini") {
    return geminiReply(system, messages);
  }
  return anthropicReply(system, messages);
}

async function anthropicReply(system: string, messages: LlmMessage[]): Promise<string> {
  const { Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: env.llm.apiKey });

  const response = await client.messages.create({
    model: env.llm.model || ANTHROPIC_DEFAULT_MODEL,
    max_tokens: 1024,
    system,
    messages,
  });

  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

async function geminiReply(system: string, messages: LlmMessage[]): Promise<string> {
  const model = env.llm.model || GEMINI_DEFAULT_MODEL;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": env.llm.apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: messages.map((m) => ({
            role: m.role === "user" ? "user" : "model",
            parts: [{ text: m.content }],
          })),
          generationConfig: { maxOutputTokens: 1024 },
        }),
        signal: controller.signal,
      }
    );

    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 300);
      throw new Error(`Gemini request failed (${res.status}): ${detail}`);
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };

    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join("\n")
      .trim();

    return text || "I could not generate an answer right now. Please try again.";
  } finally {
    clearTimeout(timer);
  }
}
