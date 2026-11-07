/** Opt-in only: node --conditions=react-server --import tsx src/lib/ai/live-check.ts */
import assert from "node:assert/strict";
import { loadEnvConfig } from "@next/env";
import { breakDown } from "./breakdown";
import { breakdownSchema } from "./breakdown-schema";
import { exampleAssignment } from "../planning/demo-example";

async function main() {
  loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
  if (!process.env.GROQ_API_KEY) {
    console.log("SKIPPED: GROQ_API_KEY is not configured. No live calls made.");
    return;
  }
  // Only these fixed, fictional inputs go to the model. No database is read.
  const cases = [
    { name: "clear", assignment: exampleAssignment },
    { name: "vague", assignment: { ...exampleAssignment,
      id: "demo-live-vague", title: "Class preparation",
      descriptionText: "Prepare something about history for class." } },
    { name: "generic", assignment: { ...exampleAssignment,
      id: "demo-live-generic", descriptionText: "Do the assignment." } },
  ];
  for (const item of cases) {
    const before = structuredClone(item.assignment);
    const start = Date.now();
    const result = await breakDown(Object.freeze(item.assignment));
    console.log(JSON.stringify({ case: item.name, elapsedMs: Date.now() - start, result }, null, 2));
    assert.deepEqual(item.assignment, before, "Planning must not mutate Canvas data");
    if (item.name === "clear") assert.ok(breakdownSchema.safeParse(result).success, "Clear prompt needs a valid live draft");
    if (item.name !== "clear") assert.equal(result.needsReview, true, "Vague prompts need review");
  }
  console.log("Schema/review checks passed. A human must still check grounding and usable steps.");
}

main().catch(() => {
  // Keep provider diagnostics and credentials out of console output.
  console.error("Live check failed; inspect the fictional results above. Do not treat this as a successful demo rehearsal.");
  process.exitCode = 1;
});
