import type { ShelfCard } from "../types";

function effort(card: ShelfCard) {
  const range = card.effortEstimate;
  return range && Number.isFinite(range.minMinutes) && Number.isFinite(range.maxMinutes)
    && range.minMinutes > 0 && range.maxMinutes >= range.minMinutes
    ? (range.minMinutes + range.maxMinutes) / 120 : null;
}
/** Total effort, never remaining step minutes. Scores are internal, not grades. */
export function importance(card: ShelfCard, now = new Date()) {
  const hours = effort(card);
  const due = card.assignment.dueAt ? Date.parse(card.assignment.dueAt) : NaN;
  const dated = Number.isFinite(due);
  const complete = card.assignment.status === "submitted" || (card.stepsTotal > 0 && card.stepsDone >= card.stepsTotal);
  const group = complete ? 5 : dated && due <= now.getTime() ? 0
    : dated && hours !== null ? 1 : dated ? 2 : hours !== null ? 3 : 4;
  const score = hours === null ? 0 : group === 1
    ? hours / Math.max((due - now.getTime()) / 86400000, 1) : hours;
  return { group, score, due: dated ? due : Infinity };
}
export function sortByImportance(cards: readonly ShelfCard[], now = new Date()): ShelfCard[] {
  return [...cards].sort((a, b) => {
    const x = importance(a, now), y = importance(b, now);
    return x.group - y.group || y.score - x.score || x.due - y.due || a.assignment.id.localeCompare(b.assignment.id);
  });
}
