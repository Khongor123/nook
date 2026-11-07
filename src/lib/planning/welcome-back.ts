import type { Checkpoint, Step, Thought } from "../types";

export interface WelcomeBackResult {
  message: string;
  nextAction: string;
  ideaText: string | null;
}

/** The route must supply the latest checkpoint for the active assignment. */
export function getWelcomeBack(
  checkpoint: Checkpoint | null,
  ideas: readonly Thought[],
  unfinishedSteps: readonly Step[],
): WelcomeBackResult {
  if (!checkpoint) {
    return { message: "Welcome back. Open the assignment to begin.", nextAction: "Open the assignment", ideaText: null };
  }
  const step = unfinishedSteps.find((item) => item.assignmentId === checkpoint.assignmentId && !item.done);
  const idea = ideas.filter((item) => item.assignmentId === checkpoint.assignmentId && item.kind === "idea")
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
  const nextAction = step
    ? checkpoint.nextStep.trim() || step.text
    : "Review and submit when ready";
  const note = checkpoint.note.trim();
  return {
    message: note ? `You left off: ${note}` : "Welcome back. Your place is saved.",
    nextAction,
    ideaText: idea?.text ?? null,
  };
}
