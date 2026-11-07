-- Run once after 0001_nook_core.sql. Existing assignments remain valid.
alter table public.assignments
  add column effort_min_minutes integer,
  add column effort_max_minutes integer,
  add constraint assignments_effort_range_check check (
    (effort_min_minutes is null and effort_max_minutes is null)
    or (effort_min_minutes between 10 and 2400
      and effort_max_minutes between effort_min_minutes and 3000)
  );

-- Replace the reviewed plan in one transaction. The caller's JWT and RLS
-- control ownership; this function does not use elevated database privileges.
create function public.save_assignment_plan(
  p_assignment_id uuid,
  p_effort_min_minutes integer,
  p_effort_max_minutes integer,
  p_steps jsonb
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_step jsonb;
  v_id uuid;
  v_seen uuid[] := '{}';
  v_position integer := 0;
  v_text text;
  v_minutes integer;
  v_done boolean;
  v_source text;
begin
  if v_user_id is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  if p_effort_min_minutes is null or p_effort_max_minutes is null
    or p_effort_min_minutes not between 10 and 2400
    or p_effort_max_minutes not between p_effort_min_minutes and 3000 then
    raise exception 'Invalid effort range' using errcode = '22023';
  end if;
  if jsonb_typeof(p_steps) is distinct from 'array' then
    raise exception 'Plan must have 1 to 6 steps' using errcode = '22023';
  end if;
  if jsonb_array_length(p_steps) not between 1 and 6 then
    raise exception 'Plan must have 1 to 6 steps' using errcode = '22023';
  end if;

  perform 1 from public.assignments
    where id = p_assignment_id and user_id = v_user_id for update;
  if not found then
    raise exception 'Assignment not found' using errcode = '42501';
  end if;

  for v_step in select value from jsonb_array_elements(p_steps) loop
    if jsonb_typeof(v_step) is distinct from 'object'
      or jsonb_typeof(v_step->'text') is distinct from 'string'
      or jsonb_typeof(v_step->'minutes') is distinct from 'number'
      or jsonb_typeof(v_step->'done') is distinct from 'boolean'
      or jsonb_typeof(v_step->'source') is distinct from 'string' then
      raise exception 'Invalid step' using errcode = '22023';
    end if;
    v_text := trim(v_step->>'text');
    v_minutes := (v_step->>'minutes')::integer;
    v_done := (v_step->>'done')::boolean;
    v_source := v_step->>'source';
    if length(v_text) not between 1 and 140
      or v_minutes not between 10 and 480
      or v_source not in ('suggested', 'student') then
      raise exception 'Invalid step' using errcode = '22023';
    end if;

    if v_step ? 'id' and nullif(v_step->>'id', '') is not null then
      v_id := (v_step->>'id')::uuid;
      if v_id = any(v_seen) then
        raise exception 'Duplicate step ID' using errcode = '22023';
      end if;
      update public.steps set
        text = v_text, minutes = v_minutes, done = v_done,
        source = v_source, position = v_position
      where id = v_id and user_id = v_user_id and assignment_id = p_assignment_id;
      if not found then
        raise exception 'Step not found in this assignment' using errcode = '42501';
      end if;
    else
      insert into public.steps
        (user_id, assignment_id, text, minutes, done, source, position)
      values
        (v_user_id, p_assignment_id, v_text, v_minutes, v_done, v_source, v_position)
      returning id into v_id;
    end if;
    v_seen := array_append(v_seen, v_id);
    v_position := v_position + 1;
  end loop;

  delete from public.steps
    where user_id = v_user_id and assignment_id = p_assignment_id
      and not (id = any(v_seen));
  update public.assignments set
    effort_min_minutes = p_effort_min_minutes,
    effort_max_minutes = p_effort_max_minutes,
    updated_at = now()
  where id = p_assignment_id and user_id = v_user_id;
end;
$$;

revoke all on function public.save_assignment_plan(uuid, integer, integer, jsonb) from public;
grant execute on function public.save_assignment_plan(uuid, integer, integer, jsonb) to authenticated;
