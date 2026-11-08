import { z } from "zod";
import { demoAssignments } from "./demo-fixtures";
import { effortInputSignature } from "./planning/effort-input";
import { getStartBy } from "./planning/start-by";
import { getWelcomeBack } from "./planning/welcome-back";
import type { Assignment, PrivateAssignmentDetail, ShelfCard, ThoughtKind, EffortResult } from "./types";

export const DEMO_STATE_KEY = "nook-demo-state-v2";
const step = z.object({ id: z.string(), assignmentId: z.string(), text: z.string(), minutes: z.number(), done: z.boolean(), source: z.enum(["suggested", "student"]) });
const thought = z.object({ id: z.string(), assignmentId: z.string(), kind: z.enum(["idea", "reflection"]), text: z.string(), createdAt: z.string() });
const checkpoint = z.object({ id: z.string(), assignmentId: z.string(), note: z.string(), nextStep: z.string(), createdAt: z.string() });
const aiEffort = z.object({ sourceHash: z.string(), effortStatus: z.enum(["ready", "unavailable"]), needsReview: z.boolean(), effortEstimate: z.object({ minMinutes: z.number(), maxMinutes: z.number() }).nullable() });
const record = z.object({ aiEffortInput: z.string().nullable().default(null), aiEffort: aiEffort.nullable().default(null), steps: z.array(step), thoughts: z.array(thought), latestCheckpoint: checkpoint.nullable(), effortEstimate: z.object({ minMinutes: z.number(), maxMinutes: z.number() }).nullable(), draftNote: z.string(), needsReview: z.boolean() });
export type DemoRecord = z.infer<typeof record>;
const stateSchema = z.object({ version: z.literal(2), dates: z.record(z.string(), z.string().nullable()), records: z.record(z.string(), record) });
type Store = Pick<Storage, "getItem" | "setItem">;
const emptyRecord = (): DemoRecord => ({ aiEffortInput: null, aiEffort: null, steps: [], thoughts: [], latestCheckpoint: null, effortEstimate: null, draftNote: "", needsReview: false });
export const STORAGE_WARNING = "Changes could not be saved. Keep this tab open and try again.";

/** Browser-only data, independent of authenticated accounts and legacy fixtures. */
export function createDemoStore(storage: () => Store, now = () => new Date(), uuid = () => crypto.randomUUID()) {
  let state: z.infer<typeof stateSchema> | undefined;
  let warning = "";
  function read() {
    if (!state) {
      state = { version: 2, dates: Object.fromEntries(demoAssignments.map(a => [a.id, a.dueAt])), records: {} };
      try {
        const raw = storage().getItem(DEMO_STATE_KEY);
        if (raw) { const saved = stateSchema.parse(JSON.parse(raw)); state = { ...saved, dates: { ...state.dates, ...saved.dates } }; }
      } catch { warning = STORAGE_WARNING; }
    }
    return state;
  }
  function assignment(id: string): Assignment {
    const item = demoAssignments.find(a => a.id === id);
    if (!item) throw new Error("This demo assignment is unavailable.");
    return { ...item, dueAt: read().dates[id] ?? item.dueAt };
  }
  function get(id: string): DemoRecord {
    assignment(id);
    const value = structuredClone(read().records[id] ?? emptyRecord());
    if (value.aiEffortInput !== effortInputSignature(assignment(id))) value.aiEffort = null;
    // A record can never contribute another assignment's content.
    value.steps = value.steps.filter(s => s.assignmentId === id);
    value.thoughts = value.thoughts.filter(t => t.assignmentId === id);
    if (value.latestCheckpoint?.assignmentId !== id) value.latestCheckpoint = null;
    return value;
  }
  function flush() {
    try { storage().setItem(DEMO_STATE_KEY, JSON.stringify(read())); warning = ""; }
    catch { warning = STORAGE_WARNING; throw new Error(STORAGE_WARNING); }
  }
  function patch(id: string, change: Partial<DemoRecord>, persist = true) {
    const next = record.parse({ ...get(id), ...change });
    read().records[id] = next;
    if (persist) flush();
    return structuredClone(next);
  }
  function detail(id: string): PrivateAssignmentDetail {
    const value = get(id);
    return { assignment: assignment(id), steps: value.steps, thoughts: value.thoughts, latestCheckpoint: value.latestCheckpoint, effortEstimate: value.effortEstimate ?? value.aiEffort?.effortEstimate ?? null, welcomeBack: getWelcomeBack(value.latestCheckpoint, value.thoughts, value.steps) };
  }
  function shelf(id: string): ShelfCard {
    const value = detail(id);
    const estimate = value.effortEstimate;
    const valid = estimate && estimate.minMinutes > 0 && estimate.maxMinutes >= estimate.minMinutes;
    const start = valid ? getStartBy(value.assignment, (estimate.minMinutes + estimate.maxMinutes) / 2, now())
      : !value.assignment.dueAt ? { startByAt: null, reason: "No Canvas due date", state: "no_due_date" as const }
      : new Date(value.assignment.dueAt) <= now() ? { startByAt: null, reason: "Start when you can", state: "overdue" as const }
      : { startByAt: null, reason: "Generate or make a plan to suggest a start date.", state: "needs_plan" as const };
    const saved = get(id);
    return { effortEstimate: estimate, effortSource: saved.effortEstimate ? "student" : estimate ? "ai" : null,
      effortStatus: estimate ? "ready" : saved.aiEffort?.effortStatus ?? "pending", assignment: value.assignment, startByAt: start.startByAt, startByReason: start.reason, startByState: start.state, stepsDone: value.steps.filter(s => s.done).length, stepsTotal: value.steps.length };
  }
  function saveThought(id: string, kind: ThoughtKind, text: string) {
    const clean = text.trim();
    if (!clean || clean.length > 160) throw new Error("Enter a thought of 1–160 characters.");
    const existing = get(id);
    if (warning && existing.thoughts[0]?.kind === kind && existing.thoughts[0]?.text === clean) { flush(); return get(id); }
    return patch(id, { thoughts: [{ id: uuid(), assignmentId: id, kind, text: clean, createdAt: now().toISOString() }, ...get(id).thoughts] });
  }
  function saveCheckpoint(id: string, note: string, nextStep: string) {
    if (!note.trim() || note.trim().length > 500 || nextStep.trim().length > 200) throw new Error("Write where you stopped (up to 500 characters) and an optional next step (up to 200).");
    return patch(id, { latestCheckpoint: { id: uuid(), assignmentId: id, note: note.trim(), nextStep: nextStep.trim(), createdAt: now().toISOString() } });
  }
  return { get, patch, detail, shelf, saveAiEffort: (id: string, result: EffortResult) => patch(id, { aiEffort: result, aiEffortInput: effortInputSignature(assignment(id)) }), saveThought, saveCheckpoint, flush, warning: () => warning, begin: () => { read(); flush(); } };
}

export const demoStore = createDemoStore(() => window.localStorage);
// These non-sensitive flags also work in memory when browser storage is blocked.
const flags = new Map<string, string>();
export function demoFlag(key: string) {
  try { return window.localStorage.getItem(key) ?? flags.get(key) ?? null; } catch { return flags.get(key) ?? null; }
}
export function setDemoFlag(key: string, value: string | null) {
  if (value === null) flags.delete(key); else flags.set(key, value);
  try { if (value === null) window.localStorage.removeItem(key); else window.localStorage.setItem(key, value); } catch { /* Demo stays usable in this tab. */ }
}
