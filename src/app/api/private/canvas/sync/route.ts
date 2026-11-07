import { z } from "zod";
import { CanvasError, canvasConfig, htmlToPlainText, listCanvasAssignments, listCanvasCourses } from "@/lib/canvas";
import { apiError, privateContext, privateJson } from "@/lib/private-api";

const requestSchema = z.object({ courseIds: z.array(z.string().regex(/^\d+$/)).min(1).max(20) });

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
    return apiError(400, "INVALID_REQUEST", "Choose at least one Canvas course");
  }

  try {
    const config = canvasConfig(context.userId);
    const available = await listCanvasCourses(config);
    const selected = [...new Set(input.courseIds)].map((id) => available.find((course) => course.id === id));
    if (selected.some((course) => !course)) return apiError(400, "INVALID_COURSE", "Choose a course from your Canvas list");

    const { supabase, userId } = context;
    let imported = 0;
    let updated = 0;
    const failures: { courseId: string; code: string; message: string }[] = [];

    for (const course of selected) {
      if (!course) continue;
      try {
        const assignments = (await listCanvasAssignments(config, course.id)).filter((item) => item.published !== false);
        const courseSave = await supabase.from("courses").upsert(
          { user_id: userId, canvas_course_id: course.id, name: course.name },
          { onConflict: "user_id,canvas_course_id" },
        );
        if (courseSave.error) throw new CanvasError("SAVE_FAILED", "Could not save course", 500, true);

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
            time_zone: course.time_zone ?? "UTC",
            source_updated_at: item.updated_at ?? null,
            status: savedStatus.get(item.id) ?? "open",
          }, { onConflict: "user_id,canvas_course_id,canvas_assignment_id" });
          if (save.error) throw new CanvasError("SAVE_FAILED", "Could not save assignments", 500, true);
          if (savedStatus.has(item.id)) updated++;
          else imported++;
        }
      } catch (error) {
        const failure = error instanceof CanvasError ? error : new CanvasError("SYNC_FAILED", "Could not sync course", 500, true);
        failures.push({ courseId: course.id, code: failure.code, message: failure.message });
      }
    }

    return privateJson({ imported, updated, failures, syncedAt: new Date().toISOString() }, failures.length ? 207 : 200);
  } catch (error) {
    if (error instanceof CanvasError) return apiError(error.status, error.code, error.message, error.retryable);
    return apiError(500, "SYNC_FAILED", "Could not sync Canvas", true);
  }
}
