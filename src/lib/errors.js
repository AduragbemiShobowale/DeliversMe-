// Turn Supabase / PostgREST / Auth errors into messages that are safe and useful to show users.
const FRIENDLY = {
  'Invalid login credentials': 'Email or password is incorrect.',
  'Email not confirmed': 'Confirm your email first. Check your inbox for the 6-digit code.',
  'User already registered': 'An account with this email already exists. Log in instead.',
  'Token has expired or is invalid': 'That code is wrong or has expired. Request a new one.',
};

export function errorMessage(error, fallback = 'Something went wrong. Try again.') {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  const msg = error.message || error.error_description || '';
  if (FRIENDLY[msg]) return FRIENDLY[msg];
  if (error.code === '42501' && /permission denied/i.test(msg)) return 'You do not have permission to do that.';
  if (error.code === '23505') return 'That record already exists.';
  if (error.code === '23514') return 'Some details are not in the expected format.';
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'Could not reach the server. Check your connection.';
  // Messages raised by our own RPCs are written for end users.
  if (['P0001', 'P0002', '22023', '42501', '28000'].includes(error.code) && msg) return msg;
  if (msg && msg.length < 160 && !/sql|relation|column|syntax|violates/i.test(msg)) return msg;
  return fallback;
}

export function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}
