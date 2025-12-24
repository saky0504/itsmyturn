
-- 1. Security Definer View Fix
-- The 'recent_comments' view is likely defined with SECURITY DEFINER, meaning it runs with the privileges of the creator (admin), bypassing RLS.
-- We must change it to SECURITY INVOKER (default behavior) so it checks the caller's permissions.
-- If 'recent_comments' is a VIEW:
ALTER VIEW recent_comments SET (security_invoker = true);

-- If it was a FUNCTION instead of a VIEW (users verify this):
-- ALTER FUNCTION get_recent_comments() SECURITY INVOKER;

-- 2. Function Search Path Fix
-- Functions without a set search_path can be hijacked by malicious schemas.
-- We should force them to use the 'public' schema (or a secure schema).
-- Repeat this for all custom functions. Example for common ones:
-- ALTER FUNCTION your_function_name() SET search_path = public, extensions;

-- Automated approach to fix potentially vulnerable functions (Safe to run if you check function names):
-- DO $$
-- BEGIN
--     FOR r IN (SELECT proname, oid FROM pg_proc WHERE pronamespace = 'public'::regnamespace) LOOP
--         EXECUTE 'ALTER FUNCTION ' || quote_ident(r.proname) || ' SET search_path = public, extensions;';
--     END LOOP;
-- END $$;

-- 3. Extension in Public Fix
-- Extensions like pg_trgm utilize operators that can be spoofed if they reside in 'public'.
-- Move them to a dedicated 'extensions' schema.
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- Move pg_trgm to extensions
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- Note: You may need to update your search_path to include 'extensions' if not already done.
-- ALTER DATABASE postgres SET search_path TO public, extensions;
