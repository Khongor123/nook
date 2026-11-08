import assert from "node:assert/strict";
import { test } from "node:test";
import { shelfStartBy } from "./private-planning";

const now = new Date("2026-11-10T17:00:00Z");

test("shelf waits for a reviewed effort estimate and keeps the Canvas due date separate", () => {
  const due = "2026-11-13T22:00:00Z";
  const unplanned = shelfStartBy(due, "America/New_York", null, null, now);
  assert.equal(unplanned.startByAt, null);
  assert.equal(unplanned.startByState, "needs_plan");

  const planned = shelfStartBy(due, "America/New_York", 120, 180, now);
  assert.equal(planned.startByAt, "2026-11-10T22:00:00Z");
  assert.equal(planned.startByState, "suggested");
  assert.equal(due, "2026-11-13T22:00:00Z");
});

test("missing and overdue dates do not invent a start-by time", () => {
  assert.equal(shelfStartBy(null, "UTC", null, null, now).startByState, "no_due_date");
  assert.equal(shelfStartBy("2026-11-01T00:00:00Z", "UTC", 30, 60, now).startByState, "overdue");
});

test("Canvas unlock time clamps a suggestion without changing the due date", () => {
  const due = "2026-11-13T22:00:00Z";
  const unlock = "2026-11-12T15:00:00Z";
  const result = shelfStartBy(due, "America/New_York", 120, 180, now, unlock);
  assert.equal(new Date(result.startByAt!).getTime(), new Date(unlock).getTime());
  assert.match(result.startByReason, /Canvas unlocks/);
  assert.equal(due, "2026-11-13T22:00:00Z");
  assert.equal(shelfStartBy(due, "America/New_York", 120, 180, now,
    "2026-11-14T15:00:00Z").startByState, "unavailable");
});
