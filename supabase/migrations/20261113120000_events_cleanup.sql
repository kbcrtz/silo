-- "Popular this week" reads 7 days of events; older rows are never read again.
select cron.schedule(
  'silo-events-30-days',
  '37 4 * * *',
  $$delete from public.events where at < now() - interval '30 days'$$
);
