-- Silo's tables. Only the backend reads and writes them, over its own Postgres
-- connection: RLS is on with no policies, so the app's publishable key gets nothing.
-- Rows belong to Supabase Auth users; deleting a user deletes their data.

-- The profile snapshot from the phone (season, quiz answers, department). No selfie photo.
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Saved items and lists, as the app's snapshot.
create table public.saved (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- One row per measurement value; the key makes resending the same entry a no-op.
create table public.measurements (
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  value double precision not null,
  measured_at timestamptz not null,
  primary key (user_id, type, measured_at)
);

-- Open / save / shop taps, for "Popular this week". A deleted account's events
-- stay as anonymous counts.
create table public.events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  at timestamptz not null default now(),
  kind text not null check (kind in ('open', 'save', 'shop')),
  item_id text not null,
  season text,
  garment text,
  silhouette text,
  color_family text
);
-- The trending query reads one season's last 7 days.
create index events_season_at on public.events (season, at);
create index events_user_id on public.events (user_id);

-- Generated try-on images, once per product, department and template version. Not personal.
create table public.tryon_images (
  key text primary key,
  model text not null,
  image bytea not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.saved enable row level security;
alter table public.measurements enable row level security;
alter table public.events enable row level security;
alter table public.tryon_images enable row level security;
