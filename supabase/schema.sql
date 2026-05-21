create extension if not exists "pgcrypto";

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  date text not null default '',
  title text not null default '',
  location text not null default '',
  source text not null default 'manual',
  calendar_event_id text,
  archive_reviewed boolean default false,
  archive_review_notes text,
  evidence_strength text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists song_works (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  session_id uuid references sessions(id) on delete set null,
  status text not null default 'Started',
  bounce_link text,
  lyrics_link text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists writers (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists song_writer_splits (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references song_works(id) on delete cascade,
  writer_id uuid not null references writers(id) on delete cascade,
  percentage numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists asset_links (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references song_works(id) on delete cascade,
  type text not null,
  url text,
  reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pitch_records (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references song_works(id) on delete cascade,
  is_pitched boolean not null default false,
  on_hold boolean not null default false,
  details text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists cut_records (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references song_works(id) on delete cascade,
  artist text,
  release_title text,
  release_date text,
  label text,
  distributor text,
  isrc text,
  chart_stream_notes text,
  dispute_status text,
  registration_status text,
  royalty_admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists contract_records (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references song_works(id) on delete cascade,
  has_contract boolean not null default false,
  split_confirmed boolean not null default false,
  points_notes text,
  master_deal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists action_items (
  id uuid primary key default gen_random_uuid(),
  due_date text not null default '',
  priority text not null default 'Medium',
  session_id uuid references sessions(id) on delete set null,
  song_id uuid references song_works(id) on delete set null,
  task text not null default '',
  status text not null default 'Open',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists archive_progress (
  id uuid primary key default gen_random_uuid(),
  year int not null unique,
  archive_reviewed_up_to text,
  last_audited_session_date text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Future auth/RLS: enable RLS and policies here once multi-user auth is introduced.

-- DEV ONLY POLICIES — replace with authenticated user policies before production.
alter table public.sessions enable row level security;
alter table public.song_works enable row level security;
alter table public.writers enable row level security;
alter table public.song_writer_splits enable row level security;
alter table public.asset_links enable row level security;
alter table public.pitch_records enable row level security;
alter table public.cut_records enable row level security;
alter table public.contract_records enable row level security;
alter table public.action_items enable row level security;
alter table public.archive_progress enable row level security;

drop policy if exists "dev select sessions" on public.sessions;
create policy "dev select sessions" on public.sessions for select to anon using (true);
drop policy if exists "dev insert sessions" on public.sessions;
create policy "dev insert sessions" on public.sessions for insert to anon with check (true);
drop policy if exists "dev update sessions" on public.sessions;
create policy "dev update sessions" on public.sessions for update to anon using (true) with check (true);
drop policy if exists "dev delete sessions" on public.sessions;
create policy "dev delete sessions" on public.sessions for delete to anon using (true);

drop policy if exists "dev select song_works" on public.song_works;
create policy "dev select song_works" on public.song_works for select to anon using (true);
drop policy if exists "dev insert song_works" on public.song_works;
create policy "dev insert song_works" on public.song_works for insert to anon with check (true);
drop policy if exists "dev update song_works" on public.song_works;
create policy "dev update song_works" on public.song_works for update to anon using (true) with check (true);
drop policy if exists "dev delete song_works" on public.song_works;
create policy "dev delete song_works" on public.song_works for delete to anon using (true);

drop policy if exists "dev select writers" on public.writers;
create policy "dev select writers" on public.writers for select to anon using (true);
drop policy if exists "dev insert writers" on public.writers;
create policy "dev insert writers" on public.writers for insert to anon with check (true);
drop policy if exists "dev update writers" on public.writers;
create policy "dev update writers" on public.writers for update to anon using (true) with check (true);
drop policy if exists "dev delete writers" on public.writers;
create policy "dev delete writers" on public.writers for delete to anon using (true);

drop policy if exists "dev select song_writer_splits" on public.song_writer_splits;
create policy "dev select song_writer_splits" on public.song_writer_splits for select to anon using (true);
drop policy if exists "dev insert song_writer_splits" on public.song_writer_splits;
create policy "dev insert song_writer_splits" on public.song_writer_splits for insert to anon with check (true);
drop policy if exists "dev update song_writer_splits" on public.song_writer_splits;
create policy "dev update song_writer_splits" on public.song_writer_splits for update to anon using (true) with check (true);
drop policy if exists "dev delete song_writer_splits" on public.song_writer_splits;
create policy "dev delete song_writer_splits" on public.song_writer_splits for delete to anon using (true);

drop policy if exists "dev select asset_links" on public.asset_links;
create policy "dev select asset_links" on public.asset_links for select to anon using (true);
drop policy if exists "dev insert asset_links" on public.asset_links;
create policy "dev insert asset_links" on public.asset_links for insert to anon with check (true);
drop policy if exists "dev update asset_links" on public.asset_links;
create policy "dev update asset_links" on public.asset_links for update to anon using (true) with check (true);
drop policy if exists "dev delete asset_links" on public.asset_links;
create policy "dev delete asset_links" on public.asset_links for delete to anon using (true);

drop policy if exists "dev select pitch_records" on public.pitch_records;
create policy "dev select pitch_records" on public.pitch_records for select to anon using (true);
drop policy if exists "dev insert pitch_records" on public.pitch_records;
create policy "dev insert pitch_records" on public.pitch_records for insert to anon with check (true);
drop policy if exists "dev update pitch_records" on public.pitch_records;
create policy "dev update pitch_records" on public.pitch_records for update to anon using (true) with check (true);
drop policy if exists "dev delete pitch_records" on public.pitch_records;
create policy "dev delete pitch_records" on public.pitch_records for delete to anon using (true);

drop policy if exists "dev select cut_records" on public.cut_records;
create policy "dev select cut_records" on public.cut_records for select to anon using (true);
drop policy if exists "dev insert cut_records" on public.cut_records;
create policy "dev insert cut_records" on public.cut_records for insert to anon with check (true);
drop policy if exists "dev update cut_records" on public.cut_records;
create policy "dev update cut_records" on public.cut_records for update to anon using (true) with check (true);
drop policy if exists "dev delete cut_records" on public.cut_records;
create policy "dev delete cut_records" on public.cut_records for delete to anon using (true);

drop policy if exists "dev select contract_records" on public.contract_records;
create policy "dev select contract_records" on public.contract_records for select to anon using (true);
drop policy if exists "dev insert contract_records" on public.contract_records;
create policy "dev insert contract_records" on public.contract_records for insert to anon with check (true);
drop policy if exists "dev update contract_records" on public.contract_records;
create policy "dev update contract_records" on public.contract_records for update to anon using (true) with check (true);
drop policy if exists "dev delete contract_records" on public.contract_records;
create policy "dev delete contract_records" on public.contract_records for delete to anon using (true);

drop policy if exists "dev select action_items" on public.action_items;
create policy "dev select action_items" on public.action_items for select to anon using (true);
drop policy if exists "dev insert action_items" on public.action_items;
create policy "dev insert action_items" on public.action_items for insert to anon with check (true);
drop policy if exists "dev update action_items" on public.action_items;
create policy "dev update action_items" on public.action_items for update to anon using (true) with check (true);
drop policy if exists "dev delete action_items" on public.action_items;
create policy "dev delete action_items" on public.action_items for delete to anon using (true);

drop policy if exists "dev select archive_progress" on public.archive_progress;
create policy "dev select archive_progress" on public.archive_progress for select to anon using (true);
drop policy if exists "dev insert archive_progress" on public.archive_progress;
create policy "dev insert archive_progress" on public.archive_progress for insert to anon with check (true);
drop policy if exists "dev update archive_progress" on public.archive_progress;
create policy "dev update archive_progress" on public.archive_progress for update to anon using (true) with check (true);
drop policy if exists "dev delete archive_progress" on public.archive_progress;
create policy "dev delete archive_progress" on public.archive_progress for delete to anon using (true);

alter table public.writers add column if not exists pro text;
alter table public.writers add column if not exists publisher text;
alter table public.song_writer_splits add column if not exists role text;
