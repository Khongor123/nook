import assert from "node:assert/strict";
import { test } from "node:test";
import { inspectDraft } from "./quality-check";
import { exampleAssignment, exampleDraft } from "../planning/demo-example";

test("clear fictional essay keeps supplied readings and PDF submission, without inventing a destination", () => {
  assert.deepEqual(inspectDraft(exampleDraft, exampleAssignment.descriptionText), []);
  assert.deepEqual(inspectDraft({ ...exampleDraft, steps: [
    { text: "Use 2 course readings in the essay and submit a PDF", minutes: 150 },
  ] }, exampleAssignment.descriptionText), []);
});

test("clear outputs flag invented sources, counts, citation styles, formats and destinations", () => {
  const draft = { ...exampleDraft,
    steps: [{ text: "Find three scholarly sources, use APA, upload a DOCX to Turnitin", minutes: 150 }],
  };
  const findings = inspectDraft(draft, exampleAssignment.descriptionText);
  for (const expected of ["unsupported_sources", "changed_source_count", "unsupported_citation_style",
    "unsupported_format", "unsupported_destination"]) assert.ok(findings.includes(expected as typeof findings[number]));
});

test("a clear reading task does not authorize research or submission", () => {
  const findings = inspectDraft({ ...exampleDraft, note: "", steps: [
    { text: "Find two references and email the summary as a PDF", minutes: 150 },
  ] }, "Read chapter 3. Write a 150-word summary.");
  assert.ok(findings.includes("unsupported_sources"));
  assert.ok(findings.includes("unsupported_submission"));
  assert.ok(findings.includes("unsupported_format"));
  assert.ok(findings.includes("unsupported_destination"));
  assert.ok(findings.every((finding) => !finding.includes("summary")));
});

test("step totals outside the effort range are flagged rather than silently called consistent", () => {
  const findings = inspectDraft({ ...exampleDraft, effortMinMinutes: 180, effortMaxMinutes: 240,
    steps: [{ text: "Draft the essay", minutes: 270 }],
  }, exampleAssignment.descriptionText);
  assert.ok(findings.includes("effort_mismatch"));
});

test("an ordinary primary-argument step does not imply a new primary-source requirement", () => {
  assert.deepEqual(inspectDraft({ ...exampleDraft, note: "", steps: [
    { text: "Identify the primary argument and write a summary", minutes: 150 },
  ] }, "Read chapter 3. Write a summary of its main argument."), []);
});
