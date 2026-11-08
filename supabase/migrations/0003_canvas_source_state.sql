-- Run once after 0002_assignment_plans.sql.
-- Keep source metadata separate from student-edited plans, notes, and checkpoints.
alter table public.assignments
  add column canvas_url text,
  add column unlock_at timestamptz,
  add column submission_types text[] not null default '{}',
  add column source_available boolean not null default true;

alter table public.courses
  add column last_synced_at timestamptz;
