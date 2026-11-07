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
  const steps = unfinishedSteps.filter((item) => item.assignmentId === checkpoint.assignmentId);
  const step = steps.find((item) => !item.done);
  const idea = ideas.filter((item) => item.assignmentId === checkpoint.assignmentId
    && item.kind === "idea" && item.text.trim() && Number.isFinite(Date.parse(item.createdAt)))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
  const allDone = steps.length > 0 && !step;
  const nextAction = allDone ? "Review and submit when ready"
    : checkpoint.nextStep.trim() || step?.text || "Open the assignment";
  const note = checkpoint.note.trim();
  return {
    message: note ? `You left off: ${note}` : "Welcome back. Your place is saved.",
    nextAction,
    ideaText: idea?.text ?? null,
  };
}
