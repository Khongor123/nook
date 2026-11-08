import "server-only";
import { demoAssignments } from "../demo-fixtures";
import { createBreakDown, createProviderGenerator } from "./breakdown";
import { createDemoLimiter, invalidDemoRequest, demoBusy } from "./demo-limit";
import type { Assignment } from "../types";
import type { BreakdownResult } from "./breakdown-schema";

type Generate = (assignment: Assignment) => Promise<BreakdownResult>;
const reply = (body: unknown, status = 200, headers: Record<string, string> = {}) => Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
const error = (code: string, message: string, status: number, retryable = false, headers?: Record<string, string>) => reply({ code, message, retryable }, status, headers);

/** Limits apply to one process, not a distributed deployment-wide budget. */
export function createDemoBreakdownHandler(generate: Generate = assignment => createBreakDown(createProviderGenerator())(assignment), now = Date.now, limiter = createDemoLimiter(now)) {
  return async (request: Request, id: string) => {
    const assignment = demoAssignments.find(item => item.id === id);
    if (!assignment) return error("NOT_FOUND", "Demo assignment not found", 404);
    const invalid = await invalidDemoRequest(request); if (invalid) return invalid;
    const release = limiter.acquire(); if (!release) return demoBusy();
    try { return reply(await generate(structuredClone(assignment))); }
    catch { return reply({ steps: [], needsReview: true, note: "Make a manual plan" }); }
    finally { release(); }
  };
}
