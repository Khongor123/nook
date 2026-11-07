import { getStartBy } from "@/lib/planning/start-by";
import type { ShelfCard } from "@/lib/types";

type StartBy = Pick<ShelfCard, "startByAt" | "startByReason" | "startByState">;

export function shelfStartBy(
  dueAt: string | null,
  timeZone: string,
  minMinutes: number | null,
  maxMinutes: number | null,
  now = new Date(),
): StartBy {
  if (!dueAt) return { startByAt: null, startByReason: "No Canvas due date", startByState: "no_due_date" };
  const due = new Date(dueAt);
  if (!Number.isFinite(due.getTime())) {
    return { startByAt: null, startByReason: "Check the Canvas due date", startByState: "unavailable" };
  }
  if (due <= now) return { startByAt: null, startByReason: "Start when you can", startByState: "overdue" };
  if (minMinutes === null || maxMinutes === null || minMinutes <= 0 || maxMinutes < minMinutes) {
    return { startByAt: null, startByReason: "Make a plan for a start-by suggestion", startByState: "needs_plan" };
  }
  try {
    const result = getStartBy({ dueAt, timeZone }, Math.ceil((minMinutes + maxMinutes) / 2), now);
    return { startByAt: result.startByAt, startByReason: result.reason, startByState: result.state };
  } catch {
    return { startByAt: null, startByReason: "Check the course time zone", startByState: "unavailable" };
  }
}
