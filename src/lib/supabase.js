import { createClient } from '@supabase/supabase-js';

const STORAGE_KEY = 'mkekashare-state-v1';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export const isSupabaseReady = () => Boolean(supabase);

export function loadAppState(storageKey = STORAGE_KEY) {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

export function persistAppState(storageKey = STORAGE_KEY, state) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch (error) {
    // Ignore write errors in restricted environments.
  }
}

export function syncStateWithSupabase(state) {
  if (!supabase) return;

  supabase.from('profiles').upsert(state.profiles).then(() => undefined);
  supabase.from('posts').upsert(state.posts).then(() => undefined);
  supabase.from('comments').upsert(state.comments).then(() => undefined);
  supabase.from('reactions').upsert(state.reactions).then(() => undefined);
  supabase.from('follows').upsert(state.follows).then(() => undefined);
  supabase.from('messages').upsert(state.messages).then(() => undefined);
  supabase.from('vip_purchases').upsert(state.vipPurchases).then(() => undefined);
  supabase.from('verification_requests').upsert(state.verificationRequests).then(() => undefined);
}
