/**
 * THAIBA PUBLIC SCHOOL — UI Components & Theme Engine
 */

export class UIComponents {
  /**
   * Escape untrusted values before interpolating them into HTML templates.
   * Prevents stored/reflected XSS from user- or staff-supplied data.
   */
  static escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  static initTheme() {
    // Enforce Pro-Max Luxury Light Theme (Dark mode completely removed as requested)
    document.body.classList.remove('dark');
    localStorage.setItem('tms_theme', 'light');

    const savedColor = localStorage.getItem('tms_color_theme') || 'emerald';
    const activeColor = (savedColor === 'oled') ? 'emerald' : savedColor;

    document.documentElement.setAttribute('data-theme', activeColor);
    document.body.setAttribute('data-theme', activeColor);
    localStorage.setItem('tms_color_theme', activeColor);

    this.installGlobalInterceptors();
  }

  static installGlobalInterceptors() {
    if (typeof window === 'undefined' || window._tmsPopupsInstalled) return;
    window._tmsPopupsInstalled = true;

    // Intercept native browser alert with luxury UIComponents modal
    window.alert = (message) => {
      this.alert({
        title: 'Campus Notification',
        message: String(message || ''),
        buttonText: 'Got It',
        type: 'info',
        icon: 'info'
      });
    };
  }

  static setColorTheme(themeName) {
    const valid = ['emerald', 'sapphire', 'burgundy'];
    const chosen = valid.includes(themeName) ? themeName : 'emerald';
    
    document.body.classList.remove('dark');
    localStorage.setItem('tms_theme', 'light');
    document.documentElement.setAttribute('data-theme', chosen);
    document.body.setAttribute('data-theme', chosen);
    localStorage.setItem('tms_color_theme', chosen);

    const names = {
      emerald: 'Thaiba Emerald (Classic Institutional)',
      sapphire: 'Royal Sapphire (Academic Blue)',
      burgundy: 'Noble Burgundy (Regal Crimson)'
    };
    this.showToast(`Active Theme: ${names[chosen]} (Premium Light Edition)`, 'success');
  }

  static toggleTheme() {
    // Cycle between luxury light palettes
    const current = localStorage.getItem('tms_color_theme') || 'emerald';
    const next = current === 'emerald' ? 'sapphire' : (current === 'sapphire' ? 'burgundy' : 'emerald');
    this.setColorTheme(next);
  }

  static updateThemeButton() {
    // No-op for dark mode button
  }

  static refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      if (this._iconRaf) cancelAnimationFrame(this._iconRaf);
      this._iconRaf = requestAnimationFrame(() => {
        try { window.lucide.createIcons(); } catch (e) { /* ignore */ }
      });
    }
  }

  static showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    
    let icon = 'info';
    let color = '#3b82f6';
    if (type === 'success') { icon = 'check-circle'; color = '#10b981'; }
    if (type === 'warning') { icon = 'alert-triangle'; color = '#f59e0b'; }
    if (type === 'danger' || type === 'error') { icon = 'alert-octagon'; color = '#ef4444'; }

    toast.innerHTML = `
      <i data-lucide="${icon}" style="color: ${color}; width: 20px; height: 20px;"></i>
      <span style="font-weight: 500;">${this.escapeHtml(message)}</span>
    `;

    container.appendChild(toast);
    this.refreshIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  static openModal({ title, bodyHtml, footerHtml = '' }) {
    let overlay = document.getElementById('global-modal-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'global-modal-overlay';
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal-window">
          <div class="card-header" style="margin-bottom: 16px;">
            <h3 class="card-title" id="global-modal-title"></h3>
            <button class="icon-btn" id="global-modal-close"><i data-lucide="x"></i></button>
          </div>
          <div id="global-modal-body" style="margin-bottom: 20px;"></div>
          <div id="global-modal-footer" style="display: flex; justify-content: flex-end; gap: 10px;"></div>
        </div>
      `;
      document.body.appendChild(overlay);

      overlay.querySelector('#global-modal-close').addEventListener('click', () => {
        this.closeModal();
      });

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.closeModal();
      });
    }

    document.getElementById('global-modal-title').innerText = title;
    document.getElementById('global-modal-body').innerHTML = bodyHtml;
    
    const footerEl = document.getElementById('global-modal-footer');
    if (footerEl) {
      if (footerHtml && footerHtml.trim()) {
        footerEl.innerHTML = footerHtml;
        footerEl.style.display = 'flex';
      } else {
        footerEl.innerHTML = '';
        footerEl.style.display = 'none';
      }
    }

    overlay.classList.add('active');
    this.refreshIcons();
  }

  static closeModal() {
    const overlay = document.getElementById('global-modal-overlay');
    if (overlay) {
      overlay.classList.remove('active');
    }
  }

  static renderLoading(message = 'Loading verified records...') {
    return `
      <div class="tms-animated-loader" style="padding: 48px 20px; text-align: center;">
        <div class="tms-loader-emblem-wrap" style="position: relative; width: 72px; height: 72px; margin: 0 auto 16px;">
          <div class="tms-loader-aura"></div>
          <img src="./tps-logo.png" alt="Thaiba Public School" class="tms-loader-img" style="width: 58px; height: 58px; object-fit: contain; position: relative; z-index: 2;">
        </div>
        <div class="tms-loader-text" style="font-family: var(--font-display, 'Outfit', sans-serif); font-weight: 700; color: #BF9A33; font-size: 0.92rem; letter-spacing: 0.02em;">
          ${this.escapeHtml(message)}
        </div>
      </div>
    `;
  }

  static renderKpiCard({ title, value, icon, color = 'blue', subtitle = '' }) {
    return `
      <div class="kpi-card">
        <div class="kpi-icon kpi-${color}">
          <i data-lucide="${icon}"></i>
        </div>
        <div class="kpi-meta">
          <h3>${value}</h3>
          <p>${title}</p>
          ${subtitle ? `<span style="font-size: 0.72rem; color: var(--text-subtle);">${subtitle}</span>` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Premium Asynchronous Confirmation Modal.
   * Completely replaces native browser-side confirm(...) popups with a luxury UI dialog.
   * @param {Object} options
   * @param {string} options.title Modal title
   * @param {string} options.message Prompt / description
   * @param {string} [options.confirmText='Confirm'] Action button label
   * @param {string} [options.cancelText='Cancel'] Cancel button label
   * @param {string} [options.type='danger'] 'danger' | 'warning' | 'primary' | 'success'
   * @param {string} [options.icon='alert-triangle'] Lucide icon name
   * @returns {Promise<boolean>}
   */
  static confirm({
    title = 'Confirm Action',
    message = 'Are you sure you want to proceed?',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    type = 'danger',
    icon = 'alert-triangle'
  } = {}) {
    return new Promise((resolve) => {
      const existing = document.getElementById('tms-confirm-overlay');
      if (existing) existing.remove();

      const overlay = document.createElement('div');
      overlay.id = 'tms-confirm-overlay';
      overlay.className = 'tms-confirm-overlay';

      let iconColor = '#ef4444';
      let iconBg = 'rgba(239, 68, 68, 0.1)';
      let iconBorder = 'rgba(239, 68, 68, 0.2)';
      let confirmBtnClass = 'btn-danger';

      if (type === 'primary' || type === 'info' || type === 'success') {
        iconColor = '#16a34a';
        iconBg = 'rgba(22, 163, 74, 0.1)';
        iconBorder = 'rgba(22, 163, 74, 0.2)';
        confirmBtnClass = 'btn-primary';
      } else if (type === 'warning') {
        iconColor = '#f59e0b';
        iconBg = 'rgba(245, 158, 11, 0.1)';
        iconBorder = 'rgba(245, 158, 11, 0.2)';
        confirmBtnClass = 'btn-warning';
      }

      overlay.innerHTML = `
        <div class="tms-confirm-box">
          <div class="tms-confirm-icon-wrap" style="background: ${iconBg}; border: 1px solid ${iconBorder}; color: ${iconColor};">
            <i data-lucide="${icon}" style="width: 28px; height: 28px;"></i>
          </div>
          <h3 class="tms-confirm-title">${this.escapeHtml(title)}</h3>
          <p class="tms-confirm-message">${this.escapeHtml(message)}</p>
          <div class="tms-confirm-actions">
            <button type="button" class="btn btn-secondary" id="tms-confirm-cancel">${this.escapeHtml(cancelText)}</button>
            <button type="button" class="btn ${confirmBtnClass}" id="tms-confirm-ok">${this.escapeHtml(confirmText)}</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);
      this.refreshIcons();

      requestAnimationFrame(() => overlay.classList.add('active'));

      const cleanup = (result) => {
        overlay.classList.remove('active');
        window.removeEventListener('keydown', handleKey);
        setTimeout(() => overlay.remove(), 220);
        resolve(result);
      };

      const handleKey = (e) => {
        if (e.key === 'Escape') cleanup(false);
        if (e.key === 'Enter') cleanup(true);
      };

      window.addEventListener('keydown', handleKey);

      overlay.querySelector('#tms-confirm-cancel').addEventListener('click', () => cleanup(false));
      overlay.querySelector('#tms-confirm-ok').addEventListener('click', () => cleanup(true));
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) cleanup(false);
      });

      setTimeout(() => {
        overlay.querySelector('#tms-confirm-ok')?.focus();
      }, 50);
    });
  }

  /**
   * Premium Asynchronous Alert Modal.
   */
  static alert({
    title = 'Notification',
    message = '',
    buttonText = 'Understood',
    type = 'info',
    icon = 'info'
  } = {}) {
    return new Promise((resolve) => {
      const existing = document.getElementById('tms-confirm-overlay');
      if (existing) existing.remove();

      const overlay = document.createElement('div');
      overlay.id = 'tms-confirm-overlay';
      overlay.className = 'tms-confirm-overlay';

      let iconColor = '#16a34a';
      let iconBg = 'rgba(22, 163, 74, 0.1)';
      let iconBorder = 'rgba(22, 163, 74, 0.2)';

      if (type === 'danger' || type === 'error') {
        iconColor = '#ef4444';
        iconBg = 'rgba(239, 68, 68, 0.1)';
        iconBorder = 'rgba(239, 68, 68, 0.2)';
      } else if (type === 'warning') {
        iconColor = '#f59e0b';
        iconBg = 'rgba(245, 158, 11, 0.1)';
        iconBorder = 'rgba(245, 158, 11, 0.2)';
      }

      overlay.innerHTML = `
        <div class="tms-confirm-box">
          <div class="tms-confirm-icon-wrap" style="background: ${iconBg}; border: 1px solid ${iconBorder}; color: ${iconColor};">
            <i data-lucide="${icon}" style="width: 28px; height: 28px;"></i>
          </div>
          <h3 class="tms-confirm-title">${this.escapeHtml(title)}</h3>
          <p class="tms-confirm-message">${this.escapeHtml(message)}</p>
          <div class="tms-confirm-actions" style="justify-content: center;">
            <button type="button" class="btn btn-primary" id="tms-alert-ok" style="min-width: 140px;">${this.escapeHtml(buttonText)}</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);
      this.refreshIcons();

      requestAnimationFrame(() => overlay.classList.add('active'));

      const cleanup = () => {
        overlay.classList.remove('active');
        window.removeEventListener('keydown', handleKey);
        setTimeout(() => overlay.remove(), 220);
        resolve();
      };

      const handleKey = (e) => {
        if (e.key === 'Escape' || e.key === 'Enter') cleanup();
      };

      window.addEventListener('keydown', handleKey);
      overlay.querySelector('#tms-alert-ok').addEventListener('click', cleanup);
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) cleanup();
      });
    });
  }
}

export default UIComponents;
