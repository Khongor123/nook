import assert from "node:assert/strict";
import { test } from "node:test";
import { estimateHours } from "../effort";

test("reviewed step durations seed a whole-hour effort range", () => {
  assert.equal(estimateHours([{ minutes: 25 }, { minutes: 65 }]), 2);
  assert.equal(estimateHours([{ minutes: 10 }]), 1);
  assert.equal(estimateHours([{ minutes: 480 }, { minutes: 480 }, { minutes: 480 }, { minutes: 480 }, { minutes: 480 }, { minutes: 480 }]), 40);
});
