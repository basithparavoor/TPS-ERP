/**
 * THAIBA PUBLIC SCHOOL — Notification Center (Enhanced UI)
 * Dynamic interactive notification drawer/modal with filter tabs,
 * unread badges, instant mark-all-read, and quick campus broadcasts.
 */

import { notificationService } from './notification-service.js';
import { UIComponents } from './ui-components.js';
import { authService } from './auth-service.js';

const esc = (v) => UIComponents.escapeHtml(v);

function timeAgo(dateString) {
  if (!dateString) return 'Just now';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return 'Recently';
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export class NotificationCenter {
  static _pollTimer = null;
  static _activeFilter = 'all';

  /**
   * Wire the bell button (#notification-bell) and unread badge (#notification-badge).
   */
  static async init() {
    const bell = document.getElementById('notification-bell');
    if (!bell) return;

    // Prevent duplicate listeners
    if (bell._notifBound) return;
    bell._notifBound = true;

    bell.addEventListener('click', () => this.openInbox());
    await this.refreshBadge();

    // Background refresh every 30 seconds
    if (!this._pollTimer) {
      this._pollTimer = setInterval(() => this.refreshBadge(), 30000);
    }
  }

  static async refreshBadge() {
    const badge = document.getElementById('notification-badge');
    const bell = document.getElementById('notification-bell');
    if (!badge) return;

    try {
      const count = await notificationService.unreadCount();
      if (count > 0) {
        badge.style.display = 'inline-flex';
        badge.innerText = count > 99 ? '99+' : String(count);
        if (bell) bell.classList.add('has-unread');
      } else {
        badge.style.display = 'none';
        if (bell) bell.classList.remove('has-unread');
      }
    } catch (e) {
      badge.style.display = 'none';
    }
  }

  static async openInbox() {
    let items = [];
    try {
      items = await notificationService.listForUser();
    } catch (e) {
      console.error('Notification load failed:', e);
    }

    const unreadCount = items.filter((n) => !n.isRead).length;
    const currentUser = authService.getCurrentUser() || {};
    const canBroadcast = ['admin', 'principal', 'coordinator'].includes(currentUser.role) || currentUser.isSuperAdmin;

    const renderList = (filter = 'all') => {
      let filtered = items;
      if (filter === 'unread') {
        filtered = items.filter((n) => !n.isRead);
      } else if (filter === 'urgent') {
        filtered = items.filter((n) => n.priority === 'Urgent' || n.priority === 'High');
      }

      if (!filtered.length) {
        return `
          <div style="text-align:center; padding: 40px 20px; color: var(--text-muted);">
            <div style="width: 56px; height: 56px; border-radius: 50%; background: rgba(22, 163, 74, 0.08); display: flex; align-items: center; justify-content: center; margin: 0 auto 12px auto; color: #16a34a;">
              <i data-lucide="bell-off" style="width: 28px; height: 28px;"></i>
            </div>
            <strong style="font-size: 1rem; color: var(--text-main); display: block; margin-bottom: 4px;">All Caught Up!</strong>
            <p style="font-size: 0.85rem; margin: 0;">No ${filter !== 'all' ? filter : ''} notifications at this moment.</p>
          </div>
        `;
      }

      return filtered.map((n) => {
        const isUrgent = n.priority === 'Urgent';
        const isHigh = n.priority === 'High';
        const borderCol = n.isRead ? 'var(--border-color)' : (isUrgent ? '#ef4444' : (isHigh ? '#f59e0b' : '#16a34a'));
        const bgTint = n.isRead ? 'var(--bg-card)' : (isUrgent ? 'rgba(239, 68, 68, 0.04)' : 'rgba(22, 163, 74, 0.04)');
        const iconName = isUrgent ? 'alert-triangle' : (isHigh ? 'bell-ring' : 'info');
        const iconColor = isUrgent ? '#ef4444' : (isHigh ? '#f59e0b' : '#16a34a');

        return `
          <div class="tms-notif-card ${n.isRead ? 'is-read' : 'is-unread'}" data-id="${esc(n.id)}" 
               style="padding: 14px; border: 1px solid var(--border-color); border-left: 4px solid ${borderCol}; border-radius: 10px; background: ${bgTint}; transition: all 0.2s ease; position: relative;">
            <div style="display: flex; gap: 12px; align-items: flex-start;">
              <div style="width: 34px; height: 34px; border-radius: 8px; background: rgba(0,0,0,0.03); display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: ${iconColor};">
                <i data-lucide="${iconName}" style="width: 18px; height: 18px;"></i>
              </div>
              <div style="flex: 1; min-width: 0;">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 4px;">
                  <strong style="font-size: 0.92rem; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${esc(n.title)}</strong>
                  <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                    <span class="badge ${isUrgent ? 'badge-danger' : (isHigh ? 'badge-warning' : 'badge-info')}" style="font-size: 0.65rem; padding: 1px 6px;">
                      ${esc(n.priority || 'Normal')}
                    </span>
                    ${!n.isRead ? `<span style="width: 8px; height: 8px; border-radius: 50%; background: #16a34a;" title="Unread"></span>` : ''}
                  </div>
                </div>
                <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0 0 8px 0; line-height: 1.45; word-break: break-word;">${esc(n.message)}</p>
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.73rem; color: var(--text-subtle);">
                  <span>${timeAgo(n.createdAt)} • ${esc(n.createdByName || 'Administration')}</span>
                  ${!n.isRead ? `
                    <button class="btn-mark-single-read" data-id="${esc(n.id)}" style="background: none; border: none; color: #16a34a; font-size: 0.75rem; font-weight: 600; cursor: pointer; padding: 2px 6px; border-radius: 4px;">
                      Mark read
                    </button>
                  ` : ''}
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');
    };

    const bodyHtml = `
      <div class="tms-notif-inbox-wrapper">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
          <div style="display: flex; gap: 6px; align-items: center;" id="notif-filter-tabs">
            <button class="btn btn-sm ${this._activeFilter === 'all' ? 'btn-primary' : 'btn-secondary'} notif-filter-btn" data-filter="all">
              All (${items.length})
            </button>
            <button class="btn btn-sm ${this._activeFilter === 'unread' ? 'btn-primary' : 'btn-secondary'} notif-filter-btn" data-filter="unread">
              Unread (${unreadCount})
            </button>
            <button class="btn btn-sm ${this._activeFilter === 'urgent' ? 'btn-primary' : 'btn-secondary'} notif-filter-btn" data-filter="urgent">
              Urgent
            </button>
          </div>
          <div style="display: flex; gap: 8px;">
            ${canBroadcast ? `
              <button class="btn btn-secondary btn-sm" id="btn-broadcast-notice" title="Send a new announcement">
                <i data-lucide="send"></i> Post Notice
              </button>
            ` : ''}
            ${unreadCount > 0 ? `
              <button class="btn btn-secondary btn-sm" id="notif-mark-all">
                <i data-lucide="check-check"></i> Mark all read
              </button>
            ` : ''}
          </div>
        </div>

        <div id="notif-items-container" style="max-height: 440px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; padding-right: 4px;">
          ${renderList(this._activeFilter)}
        </div>
      </div>
    `;

    UIComponents.openModal({
      title: 'School Notifications & Bulletins',
      bodyHtml,
      footerHtml: `
        <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
          <span style="font-size: 0.8rem; color: var(--text-muted);">${items.length} total • ${unreadCount} unread</span>
          <button class="btn btn-secondary" id="notif-inbox-close">Close</button>
        </div>
      `
    });

    const closeBtn = document.getElementById('notif-inbox-close');
    if (closeBtn) closeBtn.addEventListener('click', () => UIComponents.closeModal());

    const filterBtns = document.querySelectorAll('.notif-filter-btn');
    filterBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        filterBtns.forEach((b) => { b.classList.remove('btn-primary'); b.classList.add('btn-secondary'); });
        btn.classList.add('btn-primary');
        btn.classList.remove('btn-secondary');
        this._activeFilter = btn.dataset.filter;
        const container = document.getElementById('notif-items-container');
        if (container) {
          container.innerHTML = renderList(this._activeFilter);
          UIComponents.refreshIcons();
          this.bindCardActions(items);
        }
      });
    });

    const markAllBtn = document.getElementById('notif-mark-all');
    if (markAllBtn) {
      markAllBtn.addEventListener('click', async () => {
        const unreadIds = items.filter((n) => !n.isRead).map((n) => n.id);
        if (unreadIds.length) {
          await notificationService.markAllRead(unreadIds);
          UIComponents.showToast('All notifications marked as read.', 'success');
          await this.refreshBadge();
          this.openInbox(); // Re-render with updated state
        }
      });
    }

    const broadcastBtn = document.getElementById('btn-broadcast-notice');
    if (broadcastBtn) {
      broadcastBtn.addEventListener('click', () => {
        UIComponents.closeModal();
        this.openCreateNotificationModal();
      });
    }

    this.bindCardActions(items);
    UIComponents.refreshIcons();
  }

  static bindCardActions(items) {
    document.querySelectorAll('.btn-mark-single-read').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (id) {
          await notificationService.markRead(id);
          const item = items.find((n) => n.id === id);
          if (item) item.isRead = true;
          await this.refreshBadge();
          const card = document.querySelector(`.tms-notif-card[data-id="${id}"]`);
          if (card) {
            card.classList.remove('is-unread');
            card.classList.add('is-read');
            card.style.borderLeftColor = 'var(--border-color)';
            card.style.background = 'var(--bg-card)';
            btn.remove();
          }
        }
      });
    });

    document.querySelectorAll('.tms-notif-card').forEach((card) => {
      card.addEventListener('click', async () => {
        const id = card.dataset.id;
        const item = items.find((n) => n.id === id);
        if (item && !item.isRead) {
          await notificationService.markRead(id);
          item.isRead = true;
          await this.refreshBadge();
          card.classList.remove('is-unread');
          card.classList.add('is-read');
          card.style.borderLeftColor = 'var(--border-color)';
          card.style.background = 'var(--bg-card)';
          const btn = card.querySelector('.btn-mark-single-read');
          if (btn) btn.remove();
        }
      });
    });
  }

  static openCreateNotificationModal() {
    const esc = (v) => UIComponents.escapeHtml(v);
    const bodyHtml = `
      <form id="create-notification-form" style="display:flex; flex-direction:column; gap:14px;">
        <div class="form-group">
          <label class="form-label" for="notif-title">Title / Headline *</label>
          <input type="text" id="notif-title" class="form-input" placeholder="e.g. Annual Sports Day Schedule Announced" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="notif-message">Message Details *</label>
          <textarea id="notif-message" class="form-input" rows="4" placeholder="Enter notification message to broadcast..." required></textarea>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label" for="notif-priority">Priority</label>
            <select id="notif-priority" class="form-select">
              <option value="Normal">Normal</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent Alert</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="notif-audience">Audience</label>
            <select id="notif-audience" class="form-select">
              <option value="all">All Campus (Staff, Students, Parents)</option>
              <option value="staff">Staff Only</option>
              <option value="students">Students Only</option>
              <option value="parents">Parents Only</option>
            </select>
          </div>
        </div>
      </form>
    `;

    UIComponents.openModal({
      title: 'Broadcast Campus Announcement',
      bodyHtml,
      footerHtml: `
        <button class="btn btn-secondary" id="btn-cancel-notif">Cancel</button>
        <button class="btn btn-primary" id="btn-submit-notif"><i data-lucide="send"></i> Broadcast Now</button>
      `
    });

    const cancelBtn = document.getElementById('btn-cancel-notif');
    if (cancelBtn) cancelBtn.addEventListener('click', () => UIComponents.closeModal());

    const submitBtn = document.getElementById('btn-submit-notif');
    if (submitBtn) {
      submitBtn.addEventListener('click', async () => {
        const title = document.getElementById('notif-title')?.value?.trim();
        const message = document.getElementById('notif-message')?.value?.trim();
        const priority = document.getElementById('notif-priority')?.value || 'Normal';
        const audience = document.getElementById('notif-audience')?.value || 'all';

        if (!title || !message) {
          UIComponents.showToast('Please provide both title and message.', 'error');
          return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Broadcasting...';

        try {
          await notificationService.create({
            title,
            message,
            priority,
            audience
          });
          UIComponents.showToast('Notification broadcast successfully!', 'success');
          UIComponents.closeModal();
          await this.refreshBadge();
          this.openInbox();
        } catch (err) {
          console.error('Failed to create notification:', err);
          UIComponents.showToast('Failed to broadcast: ' + err.message, 'error');
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i data-lucide="send"></i> Broadcast Now';
        }
      });
    }

    UIComponents.refreshIcons();
  }
}

export default NotificationCenter;
