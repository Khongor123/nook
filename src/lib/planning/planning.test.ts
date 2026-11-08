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
    startByAt: null, state: "no_due_date", reason: "No due date, so no rush.",
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

test("long estimates start today and invalid estimates are rejected", () => {
  assert.equal(getStartBy(due, 3000, now).startByAt, "2026-11-07T15:00:00Z");
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

test("a checkpoint's next step survives when no plan exists; no plan does not mean all steps done", () => {
  assert.equal(getWelcomeBack(checkpoint, [idea], []).nextAction, checkpoint.nextStep);
  assert.equal(getWelcomeBack(checkpoint, [idea], [{ ...step, assignmentId: "lab" }]).nextAction, checkpoint.nextStep);
  assert.equal(getWelcomeBack({ ...checkpoint, nextStep: " " }, [], []).nextAction, "Open the assignment");
  assert.equal(getWelcomeBack(checkpoint, [idea], [{ ...step, done: true }]).nextAction, "Review and submit when ready");
});

test("reflection-only and unusable Idea lists do not become actions or mutate stored thoughts", () => {
  const thoughts = Object.freeze([
    Object.freeze({ ...idea, kind: "reflection" as const, text: "I feel overwhelmed" }),
    Object.freeze({ ...idea, text: " ", createdAt: "2026-11-09T00:00:00Z" }),
    Object.freeze({ ...idea, text: "Bad timestamp", createdAt: "invalid" }),
  ]);
  const result = getWelcomeBack(Object.freeze(checkpoint), thoughts, Object.freeze([Object.freeze(step)]));
  assert.equal(result.ideaText, null);
  assert.equal(result.nextAction, checkpoint.nextStep);
  assert.equal(thoughts[0].kind, "reflection");
});

test("calendar subtraction also works for a non-hour offset, and invalid dates/zones fail explicitly", () => {
  assert.equal(getStartBy({ dueAt: "2026-11-13T11:15:00Z", timeZone: "Asia/Kathmandu" }, 150, now).startByAt,
    "2026-11-10T11:15:00Z");
  assert.throws(() => getStartBy({ ...due, timeZone: "invalid" }, 150, now));
  assert.throws(() => getStartBy({ ...due, dueAt: "invalid" }, 150, now));
});
