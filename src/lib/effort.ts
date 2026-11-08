/** Seed the editable hour range from reviewed step durations. */
export function estimateHours(steps: { minutes: number }[]) {
  const total = steps.reduce((sum, step) => sum + (Number.isFinite(step.minutes) ? step.minutes : 0), 0);
  return Math.min(40, Math.max(1, Math.ceil(total / 60)));
}

/** Display the model's effort bounds in whole hours, rounding the range outward. */
export function estimateHourRange(draft: { steps: { minutes: number }[]; effortMinMinutes?: number; effortMaxMinutes?: number }) {
  const fallback = estimateHours(draft.steps);
  const min = Number.isFinite(draft.effortMinMinutes) && draft.effortMinMinutes! > 0
    ? Math.min(40, Math.max(1, Math.floor(draft.effortMinMinutes! / 60))) : fallback;
  const max = Number.isFinite(draft.effortMaxMinutes) && draft.effortMaxMinutes! > 0
    ? Math.min(50, Math.max(min, Math.ceil(draft.effortMaxMinutes! / 60))) : min;
  return { min, max };
}
