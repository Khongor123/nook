import "server-only";
import { demoAssignments } from "../demo-fixtures";
import { estimateEffort, effortSourceHash, unavailableEffort } from "./effort";
import { demoLimiter, invalidDemoRequest, demoBusy } from "./demo-limit";
import type { createDemoLimiter } from "./demo-limit";
export function createDemoEffortHandler(estimate = estimateEffort, hash = effortSourceHash, limiter: ReturnType<typeof createDemoLimiter> = demoLimiter) {
  return async (request: Request, id: string) => {
    const headers = { "Cache-Control": "no-store" };
    const assignment = demoAssignments.find(a => a.id === id);
    if (!assignment) return Response.json({ code: "NOT_FOUND", message: "Demo assignment not found", retryable: false }, { status: 404, headers });
    const invalid = await invalidDemoRequest(request); if (invalid) return invalid;
    const sourceHash = hash(assignment);
    // A cached browser result is revalidated against current source, prompt and model.
    if (request.headers.get("x-nook-effort-hash") === sourceHash) return Response.json({ unchanged: true, sourceHash }, { headers });
    const release = limiter.acquire(); if (!release) return demoBusy();
    try { return Response.json(await estimate(assignment), { headers }); }
    catch { return Response.json(unavailableEffort(sourceHash), { headers }); }
    finally { release(); }
  };
}
