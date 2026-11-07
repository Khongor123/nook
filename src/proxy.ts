import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

// Keep the demo routes usable even when a teammate has no Supabase setup.
export const config = {
  matcher: ["/sign-in/:path*", "/api/private/:path*"],
};
