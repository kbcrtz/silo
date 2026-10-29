-- The passport photo (the selfie), compacted by the backend to a ~30 KB JPEG.
-- One per user; deleting the account deletes it.
create table public.profile_photos (
  user_id uuid primary key references auth.users (id) on delete cascade,
  image bytea not null,
  updated_at timestamptz not null default now()
);

alter table public.profile_photos enable row level security;
