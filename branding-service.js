/**
 * THAIBA PUBLIC SCHOOL — Branding Service
 *
 * Persists the institute logo (and any future branding values) in the
 * `app_settings` table under the `branding` key, caches it in localStorage for
 * instant availability, and pushes it into the shared logo engine so that the
 * uploaded logo appears on every screen and every printed document.
 *
 * Loading this module already applies the cached logo synchronously; call
 * `refresh()` to re-read the latest value from the database.
 */

import { dbService } from './supabase-client.js';
import { TMS_LOGO } from './logo.js';

const CACHE_KEY = 'tms_branding';
const SETTINGS_ID = 'branding';
const BUCKET = 'avatars';

class BrandingService {
  constructor() {
    this.data = this.readCache();
    if (this.data && this.data.logoUrl) {
      TMS_LOGO.setCustomLogo(this.data.logoUrl);
    }
    this.updateFavicon();
    this._loaded = false;
  }

  updateFavicon() {
    try {
      const url = this.getLogoUrl();
      let icon = document.querySelector("link[rel*='icon']");
      if (!icon) {
        icon = document.createElement('link');
        icon.rel = 'icon';
        document.head.appendChild(icon);
      }
      if (url) {
        icon.href = url;
        const appleIcon = document.querySelector("link[rel='apple-touch-icon']");
        if (appleIcon) appleIcon.href = url;
      }
    } catch (e) { /* ignore */ }
  }

  readCache() {
    try {
      return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') || {};
    } catch (e) {
      return {};
    }
  }

  writeCache(value) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(value || {}));
    } catch (e) { /* storage unavailable */ }
  }

  getLogoUrl() {
    return (this.data && this.data.logoUrl) || null;
  }

  /** Re-read the branding record from the database (best effort). */
  async refresh() {
    try {
      const rows = await dbService.select('app_settings');
      const row = rows.find((r) => r.id === SETTINGS_ID);
      const value = (row && row.value) || {};
      this.data = { ...value };
      this.writeCache(this.data);
      TMS_LOGO.setCustomLogo(this.data.logoUrl || null);
      this.updateFavicon();
      this._loaded = true;
      window.dispatchEvent(new CustomEvent('tms_branding_changed', { detail: this.data }));
    } catch (e) {
      // Offline or table not created yet: keep the cached value.
    }
    return this.data;
  }

  async saveBranding(partial) {
    const next = { ...this.data, ...partial };
    const saved = await dbService.upsert('app_settings', { id: SETTINGS_ID, value: next });
    if (saved && saved._syncError) return { error: saved._syncError };
    this.data = next;
    this.writeCache(next);
    TMS_LOGO.setCustomLogo(next.logoUrl || null);
    this.updateFavicon();
    window.dispatchEvent(new CustomEvent('tms_branding_changed', { detail: next }));
    return { data: next };
  }

  sanitizeFileName(name) {
    return String(name || 'logo').replace(/[^A-Za-z0-9._-]/g, '_').slice(-60);
  }

  /** Upload a logo file and persist its public URL. */
  async uploadLogo(file) {
    const client = dbService.getClient();
    if (!client) return { error: 'Storage unavailable.' };
    if (!file) return { error: 'Choose an image file first.' };
    if (!/^image\//.test(file.type)) return { error: 'The logo must be an image file (PNG, JPG or SVG).' };

    const path = `branding/logo-${Date.now()}-${this.sanitizeFileName(file.name)}`;
    try {
      const { error } = await client.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true, cacheControl: '3600' });
      if (error) return { error: error.message };
      const publicUrl = client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      const res = await this.saveBranding({ logoUrl: publicUrl, logoUpdatedAt: new Date().toISOString() });
      if (res.error) return { error: res.error };
      return { logoUrl: publicUrl };
    } catch (e) {
      return { error: e.message };
    }
  }

  async removeLogo() {
    return this.saveBranding({ logoUrl: null });
  }

  /** Swap any `data-tms-logo` images already present in the DOM. */
  applyToDom() {
    const url = this.getLogoUrl();
    if (!url) return;
    document.querySelectorAll('img[data-tms-logo]').forEach((img) => { img.src = url; });
  }
}

export const brandingService = new BrandingService();
export default brandingService;
