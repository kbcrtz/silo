-- Daily cleanup with pg_cron.
-- Try-on images: the phone keeps its own copy and the fits, products and body
-- they came from stay in `saved`, `profiles` and `measurements`, so a week is
-- only a safety net for re-opens; after that the next view makes a new one.
-- Anonymous users: since sign-up holds the backups, one that never signed up
-- has almost nothing; after 30 days it goes, its rows by cascade.
create extension if not exists pg_cron;

-- Named jobs: scheduling the same name again replaces it.
select cron.schedule(
  'silo-tryon-images-7-days',
  '17 4 * * *',
  $$delete from public.tryon_images where created_at < now() - interval '7 days'$$
);

select cron.schedule(
  'silo-anonymous-users-30-days',
  '27 4 * * *',
  $$delete from auth.users where is_anonymous and created_at < now() - interval '30 days'$$
);
