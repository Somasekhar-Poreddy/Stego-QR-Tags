-- =========================================================================
-- Stegofy admin security migration
-- =========================================================================
-- This migration adds:
--   1. admin_failed_login_attempts — table tracking failed admin sign-ins
--   2. record_admin_login_failure() — RPC writable by anon
--   3. check_admin_login_lock()    — RPC readable by anon, returns lock state
--   4. record_admin_login_event()  — RPC for successful login events with
--      device fingerprint (used by Tier 2.6 notification flow)
--
-- Run this file once in the Supabase SQL editor.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. admin_failed_login_attempts table
-- -------------------------------------------------------------------------
create table if not exists public.admin_failed_login_attempts (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  ip_hash     text,
  user_agent  text,
  attempted_at timestamptz not null default now()
);

create index if not exists admin_failed_login_attempts_email_idx
  on public.admin_failed_login_attempts (lower(email), attempted_at desc);

alter table public.admin_failed_login_attempts enable row level security;

-- Only super-admins can read the raw table — never anon. Writes go through
-- the SECURITY DEFINER functions below.
drop policy if exists "Super admins read failed attempts" on public.admin_failed_login_attempts;
create policy "Super admins read failed attempts"
  on public.admin_failed_login_attempts
  for select
  to authenticated
  using (
    exists (
      select 1 from public.admin_users
      where user_id = auth.uid() and role = 'super_admin'
    )
  );

-- -------------------------------------------------------------------------
-- 2. record_admin_login_failure() — anon-callable
-- -------------------------------------------------------------------------
-- Called by the AdminLogin form whenever Supabase rejects the password.
-- Inserts a row keyed by email + a hash of the requesting IP. The hash is
-- computed client-side (or via Supabase's request headers) so we don't store
-- raw PII for failed logins.
create or replace function public.record_admin_login_failure(
  p_email      text,
  p_ip_hash    text default null,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.admin_failed_login_attempts (email, ip_hash, user_agent)
  values (lower(trim(p_email)), p_ip_hash, p_user_agent);

  -- Garbage-collect old rows so the table doesn't grow without bound.
  -- We only care about the trailing window for lock decisions.
  delete from public.admin_failed_login_attempts
  where attempted_at < now() - interval '1 day';
end;
$$;

revoke all on function public.record_admin_login_failure(text, text, text) from public;
grant execute on function public.record_admin_login_failure(text, text, text) to anon, authenticated;

-- -------------------------------------------------------------------------
-- 3. check_admin_login_lock() — anon-callable
-- -------------------------------------------------------------------------
-- Returns the lock state for an email so the login form can show the user
-- "Try again in N minutes" before they even enter their password. Logic:
--   - 5 or more failed attempts in the past 15 minutes  ⇒ locked
--   - returns the # of failures + the unlock_at timestamp (null if not locked)
create or replace function public.check_admin_login_lock(
  p_email text
)
returns table (
  failures   int,
  locked     boolean,
  unlock_at  timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz := now() - interval '15 minutes';
  v_failures     int;
  v_oldest_failure timestamptz;
begin
  select count(*), min(attempted_at)
  into v_failures, v_oldest_failure
  from public.admin_failed_login_attempts
  where lower(email) = lower(trim(p_email))
    and attempted_at >= v_window_start;

  failures := coalesce(v_failures, 0);
  locked := failures >= 5;
  unlock_at := case
    when locked then v_oldest_failure + interval '15 minutes'
    else null
  end;
  return next;
end;
$$;

revoke all on function public.check_admin_login_lock(text) from public;
grant execute on function public.check_admin_login_lock(text) to anon, authenticated;

-- -------------------------------------------------------------------------
-- 4. clear_admin_login_failures() — internal, called on successful login
-- -------------------------------------------------------------------------
-- Wipes the failure history for a given email after a successful sign-in.
create or replace function public.clear_admin_login_failures(
  p_email text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.admin_failed_login_attempts
  where lower(email) = lower(trim(p_email));
end;
$$;

revoke all on function public.clear_admin_login_failures(text) from public;
grant execute on function public.clear_admin_login_failures(text) to authenticated;

-- -------------------------------------------------------------------------
-- 5. user_activity_logs — add device fingerprint columns
-- -------------------------------------------------------------------------
-- Used by the Tier 2.6 login-notification path to distinguish "same device
-- as last time" from "new device, alert the admin".
alter table public.user_activity_logs
  add column if not exists device_fingerprint text;

create index if not exists user_activity_logs_user_login_idx
  on public.user_activity_logs (user_id, event_type, created_at desc);
