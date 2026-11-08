import "server-only";
import type { EffortRow } from "./effort";
import { effortSourceHash, effectiveEffort, estimateEffort } from "./effort";
import type { EffortResult } from "../types";
export interface OwnedEffortRow extends EffortRow { id: string; user_id: string; status: string }
export interface EffortRepository {
  load(id: string, userId: string): Promise<OwnedEffortRow | null>;
  save(source: OwnedEffortRow, result: EffortResult): Promise<boolean>;
}
export class EffortError extends Error {
  constructor(public code: string, message: string, public status: number) { super(message); }
}
/** Repository saves only AI fields with an ownership + source compare-and-set. */
export function createPrivateEffortService(repository: EffortRepository, estimate = estimateEffort, hash = effortSourceHash) {
  return async (id: string, userId: string, retry = false) => {
    const row = await repository.load(id, userId);
    if (!row || row.user_id !== userId || row.status !== "open") throw new EffortError("NOT_FOUND", "Assignment not found", 404);
    if (row.ai_effort_status === undefined) throw new EffortError("MIGRATION_REQUIRED", "Apply the AI effort migration before estimating imported work.", 503);
    const source = { id, userId, title: row.title, descriptionText: row.description_text };
    const sourceHash = hash(source);
    const effective = effectiveEffort(row, sourceHash);
    if (effective.effortSource === "student" || effective.effortStatus === "ready"
      || (!retry && effective.effortStatus === "unavailable")) {
      return { effortEstimate: effective.effortEstimate, effortStatus: effective.effortStatus === "ready" ? "ready" as const : "unavailable" as const, needsReview: effective.effortSource === "student" ? false : row.ai_effort_needs_review ?? true, sourceHash };
    }
    const result = await estimate(source);
    if (!await repository.save(row, result)) throw new EffortError("SOURCE_CHANGED", "Assignment instructions changed. Reload before estimating again.", 409);
    return result;
  };
}
