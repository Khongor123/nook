import { z } from "zod";
import { apiError, privateContext, privateJson } from "@/lib/private-api";

const stepInput = z.strictObject({
  id: z.uuid().optional(),
  text: z.string().trim().min(1).max(140),
  minutes: z.number().int().min(10).max(480),
  done: z.boolean().default(false),
  source: z.enum(["suggested", "student"]).default("student"),
});

const planInput = z.strictObject({
  effortMinMinutes: z.number().int().min(10).max(2400),
  effortMaxMinutes: z.number().int().min(10).max(3000),
  steps: z.array(stepInput).min(1).max(6),
}).refine((value) => value.effortMaxMinutes >= value.effortMinMinutes, {
  path: ["effortMaxMinutes"], message: "Maximum effort must be at least minimum effort",
});

// Saves reviewed steps and the editable effort range atomically in Postgres.
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await privateContext();
  if (!context) return apiError(401, "UNAUTHORIZED", "Sign in first");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return apiError(400, "INVALID_ID", "Invalid assignment ID");
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return apiError(415, "INVALID_CONTENT_TYPE", "Send JSON");
  }

  const parsed = planInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "INVALID_PLAN", "Enter 1 to 6 steps and a valid effort range");

  const { data: assignment, error: lookupError } = await context.supabase
    .from("assignments")
    .select("id")
    .eq("id", id)
    .eq("user_id", context.userId)
    .maybeSingle();
  if (lookupError) return apiError(500, "LOAD_FAILED", "Could not check assignment", true);
  if (!assignment) return apiError(404, "NOT_FOUND", "Assignment not found");

  const { error } = await context.supabase.rpc("save_assignment_plan", {
    p_assignment_id: id,
    p_effort_min_minutes: parsed.data.effortMinMinutes,
    p_effort_max_minutes: parsed.data.effortMaxMinutes,
    p_steps: parsed.data.steps,
  });
  if (error?.code === "PGRST202") {
    return apiError(503, "MIGRATION_REQUIRED", "Run the assignment-plan SQL migration", false);
  }
  if (error?.code === "42501") return apiError(404, "NOT_FOUND", "Assignment or step not found");
  if (error) return apiError(500, "SAVE_FAILED", "Plan was not saved. Try again.", true);

  return privateJson({ saved: true });
}
