import type { Assignment, ShelfCard } from "@/lib/types";
import { apiError, privateContext, privateJson } from "@/lib/private-api";

export async function GET() {
  const context = await privateContext();
  if (!context) return apiError(401, "UNAUTHORIZED", "Sign in first");

  const { supabase, userId } = context;
  const { data: rows, error } = await supabase
    .from("assignments")
    .select("*")
    .eq("user_id", userId)
    .order("due_at", { ascending: true, nullsFirst: false });
  if (error) return apiError(500, "LOAD_FAILED", "Could not load your shelf", true);

  const { data: steps, error: stepsError } = await supabase
    .from("steps")
    .select("assignment_id, done")
    .eq("user_id", userId);
  if (stepsError) return apiError(500, "LOAD_FAILED", "Could not load plan progress", true);

  const cards: ShelfCard[] = (rows ?? []).map((row): ShelfCard => {
    const assignmentSteps = (steps ?? []).filter((step) => step.assignment_id === row.id);
    const assignment: Assignment = {
      id: row.id,
      userId: row.user_id,
      canvasCourseId: row.canvas_course_id,
      canvasAssignmentId: row.canvas_assignment_id,
      courseName: row.course_name,
      title: row.title,
      descriptionText: row.description_text,
      dueAt: row.due_at,
      timeZone: row.time_zone,
      updatedAt: row.source_updated_at ?? row.updated_at,
      status: row.status,
    };
    return {
      assignment,
      // Person C will replace this temporary cue with the real date rule.
      startByAt: null,
      startByReason: assignment.dueAt === null
        ? "No Canvas due date"
        : new Date(assignment.dueAt) < new Date()
          ? "Start when you can"
          : "Start date suggestion coming soon",
      stepsDone: assignmentSteps.filter((step) => step.done).length,
      stepsTotal: assignmentSteps.length,
    };
  });

  return privateJson(cards);
}
