/**
 * THAIBA PUBLIC SCHOOL — Staff Account & Credential Service
 *
 * Every appointed staff member gets a real login (username + password):
 *   1. an authentication user is created for their official e-mail,
 *   2. their profile (role / scope / title / department) is filled in so the
 *      account also appears in Admin -> Users & Roles,
 *   3. the credentials are stored in the admin-only `staff_credentials` table
 *      and a public username -> e-mail alias is published for the sign-in page.
 */

import { TMS_CONFIG } from './config.js';
import { dbService } from './supabase-client.js';
import { createUserViaRpc, describeAccountError } from './account-utils.js';

/* Role category -> data scope used when provisioning the profile. */
const ROLE_SCOPE = {
  principal: 'school_wide',
  admin: 'school_wide',
  coordinator: 'school_wide',
  hr: 'school_wide',
  office_boy: 'school_wide',
  librarian: 'department_scope',
  finance: 'finance_scope',
  operations: 'operations_scope',
  teacher: 'assigned_class'
};

function ephemeralClient() {
  const cfg = TMS_CONFIG.supabase || {};
  if (!window.supabase || typeof window.supabase.createClient !== 'function') return null;
  return window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}

function randomDigits(len) {
  let out = '';
  for (let i = 0; i < len; i += 1) out += Math.floor(Math.random() * 10);
  return out;
}

function randomToken(len) {
  return Math.random().toString(36).replace(/[^a-z0-9]/g, '').slice(0, len).padEnd(len, '0');
}

class StaffService {
  static get ROLE_SCOPE() {
    return ROLE_SCOPE;
  }

  scopeForRole(role) {
    return ROLE_SCOPE[role] || 'school_wide';
  }

  /* ---------------- Credentials store ---------------- */

  async listCredentials() {
    return dbService.select('staff_credentials');
  }

  async getCredentials(staffId) {
    if (!staffId) return null;
    const rows = await this.listCredentials();
    return rows.find((r) => r.staffId === staffId) || null;
  }

  async getCredentialsByUser(userId) {
    if (!userId) return null;
    const rows = await this.listCredentials();
    return rows.find((r) => r.userId === userId) || null;
  }

  async usernameTaken(username) {
    const target = String(username || '').toLowerCase().trim();
    if (!target) return true;
    const aliases = await dbService.select('login_aliases');
    if (aliases.some((a) => String(a.username || '').toLowerCase() === target)) return true;
    const creds = await this.listCredentials();
    return creds.some((c) => String(c.username || '').toLowerCase() === target);
  }

  /* ---------------- Generators ---------------- */

  slugify(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9\s.]/g, '')
      .trim()
      .replace(/\s+/g, '.')
      .replace(/\.{2,}/g, '.')
      .replace(/^\.+|\.+$/g, '')
      .slice(0, 24);
  }

  async generateUsername(name, email) {
    let base = this.slugify(name);
    if (!base) base = this.slugify(String(email || '').split('@')[0]) || 'staff';
    base = base.replace(/\./g, '.');
    let candidate = base;
    let n = 1;
    // eslint-disable-next-line no-await-in-loop
    while (await this.usernameTaken(candidate)) {
      n += 1;
      candidate = `${base}${n}`;
    }
    return candidate;
  }

  generatePassword() {
    return `Tms@${randomToken(4)}${randomDigits(3)}`;
  }

  /* ---------------- Provisioning ---------------- */

  /**
   * Create the authentication account for a new staff member.
   *
   * Preferred: the `tms_create_user` SQL function, which also writes the profile
   * role/scope in the same transaction — no sign-up endpoint, no rate limit and
   * no e-mail confirmation. Falls back to `auth.signUp` when it is not deployed.
   */
  async createLogin({ email, password, name, role, title, department, assignedClass, assignedSection }) {
    const scope = this.scopeForRole(role);

    const viaRpc = await createUserViaRpc(dbService.getClient(), {
      p_email: email,
      p_password: password,
      p_name: name,
      p_role: role || 'pending',
      p_scope: scope,
      p_title: title || null,
      p_department: department || null,
      p_assigned_class: assignedClass || null,
      p_assigned_section: assignedSection || null
    });
    if (viaRpc.userId) return { userId: viaRpc.userId, profileDone: true };
    if (viaRpc.error) return { error: viaRpc.error };

    // Legacy fallback (function not deployed): sign up, then patch the profile.
    const client = ephemeralClient();
    if (!client) return { error: 'Authentication service unavailable.' };
    try {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } }
      });
      if (error) return { error: describeAccountError(error) };
      const userId = data && data.user ? data.user.id : null;
      if (!userId) {
        return {
          error: 'The account was created but needs e-mail confirmation. '
            + 'Turn OFF "Confirm email" in Supabase Auth, or run schema-update-2.sql.'
        };
      }
      return { userId };
    } catch (e) {
      return { error: describeAccountError(e) };
    }
  }

  async applyProfile(userId, { name, email, role, scope, title, department, assignedClass, assignedSection, isActive }) {
    if (!userId) return { error: 'Missing authentication user.' };
    const row = {
      id: userId,
      name: name || '',
      role: role || 'pending',
      scope: scope || this.scopeForRole(role),
      title: title || '',
      department: department || '',
      assignedClass: assignedClass || null,
      assignedSection: assignedSection || null,
      isActive: isActive === undefined ? true : !!isActive
    };
    if (email) row.email = email;

    // Upsert so the account also appears in Users & Roles even if the
    // automatic profile row was not created when the login was provisioned.
    const res = email
      ? await dbService.upsert('profiles', row)
      : await dbService.update('profiles', userId, row);
    return res && res._syncError ? { error: res._syncError } : { ok: true };
  }

  /* ---------------- Persistence ---------------- */

  async saveCredentials({ staffId, userId, username, email, password }) {
    const existing = await this.getCredentials(staffId);
    const id = existing ? existing.id : `cred-staff-${staffId}`;
    const row = {
      id,
      staffId,
      userId: userId || (existing ? existing.userId : null),
      username,
      email,
      password,
      status: 'Active'
    };
    const saved = existing
      ? await dbService.update('staff_credentials', id, row)
      : await dbService.insert('staff_credentials', row);
    if (saved && saved._syncError) return { error: saved._syncError, row: saved };
    return { row: saved };
  }

  async saveAlias({ username, email, role }) {
    const aliases = await dbService.select('login_aliases');
    const existing = aliases.find((a) => String(a.username || '').toLowerCase() === String(username || '').toLowerCase());
    const id = existing ? existing.id : `alias-${String(username || '').toLowerCase()}`;
    const row = { id, username, email, role: role || null };
    const saved = existing
      ? await dbService.update('login_aliases', id, row)
      : await dbService.insert('login_aliases', row);
    return saved;
  }

  async removeCredentials(staffId) {
    const cred = await this.getCredentials(staffId);
    if (cred) {
      await dbService.delete('staff_credentials', cred.id);
      await this.removeAlias(cred.username);
    }
    return true;
  }

  async removeAlias(username) {
    const target = String(username || '').toLowerCase();
    if (!target) return true;
    const aliases = await dbService.select('login_aliases');
    const alias = aliases.find((a) => String(a.username || '').toLowerCase() === target);
    if (alias) await dbService.delete('login_aliases', alias.id);
    return true;
  }

  /* ---------------- Deletion & password ---------------- */

  async deleteUserAccount(userId) {
    if (!userId) return { success: true, skipped: true };
    const client = dbService.getClient();
    if (!client) return { success: false, error: 'Service unavailable.' };
    try {
      const { error } = await client.rpc('admin_delete_user', { p_user_id: userId });
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async setPassword(userId, newPassword) {
    if (!userId) return { success: false, error: 'No linked login for this record.' };
    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters.' };
    }
    const client = dbService.getClient();
    if (!client) return { success: false, error: 'Service unavailable.' };
    try {
      const { error } = await client.rpc('admin_set_password', {
        p_user_id: userId,
        p_new_password: newPassword
      });
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Full provisioning used by "Appoint New Staff":
   * creates the login, fills the profile, stores credentials + public alias.
   */
  async provision({ staffId, name, email, role, title, department, assignedClass, assignedSection, username, password }) {
    const finalUsername = username || (await this.generateUsername(name, email));
    const finalPassword = password || this.generatePassword();

    const account = await this.createLogin({
      email,
      password: finalPassword,
      name,
      role,
      title,
      department,
      assignedClass,
      assignedSection
    });
    if (account.error) {
      return { error: account.error, username: finalUsername, password: finalPassword };
    }

    // The SQL function already wrote role/scope; only patch when we fell back
    // to the legacy sign-up path.
    let profile = { ok: true };
    if (!account.profileDone) {
      profile = await this.applyProfile(account.userId, {
        name, email, role, scope: this.scopeForRole(role), title, department, assignedClass, assignedSection
      });
    }

    await this.saveCredentials({
      staffId,
      userId: account.userId,
      username: finalUsername,
      email,
      password: finalPassword
    });
    await this.saveAlias({ username: finalUsername, email, role });

    return {
      userId: account.userId,
      username: finalUsername,
      password: finalPassword,
      profileError: profile.error || null
    };
  }

  /** Re-point stored credentials at a new username / password / e-mail. */
  async updateCredentials(row, { username, password, email, role }) {
    if (!row) return { error: 'No credentials on file.' };
    const newUsername = (username || row.username || '').trim();
    const newEmail = (email || row.email || '').trim();
    const newPassword = password || row.password;

    // Apply the real sign-in password first: if that fails there is nothing
    // half-saved (the row and its alias stay exactly as they were).
    if (password && row.userId) {
      const pw = await this.setPassword(row.userId, password);
      if (!pw.success) return { error: `Could not update the sign-in password: ${pw.error}` };
    }

    const updates = { username: newUsername, email: newEmail, password: newPassword };
    const saved = await dbService.update('staff_credentials', row.id, updates);
    if (saved && saved._syncError) return { error: saved._syncError };

    if (newUsername.toLowerCase() !== String(row.username || '').toLowerCase()) {
      await this.removeAlias(row.username);
    }
    await this.saveAlias({ username: newUsername, email: newEmail, role });

    return { ok: true, username: newUsername, email: newEmail, password: newPassword };
  }
}

export const staffService = new StaffService();
export default staffService;
