import test from "node:test";
import assert from "node:assert/strict";
import { createDemoEffortHandler } from "./demo-effort";
import { createDemoBreakdownHandler } from "./demo-breakdown";
import { createDemoLimiter } from "./demo-limit";
import { demoAssignments } from "../demo-fixtures";
import type { EffortResult } from "../types";
const id = demoAssignments[0].id;
const result: EffortResult = { effortEstimate: { minMinutes: 180, maxMinutes: 300 }, effortStatus: "ready", sourceHash: "current", needsReview: false };
const request = (init: RequestInit = {}) => new Request("http://localhost/api/demo", { method: "POST", ...init });
test("demo effort accepts fixed fictional IDs only and invalid requests cannot reach AI", async () => {
  let calls = 0; const handle = createDemoEffortHandler(async assignment => { calls++; assert.ok(demoAssignments.some(a => a.id === assignment.id)); return result; }, () => "current", createDemoLimiter());
  assert.equal((await handle(request(), "real-id")).status, 404);
  assert.equal((await handle(request({ body: '{"title":"arbitrary"}' }), id)).status, 400);
  assert.equal((await handle(request({ headers: { origin: "https://other.example" } }), id)).status, 403);
  assert.equal(calls, 0);
  for (const assignment of demoAssignments) assert.deepEqual(await (await handle(request(), assignment.id)).json(), result);
  assert.equal(calls, 6);
});
test("browser estimates are revalidated without AI; a changed source/model hash regenerates", async () => {
  let calls = 0, hash = "current";
  const handle = createDemoEffortHandler(async () => { calls++; return { ...result, sourceHash: hash }; }, () => hash, createDemoLimiter());
  const unchanged = await handle(request({ headers: { "x-nook-effort-hash": "current" } }), id);
  assert.deepEqual(await unchanged.json(), { unchanged: true, sourceHash: "current" }); assert.equal(calls, 0);
  hash = "new-model";
  assert.equal((await (await handle(request({ headers: { "x-nook-effort-hash": "current" } }), id)).json()).sourceHash, hash);
  assert.equal(calls, 1);
});
test("demo estimation and breakdown share the two-slot and per-minute limits", async () => {
  const limiter = createDemoLimiter(); let resolve!: (value: EffortResult) => void;
  const pending = new Promise<EffortResult>(r => { resolve = r; });
  const estimate = createDemoEffortHandler(() => pending, () => "current", limiter);
  const breakdown = createDemoBreakdownHandler(async () => ({ steps: [], needsReview: true, note: "Make a manual plan" }), Date.now, limiter);
  const first = estimate(request(), id), second = estimate(request(), id);
  assert.equal((await breakdown(request(), id)).status, 429);
  resolve(result); await Promise.all([first, second]);
  for (let i = 0; i < 8; i++) assert.equal((await breakdown(request(), id)).status, 200);
  assert.equal((await estimate(request(), id)).status, 429);
});
test("unexpected estimator exceptions return only safe unknown-effort metadata", async () => {
  const handle = createDemoEffortHandler(async () => { throw new Error("private-provider-secret"); }, () => "current", createDemoLimiter());
  const response = await handle(request(), id);
  const value = await response.json(); assert.equal(value.effortStatus, "unavailable"); assert.equal(value.effortEstimate, null);
  assert.doesNotMatch(JSON.stringify(value), /secret|provider/);
});
