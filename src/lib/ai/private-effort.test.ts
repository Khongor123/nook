import test from "node:test";
import assert from "node:assert/strict";
import { createPrivateEffortService } from "./private-effort";
import type { OwnedEffortRow } from "./private-effort";
import type { EffortResult } from "../types";
const result: EffortResult = { effortEstimate: { minMinutes: 180, maxMinutes: 300 }, effortStatus: "ready", sourceHash: "current", needsReview: false };
function fixture(change: Partial<OwnedEffortRow> = {}, saved = true) {
  const row: OwnedEffortRow = { id: "assignment", user_id: "owner", status: "open", title: "Fictional essay", description_text: "Write a fictional essay.", ai_effort_status: "pending", ...change };
  let calls = 0; const writes: EffortResult[] = [];
  const service = createPrivateEffortService({ load: async () => row, save: async (_source, value) => { writes.push(value); return saved; } }, async () => { calls++; return result; }, () => "current");
  return { row, service, writes, calls: () => calls };
}
test("private estimation requires ownership and an open assignment before AI or writes", async () => {
  for (const change of [{ user_id: "other" }, { status: "submitted" }]) {
    const f = fixture(change); await assert.rejects(f.service("assignment", "owner"), /not found/i); assert.equal(f.calls(), 0); assert.equal(f.writes.length, 0);
  }
});
test("AI metadata saves independently and failed source compare-and-set rejects stale results", async () => {
  const f = fixture(); const before = structuredClone(f.row);
  assert.deepEqual(await f.service("assignment", "owner"), result); assert.deepEqual(f.row, before); assert.deepEqual(f.writes, [result]);
  await assert.rejects(fixture({}, false).service("assignment", "owner"), /instructions changed/i);
});
test("reviewed effort and current AI estimates skip generation; stale AI is refreshed", async () => {
  for (const change of [{ effort_min_minutes: 60, effort_max_minutes: 120 }, { ai_effort_min_minutes: 180, ai_effort_max_minutes: 300, ai_effort_source_hash: "current", ai_effort_status: "ready" }]) {
    const f = fixture(change); await f.service("assignment", "owner"); assert.equal(f.calls(), 0); assert.equal(f.writes.length, 0);
  }
  const stale = fixture({ ai_effort_source_hash: "old", ai_effort_status: "ready" }); await stale.service("assignment", "owner"); assert.equal(stale.calls(), 1);
});
test("failed estimates require explicit retry and a missing migration gives a safe setup error", async () => {
  const f = fixture({ ai_effort_status: "unavailable", ai_effort_source_hash: "current" });
  assert.equal((await f.service("assignment", "owner")).effortStatus, "unavailable"); assert.equal(f.calls(), 0);
  await f.service("assignment", "owner", true); assert.equal(f.calls(), 1);
  const missing = fixture({ ai_effort_status: undefined }); await assert.rejects(missing.service("assignment", "owner"), /migration/i); assert.equal(missing.calls(), 0);
});
