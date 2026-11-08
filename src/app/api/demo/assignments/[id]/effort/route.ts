import { createDemoEffortHandler } from "@/lib/ai/demo-effort";
const handle = createDemoEffortHandler();
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(request, (await params).id);
}
