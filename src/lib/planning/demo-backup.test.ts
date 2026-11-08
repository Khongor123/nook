import assert from "node:assert/strict";
import { test } from "node:test";
import { prepareDemoBackup, demoBackupLabel } from "./demo-backup";
import { exampleDraft, exampleAssignment } from "./demo-example";
import backup from "./demo-backup.json";
import { breakdownSchema } from "../ai/breakdown-schema";
import { inspectDraft } from "../ai/quality-check";

test("backup capture labels a reviewed candidate as previous AI output, keeps edits independent, and stores only fictional source", () => {
  const input = structuredClone(exampleDraft); // Fake output for offline capture-contract test only.
  const backup = prepareDemoBackup(input, new Date("2026-11-07T00:00:00Z"));
  assert.equal(backup.label, demoBackupLabel);
  assert.equal(backup.provenance.reviewStatus, "awaiting_human_review");
  assert.deepEqual(Object.keys(backup.assignment).sort(), ["descriptionText", "title"]);
  assert.equal(backup.assignment.descriptionText, exampleAssignment.descriptionText);
  backup.draft.steps[0].text = "Student edit";
  assert.deepEqual(input, exampleDraft);
});

test("backup capture rejects fallback, vague output, invented requirements, and effort mismatch", () => {
  for (const invalid of [
    { steps: [], needsReview: true, note: "Make a manual plan" },
    { ...exampleDraft, needsReview: true },
    { ...exampleDraft, steps: [{ text: "Find three scholarly sources and upload DOCX to Turnitin", minutes: 150 }] },
    { ...exampleDraft, effortMinMinutes: 180, effortMaxMinutes: 240 },
  ]) assert.throws(() => prepareDemoBackup(invalid));
});

test("committed previous-AI backup is explicitly human-edited, grounded in the fictional prompt, and editable", () => {
  assert.equal(backup.provenance.reviewStatus, "reviewed_and_edited");
  assert.ok(backup.provenance.edits.length > 0);
  assert.match(backup.label, /not a live response/);
  assert.equal(backup.assignment.descriptionText, exampleAssignment.descriptionText);
  const draft = breakdownSchema.parse(backup.draft);
  assert.deepEqual(inspectDraft(draft, backup.assignment.descriptionText), []);
  const total = draft.steps.reduce((sum, step) => sum + step.minutes, 0);
  assert.equal(total, 230);
  assert.ok(total >= draft.effortMinMinutes && total <= draft.effortMaxMinutes);
  draft.steps[0].text = "Student demo edit";
  assert.notEqual(draft.steps[0].text, backup.draft.steps[0].text);
});
