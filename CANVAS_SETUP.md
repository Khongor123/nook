# Canvas import for the hackathon demo

This demo uses one presenter-owned Canvas token on the server. Sign in to Nook with the presenter account before using the import tester.

1. Open `/api/private/me` while signed in and copy only the `userId` value.
2. Add these lines to the project-root `.env.local` (never commit the token):

   ```env
   CANVAS_OWNER_USER_ID=your-supabase-user-id
   CANVAS_BASE_URL=https://your-school.instructure.com/
   CANVAS_ACCESS_TOKEN=your-canvas-personal-access-token
   ```

3. Restart `npm run dev` so Next.js reads the new variables.
4. Open `/dev/canvas`, load courses, select one, and sync. Open `/api/private/shelf` to inspect imported assignments. Sync again: existing assignments should update, with no duplicates.

The URL must be the HTTPS Canvas origin, not an API path. This importer only reads Canvas courses and assignments. It never submits or changes coursework in Canvas. Existing Nook thoughts, steps, checkpoints, and local status remain attached to their assignments on re-sync. A course failure is reported in the result; already imported assignments are retained.

The server-held personal token is suitable for a single presenter demo. A multi-user release needs per-user Canvas OAuth and a secure token store.
