import OpenAI from "openai";
import { ZodError } from "zod";

// Only these fixed codes may reach the opt-in checker. No error messages,
// request IDs, headers, bodies, prompts, model text, or credentials are returned.
export type DiagnosticCode = "not_configured" | "timeout" | "network"
  | "authentication" | "rate_limited" | "provider_error" | "invalid_json"
  | "invalid_output" | "unknown_error" | "refused" | "incomplete"
  | "provider_http_400" | "provider_http_400_schema_rejected"
  | "provider_http_404" | "provider_http_422" | "provider_http_500"
  | "provider_http_502" | "provider_http_503"
  | "manual_input" | "review_only" | "truncated" | "success" | "cache_hit";

export class AIConfigurationError extends Error {}

export function classifyFailure(error: unknown): DiagnosticCode {
  if (error instanceof AIConfigurationError) return "not_configured";
  if (error instanceof OpenAI.APIConnectionTimeoutError) return "timeout";
  if (error instanceof OpenAI.APIConnectionError) return "network";
  if (error instanceof OpenAI.APIError) {
    if (error.status === 401 || error.status === 403) return "authentication";
    if (error.status === 429) return "rate_limited";
    if (error.status === 408 || error.status === 504) return "timeout";
    // Compare a known code; never copy arbitrary provider-controlled strings.
    if (error.status === 400) return error.code === "json_validate_failed"
      ? "provider_http_400_schema_rejected" : "provider_http_400";
    if (error.status === 404) return "provider_http_404";
    if (error.status === 422) return "provider_http_422";
    if (error.status === 500) return "provider_http_500";
    if (error.status === 502) return "provider_http_502";
    if (error.status === 503) return "provider_http_503";
    return "provider_error";
  }
  if (error instanceof SyntaxError) return "invalid_json";
  if (error instanceof ZodError) return "invalid_output";
  return "unknown_error";
}
