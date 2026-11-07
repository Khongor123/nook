import assert from "node:assert/strict";
import { test } from "node:test";
import OpenAI from "openai";
import { createBreakDown } from "./breakdown";
import { AIConfigurationError, classifyFailure } from "./diagnostics";
import type { DiagnosticCode } from "./diagnostics";
import { exampleAssignment, exampleDraft } from "../planning/demo-example";

test("diagnostics classify safe categories without copying exception messages or response bodies", () => {
  // Synthetic marker only, never a credential or real coursework.
  const marker = "fictional-sensitive-marker";
  const cases: [unknown, DiagnosticCode][] = [
    [new AIConfigurationError(marker), "not_configured"],
    [new OpenAI.APIConnectionTimeoutError(), "timeout"],
    [new OpenAI.APIConnectionError({ message: marker }), "network"],
    [OpenAI.APIError.generate(401, { message: marker }, marker, new Headers()), "authentication"],
    [OpenAI.APIError.generate(429, { message: marker }, marker, new Headers()), "rate_limited"],
    [OpenAI.APIError.generate(503, { message: marker }, marker, new Headers()), "provider_http_503"],
    [new SyntaxError(marker), "invalid_json"],
    [{ message: marker, status: 429 }, "unknown_error"],
  ];
  for (const [error, expected] of cases) {
    assert.equal(classifyFailure(error), expected);
    assert.ok(!JSON.stringify(classifyFailure(error)).includes(marker));
  }
});

test("HTTP categories distinguish request rejection from provider outage and allowlist schema errors", () => {
  for (const [status, expected] of [
    [400, "provider_http_400"], [404, "provider_http_404"], [422, "provider_http_422"],
    [500, "provider_http_500"], [502, "provider_http_502"], [503, "provider_http_503"],
    [418, "provider_error"],
  ] as const) {
    const error = OpenAI.APIError.generate(status, { error: { message: "fictional-private-body", code: "untrusted-code" } }, undefined, new Headers());
    assert.equal(classifyFailure(error), expected);
  }
  const schemaError = OpenAI.APIError.generate(400, { error: { code: "json_validate_failed", message: "fictional-output" } }, undefined, new Headers());
  assert.equal(classifyFailure(schemaError), "provider_http_400_schema_rejected");
});

test("fallback preserves reason categories, supports an explicit retry, and does not log raw errors", async () => {
  const codes: DiagnosticCode[] = [];
  let calls = 0;
  const run = createBreakDown(async () => {
    if (++calls === 1) throw OpenAI.APIError.generate(429, { message: "fictional-private-body" }, undefined, new Headers());
    return { status: "completed", output_parsed: exampleDraft };
  }, (code) => codes.push(code));
  assert.equal((await run(exampleAssignment)).steps.length, 0);
  assert.ok((await run(exampleAssignment)).steps.length > 0);
  assert.deepEqual(codes, ["rate_limited", "success"]);
  assert.equal(calls, 2);
});

test("refusal, incomplete, validation failure and a broken observer keep the public contract", async () => {
  for (const [response, expected] of [
    [{ status: "completed", output_parsed: exampleDraft, refused: true }, "refused"],
    [{ status: "incomplete", output_parsed: exampleDraft }, "incomplete"],
    [{ status: "completed", output_parsed: { unexpected: "fictional" } }, "invalid_output"],
  ] as const) {
    const codes: DiagnosticCode[] = [];
    const result = await createBreakDown(async () => response, (code) => codes.push(code))(exampleAssignment);
    assert.deepEqual(result, { steps: [], needsReview: true, note: "Make a manual plan" });
    assert.deepEqual(codes, [expected]);
  }
  const result = await createBreakDown(async () => ({ status: "completed", output_parsed: exampleDraft }),
    () => { throw new Error("observer error"); })(exampleAssignment);
  assert.deepEqual(result, exampleDraft);
});
