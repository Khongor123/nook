import { z } from "zod";

// Keep cross-field validation separate from the JSON schema sent to the model.
export const breakdownOutputSchema = z.strictObject({
  steps: z.array(z.strictObject({
    text: z.string().trim().min(1).max(140),
    minutes: z.number().int().min(10).max(480),
  })).min(1).max(6),
  effortMinMinutes: z.number().int().min(10).max(2400),
  effortMaxMinutes: z.number().int().min(10).max(3000),
  needsReview: z.boolean(),
  note: z.string().trim().max(240),
});

export const breakdownSchema = breakdownOutputSchema.refine(
  (value) => value.effortMinMinutes <= value.effortMaxMinutes,
  { message: "Minimum effort must not exceed maximum effort.", path: ["effortMaxMinutes"] },
);

export type BreakdownDraft = z.infer<typeof breakdownSchema>;
export type BreakdownResult = BreakdownDraft | {
  steps: [];
  needsReview: true;
  note: "Make a manual plan";
};
