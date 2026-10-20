import { createClient } from '@supabase/supabase-js';
import type { Env } from '../types';

export const createAdminClient = (env: Env) => createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
export const createPublicClient = (env: Env) => createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
