import test from "node:test";
import assert from "node:assert/strict";
import { demoAssignments } from "../demo-fixtures";
import type { ShelfCard } from "../types";
import { importance, sortByImportance } from "./importance";
const now = new Date("2026-11-08T12:00:00Z");
function card(id: string, hours: number | null, days: number | null, done = 0, total = 0): ShelfCard {
  return { assignment: { ...demoAssignments[0], id, dueAt: days === null ? null : new Date(now.getTime() + days * 86400000).toISOString() }, startByAt: null, startByReason: "", stepsDone: done, stepsTotal: total,
    effortEstimate: hours === null ? null : { minMinutes: hours * 60, maxMinutes: hours * 60 } };
}
test("importance combines total effort with days remaining using the agreed example", () => {
  const essay = card("essay", 5, 2), reading = card("reading", 1, 1), presentation = card("presentation", 6, 10);
  assert.equal(importance(essay, now).score, 2.5);
  assert.deepEqual(sortByImportance([presentation, reading, essay], now).map(c => c.assignment.id), ["essay", "reading", "presentation"]);
});
test("overdue first, then estimated upcoming, unestimated upcoming, undated, completed", () => {
  const values = [card("complete", 20, -5, 2, 2), card("undated-unknown", null, null), card("undated", 6, null), card("unknown", null, 1), card("future", 3, 5), card("late-small", 1, -3), card("late-large", 5, -1)];
  assert.deepEqual(sortByImportance(values, now).map(c => c.assignment.id), ["late-large", "late-small", "future", "unknown", "undated", "undated-unknown", "complete"]);
});
test("partial completion does not reduce importance and empty plans are not complete", () => {
  assert.equal(importance(card("partial", 5, 2, 4, 5), now).score, importance(card("untouched", 5, 2, 0, 5), now).score);
  assert.notEqual(importance(card("empty", 5, 2), now).group, 5);
});
test("sub-day deadlines have a one-day floor; ties use exact due date then ID", () => {
  const a = card("a", 2, 0.5), b = card("b", 2, 0.2), c = card("c", 2, 0.2);
  assert.equal(importance(a, now).score, 2);
  assert.deepEqual(sortByImportance([c, a, b], now).map(c => c.assignment.id), ["b", "c", "a"]);
});
test("sort is immutable, uses the midpoint, updates with effort, and precedes pagination", () => {
  const values = [card("a", 1, 10), card("b", 2, 10), card("c", 3, 10), card("d", 4, 10)];
  const before = structuredClone(values);
  assert.deepEqual(sortByImportance(values, now).slice(0, 3).map(c => c.assignment.id), ["d", "c", "b"]);
  assert.deepEqual(values, before);
  values[0].effortEstimate = { minMinutes: 600, maxMinutes: 1200 };
  assert.equal(importance(values[0], now).score, 1.5);
  assert.equal(sortByImportance(values, now)[0].assignment.id, "a");
});
