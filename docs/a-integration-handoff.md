# A integration handoff for B2

The private API now connects C's planning functions to saved Nook assignments. All routes require a signed-in Supabase session and return `Cache-Control: private, no-store`. The public fixture routes remain available for layout work.

## One database step

Migration `supabase/migrations/0002_assignment_plans.sql` was applied once to the shared Nook Supabase project on November 7, 2026. Run it after `0001_nook_core.sql` only when setting up a different project. It adds an editable effort range to assignments and the transaction-safe `save_assignment_plan` function. Do not rerun either migration in the shared project.

## Private route contracts

### `GET /api/private/shelf`

Returns `ShelfCard[]` from `src/lib/types.ts`. Each card includes the original `assignment.dueAt`, plus `startByAt`, `startByReason`, and `startByState`. `startByState` is `needs_plan` for an upcoming assignment without a saved effort estimate; no date is invented. After a plan is saved, the midpoint of its editable effort range feeds C's start-by rule.

### `GET /api/private/assignments/:id`

Returns `PrivateAssignmentDetail`: the existing assignment, ordered steps, thoughts, and latest checkpoint, plus:

```json
{
  "effortEstimate": { "minMinutes": 120, "maxMinutes": 180 },
  "welcomeBack": {
    "message": "You left off: Outline finished; ready to draft.",
    "nextAction": "Write the opening paragraph.",
    "ideaText": "Open with a question?"
  }
}
```

`effortEstimate` is `null` before the student saves a plan. `ideaText` may be `null`. Reflections remain in `thoughts` and never become tasks or `nextAction` automatically.

### `POST /api/private/assignments/:id/breakdown`

Checks ownership, then calls C's server-only `breakDown`. It returns an **editable draft**, without saving it:

```json
{
  "steps": [{ "text": "Choose a topic", "minutes": 30 }],
  "effortMinMinutes": 120,
  "effortMaxMinutes": 180,
  "needsReview": false,
  "note": "Check these steps before saving."
}
```

When AI is unavailable or unconfigured, C's safe fallback is `{ "steps": [], "needsReview": true, "note": "Make a manual plan" }`. Offer manual step entry. Never auto-save a draft or send thoughts/checkpoints to AI. The server needs `OPENAI_API_KEY` and a Structured Outputs capable `OPENAI_MODEL` in ignored `.env.local` for live generation; the private planner still works without them.

### `PUT /api/private/assignments/:id/plan`

Save only after the student reviews or edits the draft. Send `Content-Type: application/json`:

```json
{
  "effortMinMinutes": 120,
  "effortMaxMinutes": 180,
  "steps": [
    { "text": "Choose a topic", "minutes": 30, "done": false, "source": "suggested" },
    { "text": "Write a draft", "minutes": 90, "done": false, "source": "student" }
  ]
}
```

Response: `{ "saved": true }`; then reload detail and shelf. There must be 1–6 steps, each 10–480 minutes, and a valid 10–3000 minute effort range. `source` defaults to `student`, `done` to `false`. When editing an existing step, include its `id` from detail so its completion state is preserved. Omit an existing step to remove it. The database function saves the range and all steps in one transaction; ownership is checked again inside Postgres. A missing migration returns `503 MIGRATION_REQUIRED`.

## Browser check

In development, visit `/dev/planning` after signing in. Load the private shelf, choose an assignment, generate an editable draft or add a manual step, save it, refresh, then load the assignment again. The saved steps and effort range should remain, the shelf should show a start-by suggestion for an upcoming due date, and the latest checkpoint should produce a welcome-back message. Also verify an Idea appears separately and a Reflection stays a note.

Error responses use `{ "code": string, "message": string, "retryable": boolean }`. Handle 401 by showing sign-in, 404 as an unavailable assignment, 400 as editable input error, and 503 as a setup issue during development.
