import assert from "node:assert/strict";
import { test } from "node:test";
import { getStartBy } from "./start-by";
import { getWelcomeBack } from "./welcome-back";
import type { Checkpoint, Step, Thought } from "../types";

const due = { dueAt: "2026-11-13T22:00:00Z", timeZone: "America/New_York" };
const now = new Date("2026-11-07T15:00:00Z");

test("Friday at 5pm suggests Tuesday at 5pm; source due date is preserved", () => {
  const assignment = Object.freeze({ ...due });
  assert.equal(getStartBy(assignment, 150, now).startByAt, "2026-11-10T22:00:00Z");
  assert.equal(assignment.dueAt, due.dueAt);
  assert.equal(getStartBy(assignment, 360, now).startByAt, "2026-11-08T22:00:00Z");
});

test("no date, overdue, and tomorrow have calm outputs", () => {
  assert.deepEqual(getStartBy({ ...due, dueAt: null }, 150, now), {
    startByAt: null, state: "no_due_date", reason: "No Canvas due date",
  });
  assert.equal(getStartBy(due, 150, new Date("2026-11-14T00:00:00Z")).state, "overdue");
  assert.deepEqual(getStartBy(due, 150, new Date("2026-11-12T15:00:00Z")), {
    startByAt: "2026-11-12T15:00:00Z", state: "start_now", reason: "Start when you can",
  });
});

test("calendar subtraction preserves 5pm across both daylight-saving changes", () => {
  assert.equal(getStartBy({ ...due, dueAt: "2026-03-10T21:00:00Z" }, 150,
    new Date("2026-03-01T12:00:00Z")).startByAt, "2026-03-07T22:00:00Z");
  assert.equal(getStartBy({ ...due, dueAt: "2026-11-03T22:00:00Z" }, 150,
    new Date("2026-10-25T12:00:00Z")).startByAt, "2026-10-31T21:00:00Z");
});

test("long estimates are capped and invalid estimates are rejected", () => {
  assert.equal(getStartBy(due, 3000, now).startByAt, "2026-11-07T22:00:00Z");
  for (const value of [0, -1, NaN, Infinity]) assert.throws(() => getStartBy(due, value, now));
});

const checkpoint: Checkpoint = {
  id: "cp", assignmentId: "essay", note: "Outline finished; ready to draft.",
  nextStep: "Write the opening paragraph.", createdAt: now.toISOString(),
};
const step: Step = { id: "step", assignmentId: "essay", text: "Draft the essay", minutes: 40, done: false, source: "student" };
const idea: Thought = { id: "idea", assignmentId: "essay", kind: "idea", text: "Open with a question?", createdAt: now.toISOString() };

test("welcome-back prefers the student's next step and only the latest same-assignment Idea", () => {
  const result = getWelcomeBack(checkpoint, [
    { ...idea, text: "Older idea", createdAt: "2026-11-01T00:00:00Z" }, idea,
    { ...idea, assignmentId: "lab", text: "Other assignment", createdAt: "2026-11-08T00:00:00Z" },
    { ...idea, kind: "reflection", text: "I feel overwhelmed", createdAt: "2026-11-09T00:00:00Z" },
  ], [step]);
  assert.equal(result.nextAction, checkpoint.nextStep);
  assert.equal(result.ideaText, idea.text);
  assert.ok(result.message.includes(checkpoint.note));
});

test("empty checkpoint uses an unfinished step; completed and foreign steps never become actions", () => {
  assert.equal(getWelcomeBack({ ...checkpoint, note: "", nextStep: " " }, [], [step]).nextAction, step.text);
  assert.equal(getWelcomeBack(checkpoint, [], [{ ...step, done: true }, { ...step, assignmentId: "lab" }]).nextAction,
    "Review and submit when ready");
  assert.deepEqual(getWelcomeBack(null, [idea], [step]), {
    message: "Welcome back. Open the assignment to begin.", nextAction: "Open the assignment", ideaText: null,
  });
});
