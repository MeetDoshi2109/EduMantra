const { createClient } = require('@supabase/supabase-js');
const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = require('./env');

// Warn instead of crashing — lets Vercel serve a meaningful error
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('[EduMantra] MISSING ENV: SUPABASE_URL and/or SUPABASE_ANON_KEY not set.');
  console.error('[EduMantra] Add these in Vercel → Project Settings → Environment Variables');
}

// Use placeholder URLs when vars missing so the module loads without crashing.
// All DB calls will fail with a clear error rather than a cold 500.
const url  = SUPABASE_URL  || 'https://placeholder.supabase.co';
const anon = SUPABASE_ANON_KEY || 'placeholder-anon-key';
const svc  = SUPABASE_SERVICE_ROLE_KEY || anon;

const supabase      = createClient(url, anon, { auth: { persistSession: false } });
const supabaseAdmin = createClient(url, svc,  { auth: { persistSession: false } });

module.exports = { supabase, supabaseAdmin };
