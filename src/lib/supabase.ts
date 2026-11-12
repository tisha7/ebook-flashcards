import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from '../config';

export const supabase = supabaseConfig.isConfigured
  ? createClient(supabaseConfig.url, supabaseConfig.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;
