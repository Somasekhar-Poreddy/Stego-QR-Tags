// NEVER import this file in the frontend.
// This module creates a Supabase client with the service role key which bypasses
// Row Level Security. It is intended exclusively for server-side Express routes.
//
// The service role key is read from SUPABASE_SERVICE_ROLE_KEY (set in Replit Secrets).
// SUPABASE_URL falls back to VITE_SUPABASE_URL so both names work in the same env.

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "[supabaseAdmin] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
    "Backend DB queries will fail.",
  );
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
