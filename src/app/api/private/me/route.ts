import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    return Response.json(
      { code: "UNAUTHORIZED", message: "Sign in first", retryable: false },
      { status: 401 },
    );
  }

  return Response.json({ userId: data.claims.sub });
}
