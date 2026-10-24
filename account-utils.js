/**
 * THAIBA PUBLIC SCHOOL — Account provisioning helpers
 *
 * Creating a login used to go through the public `/auth/v1/signup` endpoint.
 * That endpoint is rate limited (HTTP 429) and only works when "Confirm email"
 * is disabled, so it failed intermittently for parents and staff.
 *
 * The preferred path is now the `tms_create_user` SQL function
 * (see schema-update-2.sql), which creates the account directly. These helpers
 * hide the version difference and turn Supabase's terse errors into something a
 * school administrator can actually act on.
 */

/** True when the error means the `tms_create_user` function is not deployed. */
export function isMissingFunction(error) {
  const code = (error && error.code) || '';
  const msg = (error && error.message) || '';
  return code === '42883' || code === 'PGRST202'
    || /could not find the function|function .* does not exist|schema cache/i.test(msg);
}

/** True when Supabase rejected the request because of a rate limit. */
export function isRateLimited(error) {
  const status = (error && error.status) || 0;
  const msg = (error && error.message) || '';
  return status === 429 || /rate limit|too many requests|for security purposes/i.test(msg);
}

/** Human-readable explanation of an account-creation failure. */
export function describeAccountError(error) {
  if (!error) return 'Unknown error.';
  const msg = error.message || String(error);

  if (isMissingFunction(error)) {
    return 'Account creation function is not installed. Run schema-update-2.sql in Supabase.';
  }
  if (isRateLimited(error)) {
    return 'Supabase is rate-limiting sign-ups (HTTP 429). Wait about an hour, or run '
      + 'schema-update-2.sql so logins are created directly without the sign-up endpoint.';
  }
  if (/already (registered|exists)|user already/i.test(msg)) {
    return 'An account with this e-mail address already exists.';
  }
  if (/signups? not allowed|signup.*disabled|signups are disabled/i.test(msg)) {
    return 'Sign-ups are disabled in Supabase. Enable them (Auth → Providers → Email), '
      + 'or run schema-update-2.sql so logins are created directly.';
  }
  if (/email.*(invalid|not valid)|invalid.*email/i.test(msg)) {
    return `Supabase rejected the e-mail address (${msg}).`;
  }
  if (/confirm/i.test(msg) && /email/i.test(msg)) {
    return 'The account needs e-mail confirmation. Turn OFF "Confirm email" in '
      + 'Supabase Auth → Providers → Email, or run schema-update-2.sql.';
  }
  return msg;
}

/**
 * Create an account via the `tms_create_user` SQL function.
 * @returns {Promise<{userId?: string|null, error?: string, unsupported?: boolean}>}
 */
export async function createUserViaRpc(client, payload) {
  if (!client || typeof client.rpc !== 'function') return { unsupported: true };
  try {
    const { data, error } = await client.rpc('tms_create_user', payload);
    if (!error) return { userId: data || null };
    if (isMissingFunction(error)) return { unsupported: true };
    return { error: describeAccountError(error) };
  } catch (e) {
    return { error: describeAccountError(e) };
  }
}

export default { isMissingFunction, isRateLimited, describeAccountError, createUserViaRpc };
