/**
 * THAIBA PUBLIC SCHOOL — Authentication & Identity Service
 * Strict Production Mode:
 *   - Authenticates exclusively against Supabase Auth.
 *   - Authorisation (role/scope) is read ONLY from the server-side `profiles` table.
 *   - Never trusts localStorage, user_metadata, or client-supplied roles.
 */

import { TMS_CONFIG } from './config.js';
import { dbService } from './supabase-client.js';

class AuthService {
  constructor() {
    this.sessionKey = 'tms_auth_session';
    this.currentUser = null;
    // Cache is for UI hydration only; it is always re-validated against the server.
    this.cachedUser = this.readCache();
  }

  readCache() {
    try {
      const raw = localStorage.getItem(this.sessionKey);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Validate the current Supabase session and load the authoritative profile.
   * Must be awaited before any authentication decision is made.
   */
  async init() {
    const client = dbService.getClient();
    if (!client) {
      this.currentUser = null;
      this.clearCache();
      return null;
    }

    try {
      const { data: { session } } = await client.auth.getSession();
      if (!session || !session.user) {
        this.currentUser = null;
        this.clearCache();
        return null;
      }

      const profile = await this.loadProfile(session.user);
      if (!profile) {
        // Authenticated but no profile / inactive: deny access.
        await client.auth.signOut();
        this.currentUser = null;
        this.clearCache();
        return null;
      }

      this.currentUser = profile;
      this.saveCache(profile);
      return profile;
    } catch (e) {
      console.error('TMS session validation failed:', e);
      this.currentUser = null;
      this.clearCache();
      return null;
    }
  }

  async loadProfile(authUser) {
    const client = dbService.getClient();
    if (!client || !authUser) return null;

    const email = (authUser.email || '').toLowerCase().trim();

    // 1. Try finding profile by auth ID
    let { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    // 2. If not found by ID, look up by email (e.g. initial Google login or migrated account)
    if (!data && email) {
      const { data: profileByEmail } = await client
        .from('profiles')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (profileByEmail) {
        data = profileByEmail;
        // Link the auth ID to the profile
        try {
          await client.from('profiles').update({ id: authUser.id }).eq('email', email);
          data.id = authUser.id;
        } catch (e) {
          // If id update restricted, retain current data
        }
      }
    }

    // 3. Auto-provision Super Admin if cmbasith786@gmail.com logs in
    if (!data && email && email === (TMS_CONFIG.superAdminEmail || '').toLowerCase().trim()) {
      const superAdminProfile = {
        id: authUser.id,
        email: email,
        name: authUser.user_metadata?.full_name || 'Executive Director',
        role: TMS_CONFIG.roles.SUPER_ADMIN,
        title: 'Executive Director & Super Admin',
        scope: TMS_CONFIG.scopes.SCHOOL_WIDE,
        department: 'Executive Governance',
        phone: '+91 97480 00000',
        is_active: true,
        is_super_admin: true
      };
      try {
        await client.from('profiles').upsert(superAdminProfile);
        data = superAdminProfile;
      } catch (e) {
        console.warn('Super Admin auto-provision error:', e);
      }
    }

    if (!data || data.is_active === false) {
      console.warn('TMS profile lookup failed for user:', authUser.id, email);
      return null;
    }

    return this.normalizeProfile(data);
  }

  normalizeProfile(profile) {
    if (!profile || !profile.role) return null;

    const email = (profile.email || '').toLowerCase().trim();
    const isSuperAdmin =
      email === (TMS_CONFIG.superAdminEmail || '').toLowerCase().trim() ||
      profile.role === TMS_CONFIG.roles.SUPER_ADMIN ||
      profile.role === 'super_admin' ||
      profile.is_super_admin === true ||
      profile.isSuperAdmin === true;

    return {
      id: profile.id,
      email: email,
      name: profile.name || (email ? email.split('@')[0] : 'TMS User'),
      role: isSuperAdmin ? TMS_CONFIG.roles.SUPER_ADMIN : profile.role,
      isSuperAdmin,
      title: isSuperAdmin ? (profile.title || 'Executive Director & Super Admin') : (profile.title || 'Staff Member'),
      scope: isSuperAdmin ? TMS_CONFIG.scopes.SCHOOL_WIDE : (profile.scope || TMS_CONFIG.scopes.OWN_RECORDS),
      department: profile.department || '—',
      assignedClass: profile.assigned_class || null,
      assignedSection: profile.assigned_section || null,
      phone: profile.phone || '',
      rawTitle: profile.title || '',
      rawDepartment: profile.department || '',
      avatar: profile.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'
    };
  }

  isAuthenticated() {
    return !!this.currentUser && !!this.currentUser.id && !!this.currentUser.role;
  }

  getCurrentUser() {
    return this.currentUser;
  }

  async login(email, password) {
    const client = dbService.getClient();
    if (!client) {
      return { success: false, error: 'Authentication service is unavailable. Please retry.' };
    }

    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPass = String(password || '');

    if (!cleanEmail || !cleanPass) {
      return { success: false, error: 'Email and password are required.' };
    }

    try {
      const { data, error } = await client.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPass
      });

      if (error || !data || !data.user) {
        return { success: false, error: 'Invalid email or password.' };
      }

      const profile = await this.loadProfile(data.user);
      if (!profile) {
        await client.auth.signOut();
        return {
          success: false,
          error: 'Your account has no assigned role yet. Please contact school administration.'
        };
      }

      this.currentUser = profile;
      this.saveCache(profile);

      // Create tracking session in user_sessions
      const sessionId = 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
      const sessionRecord = {
        id: sessionId,
        userId: profile.id,
        userEmail: profile.email,
        userName: profile.name,
        userRole: profile.role,
        loginAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        logoutAt: null,
        status: 'active',
        clientAgent: navigator.userAgent
      };
      try {
        localStorage.setItem('tms_current_session_id', sessionId);
        dbService.insert('user_sessions', sessionRecord).catch(() => {});
      } catch (e) { /* ignore */ }

      // Dynamic import to prevent circular dependency
      import('./audit-service.js').then(({ auditService }) => {
        auditService.log('USER_LOGIN', 'AUTH', {
          email: profile.email,
          name: profile.name,
          role: profile.role,
          isSuperAdmin: profile.isSuperAdmin,
          sessionId,
          device: navigator.userAgent
        }, profile.id).catch(() => {});
      }).catch(() => {});

      return { success: true, user: profile };
    } catch (err) {
      return { success: false, error: 'Sign-in failed. Please try again.' };
    }
  }

  /**
   * Google OAuth Authentication
   */
  async loginWithGoogle() {
    const client = dbService.getClient();
    if (!client) {
      return { success: false, error: 'Authentication service is unavailable. Please retry.' };
    }

    try {
      const redirectUrl = window.location.href.split('#')[0].split('?')[0];
      const { data, error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account'
          }
        }
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message || 'Google sign-in initiation failed.' };
    }
  }

  async requestPasswordReset(email) {
    const client = dbService.getClient();
    if (!client) return { success: false, error: 'Service unavailable.' };
    try {
      const redirectUrl = window.location.origin + window.location.pathname;
      const { error } = await client.auth.resetPasswordForEmail(
        String(email || '').trim().toLowerCase(),
        { redirectTo: redirectUrl }
      );
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message || 'Unable to send reset email.' };
    }
  }

  async updateOwnProfile(fields) {
    const client = dbService.getClient();
    if (!client) return { success: false, error: 'Service unavailable.' };
    try {
      const { error } = await client.rpc('update_own_profile', {
        p_name: fields.name || null,
        p_title: fields.title || null,
        p_department: fields.department || null,
        p_phone: fields.phone || null,
        p_avatar: fields.avatar || null
      });
      if (error && this.currentUser?.id) {
        // Fallback direct table update if RPC failed
        await client
          .from('profiles')
          .update({
            name: fields.name || undefined,
            title: fields.title || undefined,
            department: fields.department || undefined,
            phone: fields.phone || undefined,
            avatar: fields.avatar || undefined
          })
          .eq('id', this.currentUser.id);
      }

      if (this.currentUser) {
        if (fields.name) this.currentUser.name = fields.name;
        if (fields.title) this.currentUser.title = fields.title;
        if (fields.department) this.currentUser.department = fields.department;
        if (fields.phone) this.currentUser.phone = fields.phone;
        if (fields.avatar) this.currentUser.avatar = fields.avatar;
        this.saveCache(this.currentUser);
      }

      await this.init();
      return { success: true, user: this.currentUser };
    } catch (e) {
      if (this.currentUser) {
        if (fields.avatar) this.currentUser.avatar = fields.avatar;
        this.saveCache(this.currentUser);
        return { success: true, user: this.currentUser };
      }
      return { success: false, error: e.message };
    }
  }

  async changePassword(newPassword) {
    const client = dbService.getClient();
    if (!client) return { success: false, error: 'Service unavailable.' };
    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters.' };
    }
    try {
      const { error } = await client.auth.updateUser({ password: newPassword });
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async adminSetPassword(userId, newPassword) {
    const client = dbService.getClient();
    if (!client) return { success: false, error: 'Service unavailable.' };
    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters.' };
    }
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

  /** Permanently remove a user's login and profile (admin only). */
  async adminDeleteUser(userId) {
    const client = dbService.getClient();
    if (!client) return { success: false, error: 'Service unavailable.' };
    if (!userId) return { success: false, error: 'No user selected.' };
    if (this.currentUser && this.currentUser.id === userId) {
      return { success: false, error: 'You cannot delete your own account.' };
    }
    try {
      const { error } = await client.rpc('admin_delete_user', { p_user_id: userId });
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  saveCache(profile) {
    try {
      localStorage.setItem(this.sessionKey, JSON.stringify(profile));
    } catch (e) {
      /* ignore quota errors */
    }
    window.dispatchEvent(new CustomEvent('tms_auth_changed', { detail: profile }));
  }

  clearCache() {
    localStorage.removeItem(this.sessionKey);
  }

  async touchSession() {
    const now = Date.now();
    if (this._lastTouch && (now - this._lastTouch < 180000)) return;
    this._lastTouch = now;
    const sid = localStorage.getItem('tms_current_session_id');
    if (sid && this.currentUser) {
      try {
        await dbService.update('user_sessions', sid, {
          lastActiveAt: new Date().toISOString()
        });
      } catch (e) { /* ignore */ }
    }
  }

  async logout() {
    const currentSessionId = localStorage.getItem('tms_current_session_id');
    if (currentSessionId) {
      try {
        await dbService.update('user_sessions', currentSessionId, {
          logoutAt: new Date().toISOString(),
          status: 'logged_out'
        });
      } catch (e) { /* ignore */ }
      localStorage.removeItem('tms_current_session_id');
    }

    if (this.currentUser) {
      const userToLog = { ...this.currentUser };
      import('./audit-service.js').then(({ auditService }) => {
        auditService.log('USER_LOGOUT', 'AUTH', {
          email: userToLog.email,
          name: userToLog.name,
          role: userToLog.role,
          logoutTime: new Date().toISOString()
        }, userToLog.id).catch(() => {});
      }).catch(() => {});
    }

    const client = dbService.getClient();
    if (client) {
      try {
        await client.auth.signOut();
      } catch (e) {
        /* ignore */
      }
    }
    this.currentUser = null;
    this.clearCache();
    window.location.href = 'login.html';
  }
}

export const authService = new AuthService();
export default authService;
