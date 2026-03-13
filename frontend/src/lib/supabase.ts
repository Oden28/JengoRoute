/**
 * lib/supabase.ts - Supabase client initialization.
 *
 * Creates a browser-safe Supabase client using the public anon key.
 * Used for real-time subscriptions and direct queries from the frontend.
 * For dashboard data, we primarily use the FastAPI REST API via SWR.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase environment variables not set. Real-time features will not work.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

