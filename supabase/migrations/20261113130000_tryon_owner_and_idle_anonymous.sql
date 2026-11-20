-- Try-on images drawn on a shopper's body carry their shape, so they go when
-- the account does. Images without a body stay shared (user_id null).
alter table public.tryon_images add column user_id uuid references auth.users (id) on delete cascade;
create index tryon_images_user_id on public.tryon_images (user_id);

-- Anonymous users go after 30 days without use, not 30 days after creation,
-- so a tester still opening the app keeps their data. A token refresh counts as use.
select cron.schedule(
  'silo-anonymous-users-30-days',
  '27 4 * * *',
  $$delete from auth.users u where u.is_anonymous
      and greatest(u.created_at, u.last_sign_in_at) < now() - interval '30 days'
      and not exists (select 1 from auth.sessions s where s.user_id = u.id
        and greatest(s.created_at, s.updated_at, s.refreshed_at) > now() - interval '30 days')$$
);
