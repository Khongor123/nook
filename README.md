# Nook

Nook is a phone-first coursework planner designed to make it easier to begin and return to schoolwork. It turns selected Canvas assignments into a small, editable plan, keeps a student's own notes and progress with each assignment, and offers a gentle reminder of where to continue.

The interface uses a warm cream, peach, and lavender palette with Nunito. The main signed-in destinations are **Shelf** and **Current work**. A persistent bottom navigation pill appears after the user can access the Shelf; it is hidden on welcome, sign-in, sign-up, and setup screens.

## What works

### Accounts and access

- Students can create an account, sign in, and request a password reset through Supabase Auth.
- The configured presenter account can access the Canvas-backed flow. Nook checks the server-side Canvas configuration before showing the import screen.
- Accounts that are not configured for the presenter Canvas connection see an honest “Canvas connection coming later” screen. Individual Canvas account linking is not implemented yet.
- Private API routes require a valid Supabase session. Coursework and planning data are scoped to the signed-in user using Supabase row-level security.

### Canvas import and Shelf

- The presenter flow lists Canvas courses and lets the user choose which courses to import or sync.
- Import and sync read course and assignment data from Canvas. The integration does not submit work, edit due dates, or otherwise write coursework back to Canvas.
- The Shelf includes assignments only from selected courses. It excludes submitted assignments, assignments awaiting grading after submission, and graded assignments.
- The Shelf shows up to three assignments at a time. When there are more, previous and next controls page through the list.
- Assignment cards keep Canvas's due date separate from Nook's suggested start date. The suggestion is based on the saved effort estimate, a 90-minute daily work assumption, a buffer day, and any Canvas unlock date. It is a planning suggestion, not a changed due date.
- If an assignment disappears from a successfully synced Canvas course, Nook marks its source as unavailable while preserving its local plan and notes.

### Planning and returning to work

- Each assignment has a detail view with its course, instructions, due date, Canvas link when available, plan, and progress.
- Nook can request an AI-generated breakdown. The result is an unsaved draft that the student can edit. If AI is unavailable or the instructions are too vague, the student can write a plan manually.
- A reviewed plan contains one to six editable steps. The effort estimate is displayed and saved as a whole number of hours; the per-step durations are stored in minutes.
- Saving a plan persists its steps and effort estimate. Current work lets the student mark steps complete and continue working on the same assignment.
- Students can save an **Idea** and a **Reflection** as separate notes. Neither is automatically converted into a task.
- A checkpoint saves where the student paused and the next action they chose. Welcome back uses the same assignment's saved checkpoint, Idea, and plan context to help the student resume.
- The active assignment is retained in the URL and browser storage so navigation and reloads can return to that work.

### Try demo coursework

The welcome screen's **Try demo coursework** button opens the Shelf without signing in. This mode uses fictional assignments and courses bundled with the app. Demo course selection and sync are local only, so they never read the presenter's Canvas token or show actual Canvas courses. Demo planning changes are stored in that browser's local storage rather than in the account database. Demo content is not real coursework and does not sync between browsers or devices.

## Postponed or limited

- **Individual Canvas connections:** per-student Canvas OAuth, consent, token storage, and account-specific sync are not implemented. Canvas import currently uses one presenter-owned token configured on the server for the presenter account.
- **Personal coursework for new accounts:** creating a Nook account does not connect it to a student's Canvas account. Those accounts stop at the coming-later screen until individual Canvas linking is built.
- **Cross-device demo persistence:** demo course selections and saved demo planning state live in browser local storage only. They are separate from signed-in Supabase data.
- **Canvas write-back:** submitting assignments, editing Canvas content, changing due dates, or creating Canvas tasks are intentionally not supported; the integration is read-only.
- **AI guarantees:** generated suggestions can be incomplete or need correction. They are presented as editable drafts, not authoritative instructions. A manual plan remains available if the provider is unconfigured or fails.

## Running locally

Use Node.js and npm. Install dependencies and start the development server:

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). To explore the fictional sample flow, choose **Try demo coursework**. To use authenticated and Canvas-backed features, configure the environment variables below and apply the database migrations to a Supabase project.

### Environment variables

Set these in `.env.local`. Keep the file and all secret values out of Git.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL used by browser and server clients. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable/anonymous client key. Never put a secret/service-role key in browser code. |
| `CANVAS_OWNER_USER_ID` | Supabase user ID allowed to use the presenter Canvas connection. |
| `CANVAS_BASE_URL` | HTTPS origin of the presenter's Canvas installation. |
| `CANVAS_ACCESS_TOKEN` | Presenter-owned Canvas access token; server-side only. |
| `GROQ_API_KEY` | Optional server-side Groq key for AI planning. |
| `GROQ_MODEL` | Optional Groq model override; defaults to `openai/gpt-oss-20b`. |
| `OPENAI_API_KEY` | Optional server-side OpenAI key if using the OpenAI provider path. |
| `OPENAI_MODEL` | Optional OpenAI model name. |

Groq is preferred when both provider keys are configured. Restart the development server after changing environment variables. Missing Supabase URL or publishable key prevents the Supabase client from being created. Missing AI configuration leaves manual planning available.

### Database setup

For a new Supabase project, apply the SQL migrations in order, once each:

1. `supabase/migrations/0001_nook_core.sql`
2. `supabase/migrations/0002_assignment_plans.sql`
3. `supabase/migrations/0003_canvas_source_state.sql`

The shared project used for the demo already has these migrations applied; do not rerun them there. The schema stores courses, assignments, plan steps, thoughts, and checkpoints, with row-level security limiting records to their owner.

### Commands

```bash
npm run dev          # Start the Next.js development server
npm run lint         # Run ESLint
npm test             # Run planning, AI, persistence-contract, and Canvas tests
npm run build        # Create a production build using webpack
npm start            # Serve the production build
```

## Main application routes

| Route | Purpose |
| --- | --- |
| `/` | Welcome screen and demo entry. |
| `/sign-in`, `/sign-up` | Supabase account access. |
| `/connect`, `/coming-later` | Presenter Canvas entry and account setup status. |
| `/import` | Select Canvas courses and import or sync assignments. |
| `/shelf` | Selected-course assignments, three at a time. |
| `/assignments/:id` | Assignment details, plan drafting, and estimate review. |
| `/current/:id` | Work through and update a saved assignment plan. |
| `/checkpoint/:id` | Save a pause point and chosen next action. |
| `/welcome-back/:id` | Resume the same assignment using its saved context. |

Development-only `/dev/*` pages provide Canvas, persistence, and planning testers; they are not intended as student-facing routes.

## Private API overview

Authenticated application routes live under `/api/private`:

- `GET /api/private/canvas/courses` lists courses and their selection state.
- `POST /api/private/canvas/sync` saves the selected course set and syncs assignments from Canvas.
- `GET /api/private/shelf` returns open assignments from selected courses with progress and start suggestions.
- `GET /api/private/assignments/:id` returns assignment details, steps, thoughts, latest checkpoint, effort estimate, and welcome-back context.
- `POST /api/private/assignments/:id/breakdown` returns an editable, unsaved AI draft.
- `PUT /api/private/assignments/:id/plan` saves reviewed steps and the effort estimate.
- `POST /api/private/assignments/:id/thoughts` saves an Idea or Reflection.
- `POST /api/private/assignments/:id/checkpoints` saves a checkpoint and next action.

Private responses are not cached publicly. The public fixture routes and the browser-only demo mode are for fictional examples, not access to personal coursework.

## Deployment

The app is deployed with Vercel from the repository's `main` branch. Configure the same required Supabase environment variables in the Vercel project, and add the server-only Canvas and AI variables for the presenter flow. Never expose Canvas or AI provider tokens with a `NEXT_PUBLIC_` prefix. Deployments need to use the repository's configured build command, `npm run build`.
