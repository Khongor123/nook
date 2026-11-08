import test from "node:test";
import assert from "node:assert/strict";
import { createDemoBreakdownHandler } from "./demo-breakdown";
import { createBreakDown, createProviderGenerator } from "./breakdown";
import { demoAssignments } from "../demo-fixtures";
import type { BreakdownResult } from "./breakdown-schema";
const id = demoAssignments[0].id;
const request = (init?: RequestInit) => new Request(`http://localhost/api/demo/assignments/${id}/breakdown`, { method: "POST", ...init });
const draft: BreakdownResult = { steps: [{ text: "Outline the essay using the two course readings", minutes: 15 }], effortMinMinutes: 10, effortMaxMinutes: 20, needsReview: false, note: "Review this suggestion." };

test("public demo generation uses only the server's fictional assignment and returns the draft", async () => {
  let calls = 0;
  const handler = createDemoBreakdownHandler(async assignment => { calls++; assert.deepEqual(assignment, demoAssignments[0]); return draft; });
  const response = await handler(request(), id);
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), draft); assert.equal(calls, 1);
  assert.equal(response.headers.get("cache-control"), "no-store");
});
test("unknown IDs, custom prompts, queries and cross-origin requests never reach AI", async () => {
  let calls = 0; const handler = createDemoBreakdownHandler(async () => { calls++; return draft; });
  assert.equal((await handler(request(), "real-student-assignment")).status, 404);
  assert.equal((await handler(request({ body: JSON.stringify({ title: "custom" }) }), id)).status, 400);
  assert.equal((await handler(new Request("http://localhost/api/demo?prompt=custom", { method: "POST" }), id)).status, 400);
  assert.equal((await handler(request({ headers: { origin: "https://elsewhere.example" } }), id)).status, 403);
  assert.equal(calls, 0);
});
test("review-only and empty fallback retain their response shape; errors remain private", async () => {
  for (const result of [{ ...draft, needsReview: true }, { steps: [], needsReview: true, note: "Make a manual plan" }] as BreakdownResult[]) {
    const response = await createDemoBreakdownHandler(async () => result)(request(), id);
    assert.deepEqual(await response.json(), result);
  }
  const response = await createDemoBreakdownHandler(async () => { throw new Error("secret-provider-details"); })(request(), id);
  assert.deepEqual(await response.json(), { steps: [], needsReview: true, note: "Make a manual plan" });
});
test("two active requests reject a third; slots are released after completion", async () => {
  let resolve!: (value: BreakdownResult) => void;
  const pending = new Promise<BreakdownResult>(r => { resolve = r; });
  const handler = createDemoBreakdownHandler(() => pending);
  const first = handler(request(), id), second = handler(request(), id);
  assert.equal((await handler(request(), id)).status, 429);
  resolve(draft); await Promise.all([first, second]);
  assert.equal((await handler(request(), id)).status, 200);
});
test("ten calls per minute per process, with recovery after the window", async () => {
  let time = 0; const handler = createDemoBreakdownHandler(async () => draft, () => time);
  for (let i = 0; i < 10; i++) assert.equal((await handler(request(), id)).status, 200);
  const limited = await handler(request(), id); assert.equal(limited.status, 429); assert.equal(limited.headers.get("retry-after"), "60");
  time = 60000; assert.equal((await handler(request(), id)).status, 200);
});
test("fake provider transport exercises real parsing and schema retry through demo handler", async () => {
  let calls = 0;
  const generate = createProviderGenerator({ GROQ_API_KEY: "fictional-test-key" }, async () => {
    calls++;
    if (calls === 1) return Response.json({ error: { code: "json_validate_failed", message: "fictional" } }, { status: 400 });
    return Response.json({ id: "resp_demo", object: "response", created_at: 0, status: "completed", output: [{ type: "message", id: "msg_demo", status: "completed", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(draft), annotations: [] }] }] });
  });
  const response = await createDemoBreakdownHandler(createBreakDown(generate))(request(), id);
  assert.deepEqual(await response.json(), draft); assert.equal(calls, 2);
});

 test("Next-style empty POST streams are accepted without permitting prompt bodies", async () => {
  let calls = 0;
  const handler = createDemoBreakdownHandler(async () => { calls++; return draft; });
  const emptyStream = new ReadableStream({ start(controller) { controller.close(); } });
  const req = new Request("http://localhost/api/demo", { method: "POST", body: emptyStream, duplex: "half" } as RequestInit);
  assert.equal((await handler(req, id)).status, 200);
  assert.equal(calls, 1);
});
