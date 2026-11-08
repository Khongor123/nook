import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { CanvasError, canvasAssignmentUrl, canvasPages, isSubmittedOrGradedAssignment, listCanvasAssignments } from "./canvas";

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

test("assignment import requests the current submission and hides submitted or graded work", async () => {
  let requested = "";
  const fakeFetch = (async (url: URL | RequestInfo) => {
    requested = String(url);
    return Response.json([
      { id: "1", name: "Graded", submission: { workflow_state: "graded", graded_at: "2026-11-01T12:00:00Z" } },
      { id: "2", name: "Ungraded", submission: { workflow_state: "submitted", grade: null } },
      { id: "3", name: "New attempt", submission: { workflow_state: "submitted", grade: "85", grade_matches_current_submission: false } },
      { id: "4", name: "No submission" },
      { id: "5", name: "Zero grade", submission: { workflow_state: "submitted", score: 0 } },
      { id: "6", name: "Pending review", submission: { workflow_state: "pending_review" } },
      { id: "7", name: "Submitted timestamp", submission: { workflow_state: "unsubmitted", submitted_at: "2026-11-02T12:00:00Z" } },
      { id: "8", name: "Unsubmitted stale grade", submission: { workflow_state: "unsubmitted", grade: "85", grade_matches_current_submission: false } },
    ]);
  }) as typeof fetch;
  const assignments = await listCanvasAssignments(config, "42", fakeFetch);
  assert.equal(new URL(requested).searchParams.get("include[]"), "submission");
  assert.deepEqual(assignments.map(isSubmittedOrGradedAssignment), [true, true, true, false, true, true, true, false]);
});
