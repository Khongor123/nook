import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { CanvasError, canvasAssignmentUrl, canvasPages } from "./canvas";

const config = { base: new URL("https://school.instructure.com/"), token: "test-only" };
const item = z.object({ id: z.string() });
const path = "/api/v1/courses?per_page=1";
const noWait = async () => {};

test("Canvas pagination follows the next link and keeps string IDs", async () => {
  const seen: string[] = [];
  const fakeFetch = (async (url: URL | RequestInfo) => {
    seen.push(String(url));
    return seen.length === 1
      ? Response.json([{ id: "9007199254740993" }], { headers: {
        Link: '<https://school.instructure.com/api/v1/courses?page=2>; rel="next"',
      } })
      : Response.json([{ id: "2" }]);
  }) as typeof fetch;
  assert.deepEqual(await canvasPages(config, path, item, 10, fakeFetch, noWait), [
    { id: "9007199254740993" }, { id: "2" },
  ]);
  assert.equal(seen.length, 2);
});

test("Canvas retries temporary 429 and 5xx, then reports a partial-course-safe error", async () => {
  const waits: number[] = [];
  let calls = 0;
  const fakeFetch = (async () => {
    calls++;
    if (calls === 1) return new Response("", { status: 429, headers: { "Retry-After": "1" } });
    if (calls === 2) return new Response("", { status: 503 });
    return Response.json([{ id: "3" }]);
  }) as typeof fetch;
  assert.deepEqual(await canvasPages(config, path, item, 10, fakeFetch,
    async (ms) => { waits.push(ms); }), [{ id: "3" }]);
  assert.deepEqual(waits, [1000, 500]);

  const failed = (async () => new Response("", { status: 503 })) as typeof fetch;
  await assert.rejects(canvasPages(config, path, item, 10, failed, noWait),
    (error: unknown) => error instanceof CanvasError && error.code === "CANVAS_REQUEST_FAILED" && error.retryable);
});

test("Canvas rejects bad credentials, unsafe page links, and external assignment URLs", async () => {
  const unauthorized = (async () => new Response("", { status: 401 })) as typeof fetch;
  await assert.rejects(canvasPages(config, path, item, 10, unauthorized, noWait),
    (error: unknown) => error instanceof CanvasError && error.code === "CANVAS_AUTH_FAILED");

  const external = (async () => Response.json([{ id: "1" }], { headers: {
    Link: '<https://other.example/api/v1/courses?page=2>; rel="next"',
  } })) as typeof fetch;
  await assert.rejects(canvasPages(config, path, item, 10, external, noWait),
    (error: unknown) => error instanceof CanvasError && error.code === "CANVAS_BAD_PAGE");
  assert.equal(canvasAssignmentUrl("https://other.example/a", config.base), null);
  assert.equal(canvasAssignmentUrl("https://school.instructure.com/courses/1/assignments/2", config.base),
    "https://school.instructure.com/courses/1/assignments/2");
});
