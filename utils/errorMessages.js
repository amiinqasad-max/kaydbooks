/**
 * errorMessages.js -- Phase 2 (#19: replace generic technical errors with
 * human-readable UX).
 *
 * Turns a raw Supabase/PostgREST/network error into a short, human
 * sentence a non-technical user can act on. The original error is never
 * discarded -- callers should still console.error/log it -- this only
 * changes what reaches the screen.
 *
 * Deliberately small and conservative: it maps the specific error shapes
 * that actually occur in this app (seen throughout services/supabase.js
 * and the screens that call it) rather than attempting a universal
 * translator for every possible Postgres/network failure.
 */

const KNOWN_CODES = {
  PGRST116: 'No matching record was found.', // Supabase "no rows" for .single()
  '23505': 'That already exists.', // unique_violation
  '23503': 'That item is linked to something else and can’t be changed right now.', // foreign_key_violation
  '42501': 'You don’t have permission to do that.', // insufficient_privilege (RLS/GRANT denial)
  PGRST301: 'Your session has expired. Please sign in again.',
};

export const toUserMessage = (error, fallback = 'Something went wrong. Please try again.') => {
  if (!error) return fallback;

  const code = error.code || error?.error?.code;
  if (code && KNOWN_CODES[code]) return KNOWN_CODES[code];

  const raw = (error.message || String(error)).toLowerCase();

  if (raw.includes('network request failed') || raw.includes('fetch')) {
    return 'No internet connection. Please check your network and try again.';
  }
  if (raw.includes('jwt') || raw.includes('not authenticated') || raw.includes('invalid token')) {
    return 'Your session has expired. Please sign in again.';
  }
  if (raw.includes('row-level security') || raw.includes('permission denied')) {
    return 'You don’t have permission to do that.';
  }
  if (raw.includes('timeout')) {
    return 'That took too long. Please try again.';
  }

  return fallback;
};

export default toUserMessage;
