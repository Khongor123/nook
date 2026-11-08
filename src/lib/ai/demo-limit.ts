import "server-only";
export function createDemoLimiter(now = Date.now) {
  let active = 0;
  let calls: number[] = [];
  return { acquire() {
    const time = now(); calls = calls.filter(at => time - at < 60000);
    if (active >= 2 || calls.length >= 10) return null;
    calls.push(time); active++;
    return () => { active--; };
  } };
}
export const demoLimiter = createDemoLimiter();
export async function invalidDemoRequest(request: Request): Promise<Response | null> {
  const fail = (message: string, status = 400) => Response.json({ code: "INVALID_REQUEST", message, retryable: false }, { status, headers: { "Cache-Control": "no-store" } });
  const origin = request.headers.get("origin");
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") return fail("Open this action in Nook.", 403);
  if (new URL(request.url).search) return fail("Query parameters are not supported.");
  const reader = request.body?.getReader();
  if (reader) {
    try {
      while (true) {
        const chunk = await reader.read(); if (chunk.done) break;
        if (chunk.value.byteLength) { void reader.cancel().catch(() => {}); return fail("Send an assignment ID without a request body."); }
      }
    } catch { return fail("Could not read this request."); }
    finally { reader.releaseLock(); }
  }
  return null;
}
export function demoBusy() {
  return Response.json({ code: "DEMO_BUSY", message: "Demo generation is busy. Please try again shortly.", retryable: true }, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "60" } });
}
