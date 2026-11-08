import { Temporal } from "@js-temporal/polyfill";
import type { Assignment } from "../types";

export interface StartByResult {
  startByAt: string | null;
  reason: string;
  state: "suggested" | "start_now" | "no_due_date" | "overdue";
}

/** Calendar-day subtraction preserves the student's local clock across DST. */
export function getStartBy(
  assignment: Pick<Assignment, "dueAt" | "timeZone">,
  estimateMinutes: number,
  now: Date = new Date(),
): StartByResult {
  if (!assignment.dueAt) {
    return { startByAt: null, reason: "No due date, so no rush.", state: "no_due_date" };
  }
  const current = Temporal.Instant.from(now.toISOString());
  const due = Temporal.Instant.from(assignment.dueAt);
  if (Temporal.Instant.compare(due, current) <= 0) {
    return { startByAt: null, reason: "Start when you can", state: "overdue" };
  }
  if (!Number.isFinite(estimateMinutes) || estimateMinutes <= 0) {
    throw new RangeError("Estimate must be a positive number of minutes.");
  }
  const daysBefore = Math.max(1, Math.ceil(estimateMinutes / 90)) + 1;
  const suggested = due.toZonedDateTimeISO(assignment.timeZone)
    .subtract({ days: daysBefore }).toInstant();
  if (Temporal.Instant.compare(suggested, current) <= 0) {
    return { startByAt: current.toString(), reason: "Start when you can", state: "start_now" };
  }
  return {
    startByAt: suggested.toString(),
    reason: `About ${Math.ceil(estimateMinutes / 60)} hours of work in small pieces, with a day of breathing room.`,
    state: "suggested",
  };
}
