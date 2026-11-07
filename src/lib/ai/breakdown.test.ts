import assert from "node:assert/strict";
import { test } from "node:test";
import { zodTextFormat } from "openai/helpers/zod";
import { breakdownOutputSchema, breakdownSchema } from "./breakdown-schema";
import { breakDown, createBreakDown, reviewInstructions } from "./breakdown";

const source = { id: "essay", userId: "demo", title: "History essay", descriptionText: "Write a short essay using the two course readings." };
const draft = {
  steps: [{ text: "Read the instructions", minutes: 20 }],
  effortMinMinutes: 120, effortMaxMinutes: 180, needsReview: false, note: "Suggested; edit before saving.",
};

test("schema rejects invalid ranges, blank text, extra fields, and invalid step counts", () => {
  assert.ok(breakdownSchema.safeParse(draft).success);
  for (const invalid of [
    { ...draft, effortMinMinutes: 200 }, { ...draft, dueAt: "invented" },
    { ...draft, steps: [] }, { ...draft, steps: Array(7).fill(draft.steps[0]) },
    { ...draft, steps: [{ text: " ", minutes: 20 }] },
    { ...draft, steps: [{ text: "Read", minutes: 0 }] },
  ]) assert.equal(breakdownSchema.safeParse(invalid).success, false);
  assert.equal(zodTextFormat(breakdownOutputSchema, "breakdown").type, "json_schema");
});

test("cache deduplicates concurrent calls and keeps returned drafts independently editable", async () => {
  let calls = 0;
  const run = createBreakDown(async () => { calls++; return { status: "completed", output_parsed: draft }; });
  const [a, b] = await Promise.all([run(source), run(source)]);
  assert.equal(calls, 1);
  a.steps[0].text = "Student edit";
  assert.equal(b.steps[0].text, "Read the instructions");
  await run({ ...source, descriptionText: "Changed instructions" });
  await run({ ...source, userId: "another-user" });
  assert.equal(calls, 3);
});

test("missing, refused, incomplete, malformed and unavailable responses all permit manual planning", async () => {
  for (const response of [
    { status: "completed", output_parsed: null },
    { status: "incomplete", output_parsed: draft },
    { status: "completed", output_parsed: { ...draft, steps: [] } },
  ]) {
    assert.deepEqual(await createBreakDown(async () => response)(source), {
      steps: [], needsReview: true, note: "Make a manual plan",
    });
  }
  const run = createBreakDown(async () => { throw new Error("provider outage"); });
  assert.equal((await run(source)).steps.length, 0);
});

test("failures can be retried; blank instructions make no call; only capped source fields leave", async () => {
  let calls = 0;
  const run = createBreakDown(async (input) => {
    calls++;
    assert.deepEqual(Object.keys(input).sort(), ["descriptionText", "title"]);
    assert.ok(input.descriptionText.length <= 12000);
    assert.ok(input.title.length <= 240);
    if (calls === 1) throw new Error("offline");
    return { status: "completed", output_parsed: { ...draft, needsReview: true } };
  });
  await run({ ...source, descriptionText: " " });
  assert.equal(calls, 0);
  await run(source);
  assert.equal((await run(source)).needsReview, true);
  assert.equal(calls, 2);
  await run({ ...source, title: "a".repeat(300), descriptionText: "b".repeat(13000) });
});

test("unconfigured live adapter returns a manual plan without a network request", async () => {
  const groqKey = process.env.GROQ_API_KEY;
  const key = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  try {
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
    assert.deepEqual(await breakDown(source), { steps: [], needsReview: true, note: "Make a manual plan" });
  } finally {
    if (groqKey !== undefined) process.env.GROQ_API_KEY = groqKey;
    if (key !== undefined) process.env.OPENAI_API_KEY = key;
    if (model !== undefined) process.env.OPENAI_MODEL = model;
  }
});

test("generic instructions get manual review without a model call; short specific prompts still work", async () => {
  let calls = 0;
  const run = createBreakDown(async () => { calls++; return { status: "completed", output_parsed: draft }; });
  for (const descriptionText of ["Do the assignment.", "Complete your homework!", "Finish this task"]) {
    assert.deepEqual(await run({ ...source, descriptionText }), { steps: [], needsReview: true, note: "Make a manual plan" });
  }
  assert.equal(calls, 0);
  assert.equal((await run({ ...source, descriptionText: "Read chapter 3." })).steps.length, 1);
  assert.equal(calls, 1);
});

test("truncation forces review even when a model reports confidence; different truncation does not reuse a confident draft", async () => {
  const run = createBreakDown(async () => ({ status: "completed", output_parsed: draft }));
  const text = "a".repeat(12000);
  assert.equal((await run({ ...source, descriptionText: text })).needsReview, false);
  const result = await run({ ...source, descriptionText: text + " Additional instructions." });
  assert.equal(result.needsReview, true);
  assert.match(result.note, /Only part of the instructions/);
});

test("empty review notes receive usable UI wording and cached copies keep editable estimates", async () => {
  const run = createBreakDown(async () => ({ status: "completed", output_parsed: { ...draft, needsReview: true, note: " " } }));
  const first = await run(source);
  assert.match(first.note, /Review the Canvas prompt/);
  if ("effortMinMinutes" in first) first.effortMinMinutes = 30;
  const second = await run(source);
  assert.ok("effortMinMinutes" in second);
  assert.equal(second.effortMinMinutes, 10);
});

test("vague model output cannot invent research or submission steps, even in its note", async () => {
  const run = createBreakDown(async () => ({ status: "completed", output_parsed: {
    ...draft, needsReview: true,
    steps: [{ text: "Find three scholarly sources and upload a PDF", minutes: 60 }],
    note: "Use APA and submit on Canvas",
  } }));
  assert.deepEqual(await run({ ...source, descriptionText: "Prepare for discussion." }), reviewInstructions());
});

test("known vague preparation prompt is review-only even if the provider would be confident", async () => {
  const run = createBreakDown(async () => { assert.fail("Vague preparation must not call the provider"); });
  assert.deepEqual(await run({ ...source, descriptionText: "Prepare something about history for class." }), reviewInstructions());
});
