# Fictional coursework demo

The welcome page offers a complete browser-local demo and a Canvas postponement
page. Individual Canvas connections wait for an institution-issued OAuth developer
key. Existing authenticated APIs, data, and presenter configuration are preserved.

## Demo behavior

- A fresh browser starts with six fictional assignments and no seeded plans or
  progress. AI estimates effort before showing the Shelf, without creating steps.
- Generate plan calls the real server-side AI adapter on demand. Only fixed
  fictional assignment IDs are accepted; visitors cannot supply prompts or keys.
- Generated steps and effort remain editable. Effort uses AI-generated whole-hour
  bounds; non-hour responses are rounded outward for display. Changes autosave after 400 ms;
  blur, internal navigation and page exit flush pending writes. Save flushes now.
  Normal saves are silent; no browser-storage or thought-save banners are shown.
  Saved Thoughts lists Ideas and Reflections openly rather than in a disclosure.
  The shelf shows three assignments per page, with pagination for all six.
- Ideas, Reflections, checkpoints, and edited next actions save locally. The
  existing planning rules calculate welcome-back and start suggestions.
- Dates are snapshotted when this browser starts the demo. They do not move on
  reload. Planning never changes them. Deleting all steps stays deleted.
- Re-entering the demo preserves progress without changing any real-account
  session. This is not cross-device storage.
- `nook-demo-state-v2` isolates this empty-start flow from old preloaded demo state.
  The legacy key is left intact but is not imported.
- Failed storage writes preserve in-memory edits, retain thought/checkpoint form
  text, and warn that progress may not survive reload.

## Generation endpoint

`POST /api/demo/assignments/:id/breakdown`, without a body or query parameters,
returns the existing breakdown draft/fallback shape and `Cache-Control: no-store`.
Unknown fixture IDs return 404; custom bodies/queries return 400; cross-origin
browser requests return 403. Two active generations or ten requests in a minute
per process return 429 with Retry-After. A schema rejection may still cause the
existing single extra Groq attempt. These limits are process-local: they are not
a deployment-wide spending cap and reset on restart. No paid provider switch or
billing change is made here.

Generation requires the same server-only environment as the private adapter:
GROQ_API_KEY, optionally GROQ_MODEL, or the existing OpenAI configuration. Keys
must never be entered into the demo UI, logged, or committed. Without configuration
or on failure, the app offers manual planning and preserves existing progress.
A successful new draft replaces an existing plan only after confirmation. Edits
made while generation is pending are preserved; late results are discarded.

## Verification

Automated coverage includes empty state, editable persistence/reload, completion,
all-step deletion, due-date preservation, start updates, assignment isolation,
latest Idea/checkpoint, Reflection exclusion, corrupt/blocked storage and retry,
fixed-input endpoint validation, concurrency/rate limits, empty POST streams,
and the actual SDK parser/schema retry with fake HTTP transport.

A local real-provider browser smoke check generated six editable fictional essay
steps, marked needsReview. An edit, completed step, deleted step, Idea, Reflection,
checkpoint, and edited next action survived reload. The original fictional due
date was unchanged. The server request log showed only page loads and the demo
breakdown requests during that flow, with no private save calls.

After the UI revision, browser checks confirmed both shelf pages, the open Saved
Thoughts list, and a fresh AI-generated poetry plan displaying an integer 1–2 hour
range. Reminder and routine save banners were removed.

Screenshot capture was unavailable in the computer-use environment. A 360 px
responsive preview was opened, but full visual checks at 360/390/430 px, an actual
phone keyboard and deployment/network rehearsal remain for B2/A. A successful
live call is not a guarantee of future availability or content quality.

## Automatic effort and importance ordering

On demo entry/course import and after a real Canvas sync, the Shelf performs one
round of effort-only estimation and displays `Estimating effort: X of Y` until
all selected items have succeeded or failed. It schedules at most two requests
at once; leaving the screen stops scheduling more. Pending work resumes when
reopened. This runs in the app's import/Shelf flow, not a durable background job
for third-party callers of the Canvas sync API.

Automatic estimation does NOT call breakdown or create plan steps. It requests
only a whole-hour minimum/maximum, sends only title and sanitized instructions,
and saves separate AI metadata. Generating a step plan remains an explicit action.
A reviewed/edited plan range always wins over an automatic estimate. Neither
process changes Canvas dates, thoughts, checkpoints, or completion state.

The score is the midpoint effort in hours divided by days to due, with a one-day
minimum denominator. Groups: unfinished overdue (largest effort first), upcoming
with estimates (highest score), upcoming without estimates (nearest due), undated
with estimates (largest effort), undated without estimates, fully completed plans.
Exact score ties use due date and assignment ID. Partial completion does not reduce
the score; empty plans are not complete. Sorting precedes three-card pagination.
The UI shows effort ranges, not numeric importance scores.

`POST /api/demo/assignments/:id/effort` accepts only known fixture IDs and no body.
`POST /api/private/assignments/:id/effort` requires session ownership, an open
assignment and a currently selected course. Both return effortEstimate,
effortStatus, needsReview and sourceHash, never a plan. Failure is an unavailable
estimate, not an invented duration. Retry estimates deliberately retries only
unestimated work. The demo's estimate and breakdown routes share the existing
10-request/minute/two-active per-process limits; these are not distributed quotas.

AI cache keys include assignment/owner, full normalized source hash, prompt version,
provider and model. Process caches have a 24-hour TTL and independent copies.
Successful demo results persist locally, and the endpoint revalidates their hash
before reuse (an unchanged response makes no model call). Persisted failures need
an explicit retry; source/provider/version changes invalidate them. Missing or
changed sources cannot overwrite reviewed work. Failed network attempts without
a source hash are retained locally until explicit retry. Server errors and secrets
are not logged.

### Person A: migration and deployment prerequisites

Review `supabase/migrations/0004_ai_effort.sql`, then apply it once AFTER 0003 to
whichever Supabase project is intended. It adds separate AI estimate, source hash,
status and review fields; existing assignment RLS remains in force. This change
has NOT applied it to the shared project. No additional credential is required;
use the existing server-side model configuration. Canvas connection UI remains
postponed and no provider/billing configuration is changed.

Without 0004, private reads still work but automatic private estimates are marked
unavailable; estimating explicitly returns 503 MIGRATION_REQUIRED. After the
migration, new imports are pending and stale source hashes are recognized on
Shelf reads. The Canvas import upsert itself does not overwrite AI or reviewed
plan fields. The private estimator writes only AI columns using ownership and
original title/description conditions, rejecting stale source results.

A must verify the migration and two-account isolation on the intended database,
and confirm hosting accommodates the existing timeout plus one bounded Groq
schema-rejection retry. Those deployment checks are not claimed by local tests.


### Importance verification in this pass

In a fresh isolated browser session, all six fictional assignments received real
AI effort estimates before the Shelf appeared. The first page showed the overdue
lab, the essay (8–12h, due in five days), then the chart (3–7h, due in three days).
The second page contained the presentation, poetry and undated reading. Opening
poetry showed its 2–4h effort range with no plan steps. Editing only that range to
40–40h moved it above the essay (while the overdue lab stayed first); its original
due date was unchanged. This test used disposable fictional browser-local data.
No shared-database migration or real-coursework model call was made.
