import { CanvasError, canvasConfig, listCanvasCourses } from "@/lib/canvas";
import { apiError, privateContext, privateJson } from "@/lib/private-api";

export async function GET() {
  const context = await privateContext();
  if (!context) return apiError(401, "UNAUTHORIZED", "Sign in first");

  try {
    const courses = await listCanvasCourses(canvasConfig(context.userId));
    const { data: saved, error } = await context.supabase.from("courses")
      .select("canvas_course_id,last_synced_at")
      .eq("user_id", context.userId);
    if (error) return apiError(500, "LOAD_FAILED", "Could not load saved sync times", true);
    const lastSync = new Map((saved ?? []).map((row) => [row.canvas_course_id, row.last_synced_at]));
    return privateJson(courses.map(({ id, name, time_zone }) => ({
      id, name, timeZone: time_zone ?? "UTC", lastSyncedAt: lastSync.get(id) ?? null,
      selected: lastSync.has(id),
    })));
  } catch (error) {
    if (error instanceof CanvasError) return apiError(error.status, error.code, error.message, error.retryable);
    return apiError(500, "CANVAS_LOAD_FAILED", "Could not load Canvas courses", true);
  }
}
