import { z } from "zod";
import { apiError, privateContext, privateJson } from "@/lib/private-api";

const thoughtInput = z.object({
  kind: z.enum(["idea", "reflection"]),
  text: z.string().trim().min(1).max(160),
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

  const input = thoughtInput.safeParse(await request.json().catch(() => null));
  if (!input.success) {
    return apiError(400, "INVALID_INPUT", "Choose Idea or Reflection and enter a short thought");
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
    .from("thoughts")
    .insert({
      user_id: userId,
      assignment_id: id,
      kind: input.data.kind,
      text: input.data.text,
    })
    .select("id, assignment_id, kind, text, created_at")
    .single();
  if (error) return apiError(500, "SAVE_FAILED", "Thought was not saved. Try again.", true);

  return privateJson({
    id: data.id,
    assignmentId: data.assignment_id,
    kind: data.kind,
    text: data.text,
    createdAt: data.created_at,
  }, 201);
}
