import assert from "node:assert/strict";
import { test } from "node:test";
import { createBreakDown, createProviderGenerator } from "./breakdown";
import { exampleAssignment, exampleDraft, exampleSteps } from "../planning/demo-example";

// Real SDK + fake HTTP transport: no credentials or network calls are used.
const env = { GROQ_API_KEY: "test-only-not-a-key" };
function response(text: string, status = "completed") {
  return Response.json({
    id: "resp_fictional", object: "response", created_at: 1, status,
    output: [{ id: "msg_fictional", type: "message", role: "assistant", status: "completed",
      content: [{ type: "output_text", text, annotations: [] }] }],
  });
}

test("Groq adapter parses a clear fictional draft using the configured model and strict schema", async () => {
  let calls = 0;
  const generator = createProviderGenerator({ ...env, GROQ_MODEL: "test-model", OPENAI_API_KEY: "unused" },
    async (url, init) => {
      calls++;
      assert.equal(String(url), "https://api.groq.com/openai/v1/responses");
      const body = JSON.parse(String(init?.body));
      assert.equal(body.model, "test-model");
      assert.equal(body.store, undefined);
      assert.equal(body.text.format.strict, true);
      assert.equal(body.text.format.schema.additionalProperties, false);
      assert.match(body.input[0].content, /untrusted assignment data/);
      assert.match(body.input[0].content, /needsReview/);
      assert.deepEqual(JSON.parse(body.input[1].content), {
        title: exampleAssignment.title, descriptionText: exampleAssignment.descriptionText,
      });
      return response(JSON.stringify(exampleDraft));
    });
  const source = structuredClone(exampleAssignment);
  const result = await createBreakDown(generator)(Object.freeze(source));
  assert.deepEqual(result, exampleDraft);
  result.steps[0].text = "My edited opening step";
  if ("effortMinMinutes" in result) result.effortMinMinutes = 100;
  assert.equal(source.dueAt, exampleAssignment.dueAt);
  assert.equal(calls, 1);
});

test("Groq has the existing default model; OpenAI stays on its original endpoint", async () => {
  for (const [config, endpoint, model] of [
    [env, "https://api.groq.com/openai/v1/responses", "openai/gpt-oss-20b"],
    [{ OPENAI_API_KEY: "test-only", OPENAI_MODEL: "test-openai" }, "https://api.openai.com/v1/responses", "test-openai"],
  ] as const) {
    const run = createBreakDown(createProviderGenerator(config, async (url, init) => {
      const body = JSON.parse(String(init?.body));
      assert.equal(String(url), endpoint);
      assert.equal(body.model, model);
      if (!config.GROQ_API_KEY) assert.equal(body.store, false);
      return response(JSON.stringify(exampleDraft));
    }));
    assert.ok((await run(exampleAssignment)).steps.length > 0);
  }
});

test("Groq 401, 429, and 5xx return manual planning without automatic retries", async () => {
  for (const status of [401, 429, 500, 503]) {
    let calls = 0;
    const run = createBreakDown(createProviderGenerator(env, async () => {
      calls++;
      return Response.json({ error: { message: "private provider detail" } }, { status });
    }));
    assert.deepEqual(await run(exampleAssignment), { steps: [], needsReview: true, note: "Make a manual plan" });
    assert.equal(calls, 1);
  }
});

function schemaRejection(status = 400, code = "json_validate_failed") {
  return Response.json({ error: { code, message: "Fictional private error detail" } }, { status });
}

test("one Groq schema rejection then success makes two requests and returns only an editable draft", async () => {
  let calls = 0;
  const savedPlan = Object.freeze({ steps: Object.freeze(structuredClone(exampleSteps)),
    effortMinMinutes: 120, effortMaxMinutes: 180 });
  const assignment = Object.freeze({ ...exampleAssignment, savedPlan });
  const before = structuredClone(assignment);
  const bodies: unknown[] = [];
  const run = createBreakDown(createProviderGenerator(env, async (url, init) => {
    assert.equal(String(url), "https://api.groq.com/openai/v1/responses");
    assert.equal(init?.method, "POST");
    bodies.push(JSON.parse(String(init?.body)));
    return ++calls === 1 ? schemaRejection() : response(JSON.stringify(exampleDraft));
  }));
  const result = await run(assignment);
  assert.equal(calls, 2);
  assert.deepEqual(bodies[0], bodies[1]);
  assert.deepEqual(result, exampleDraft);
  assert.deepEqual(assignment, before);
  result.steps[0].text = "Student draft edit";
  assert.deepEqual(assignment, before); // No saved steps/effort or Canvas due date are changed.
  assert.deepEqual(await run(assignment), exampleDraft);
  assert.equal(calls, 2); // Cache the success, never a saved plan mutation.
});

test("two Groq schema rejections make exactly two requests and return the unchanged safe fallback", async () => {
  let calls = 0;
  const run = createBreakDown(createProviderGenerator(env, async () => { calls++; return schemaRejection(); }));
  assert.deepEqual(await run(exampleAssignment), { steps: [], needsReview: true, note: "Make a manual plan" });
  assert.equal(calls, 2);
});

test("authentication or rate-limit failure on the second attempt stops without a third request", async () => {
  for (const status of [401, 429]) {
    let calls = 0;
    const run = createBreakDown(createProviderGenerator(env, async () => {
      return ++calls === 1 ? schemaRejection() : schemaRejection(status);
    }));
    assert.deepEqual(await run(exampleAssignment), { steps: [], needsReview: true, note: "Make a manual plan" });
    assert.equal(calls, 2);
  }
});

test("schema-like errors do not retry unless provider, status and code all match", async () => {
  for (const [config, status, code] of [
    [env, 401, "json_validate_failed"], [env, 429, "json_validate_failed"],
    [env, 400, "invalid_request_error"], [env, 422, "json_validate_failed"],
    [{ OPENAI_API_KEY: "test-only", OPENAI_MODEL: "test-model" }, 400, "json_validate_failed"],
  ] as const) {
    let calls = 0;
    const run = createBreakDown(createProviderGenerator(config, async () => {
      calls++; return schemaRejection(status, code);
    }));
    assert.deepEqual(await run(exampleAssignment), { steps: [], needsReview: true, note: "Make a manual plan" });
    assert.equal(calls, 1);
  }
});

test("network/timeout errors, incomplete output, malformed JSON, and refusal are never partial plans", async () => {
  const transports: (typeof fetch)[] = [
    async () => { throw new DOMException("Timed out", "TimeoutError"); },
    async () => response(JSON.stringify(exampleDraft), "incomplete"),
    async () => response("{broken"),
    async () => response(JSON.stringify({ ...exampleDraft, dueAt: "invented" })),
    async () => Response.json({
      id: "refusal", object: "response", created_at: 1, status: "completed",
      output: [{ id: "msg", type: "message", role: "assistant", status: "completed",
        content: [{ type: "refusal", refusal: "Cannot help" },
          { type: "output_text", text: JSON.stringify(exampleDraft), annotations: [] }] }],
    }),
  ];
  for (const transport of transports) {
    let calls = 0;
    const result = await createBreakDown(createProviderGenerator(env, async (...args) => {
      calls++; return transport(...args);
    }))(exampleAssignment);
    assert.deepEqual(result, { steps: [], needsReview: true, note: "Make a manual plan" });
    assert.equal(calls, 1);
  }
});

test("a vague assignment does not become an instruction-only plan", async () => {
  const run = createBreakDown(createProviderGenerator(env, async () => response(JSON.stringify({
    steps: [{ text: "Open Canvas and check the full instructions", minutes: 10 }],
    effortMinMinutes: 10, effortMaxMinutes: 20, needsReview: true,
    note: "The prompt does not specify a topic or deliverable. Review Canvas before planning.",
  }))));
  const result = await run({ ...exampleAssignment, descriptionText: "Prepare for discussion." });
  assert.equal(result.needsReview, true);
  assert.equal(result.steps.length, 0);
});
