import "server-only"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

let adminClient: SupabaseClient | null = null
let didWarnMissingServiceRoleKey = false

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    if (!didWarnMissingServiceRoleKey) {
      console.warn("Supabase service role key is not configured; admin-only cache RPCs are disabled.")
      didWarnMissingServiceRoleKey = true
    }

    return null
  }

  adminClient ??= createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return adminClient
}
