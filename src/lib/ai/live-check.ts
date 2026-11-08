/** Opt-in only: node --conditions=react-server --import tsx src/lib/ai/live-check.ts */
import assert from "node:assert/strict";
import { loadEnvConfig } from "@next/env";
import { createBreakDown, createProviderGenerator } from "./breakdown";
import { breakdownSchema } from "./breakdown-schema";
import type { DiagnosticCode } from "./diagnostics";
import { inspectDraft } from "./quality-check";
import { exampleAssignment } from "../planning/demo-example";
import { prepareDemoBackup } from "../planning/demo-backup";
import { writeFile } from "node:fs/promises";

async function main() {
  loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
  if (!process.env.GROQ_API_KEY) {
    console.log("SKIPPED: GROQ_API_KEY is not configured. No live calls made.");
    return;
  }
  // Only fixed fictional inputs go to the model. Never log raw provider results,
  // errors, prompts, headers, model names from env, or any configuration values.
  const cases = [
    { name: "clear", assignment: exampleAssignment },
    { name: "clear_no_sources_or_submission", assignment: { ...exampleAssignment,
      id: "demo-live-reading", title: "Chapter summary",
      descriptionText: "Read chapter 3 of the course textbook. Write a 150-word summary of its main argument." } },
    { name: "vague", assignment: { ...exampleAssignment,
      id: "demo-live-vague", title: "Class preparation",
      descriptionText: "Prepare something about history for class." } },
    { name: "generic", assignment: { ...exampleAssignment,
      id: "demo-live-generic", descriptionText: "Do the assignment." } },
  ];
  let failed = false;
  for (const item of cases) {
    const diagnostics: DiagnosticCode[] = [];
    const observe = (code: DiagnosticCode) => diagnostics.push(code);
    const run = createBreakDown(createProviderGenerator(process.env, undefined, observe), observe);
    const before = structuredClone(item.assignment);
    const start = Date.now();
    const result = await run(Object.freeze(item.assignment));
    const parsed = breakdownSchema.safeParse(result);
    const findings = parsed.success ? inspectDraft(parsed.data, item.assignment.descriptionText) : [];
    const clear = item.name.startsWith("clear");
    const passed = clear ? parsed.success && !result.needsReview && findings.length === 0
      : result.needsReview && (result.steps.length === 0 || (result.steps.length === 1
        && result.steps[0].text === "Open Canvas and check the full instructions"));
    console.log(JSON.stringify({ case: item.name, elapsedMs: Date.now() - start,
      diagnostics, stepCount: result.steps.length, needsReview: result.needsReview,
      findings, passed }, null, 2));
    assert.deepEqual(item.assignment, before, "Planning must not mutate Canvas data");
    if (item.name === "clear" && passed && process.argv.includes("--record-backup")) {
      try {
        // Explicit opt-in; fixed fictional source only; never replace a reviewed backup.
        await writeFile(new URL("../planning/demo-backup.json", import.meta.url),
          JSON.stringify(prepareDemoBackup(result), null, 2) + "\n", { flag: "wx" });
        console.log("Fictional AI backup captured. Human review is required before presentation.");
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "EEXIST") {
          console.log("Existing fictional backup preserved; no replacement made.");
        } else {
          console.error("Backup capture failed. No error details logged.");
          failed = true;
        }
      }
    }
    if (!passed) failed = true;
  }
  console.log(failed ? "FAILED: inspect the safe diagnostic categories above; Groq schema-rejection retries are limited to one extra attempt."
    : "Checks passed. Grounding checks are heuristic; human review is still needed.");
  if (failed) process.exitCode = 1;
}

main().catch(() => {
  // Keep provider diagnostics and credentials out of console output.
  console.error("Checker failed unexpectedly. No raw error or provider output was logged.");
  process.exitCode = 1;
});
