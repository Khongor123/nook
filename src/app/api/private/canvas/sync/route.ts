import { z } from "zod";
import { CanvasError, canvasAssignmentUrl, canvasConfig, htmlToPlainText, isSubmittedOrGradedAssignment, listCanvasAssignments, listCanvasCourses } from "@/lib/canvas";
import { apiError, privateContext, privateJson } from "@/lib/private-api";

const requestSchema = z.object({ courseIds: z.array(z.string().regex(/^\d+$/)).max(500) });

export async function POST(request: Request) {
  const context = await privateContext();
  if (!context) return apiError(401, "UNAUTHORIZED", "Sign in first");
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return apiError(415, "INVALID_CONTENT_TYPE", "Send JSON");
  }

  let input: z.infer<typeof requestSchema>;
  try {
    input = requestSchema.parse(await request.json());
  } catch {
    return apiError(400, "INVALID_REQUEST", "Choose up to 500 Canvas courses");
  }

  try {
    const config = canvasConfig(context.userId);
    const available = input.courseIds.length ? await listCanvasCourses(config) : [];
    const selected = [...new Set(input.courseIds)].map((id) => available.find((course) => course.id === id));
    if (selected.some((course) => !course)) return apiError(400, "INVALID_COURSE", "Choose a course from your Canvas list");

    const { supabase, userId } = context;
    const { data: savedCourses, error: savedError } = await supabase.from("courses")
      .select("canvas_course_id").eq("user_id", userId);
    if (savedError) return apiError(500, "LOAD_FAILED", "Could not load selected courses", true);
    if (selected.length) {
      const selectionSave = await supabase.from("courses").upsert(
        selected.filter((course): course is NonNullable<typeof course> => !!course).map((course) => ({
          user_id: userId, canvas_course_id: course.id, name: course.name,
        })),
        { onConflict: "user_id,canvas_course_id" },
      );
      if (selectionSave.error) return apiError(500, "SAVE_FAILED", "Could not save selected courses", true);
    }
    const selectedIds = new Set(input.courseIds);
    const removed = (savedCourses ?? []).map((course) => course.canvas_course_id)
      .filter((courseId) => !selectedIds.has(courseId));
    if (removed.length) {
      const selectionDelete = await supabase.from("courses").delete()
        .eq("user_id", userId).in("canvas_course_id", removed);
      if (selectionDelete.error) return apiError(500, "SAVE_FAILED", "Could not update selected courses", true);
    }
    let imported = 0;
    let updated = 0;
    const failures: { courseId: string; code: string; message: string }[] = [];
    const syncedCourses: { courseId: string; lastSyncedAt: string; unavailable: number }[] = [];

    for (const course of selected) {
      if (!course) continue;
      try {
        const assignments = (await listCanvasAssignments(config, course.id)).filter((item) => item.published !== false);
        const existing = await supabase.from("assignments")
          .select("canvas_assignment_id,status")
          .eq("user_id", userId)
          .eq("canvas_course_id", course.id);
        if (existing.error) throw new CanvasError("SAVE_FAILED", "Could not load saved assignments", 500, true);
        const savedStatus = new Map((existing.data ?? []).map((row) => [row.canvas_assignment_id, row.status]));

        for (const item of assignments) {
          const save = await supabase.from("assignments").upsert({
            user_id: userId,
            canvas_course_id: course.id,
            canvas_assignment_id: item.id,
            course_name: course.name,
            title: item.name,
            description_text: htmlToPlainText(item.description ?? "").slice(0, 30000),
            due_at: item.due_at ?? null,
            unlock_at: item.unlock_at ?? null,
            canvas_url: canvasAssignmentUrl(item.html_url, config.base),
            submission_types: item.submission_types ?? [],
            source_available: true,
            time_zone: course.time_zone ?? "UTC",
            source_updated_at: item.updated_at ?? null,
            status: isSubmittedOrGradedAssignment(item) ? "submitted" : "open",
          }, { onConflict: "user_id,canvas_course_id,canvas_assignment_id" });
          if (save.error) throw new CanvasError("SAVE_FAILED", "Could not save assignments", 500, true);
          if (savedStatus.has(item.id)) updated++;
          else imported++;
        }

        const importedIds = assignments.map((item) => item.id);
        let unavailable = 0;
        for (const oldId of savedStatus.keys()) {
          if (importedIds.includes(oldId)) continue;
          const stale = await supabase.from("assignments")
            .update({ source_available: false })
            .eq("user_id", userId)
            .eq("canvas_course_id", course.id)
            .eq("canvas_assignment_id", oldId);
          if (stale.error) throw new CanvasError("SAVE_FAILED", "Could not mark unavailable assignments", 500, true);
          unavailable++;
        }
        const lastSyncedAt = new Date().toISOString();
        const syncSave = await supabase.from("courses")
          .update({ last_synced_at: lastSyncedAt })
          .eq("user_id", userId)
          .eq("canvas_course_id", course.id);
        if (syncSave.error) throw new CanvasError("SAVE_FAILED", "Could not save sync time", 500, true);
        syncedCourses.push({ courseId: course.id, lastSyncedAt, unavailable });
      } catch (error) {
        const failure = error instanceof CanvasError ? error : new CanvasError("SYNC_FAILED", "Could not sync course", 500, true);
        failures.push({ courseId: course.id, code: failure.code, message: failure.message });
      }
    }

    return privateJson({ imported, updated, failures, syncedCourses, syncedAt: new Date().toISOString() }, failures.length ? 207 : 200);
  } catch (error) {
    if (error instanceof CanvasError) return apiError(error.status, error.code, error.message, error.retryable);
    return apiError(500, "SYNC_FAILED", "Could not sync Canvas", true);
  }
}
