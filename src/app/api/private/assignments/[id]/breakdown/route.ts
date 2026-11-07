import "server-only";
import { z } from "zod";
import { breakDown } from "@/lib/ai/breakdown";
import { apiError, privateContext, privateJson } from "@/lib/private-api";

// Generates an editable draft. The student saves it with PUT /plan after review.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await privateContext();
  if (!context) return apiError(401, "UNAUTHORIZED", "Sign in first");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return apiError(400, "INVALID_ID", "Invalid assignment ID");

  const { data: assignment, error } = await context.supabase
    .from("assignments")
    .select("id, user_id, title, description_text")
    .eq("id", id)
    .eq("user_id", context.userId)
    .maybeSingle();
  if (error) return apiError(500, "LOAD_FAILED", "Could not load assignment", true);
  if (!assignment) return apiError(404, "NOT_FOUND", "Assignment not found");

  const draft = await breakDown({
    id: assignment.id,
    userId: context.userId,
    title: assignment.title,
    descriptionText: assignment.description_text,
  });
  return privateJson(draft);
}
