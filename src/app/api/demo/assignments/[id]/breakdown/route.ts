import { createDemoBreakdownHandler } from "@/lib/ai/demo-breakdown";

import { demoLimiter } from "@/lib/ai/demo-limit";
const handle = createDemoBreakdownHandler(undefined, undefined, demoLimiter);
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(request, (await params).id);
}
