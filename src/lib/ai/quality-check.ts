import type { BreakdownDraft } from "./breakdown-schema";

export type QualityFinding = "unsupported_sources" | "changed_source_count"
  | "unsupported_submission" | "unsupported_format" | "unsupported_destination"
  | "unsupported_citation_style" | "effort_mismatch";

// Checker-only heuristics, not a general semantic validator. Return categories,
// never excerpts: even an unexpected model response must not leak into logs.
export function inspectDraft(draft: BreakdownDraft, description: string): QualityFinding[] {
  const source = description.toLowerCase();
  const output = [...draft.steps.map((step) => step.text), draft.note].join(" ").toLowerCase();
  const findings = new Set<QualityFinding>();
  if (/\b(sources?|references?|citations?|bibliography)\b/.test(output)
    && !/\b(sources?|references?|readings?|citations?|bibliography)\b/.test(source)) findings.add("unsupported_sources");
  for (const qualifier of ["peer-reviewed", "scholarly", "primary", "secondary", "external"]) {
    const qualifiedSource = new RegExp(`\\b${qualifier}\\s+(?:sources?|readings?|articles?|references?)\\b`);
    if (qualifiedSource.test(output) && !qualifiedSource.test(source)) findings.add("unsupported_sources");
  }
  if (/\b(find|search|locate|research)\b[^.!?]{0,140}\b(sources?|articles?|references?)\b/.test(output)
    && !/\b(find|search|locate|research)\b/.test(source)) findings.add("unsupported_sources");
  const countWords = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  function counts(text: string) {
    const matches = text.matchAll(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:(?:course|academic|scholarly|primary|secondary|external|peer-reviewed)\s+)*(?:sources?|readings?|references?|articles?)\b/g);
    return [...matches].map((match) => /^\d+$/.test(match[1]) ? Number(match[1]) : countWords.indexOf(match[1]));
  }
  const suppliedCounts = counts(source);
  if (counts(output).some((count) => !suppliedCounts.includes(count))) findings.add("changed_source_count");
  const submission = /\b(submit|upload|email|turn in|hand in)\b/;
  if (submission.test(output) && !submission.test(source)) findings.add("unsupported_submission");
  for (const format of ["pdf", "docx", "pptx", "csv", "word document", "powerpoint"]) {
    if (output.includes(format) && !source.includes(format)) findings.add("unsupported_format");
  }
  for (const destination of ["canvas", "turnitin", "email", "google classroom", "blackboard", "moodle", "google drive"]) {
    if (submission.test(output) && output.includes(destination) && !source.includes(destination)) findings.add("unsupported_destination");
  }
  for (const style of ["apa", "mla", "chicago", "harvard"]) {
    if (new RegExp(`\\b${style}\\b`).test(output) && !new RegExp(`\\b${style}\\b`).test(source)) findings.add("unsupported_citation_style");
  }
  const total = draft.steps.reduce((sum, step) => sum + step.minutes, 0);
  if (total < draft.effortMinMinutes || total > draft.effortMaxMinutes) findings.add("effort_mismatch");
  return [...findings];
}
