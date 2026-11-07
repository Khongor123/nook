import assert from "node:assert/strict";
import { test } from "node:test";
import { breakdownSchema } from "../ai/breakdown-schema";
import { createBreakDown } from "../ai/breakdown";
import { getStartBy } from "./start-by";
import { getWelcomeBack } from "./welcome-back";
import {
  exampleAssignment, exampleCheckpoint, exampleDraft, exampleManualFallback,
  exampleNow, exampleReviewDraft, exampleStartBy, exampleSteps, exampleThoughts,
  exampleWelcomeBack, vagueExampleAssignment,
} from "./demo-example";

test("B2's example responses match the real functions and schemas", () => {
  assert.ok(breakdownSchema.safeParse(exampleDraft).success);
  assert.ok(breakdownSchema.safeParse(exampleReviewDraft).success);
  assert.equal(exampleReviewDraft.needsReview, true);
  assert.equal(vagueExampleAssignment.dueAt, exampleAssignment.dueAt);
  assert.equal(exampleStartBy.startByAt, "2026-11-10T22:00:00Z");
  assert.deepEqual(exampleWelcomeBack, {
    message: "You left off: Outline finished; ready to draft.",
    nextAction: "Write the opening paragraph.", ideaText: "Open with a question?",
  });
});

test("fictional review/edit/return loop preserves due dates and keeps Reflections as notes", async () => {
  const assignment = Object.freeze({ ...exampleAssignment });
  const thoughts = structuredClone(exampleThoughts);
  const run = createBreakDown(async () => ({ status: "completed", output_parsed: exampleDraft }));
  const draft = await run(assignment);
  assert.ok("effortMinMinutes" in draft);
  draft.steps[2].text = "Draft the opening paragraph";
  draft.effortMinMinutes = 300;
  draft.effortMaxMinutes = 420;
  assert.ok(breakdownSchema.safeParse(draft).success);
  const revised = getStartBy(assignment, (draft.effortMinMinutes + draft.effortMaxMinutes) / 2, exampleNow);
  assert.notEqual(revised.startByAt, exampleStartBy.startByAt);
  const steps = exampleSteps.map((step, index) => ({ ...step, ...draft.steps[index] }));
  // JSON round-trip simulates transport, not authenticated database persistence.
  const restored = JSON.parse(JSON.stringify({ checkpoint: exampleCheckpoint, thoughts, steps }));
  assert.equal(getWelcomeBack(restored.checkpoint, restored.thoughts, restored.steps).nextAction,
    exampleCheckpoint.nextStep);
  assert.equal(steps.length, exampleSteps.length);
  assert.deepEqual(thoughts, exampleThoughts);
  assert.equal(assignment.dueAt, "2026-11-13T22:00:00Z");
  assert.deepEqual(await createBreakDown(async () => { throw new Error("offline"); })(assignment), exampleManualFallback);
});
