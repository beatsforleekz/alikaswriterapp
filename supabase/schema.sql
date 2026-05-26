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
  apple_note_exists boolean default false,
  evidence_strength_override boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists studios (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
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
  audio_storage_path text,
  audio_file_name text,
  audio_mime_type text,
  audio_uploaded_at timestamptz,
  audio_source_note text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists song_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists song_work_tags (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references song_works(id) on delete cascade,
  tag_id uuid not null references song_tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(song_id, tag_id)
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

create table if not exists session_review_history (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  event_type text not null,
  field_name text not null,
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);

create table if not exists pitch_playlists (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  recipient_name text,
  recipient_company text,
  password text,
  expires_at timestamptz,
  share_token text unique not null,
  is_active boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pitch_playlist_tracks (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references pitch_playlists(id) on delete cascade,
  song_work_id uuid not null references song_works(id) on delete cascade,
  notes text,
  sort_order integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pitch_playlist_views (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references pitch_playlists(id) on delete cascade,
  viewed_at timestamptz default now(),
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists pitch_playlist_events (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references pitch_playlists(id) on delete cascade,
  playlist_track_id uuid references pitch_playlist_tracks(id) on delete set null,
  event_type text not null check (event_type in ('view','play','finish')),
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists pitch_playlist_responses (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references pitch_playlists(id) on delete cascade,
  playlist_track_id uuid references pitch_playlist_tracks(id) on delete set null,
  response_type text not null check (response_type in ('interested','hold','pass','feedback')),
  sender_name text,
  sender_company text,
  sender_artist text,
  sender_message text,
  created_at timestamptz not null default now()
);

-- Future auth/RLS: enable RLS and policies here once multi-user auth is introduced.

-- DEV ONLY POLICIES — replace with authenticated user policies before production.
alter table public.sessions enable row level security;
alter table public.studios enable row level security;
alter table public.song_works enable row level security;
alter table public.song_tags enable row level security;
alter table public.song_work_tags enable row level security;
alter table public.writers enable row level security;
alter table public.song_writer_splits enable row level security;
alter table public.asset_links enable row level security;
alter table public.pitch_records enable row level security;
alter table public.cut_records enable row level security;
alter table public.contract_records enable row level security;
alter table public.action_items enable row level security;
alter table public.archive_progress enable row level security;
alter table public.session_review_history enable row level security;
alter table public.pitch_playlists enable row level security;
alter table public.pitch_playlist_tracks enable row level security;
alter table public.pitch_playlist_views enable row level security;
alter table public.pitch_playlist_events enable row level security;
alter table public.pitch_playlist_responses enable row level security;

grant select, insert, update, delete on public.writers to anon;
grant select, insert, update, delete on public.song_writer_splits to anon;

drop policy if exists "dev all writers" on public.writers;
create policy "dev all writers" on public.writers
for all to anon using (true) with check (true);

drop policy if exists "dev all song_writer_splits" on public.song_writer_splits;
create policy "dev all song_writer_splits" on public.song_writer_splits
for all to anon using (true) with check (true);

drop policy if exists "dev select sessions" on public.sessions;
create policy "dev select sessions" on public.sessions for select to anon using (true);
drop policy if exists "dev insert sessions" on public.sessions;
create policy "dev insert sessions" on public.sessions for insert to anon with check (true);
drop policy if exists "dev update sessions" on public.sessions;
create policy "dev update sessions" on public.sessions for update to anon using (true) with check (true);
drop policy if exists "dev delete sessions" on public.sessions;
create policy "dev delete sessions" on public.sessions for delete to anon using (true);

grant select, insert, update, delete on public.studios to anon;
drop policy if exists "dev select studios" on public.studios;
create policy "dev select studios" on public.studios for select to anon using (true);
drop policy if exists "dev insert studios" on public.studios;
create policy "dev insert studios" on public.studios for insert to anon with check (true);
drop policy if exists "dev update studios" on public.studios;
create policy "dev update studios" on public.studios for update to anon using (true) with check (true);
drop policy if exists "dev delete studios" on public.studios;
create policy "dev delete studios" on public.studios for delete to anon using (true);

drop policy if exists "dev select song_works" on public.song_works;
create policy "dev select song_works" on public.song_works for select to anon using (true);
drop policy if exists "dev insert song_works" on public.song_works;
create policy "dev insert song_works" on public.song_works for insert to anon with check (true);
drop policy if exists "dev update song_works" on public.song_works;
create policy "dev update song_works" on public.song_works for update to anon using (true) with check (true);
drop policy if exists "dev delete song_works" on public.song_works;
create policy "dev delete song_works" on public.song_works for delete to anon using (true);

grant select, insert, update, delete on public.song_tags to anon;
grant select, insert, update, delete on public.song_work_tags to anon;
grant select, insert, update, delete on public.session_review_history to anon;

drop policy if exists "dev select song_tags" on public.song_tags;
create policy "dev select song_tags" on public.song_tags for select to anon using (true);
drop policy if exists "dev insert song_tags" on public.song_tags;
create policy "dev insert song_tags" on public.song_tags for insert to anon with check (true);
drop policy if exists "dev update song_tags" on public.song_tags;
create policy "dev update song_tags" on public.song_tags for update to anon using (true) with check (true);
drop policy if exists "dev delete song_tags" on public.song_tags;
create policy "dev delete song_tags" on public.song_tags for delete to anon using (true);

drop policy if exists "dev select song_work_tags" on public.song_work_tags;
create policy "dev select song_work_tags" on public.song_work_tags for select to anon using (true);
drop policy if exists "dev insert song_work_tags" on public.song_work_tags;
create policy "dev insert song_work_tags" on public.song_work_tags for insert to anon with check (true);
drop policy if exists "dev update song_work_tags" on public.song_work_tags;
create policy "dev update song_work_tags" on public.song_work_tags for update to anon using (true) with check (true);
drop policy if exists "dev delete song_work_tags" on public.song_work_tags;
create policy "dev delete song_work_tags" on public.song_work_tags for delete to anon using (true);

drop policy if exists "dev select session_review_history" on public.session_review_history;
create policy "dev select session_review_history" on public.session_review_history for select to anon using (true);
drop policy if exists "dev insert session_review_history" on public.session_review_history;
create policy "dev insert session_review_history" on public.session_review_history for insert to anon with check (true);
drop policy if exists "dev update session_review_history" on public.session_review_history;
create policy "dev update session_review_history" on public.session_review_history for update to anon using (true) with check (true);
drop policy if exists "dev delete session_review_history" on public.session_review_history;
create policy "dev delete session_review_history" on public.session_review_history for delete to anon using (true);

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

grant select, insert, update, delete on public.pitch_playlists to anon;
grant select, insert, update, delete on public.pitch_playlist_tracks to anon;
grant select, insert, update, delete on public.pitch_playlist_views to anon;
grant select, insert, update, delete on public.pitch_playlist_events to anon;
grant select, insert, update, delete on public.pitch_playlist_responses to anon;

drop policy if exists "dev select pitch_playlists" on public.pitch_playlists;
create policy "dev select pitch_playlists" on public.pitch_playlists for select to anon using (true);
drop policy if exists "dev insert pitch_playlists" on public.pitch_playlists;
create policy "dev insert pitch_playlists" on public.pitch_playlists for insert to anon with check (true);
drop policy if exists "dev update pitch_playlists" on public.pitch_playlists;
create policy "dev update pitch_playlists" on public.pitch_playlists for update to anon using (true) with check (true);
drop policy if exists "dev delete pitch_playlists" on public.pitch_playlists;
create policy "dev delete pitch_playlists" on public.pitch_playlists for delete to anon using (true);

drop policy if exists "dev select pitch_playlist_tracks" on public.pitch_playlist_tracks;
create policy "dev select pitch_playlist_tracks" on public.pitch_playlist_tracks for select to anon using (true);
drop policy if exists "dev insert pitch_playlist_tracks" on public.pitch_playlist_tracks;
create policy "dev insert pitch_playlist_tracks" on public.pitch_playlist_tracks for insert to anon with check (true);
drop policy if exists "dev update pitch_playlist_tracks" on public.pitch_playlist_tracks;
create policy "dev update pitch_playlist_tracks" on public.pitch_playlist_tracks for update to anon using (true) with check (true);
drop policy if exists "dev delete pitch_playlist_tracks" on public.pitch_playlist_tracks;
create policy "dev delete pitch_playlist_tracks" on public.pitch_playlist_tracks for delete to anon using (true);

drop policy if exists "dev select pitch_playlist_views" on public.pitch_playlist_views;
create policy "dev select pitch_playlist_views" on public.pitch_playlist_views for select to anon using (true);
drop policy if exists "dev insert pitch_playlist_views" on public.pitch_playlist_views;
create policy "dev insert pitch_playlist_views" on public.pitch_playlist_views for insert to anon with check (true);
drop policy if exists "dev update pitch_playlist_views" on public.pitch_playlist_views;
create policy "dev update pitch_playlist_views" on public.pitch_playlist_views for update to anon using (true) with check (true);
drop policy if exists "dev delete pitch_playlist_views" on public.pitch_playlist_views;
create policy "dev delete pitch_playlist_views" on public.pitch_playlist_views for delete to anon using (true);

drop policy if exists "dev select pitch_playlist_events" on public.pitch_playlist_events;
create policy "dev select pitch_playlist_events" on public.pitch_playlist_events for select to anon using (true);
drop policy if exists "dev insert pitch_playlist_events" on public.pitch_playlist_events;
create policy "dev insert pitch_playlist_events" on public.pitch_playlist_events for insert to anon with check (true);
drop policy if exists "dev update pitch_playlist_events" on public.pitch_playlist_events;
create policy "dev update pitch_playlist_events" on public.pitch_playlist_events for update to anon using (true) with check (true);
drop policy if exists "dev delete pitch_playlist_events" on public.pitch_playlist_events;
create policy "dev delete pitch_playlist_events" on public.pitch_playlist_events for delete to anon using (true);

drop policy if exists "dev select pitch_playlist_responses" on public.pitch_playlist_responses;
create policy "dev select pitch_playlist_responses" on public.pitch_playlist_responses for select to anon using (true);
drop policy if exists "dev insert pitch_playlist_responses" on public.pitch_playlist_responses;
create policy "dev insert pitch_playlist_responses" on public.pitch_playlist_responses for insert to anon with check (true);
drop policy if exists "dev update pitch_playlist_responses" on public.pitch_playlist_responses;
create policy "dev update pitch_playlist_responses" on public.pitch_playlist_responses for update to anon using (true) with check (true);
drop policy if exists "dev delete pitch_playlist_responses" on public.pitch_playlist_responses;
create policy "dev delete pitch_playlist_responses" on public.pitch_playlist_responses for delete to anon using (true);

alter table public.writers add column if not exists pro text;
alter table public.writers add column if not exists publisher text;
alter table public.writers add column if not exists email text;
alter table public.writers add column if not exists phone text;
alter table public.writers add column if not exists notes text;
alter table public.song_writer_splits add column if not exists role text;
alter table public.song_works add column if not exists audio_storage_path text;
alter table public.song_works add column if not exists audio_file_name text;
alter table public.song_works add column if not exists audio_mime_type text;
alter table public.song_works add column if not exists audio_uploaded_at timestamptz;
alter table public.song_works add column if not exists audio_source_note text;
alter table public.sessions add column if not exists apple_note_exists boolean default false;
alter table public.sessions add column if not exists evidence_strength_override boolean default false;
alter table public.pitch_playlist_tracks alter column song_work_id set not null;
alter table public.pitch_playlist_tracks drop column if exists title;
alter table public.pitch_playlist_tracks drop column if exists artist;
alter table public.pitch_playlist_tracks drop column if exists audio_url;

-- DEV ONLY STORAGE POLICIES — replace with authenticated user policies before production.
-- Supabase Storage setup notes:
-- 1) Create a private bucket named pitch-audio in Supabase Storage.
-- 2) Apply these temporary dev policies for anon local development only.

grant usage on schema storage to anon;
grant select, insert, update, delete on storage.objects to anon;

drop policy if exists "dev pitch audio select" on storage.objects;
create policy "dev pitch audio select"
on storage.objects for select to anon
using (bucket_id = 'pitch-audio');

drop policy if exists "dev pitch audio insert" on storage.objects;
create policy "dev pitch audio insert"
on storage.objects for insert to anon
with check (bucket_id = 'pitch-audio');

drop policy if exists "dev pitch audio update" on storage.objects;
create policy "dev pitch audio update"
on storage.objects for update to anon
using (bucket_id = 'pitch-audio')
with check (bucket_id = 'pitch-audio');

drop policy if exists "dev pitch audio delete" on storage.objects;
create policy "dev pitch audio delete"
on storage.objects for delete to anon
using (bucket_id = 'pitch-audio');
