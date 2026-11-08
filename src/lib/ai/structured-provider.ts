import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";
import { AIConfigurationError } from "./diagnostics";
import type { BreakdownRequest } from "./breakdown";

export function providerIdentity(env: Record<string, string | undefined> = process.env) {
  return env.GROQ_API_KEY
    ? { provider: "groq", model: env.GROQ_MODEL || "openai/gpt-oss-20b", configured: true }
    : { provider: "openai", model: env.OPENAI_MODEL || "", configured: !!env.OPENAI_API_KEY && !!env.OPENAI_MODEL };
}

export function createStructuredGenerator(schema: z.ZodType, name: string, prompt: string,
  env: Record<string, string | undefined> = process.env, fetcher?: typeof fetch,
): (source: BreakdownRequest) => Promise<{ status?: string; output_parsed: unknown; refused?: boolean }> {
  return async (source) => {
    const groqKey = env.GROQ_API_KEY;
    const apiKey = groqKey || env.OPENAI_API_KEY;
    const model = groqKey
      ? env.GROQ_MODEL || "openai/gpt-oss-20b"
      : env.OPENAI_MODEL;
    if (!apiKey || !model) throw new AIConfigurationError("AI is not configured");
    const client = new OpenAI({
      apiKey,
      ...(groqKey ? { baseURL: "https://api.groq.com/openai/v1" } : {}),
      timeout: 20000,
      maxRetries: 0,
      ...(fetcher ? { fetch: fetcher } : {}),
    });
    const request = () => client.responses.parse({
      model,
      ...(!groqKey ? { store: false } : {}),
      input: [
        { role: "system", content: prompt },
        { role: "user", content: JSON.stringify(source) },
      ],
      text: { format: zodTextFormat(schema, name) },
    });
    // One extra attempt only for Groq's intermittent schema-generation rejection.
    // SDK retries stay disabled. A second failure escapes to the safe fallback;
    // this catch does not wrap the second request or retry other error classes.
    const response = await request().catch((error: unknown) => {
      if (groqKey && error instanceof OpenAI.APIError
        && error.status === 400 && error.code === "json_validate_failed") {
        return request();
      }
      throw error;
    });
    return {
      status: response.status,
      output_parsed: response.output_parsed,
      refused: response.output.some((item) => item.type === "message"
        && item.content.some((content) => content.type === "refusal")),
    };
  };
}
