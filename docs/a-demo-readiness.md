# Person A: demo readiness and B2 handoff

This checklist is for the phone-first hackathon demo. Keep tokens and real coursework out of screenshots, commits, and public demo fixtures.

## Verified on merged main, November 7, 2026

- Presenter session loaded Canvas courses through `/api/private/canvas/courses`.
- Syncing one course twice returned HTTP 200 both times. Each pass reported `imported: 0`, `updated: 28`, and no course failures. This verifies that this already-imported course did not create duplicate assignments on repeat sync.
- The development persistence page saved an Idea, a Reflection, and a checkpoint on the fictional Community history essay. After a browser reload, the private detail route returned both thought kinds and the latest checkpoint. Earlier notes remained present.
- The authenticated breakdown route returned an editable, five-step Groq draft for that fictional assignment. It was not saved, so the existing completed step was preserved.
- An unauthenticated request to `/api/private/shelf` returned HTTP 401 with `UNAUTHORIZED`.
- `npm test` passed 13 tests; `npm run lint`, `npx tsc --noEmit`, and `npx next build --webpack` passed. The first build attempt was blocked by sandbox DNS while fetching Google fonts; the build passed with network access.
- Static review: all five tables enable row-level security, and their policies compare `user_id` with `auth.uid()`. The plan-save function runs as `SECURITY INVOKER` and checks ownership. This is not a substitute for a second-account test.

## Remaining account-level check for A

1. In Supabase Authentication, create or invite a second test user with an email you control. Sign in to Nook as that user in a private browser window.
2. Open `/api/private/shelf`. The presenter's assignments must not appear. Opening a presenter assignment URL by its UUID must return 404. Attempting to save a thought or plan against that UUID must also return 404.
3. Sign back in as the presenter. Confirm their assignment, plan, thoughts, and checkpoint are still present. Do not delete or overwrite real coursework during this check.

## Deploy a phone-accessible preview

1. In Vercel, import `Khongor123/nook` from GitHub and select the current `main` branch. The project is a Next.js app at the repository root. Set the build command to `npx next build --webpack` if the default build fails in Vercel.
2. In Vercel project environment variables, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Add server-only `GROQ_API_KEY`, `GROQ_MODEL` (optional; default `openai/gpt-oss-20b`), `CANVAS_OWNER_USER_ID`, `CANVAS_BASE_URL`, and `CANVAS_ACCESS_TOKEN`. Copy their values from your local `.env.local` yourself. Do not paste values in GitHub, chat, screenshots, or documents. Never prefix the server-only variables with `NEXT_PUBLIC_`.
3. Deploy. On the Vercel HTTPS URL, sign in as the presenter and open `/api/private/shelf`. Check an assignment detail and generate a draft. The public home page is still the Next.js starter until B2's UI is merged; this deployment validates the backend and supplies a preview URL.
4. Open the HTTPS URL on your phone and sign in with the existing email and password flow. If sign-in fails, check the Vercel Supabase URL and publishable key first.
5. After B2's UI PR merges, redeploy from `main` and rehearse the whole phone flow there.

## B2 handoff

- Give B2 the Vercel preview URL once the private routes work there. The API contract and example payloads are in [`a-integration-handoff.md`](a-integration-handoff.md).
- Tell B2 that the demo Canvas import uses a presenter-only server token. The Connect Canvas button should explain this demo connection; it should not ask users for a token or imply per-user OAuth is implemented.
- B2 should use the private routes for signed-in app data and the public fixture routes only for layout/demo samples. The `/dev/*` pages are local development testers and return 404 in production.
- Hand C this quality finding: one fictional AI draft proposed 270 total step minutes while its effort range was 180-240 minutes. C should decide whether to tighten the prompt or validation before the demo.
