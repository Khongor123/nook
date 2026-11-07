# Set up Nook's Supabase project

1. Open the [Supabase Dashboard](https://supabase.com/dashboard), sign in, and create a new project named **nook**. Keep the database password in your password manager.
2. When the project is ready, open **SQL Editor**. Paste the contents of `migrations/0001_nook_core.sql` and run it once. In **Table Editor**, confirm that `courses`, `assignments`, `steps`, `thoughts`, and `checkpoints` exist.
3. In the project's **Connect** panel, copy the project URL and publishable key. In the Nook project folder, copy `.env.example` to `.env.local` and fill in those two values. Keep `.env.local` out of Git.
4. Once the project and tables are ready, add Supabase sign-in and authenticated database reads. Keep the existing demo routes available for B's UI work.

The SQL uses row-level security: a signed-in student can read and write only their own rows. Do not put a Supabase secret key in browser code or in chat.
