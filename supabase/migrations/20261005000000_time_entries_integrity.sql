begin;

create table if not exists public.time_entries (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    started_at timestamptz not null,
    ended_at timestamptz,
    task_name text not null default 'Untitled task'
);

-- Existing installations may not yet have an ownership column/default.
alter table public.time_entries
    add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.time_entries alter column user_id set default auth.uid();

-- Preserve existing data: abort with instructions rather than choosing owners or stopping timers.
do $$
begin
    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'time_entries'
          and column_name in ('started_at', 'ended_at') and udt_name <> 'timestamptz'
    ) then
        raise exception 'Convert started_at and ended_at to timestamptz using the original recording timezone before applying this migration.';
    end if;
    if exists (select 1 from public.time_entries where user_id is null) then
        raise exception 'Assign the correct user_id to existing ownerless entries before applying this migration.';
    end if;
    if exists (select 1 from public.time_entries where started_at is null or ended_at < started_at) then
        raise exception 'Correct missing start times or end times earlier than their start before applying this migration.';
    end if;
    if exists (
        select user_id from public.time_entries where ended_at is null
        group by user_id having count(*) > 1
    ) then
        raise exception 'Resolve duplicate running timers for each user before applying this migration.';
    end if;
end $$;

alter table public.time_entries alter column user_id set not null;
alter table public.time_entries alter column started_at set not null;
alter table public.time_entries add constraint time_entries_valid_duration
    check (ended_at is null or ended_at >= started_at);

create unique index time_entries_one_running_per_user
    on public.time_entries (user_id) where ended_at is null;
create index if not exists time_entries_user_started_at
    on public.time_entries (user_id, started_at);

alter table public.time_entries enable row level security;
revoke all on public.time_entries from anon;
grant select, insert, update on public.time_entries to authenticated;

-- The restrictive guard also constrains any pre-existing permissive policies.
create policy time_entries_owner_guard on public.time_entries as restrictive
    for all to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);
create policy time_entries_owner_access on public.time_entries
    for all to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);
create policy time_entries_no_anonymous_access on public.time_entries as restrictive
    for all to anon using (false) with check (false);

commit;
