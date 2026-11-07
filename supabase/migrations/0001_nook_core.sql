-- Nook's private coursework data. Run once in the Supabase SQL Editor.
-- Demo fixtures are separate and do not need database rows.

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  canvas_course_id text not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, canvas_course_id)
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  canvas_course_id text not null,
  canvas_assignment_id text not null,
  course_name text not null,
  title text not null,
  description_text text not null default '',
  due_at timestamptz,
  time_zone text not null default 'UTC',
  source_updated_at timestamptz,
  status text not null default 'open'
    check (status in ('open', 'submitted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, canvas_course_id, canvas_assignment_id),
  unique (id, user_id)
);

create table public.steps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  assignment_id uuid not null,
  text text not null check (length(trim(text)) > 0),
  minutes integer not null check (minutes > 0 and minutes <= 1440),
  done boolean not null default false,
  source text not null check (source in ('suggested', 'student')),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  foreign key (assignment_id, user_id)
    references public.assignments (id, user_id) on delete cascade
);

create table public.thoughts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  assignment_id uuid not null,
  kind text not null check (kind in ('idea', 'reflection')),
  text text not null check (length(trim(text)) > 0),
  created_at timestamptz not null default now(),
  foreign key (assignment_id, user_id)
    references public.assignments (id, user_id) on delete cascade
);

create table public.checkpoints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  assignment_id uuid not null,
  note text not null default '',
  next_step text not null default '',
  created_at timestamptz not null default now(),
  foreign key (assignment_id, user_id)
    references public.assignments (id, user_id) on delete cascade
);

create index steps_user_assignment_idx
  on public.steps (user_id, assignment_id, position);
create index thoughts_user_assignment_idx
  on public.thoughts (user_id, assignment_id, created_at desc);
create index checkpoints_user_assignment_idx
  on public.checkpoints (user_id, assignment_id, created_at desc);

alter table public.courses enable row level security;
alter table public.assignments enable row level security;
alter table public.steps enable row level security;
alter table public.thoughts enable row level security;
alter table public.checkpoints enable row level security;

-- The publishable key is safe to use in a browser only because these policies
-- restrict every read and write to the signed-in user's own rows.
create policy "courses own rows" on public.courses
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "assignments own rows" on public.assignments
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "steps own rows" on public.steps
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "thoughts own rows" on public.thoughts
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "checkpoints own rows" on public.checkpoints
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete
  on public.courses, public.assignments, public.steps,
     public.thoughts, public.checkpoints
  to authenticated;
