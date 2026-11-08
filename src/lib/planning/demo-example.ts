import type { Assignment, Checkpoint, Step, Thought } from "../types";
import type { BreakdownDraft, BreakdownResult } from "../ai/breakdown-schema";
import { getStartBy } from "./start-by";
import { getWelcomeBack } from "./welcome-back";

// Fixed fictional dates make the team handoff reproducible, independent of today.
export const exampleNow = new Date("2026-11-07T15:00:00Z");
export const exampleAssignment: Assignment = {
  id: "demo-planning-history", userId: "demo-user",
  canvasCourseId: "demo-history", canvasAssignmentId: "demo-history-essay",
  courseName: "History 101", title: "History essay",
  descriptionText: "Choose a local historical event. Write a 900-word essay using two course readings. Revise and submit a PDF.",
  dueAt: "2026-11-13T22:00:00Z", timeZone: "America/New_York",
  updatedAt: exampleNow.toISOString(), status: "open",
};
export const exampleDraft: BreakdownDraft = {
  steps: [
    { text: "Read the instructions and choose an event", minutes: 20 },
    { text: "Outline using two course readings", minutes: 30 },
    { text: "Draft the essay", minutes: 70 },
    { text: "Revise and prepare a PDF", minutes: 30 },
  ],
  effortMinMinutes: 120, effortMaxMinutes: 180, needsReview: false,
  note: "Fictional demo plan, not a live AI response. Review and edit the suggestions.",
};
export const exampleSteps: Step[] = exampleDraft.steps.map((step, index) => ({
  ...step, id: `demo-planning-step-${index}`, assignmentId: exampleAssignment.id,
  done: index < 2, source: "suggested",
}));
export const exampleThoughts: Thought[] = [
  { id: "demo-planning-idea", assignmentId: exampleAssignment.id, kind: "idea",
    text: "Open with a question?", createdAt: exampleNow.toISOString() },
  { id: "demo-planning-reflection", assignmentId: exampleAssignment.id, kind: "reflection",
    text: "I feel overwhelmed", createdAt: exampleNow.toISOString() },
];
export const exampleCheckpoint: Checkpoint = {
  id: "demo-planning-checkpoint", assignmentId: exampleAssignment.id,
  note: "Outline finished; ready to draft.", nextStep: "Write the opening paragraph.",
  createdAt: exampleNow.toISOString(),
};
export const exampleStartBy = getStartBy(exampleAssignment, 150, exampleNow);
export const exampleWelcomeBack = getWelcomeBack(exampleCheckpoint, exampleThoughts, exampleSteps);

export const vagueExampleAssignment: Assignment = {
  ...exampleAssignment, id: "demo-planning-vague", title: "Class preparation",
  descriptionText: "Prepare something about history for class.",
};
// Hand-authored B2 review state; not a claim about live model output.
export const exampleReviewDraft: BreakdownDraft = {
  steps: [{ text: "Open Canvas and check the full instructions", minutes: 10 }],
  effortMinMinutes: 10, effortMaxMinutes: 20, needsReview: true,
  note: "Review the Canvas prompt before planning. This estimate is only for checking the instructions.",
};
export const exampleManualFallback: BreakdownResult = {
  steps: [], needsReview: true, note: "Make a manual plan",
};
