import { createClient } from '@supabase/supabase-js';

const configuredUrl = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Some customer networks cannot establish a direct connection to the
// Supabase domain. On Vercel, keep the browser on the site's own origin and
// let the rewrite in vercel.json proxy Supabase requests at the edge.
const isVercelDeployment =
  typeof window !== 'undefined' && window.location.hostname.endsWith('.vercel.app');
const url = isVercelDeployment ? `${window.location.origin}/supabase` : configuredUrl;

export const supabase = url && anonKey ? createClient(url, anonKey) : null;
