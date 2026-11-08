import test from "node:test";
import assert from "node:assert/strict";
import { createEffortEstimator, effortSourceHash, effectiveEffort } from "./effort";
import { createStructuredGenerator } from "./structured-provider";
import { z } from "zod";
import { demoAssignments } from "../demo-fixtures";
const source = demoAssignments[0];
const valid = { status: "completed", output_parsed: { minHours: 3, maxHours: 5, needsReview: true } };

test("effort-only generation sends only source text and cannot create plan steps or change dates", async () => {
  let input: unknown;
  const estimate = createEffortEstimator(async value => { input = value; return valid; });
  const before = structuredClone(source), result = await estimate(Object.freeze({ ...source }));
  assert.deepEqual(input, { title: source.title, descriptionText: source.descriptionText });
  assert.deepEqual(result.effortEstimate, { minMinutes: 180, maxMinutes: 300 });
  assert.equal(result.effortStatus, "ready"); assert.equal(result.needsReview, true);
  assert.equal("steps" in result, false); assert.deepEqual(source, before);
});
test("cache and concurrent calls deduplicate; edits to copies are independent; source/model/prompt affect keys", async () => {
  let calls = 0, time = 0;
  const estimate = createEffortEstimator(async () => { calls++; return valid; }, effortSourceHash, () => time);
  const [a, b] = await Promise.all([estimate(source), estimate(source)]);
  assert.equal(calls, 1); a.effortEstimate!.minMinutes = 1; assert.equal(b.effortEstimate!.minMinutes, 180);
  await estimate({ ...source, descriptionText: "Read chapter 4 and write a summary." }); assert.equal(calls, 2);
  time = 86400001; await estimate(source); assert.equal(calls, 3);
  const hashA = effortSourceHash(source, { GROQ_API_KEY: "fake", GROQ_MODEL: "model-a" });
  assert.notEqual(hashA, effortSourceHash(source, { GROQ_API_KEY: "fake", GROQ_MODEL: "model-b" }));
  assert.equal(hashA, effortSourceHash(source, { GROQ_API_KEY: "another-fake-key", GROQ_MODEL: "model-a" }));
});
test("invalid, unavailable and refused estimates stay unknown; failures are not cached", async () => {
  for (const response of [{ ...valid, refused: true }, { ...valid, status: "incomplete" }, { ...valid, output_parsed: { minHours: null, maxHours: null, needsReview: true } }, { ...valid, output_parsed: { minHours: 5, maxHours: 2, needsReview: false } }, { ...valid, output_parsed: { minHours: 1.5, maxHours: 2, needsReview: false } }, { ...valid, output_parsed: { ...valid.output_parsed, steps: [] } }]) {
    let calls = 0; const estimate = createEffortEstimator(async () => { calls++; return response; });
    const result = await estimate(source); assert.equal(result.effortEstimate, null); assert.equal(result.effortStatus, "unavailable");
    await estimate(source); assert.equal(calls, 2);
  }
  let calls = 0; const estimate = createEffortEstimator(async () => { calls++; throw new Error("private-key-error"); });
  assert.equal((await estimate(source)).effortStatus, "unavailable");
  await estimate({ ...source, descriptionText: "" }); assert.equal(calls, 1);
});
test("student estimates win, changed source invalidates AI, and missing migrations remain readable", () => {
  const row = { title: source.title, description_text: source.descriptionText, ai_effort_min_minutes: 180, ai_effort_max_minutes: 300, ai_effort_status: "ready", ai_effort_source_hash: "current" };
  assert.equal(effectiveEffort(row, "current").effortSource, "ai");
  assert.equal(effectiveEffort(row, "changed").effortStatus, "pending");
  assert.equal(effectiveEffort({ ...row, effort_min_minutes: 60, effort_max_minutes: 120 }, "changed").effortSource, "student");
  assert.equal(effectiveEffort({ title: "a", description_text: "b" }, "x").effortStatus, "unavailable");
});
test("extracted transport preserves exact schema retry and does not retry auth or rate limits", async () => {
  for (const status of [400, 401, 429]) {
    let calls = 0;
    const generate = createStructuredGenerator(z.strictObject({ minHours: z.number() }), "test_effort", "Fictional test", { GROQ_API_KEY: "fake" }, async () => {
      calls++;
      if (calls === 1) return Response.json({ error: { code: "json_validate_failed", message: "private fictional error" } }, { status });
      return Response.json({ id: "resp_test", object: "response", created_at: 1, status: "completed", output: [{ type: "message", id: "msg_test", status: "completed", role: "assistant", content: [{ type: "output_text", text: '{"minHours":3}', annotations: [] }] }] });
    });
    if (status === 400) { assert.deepEqual((await generate({ title: "Fictional", descriptionText: "Write a summary" })).output_parsed, { minHours: 3 }); assert.equal(calls, 2); }
    else { await assert.rejects(generate({ title: "Fictional", descriptionText: "Write a summary" })); assert.equal(calls, 1); }
  }
});
