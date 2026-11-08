import test from "node:test";
import assert from "node:assert/strict";
import { estimateBatch } from "./estimate-batch";
test("import estimates at most two at once and waits for success or failure of every item", async () => {
  let active = 0, max = 0; const finished: number[] = [], progress: number[] = [];
  await estimateBatch([1, 2, 3, 4, 5, 6], async item => {
    active++; max = Math.max(max, active); await new Promise(resolve => setTimeout(resolve, 2)); active--; finished.push(item);
    if (item === 3) throw new Error("fake failure");
  }, completed => progress.push(completed));
  assert.equal(max, 2); assert.equal(finished.length, 6); assert.equal(progress.at(-1), 6);
});
test("leaving import stops scheduling new requests and a later visit can resume missing work", async () => {
  let cancel = false; const finished: number[] = [];
  await estimateBatch([1, 2, 3, 4], async item => { finished.push(item); cancel = true; }, () => {}, () => cancel);
  assert.ok(finished.length < 4);
  await estimateBatch([1, 2, 3, 4].filter(item => !finished.includes(item)), async item => { finished.push(item); });
  assert.equal(finished.length, 4);
});
