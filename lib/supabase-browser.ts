// Lightweight Supabase client for browser-only Realtime subscriptions
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Export a singleton client only in the browser
export const supabaseBrowser =
  typeof window !== "undefined" && url && anon
    ? createClient(url, anon)
    : null;

