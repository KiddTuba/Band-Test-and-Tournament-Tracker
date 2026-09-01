create table if not exists public.bandcenter_state (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.bandcenter_state enable row level security;

-- Classroom deployment policy. The anon key may read/write the single BandCenter
-- document. Keep real student names out of any public-facing view in the app.
create policy "bandcenter read" on public.bandcenter_state for select using (true);
create policy "bandcenter insert" on public.bandcenter_state for insert with check (true);
create policy "bandcenter update" on public.bandcenter_state for update using (true) with check (true);

insert into public.bandcenter_state (id, payload)
values ('okeene-bandcenter', '{}'::jsonb)
on conflict (id) do nothing;
