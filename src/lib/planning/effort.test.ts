import assert from "node:assert/strict";
import { test } from "node:test";
import { estimateHours, estimateHourRange } from "../effort";

test("reviewed step durations seed a whole-hour effort range", () => {
  assert.equal(estimateHours([{ minutes: 25 }, { minutes: 65 }]), 2);
  assert.equal(estimateHours([{ minutes: 10 }]), 1);
  assert.equal(estimateHours([{ minutes: 480 }, { minutes: 480 }, { minutes: 480 }, { minutes: 480 }, { minutes: 480 }, { minutes: 480 }]), 40);
});

test("whole-hour effort uses the AI's bounds rather than a fixed range around step totals", () => {
  assert.deepEqual(estimateHourRange({ steps: [{ minutes: 15 }], effortMinMinutes: 180, effortMaxMinutes: 300 }), { min: 3, max: 5 });
  assert.deepEqual(estimateHourRange({ steps: [{ minutes: 210 }], effortMinMinutes: 220, effortMaxMinutes: 250 }), { min: 3, max: 5 });
  assert.deepEqual(estimateHourRange({ steps: [{ minutes: 15 }], effortMinMinutes: 10, effortMaxMinutes: 20 }), { min: 1, max: 1 });
});
