/** Seed the editable hour range from reviewed step durations. */
export function estimateHours(steps: { minutes: number }[]) {
  const total = steps.reduce((sum, step) => sum + (Number.isFinite(step.minutes) ? step.minutes : 0), 0);
  return Math.min(40, Math.max(1, Math.ceil(total / 60)));
}
