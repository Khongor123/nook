import { demoShelfCards } from "@/lib/demo-fixtures";

// Demo-only data. Replace this handler with an authenticated data source later.
export function GET() {
  return Response.json(demoShelfCards);
}
