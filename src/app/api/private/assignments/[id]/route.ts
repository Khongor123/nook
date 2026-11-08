import { z } from "zod";
import type { PrivateAssignmentDetail, Step, Thought, Checkpoint } from "@/lib/types";
import { apiError, privateContext, privateJson } from "@/lib/private-api";
import { effectiveEffort } from "@/lib/ai/effort";
import { getWelcomeBack } from "@/lib/planning/welcome-back";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await privateContext();
  if (!context) return apiError(401, "UNAUTHORIZED", "Sign in first");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return apiError(400, "INVALID_ID", "Invalid assignment ID");
  }

  const { supabase, userId } = context;
  const { data: row, error } = await supabase
    .from("assignments")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return apiError(500, "LOAD_FAILED", "Could not load assignment", true);
  if (!row) return apiError(404, "NOT_FOUND", "Assignment not found");
  if (row.status !== "open") return apiError(404, "NOT_FOUND", "Assignment is no longer on your shelf");
  const { data: selectedCourse, error: courseError } = await supabase.from("courses")
    .select("canvas_course_id")
    .eq("user_id", userId)
    .eq("canvas_course_id", row.canvas_course_id)
    .maybeSingle();
  if (courseError) return apiError(500, "LOAD_FAILED", "Could not check selected course", true);
  if (!selectedCourse) return apiError(404, "NOT_FOUND", "Assignment is no longer on your shelf");

  const [stepResult, thoughtResult, checkpointResult] = await Promise.all([
    supabase.from("steps").select("*").eq("assignment_id", id).eq("user_id", userId).order("position"),
    supabase.from("thoughts").select("*").eq("assignment_id", id).eq("user_id", userId).order("created_at"),
    supabase.from("checkpoints").select("*").eq("assignment_id", id).eq("user_id", userId).order("created_at", { ascending: false }).limit(1),
  ]);
  if (stepResult.error || thoughtResult.error || checkpointResult.error) {
    return apiError(500, "LOAD_FAILED", "Could not load saved work", true);
  }

  const detail: PrivateAssignmentDetail = {
    assignment: {
      id: row.id, userId: row.user_id, canvasCourseId: row.canvas_course_id,
      canvasAssignmentId: row.canvas_assignment_id, courseName: row.course_name,
      title: row.title, descriptionText: row.description_text, dueAt: row.due_at,
      canvasUrl: row.canvas_url, unlockAt: row.unlock_at,
      sourceAvailable: row.source_available,
      timeZone: row.time_zone, updatedAt: row.source_updated_at ?? row.updated_at,
      status: row.status,
    },
    steps: (stepResult.data ?? []).map((step): Step => ({
      id: step.id, assignmentId: step.assignment_id, text: step.text,
      minutes: step.minutes, done: step.done, source: step.source,
    })),
    thoughts: (thoughtResult.data ?? []).map((thought): Thought => ({
      id: thought.id, assignmentId: thought.assignment_id, kind: thought.kind,
      text: thought.text, createdAt: thought.created_at,
    })),
    latestCheckpoint: checkpointResult.data?.[0]
      ? {
          id: checkpointResult.data[0].id,
          assignmentId: checkpointResult.data[0].assignment_id,
          note: checkpointResult.data[0].note,
          nextStep: checkpointResult.data[0].next_step,
          createdAt: checkpointResult.data[0].created_at,
        } satisfies Checkpoint
      : null,
    effortEstimate: effectiveEffort(row).effortEstimate,
    welcomeBack: { message: "", nextAction: "", ideaText: null },
  };
  detail.welcomeBack = getWelcomeBack(detail.latestCheckpoint, detail.thoughts, detail.steps);
  return privateJson(detail);
}
