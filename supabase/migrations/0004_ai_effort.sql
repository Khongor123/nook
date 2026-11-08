-- Review and apply once after 0003. This migration is NOT applied by the app.
-- Existing assignment RLS continues to protect these per-user fields.
alter table public.assignments
  add column ai_effort_min_minutes integer,
  add column ai_effort_max_minutes integer,
  add column ai_effort_source_hash text,
  add column ai_effort_status text not null default 'pending'
    check (ai_effort_status in ('pending', 'ready', 'unavailable')),
  add column ai_effort_needs_review boolean not null default true;
alter table public.assignments add constraint assignments_ai_effort_range check (
  (ai_effort_status = 'ready' and ai_effort_min_minutes is not null
    and ai_effort_max_minutes is not null and ai_effort_source_hash is not null
    and ai_effort_min_minutes between 60 and 2400
    and ai_effort_max_minutes between ai_effort_min_minutes and 3000
    and ai_effort_min_minutes % 60 = 0 and ai_effort_max_minutes % 60 = 0)
  or (ai_effort_status <> 'ready' and ai_effort_min_minutes is null and ai_effort_max_minutes is null)
);
