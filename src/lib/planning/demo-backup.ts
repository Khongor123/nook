import { breakdownSchema } from "../ai/breakdown-schema";
import { inspectDraft } from "../ai/quality-check";
import { exampleAssignment } from "./demo-example";

export const demoBackupLabel = "Previously AI-generated fictional demo plan — not a live response";

/** Only the fixed fictional essay can be captured; no database or caller source. */
export function prepareDemoBackup(output: unknown, generatedAt = new Date()) {
  const parsed = breakdownSchema.safeParse(output);
  if (!parsed.success || parsed.data.needsReview
    || inspectDraft(parsed.data, exampleAssignment.descriptionText).length > 0) {
    throw new Error("Backup needs a valid, clear draft with no heuristic findings.");
  }
  return {
    label: demoBackupLabel,
    provenance: {
      provider: "Groq",
      generatedAt: generatedAt.toISOString(),
      source: "fixed fictional History essay from demo-example.ts",
      reviewStatus: "awaiting_human_review",
    },
    assignment: {
      title: exampleAssignment.title,
      descriptionText: exampleAssignment.descriptionText,
    },
    draft: parsed.data,
  };
}
