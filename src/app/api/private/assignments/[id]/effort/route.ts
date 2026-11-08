import { z } from "zod";
import { apiError, privateContext, privateJson } from "@/lib/private-api";
import { invalidDemoRequest } from "@/lib/ai/demo-limit";
import { createPrivateEffortService, EffortError } from "@/lib/ai/private-effort";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await privateContext();
  if (!context) return apiError(401, "UNAUTHORIZED", "Sign in first");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return apiError(400, "INVALID_ID", "Invalid assignment ID");
  const invalid = await invalidDemoRequest(request); if (invalid) return invalid;
  const { supabase, userId } = context;
  const service = createPrivateEffortService({
    async load(assignmentId, owner) {
      const { data, error } = await supabase.from("assignments").select("*").eq("id", assignmentId).eq("user_id", owner).maybeSingle();
      if (error) throw new EffortError("LOAD_FAILED", "Could not load assignment", 500);
      if (!data) return null;
      const course = await supabase.from("courses").select("canvas_course_id").eq("user_id", owner).eq("canvas_course_id", data.canvas_course_id).maybeSingle();
      if (course.error) throw new EffortError("LOAD_FAILED", "Could not check selected course", 500);
      return course.data ? data : null;
    },
    async save(source, result) {
      const { data, error } = await supabase.from("assignments").update({
        ai_effort_min_minutes: result.effortEstimate?.minMinutes ?? null,
        ai_effort_max_minutes: result.effortEstimate?.maxMinutes ?? null,
        ai_effort_source_hash: result.sourceHash, ai_effort_status: result.effortStatus,
        ai_effort_needs_review: result.needsReview,
      }).eq("id", source.id).eq("user_id", source.user_id).eq("status", "open")
        .eq("title", source.title).eq("description_text", source.description_text).select("id").maybeSingle();
      if (error) throw new EffortError("SAVE_FAILED", "Could not save effort estimate", 500);
      return !!data;
    },
  });
  try { return privateJson(await service(id, userId, request.headers.get("x-nook-retry") === "true")); }
  catch (error) {
    if (error instanceof EffortError) return apiError(error.status, error.code, error.message, error.status >= 500);
    return apiError(500, "ESTIMATE_FAILED", "Could not estimate effort. Try again.", true);
  }
}
