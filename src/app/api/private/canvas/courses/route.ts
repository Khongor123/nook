import { CanvasError, canvasConfig, listCanvasCourses } from "@/lib/canvas";
import { apiError, privateContext, privateJson } from "@/lib/private-api";

export async function GET() {
  const context = await privateContext();
  if (!context) return apiError(401, "UNAUTHORIZED", "Sign in first");

  try {
    const courses = await listCanvasCourses(canvasConfig(context.userId));
    return privateJson(courses.map(({ id, name, time_zone }) => ({ id, name, timeZone: time_zone ?? "UTC" })));
  } catch (error) {
    if (error instanceof CanvasError) return apiError(error.status, error.code, error.message, error.retryable);
    return apiError(500, "CANVAS_LOAD_FAILED", "Could not load Canvas courses", true);
  }
}
