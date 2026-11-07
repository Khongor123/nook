import { demoAssignments } from "@/lib/demo-fixtures";
import { apiError, privateContext, privateJson } from "@/lib/private-api";

// Creates one fictional assignment in the signed-in user's private database.
// Repeating this call updates Canvas-owned fields without deleting local notes.
export async function POST() {
  const context = await privateContext();
  if (!context) return apiError(401, "UNAUTHORIZED", "Sign in first");

  const { supabase, userId } = context;
  const sample = demoAssignments[0];

  const courseResult = await supabase.from("courses").upsert(
    {
      user_id: userId,
      canvas_course_id: sample.canvasCourseId,
      name: sample.courseName,
    },
    { onConflict: "user_id,canvas_course_id" },
  );
  if (courseResult.error) {
    return apiError(500, "SAVE_FAILED", "Could not prepare demo course", true);
  }

  const assignmentResult = await supabase
    .from("assignments")
    .upsert(
      {
        user_id: userId,
        canvas_course_id: sample.canvasCourseId,
        canvas_assignment_id: sample.canvasAssignmentId,
        course_name: sample.courseName,
        title: sample.title,
        description_text: sample.descriptionText,
        due_at: sample.dueAt,
        time_zone: sample.timeZone,
        source_updated_at: sample.updatedAt,
        status: sample.status,
      },
      { onConflict: "user_id,canvas_course_id,canvas_assignment_id" },
    )
    .select("id")
    .single();

  if (assignmentResult.error) {
    return apiError(500, "SAVE_FAILED", "Could not prepare demo assignment", true);
  }

  return privateJson({ assignmentId: assignmentResult.data.id }, 201);
}
