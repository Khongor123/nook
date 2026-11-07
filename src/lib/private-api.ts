import { createClient } from "@/lib/supabase/server";

export async function privateContext() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  return error || !userId ? null : { supabase, userId };
}

export function privateJson(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export function apiError(
  status: number,
  code: string,
  message: string,
  retryable = false,
) {
  return privateJson({ code, message, retryable }, status);
}
