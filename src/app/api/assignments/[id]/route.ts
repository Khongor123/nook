import { getDemoAssignmentDetail } from "@/lib/demo-fixtures";

// Next.js 16 provides dynamic route params as a Promise.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const detail = getDemoAssignmentDetail(id);

  if (!detail) {
    return Response.json(
      { code: "NOT_FOUND", message: "Assignment not found", retryable: false },
      { status: 404 },
    );
  }

  return Response.json(detail);
}
