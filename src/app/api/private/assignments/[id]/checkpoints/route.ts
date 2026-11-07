import { z } from "zod";
import { apiError, privateContext, privateJson } from "@/lib/private-api";

const checkpointInput = z.object({
  note: z.string().trim().min(1).max(500),
  nextStep: z.string().trim().max(200).default(""),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await privateContext();
  if (!context) return apiError(401, "UNAUTHORIZED", "Sign in first");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return apiError(400, "INVALID_ID", "Invalid assignment ID");
  }

  const input = checkpointInput.safeParse(await request.json().catch(() => null));
  if (!input.success) {
    return apiError(400, "INVALID_INPUT", "Write where you left off");
  }

  const { supabase, userId } = context;
  const { data: assignment, error: lookupError } = await supabase
    .from("assignments")
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (lookupError) return apiError(500, "LOAD_FAILED", "Could not check assignment", true);
  if (!assignment) return apiError(404, "NOT_FOUND", "Assignment not found");

  const { data, error } = await supabase
    .from("checkpoints")
    .insert({
      user_id: userId,
      assignment_id: id,
      note: input.data.note,
      next_step: input.data.nextStep,
    })
    .select("id, assignment_id, note, next_step, created_at")
    .single();
  if (error) return apiError(500, "SAVE_FAILED", "Checkpoint was not saved. Try again.", true);

  return privateJson({
    id: data.id,
    assignmentId: data.assignment_id,
    note: data.note,
    nextStep: data.next_step,
    createdAt: data.created_at,
  }, 201);
}
