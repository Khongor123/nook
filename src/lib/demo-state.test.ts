import test from "node:test";
import assert from "node:assert/strict";
import { createDemoStore, DEMO_STATE_KEY } from "./demo-state";
import { demoAssignments } from "./demo-fixtures";

const id = demoAssignments[0].id, other = demoAssignments[1].id;
function fixture() {
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
  let count = 0;
  const create = () => createDemoStore(() => storage, () => new Date("2026-11-08T12:00:00Z"), () => `fictional-${++count}`);
  return { data, storage, create };
}
const steps = [{ id: "fictional-step", assignmentId: id, text: "Read instructions", minutes: 30, done: false, source: "suggested" as const }];

test("fresh demo has no plan, effort, thoughts, checkpoint, or fixture progress", () => {
  const { create, data } = fixture(); const store = create(); store.begin();
  assert.equal(demoAssignments.length, 6);
  for (const assignment of demoAssignments) assert.equal(store.get(assignment.id).steps.length, 0);
  assert.deepEqual(store.get(id), { aiEffortInput: null, aiEffort: null, steps: [], thoughts: [], latestCheckpoint: null, effortEstimate: null, draftNote: "", needsReview: false });
  assert.equal(store.shelf(id).startByState, "needs_plan");
  assert.ok(data.has(DEMO_STATE_KEY));
});
test("generated plan, edits, completion, effort and deletion survive a new store", () => {
  const { create } = fixture(); const store = create();
  const due = store.detail(id).assignment.dueAt;
  store.patch(id, { steps, effortEstimate: { minMinutes: 120, maxMinutes: 180 } });
  const firstStart = store.shelf(id).startByAt;
  store.patch(id, { steps: [{ ...steps[0], text: "Edited", done: true }], effortEstimate: { minMinutes: 300, maxMinutes: 400 } });
  assert.notEqual(store.shelf(id).startByAt, firstStart);
  assert.equal(create().get(id).steps[0].text, "Edited");
  assert.equal(create().shelf(id).stepsDone, 1);
  assert.equal(create().detail(id).assignment.dueAt, due);
  store.patch(id, { steps: [] });
  assert.deepEqual(create().get(id).steps, []);
  assert.deepEqual(create().get(other).steps, []);
});
test("thoughts and edited latest checkpoint stay on their assignment; reflections never become actions", () => {
  const { create } = fixture(); const store = create();
  store.patch(id, { steps });
  store.saveThought(id, "idea", "First idea"); store.saveThought(id, "reflection", "Feeling overwhelmed");
  store.saveCheckpoint(id, "Read instructions", "Open the reading");
  store.saveCheckpoint(id, "New checkpoint", "Write an outline");
  const detail = create().detail(id);
  assert.equal(detail.welcomeBack.nextAction, "Write an outline");
  assert.equal(detail.welcomeBack.ideaText, "First idea");
  assert.equal(detail.latestCheckpoint?.note, "New checkpoint");
  assert.equal(detail.steps.length, 1);
  assert.equal(create().detail(other).thoughts.length, 0);
});
test("empty plan and all-complete return states are deterministic", () => {
  const { create } = fixture(); const store = create();
  store.saveCheckpoint(id, "Paused", "");
  assert.equal(store.detail(id).welcomeBack.nextAction, "Open the assignment");
  store.patch(id, { steps: [{ ...steps[0], done: true }] });
  assert.equal(store.detail(id).welcomeBack.nextAction, "Review and submit when ready");
});
test("old fixture state is ignored and corrupt storage warns without breaking the demo", () => {
  const { data, create } = fixture();
  data.set("nook-demo-state", JSON.stringify({ [id]: { steps } }));
  assert.equal(create().get(id).steps.length, 0);
  data.set(DEMO_STATE_KEY, "broken");
  const store = create(); assert.equal(store.get(id).steps.length, 0); assert.ok(store.warning());
  assert.ok(data.has("nook-demo-state"));
});
test("failed writes preserve in-memory progress and report failure", () => {
  const store = createDemoStore(() => ({ getItem: () => null, setItem: () => { throw new Error("blocked"); } }));
  assert.throws(() => store.patch(id, { steps }), /could not be saved/i);
  assert.equal(store.get(id).steps.length, 1);
  assert.ok(store.warning());
});
test("draft changes can be staged and flushed before navigation; copies are independent", () => {
  const { create } = fixture(); const store = create();
  store.patch(id, { steps }, false);
  assert.equal(create().get(id).steps.length, 0);
  store.flush(); assert.equal(create().get(id).steps.length, 1);
  const copy = store.get(id); copy.steps[0].text = "outside edit";
  assert.equal(store.get(id).steps[0].text, steps[0].text);
});

test("retrying a failed thought save persists the same record without duplicating it", () => {
  let blocked = true, raw: string | null = null;
  const store = createDemoStore(() => ({ getItem: () => raw, setItem: (_key, value) => { if (blocked) throw new Error("quota"); raw = value; } }));
  assert.throws(() => store.saveThought(id, "idea", "Fictional idea"));
  blocked = false; store.saveThought(id, "idea", "Fictional idea");
  assert.equal(store.detail(id).thoughts.length, 1);
  assert.equal(store.warning(), "");
});
test("latest Idea wins even when saves have the same timestamp", () => {
  const { create } = fixture(); const store = create();
  store.saveThought(id, "idea", "First idea"); store.saveThought(id, "idea", "Latest idea");
  store.saveCheckpoint(id, "Paused", "Draft");
  assert.equal(create().detail(id).welcomeBack.ideaText, "Latest idea");
});

test("automatic AI estimates create no steps, preserve notes and due dates, and never replace reviewed effort", () => {
  const { create } = fixture(); const store = create();
  store.saveThought(id, "reflection", "Fictional reflection"); store.saveCheckpoint(id, "Paused", "Write");
  const before = store.detail(id);
  store.saveAiEffort(id, { sourceHash: "example", effortStatus: "ready", effortEstimate: { minMinutes: 180, maxMinutes: 300 }, needsReview: false });
  const after = create().detail(id);
  assert.equal(after.steps.length, 0); assert.deepEqual(after.thoughts, before.thoughts); assert.deepEqual(after.latestCheckpoint, before.latestCheckpoint);
  assert.equal(after.assignment.dueAt, before.assignment.dueAt); assert.equal(store.shelf(id).effortSource, "ai");
  store.patch(id, { effortEstimate: { minMinutes: 60, maxMinutes: 120 } });
  store.saveAiEffort(id, { sourceHash: "new", effortStatus: "ready", effortEstimate: { minMinutes: 240, maxMinutes: 360 }, needsReview: false });
  assert.deepEqual(store.detail(id).effortEstimate, { minMinutes: 60, maxMinutes: 120 }); assert.equal(store.shelf(id).effortSource, "student");
});

test("a blocked estimate write retains the successful AI result in memory without making a plan", () => {
  const store = createDemoStore(() => ({ getItem: () => null, setItem: () => { throw new Error("blocked"); } }));
  assert.throws(() => store.saveAiEffort(id, { sourceHash: "current", effortStatus: "ready", effortEstimate: { minMinutes: 120, maxMinutes: 180 }, needsReview: false }));
  assert.equal(store.shelf(id).effortStatus, "ready"); assert.equal(store.detail(id).steps.length, 0); assert.ok(store.warning());
});
