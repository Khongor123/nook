# Person C handoff

Implemented on `c-planning`. No pages or API routes were changed. A integrates the
functions into authenticated routes; B2 renders their results. Existing shared
types and fixtures remain unchanged.

## Reproducible example for A and B2

Import the fictional data and computed results from
`src/lib/planning/demo-example.ts`. These are separate from the existing fixtures
so teammates can adopt them deliberately.

- History essay: Friday, November 13, 2026, 5 p.m., America/New_York.
- Rough effort: 120–180 minutes; midpoint 150 minutes.
- Four editable steps: choose event, outline, draft, revise/PDF.
- First two steps are complete. The checkpoint says “Outline finished; ready to draft.”
- Saved Idea: “Open with a question?” Saved Reflection: “I feel overwhelmed”.
- This is invented coursework and a hand-authored draft, not a live AI result.

Expected start-by result at the fixed example clock:

```json
{
  "startByAt": "2026-11-10T22:00:00Z",
  "reason": "Suggested from about 150 minutes of work at 90 minutes a day, plus one buffer day. Change the estimate anytime.",
  "state": "suggested"
}
```

Tuesday, November 10 at 5 p.m. is a suggestion. Friday remains the Canvas due date.

Expected welcome-back result:

```json
{
  "message": "You left off: Outline finished; ready to draft.",
  "nextAction": "Write the opening paragraph.",
  "ideaText": "Open with a question?"
}
```

Show the Idea separately. The Reflection never becomes a task.

## Function contracts

- `getStartBy(assignment, estimateMinutes, now?)`: returns `{ startByAt, reason, state }`.
  Pass the midpoint of the editable effort range. Uses the C guide's capped rule:
  `min(5, max(1, ceil(minutes / 90))) + 1` calendar days. Missing dates and overdue
  dates return null. A past suggestion clamps to now. Invalid upcoming dates,
  time zones, or nonpositive estimates throw; validate route inputs before calling.
- `getWelcomeBack(checkpoint, ideas, unfinishedSteps)`: returns `{ message, nextAction, ideaText }`.
  A must select the latest checkpoint for the active assignment, with ownership
  checks. The function filters Ideas and unfinished steps to that checkpoint's
  assignment. Pass remaining steps (or all steps with their `done` flags).
  No checkpoint invites opening the assignment; no remaining steps invites review
  and submission. Otherwise checkpoint nextStep takes precedence over the first
  unfinished step. Step order is the order supplied by the caller.
- `breakDown(assignment)`: server-only, returns an editable validated draft or
  `{ "steps": [], "needsReview": true, "note": "Make a manual plan" }`.
  Success fields are `steps`, `effortMinMinutes`, `effortMaxMinutes`, `needsReview`,
  and `note`; see `exampleDraft` for example JSON. A should save student edits
  separately from generated drafts. This function does not save anything.

## AI configuration and integration

The server needs `OPENAI_API_KEY` and `OPENAI_MODEL` in the ignored `.env.local`.
Ask A for the team's supported model name; use one that supports Structured
Outputs. Do not put credentials in client components or commit `.env.local`.
Missing configuration returns the manual fallback; planning and welcome-back need
no credentials. No paid API request is made by the tests.

The implementation uses the OpenAI Responses API, `zodTextFormat`, and
`output_parsed`, with a second local validation for effort-range ordering. Only
sanitized title (240 characters maximum) and instructions (12,000 maximum) are
sent. The caller must sanitize Canvas HTML before calling. Notes, reflections,
dates, and user IDs are not sent. Refused, incomplete, malformed, or unavailable
responses fall back to manual planning. Provider errors are not displayed.

Successful drafts and in-flight calls are cached by user, assignment, source hash,
and prompt version, capped at 100 entries. Returned drafts are independent copies.
Failures can be retried. This is an in-memory cache: it does not survive process
restarts or coordinate multiple server instances. A should persist generated
drafts to avoid repeat calls across deployments. Keep authorization at the route.

## Checks and remaining work

Run `npm test`, `npx tsc --noEmit`, and `npm run lint`.
The test command needs Node 20.6+ for `--import`; current setup uses Node 26.

A still needs to connect the functions to shelf, breakdown, and welcome-back
routes. B2 still needs to connect the UI. Live AI quality and the full phone
workflow must be checked once configuration and integration exist. The original
shared `Assignment` has no unlock date, so unlock-date clamping from the broader
design document needs a coordinated type change with A before it can be added.

The C guide narrows the broader design document to 1–6 steps, camelCase draft
fields, and a capped start-by rule; those are the contracts implemented here.
No routes were invented to override A's ownership.

Official SDK pattern: https://developers.openai.com/api/docs/guides/structured-outputs
