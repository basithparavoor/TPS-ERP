/**
 * THAIBA PUBLIC SCHOOL — Communication, Circulars & Broadcast Module
 *
 * Circulars can be published, edited, deleted and selected in bulk. Publishing
 * or resending a circular also raises an in-app notification for the target
 * audience so it reaches every portal.
 */

import { TMS_CONFIG } from './config.js';
import { dbService } from './supabase-client.js';
import { UIComponents } from './ui-components.js';
import { auditService } from './audit-service.js';
import { authService } from './auth-service.js';
import { notificationService } from './notification-service.js';

const MANAGER_ROLES = ['admin', 'principal', 'coordinator', 'super_admin'];

const CATEGORIES = ['Academic', 'Event', 'Holiday', 'Emergency Closure', 'Examination', 'Fee Notice'];
const TARGETS = ['All School', 'Parents', 'Faculty & Staff', 'High School Students'];
const PRIORITIES = ['Normal', 'High', 'Urgent'];

function audienceForTarget(target) {
  if (target === 'Parents') return 'parents';
  if (target === 'Faculty & Staff') return 'staff';
  if (target === 'High School Students') return 'students';
  return 'all';
}

export class CommunicationModule {
  static async render(container) {
    const notices = await dbService.select('notices');
    const esc = (v) => UIComponents.escapeHtml(v);
    const user = authService.getCurrentUser() || {};
    const canManage = MANAGER_ROLES.includes(user.role);

    this._notices = notices;

    container.innerHTML = `
      <div style="margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
          <div>
            <h1 style="font-size: 1.8rem;">Official Communication &amp; Broadcast</h1>
            <p style="color: var(--text-muted); font-size: 0.9rem;">
              School circulars, targeted notices, emergency bulletins, SMS/WhatsApp broadcast dispatch.
            </p>
          </div>
          ${canManage ? '<button class="btn btn-primary" id="btn-create-notice"><i data-lucide="send"></i> Publish New Notice</button>' : ''}
        </div>
      </div>

      <div class="kpi-grid">
        ${UIComponents.renderKpiCard({ title: 'Active Circulars', value: `${notices.length}`, icon: 'bell', color: 'blue', subtitle: 'Published on Campus' })}
        ${UIComponents.renderKpiCard({ title: 'Emergency Bulletins', value: `${notices.filter(n => n.priority === 'Urgent').length} Active`, icon: 'shield-alert', color: 'emerald', subtitle: 'Urgent Priority Notices' })}
        ${UIComponents.renderKpiCard({ title: 'Notices This Month', value: `${notices.filter(n => String(n.date || '').slice(0, 7) === new Date().toISOString().slice(0, 7)).length}`, icon: 'calendar-days', color: 'amber', subtitle: 'Circulars Dispatched' })}
        ${UIComponents.renderKpiCard({ title: 'Urgent Unresolved', value: `${notices.filter(n => n.priority === 'Urgent').length}`, icon: 'check-check', color: 'rose', subtitle: 'Requiring Acknowledgement' })}
      </div>

      <div class="card">
        <div class="card-header" style="flex-wrap:wrap; gap:12px;">
          <div>
            <h3 class="card-title">School Notice Board &amp; Official Circulars</h3>
            <p class="card-desc">Targeted notices for Parents, Faculty, Students, or School-Wide distribution.</p>
          </div>
        </div>

        ${canManage ? `
        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:14px;">
          <button class="btn btn-secondary btn-sm" id="btn-notice-select-all"><i data-lucide="check-square"></i> Select All</button>
          <button class="btn btn-secondary btn-sm" id="btn-notice-clear">Clear</button>
          <button class="btn btn-secondary btn-sm" id="btn-notice-bulk-export"><i data-lucide="download"></i> Export Selected</button>
          <button class="btn btn-secondary btn-sm" id="btn-notice-bulk-delete" style="color:#ef4444;"><i data-lucide="trash-2"></i> Delete Selected (<span id="notice-selected-count">0</span>)</button>
        </div>` : ''}

        <div style="display: grid; gap: 18px;">
          ${notices.length ? notices.map(n => `
            <div data-notice-id="${esc(n.id)}" style="background: rgba(0,0,0,0.02); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 18px; border-left: 4px solid ${n.priority === 'Urgent' ? '#ef4444' : '#3b82f6'};">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
                <div style="display:flex; gap:10px; align-items:flex-start;">
                  ${canManage ? `<input type="checkbox" class="notice-row-check" value="${esc(n.id)}" style="margin-top:5px;">` : ''}
                  <div>
                    <h4 style="font-size: 1.05rem; font-weight: 700;">${esc(n.title)}</h4>
                    <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">
                      Category: <strong>${esc(n.category)}</strong> • Target: <span class="badge badge-info">${esc(n.target)}</span> • Date: ${esc(n.date)}
                    </div>
                  </div>
                </div>
                <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
                  <span class="badge badge-${n.priority === 'Urgent' ? 'danger' : 'info'}">${esc(n.priority)} Priority</span>
                  ${canManage ? `
                  <button class="btn btn-secondary btn-sm btn-edit-notice" data-id="${esc(n.id)}" title="Edit circular"><i data-lucide="pencil"></i></button>
                  <button class="btn btn-secondary btn-sm btn-del-notice" data-id="${esc(n.id)}" title="Delete circular" style="color:#ef4444;"><i data-lucide="trash-2"></i></button>` : ''}
                </div>
              </div>
              <p style="font-size: 0.9rem; color: var(--text-main); line-height: 1.6; margin-bottom: 12px;">
                ${esc(n.content)}
              </p>
              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.78rem; color: var(--text-muted); border-top: 1px dashed var(--border-color); padding-top: 8px; flex-wrap:wrap; gap:8px;">
                <span>Dispatched by: <strong>${esc(n.publishedBy || 'Executive Office')}</strong></span>
                <button class="btn btn-secondary btn-sm btn-resend-notice" data-id="${esc(n.id)}">
                  <i data-lucide="share"></i> Resend Broadcast
                </button>
              </div>
            </div>
          `).join('') : `
            <div style="text-align: center; color: var(--text-muted); padding: 40px;">
              <i data-lucide="inbox" style="width:40px;height:40px;display:block;margin:0 auto 10px;"></i>
              No records available yet.
            </div>
          `}
        </div>
      </div>
    `;

    this.bindEvents(container, canManage);
    UIComponents.refreshIcons();
  }

  static bindEvents(container, canManage) {
    const notices = this._notices || [];

    const createBtn = container.querySelector('#btn-create-notice');
    if (createBtn) createBtn.addEventListener('click', () => this.openNoticeModal(null, container));

    container.querySelectorAll('.btn-edit-notice').forEach((b) =>
      b.addEventListener('click', () => {
        const n = notices.find((x) => x.id === b.dataset.id);
        if (n) this.openNoticeModal(n, container);
      }));

    container.querySelectorAll('.btn-del-notice').forEach((b) =>
      b.addEventListener('click', () => {
        const n = notices.find((x) => x.id === b.dataset.id);
        if (n) this.deleteNotices([n], container);
      }));

    container.querySelectorAll('.btn-resend-notice').forEach((b) =>
      b.addEventListener('click', async () => {
        const n = notices.find((x) => x.id === b.dataset.id);
        if (!n) return;
        try {
          await notificationService.create({
            title: n.title,
            message: n.content,
            audience: audienceForTarget(n.target),
            priority: n.priority
          });
          await auditService.log('CIRCULAR_RESENT', 'COMMUNICATION', { title: n.title, target: n.target }, n.id);
          UIComponents.showToast('Circular re-broadcast to all portals and recipients.', 'success');
        } catch (e) {
          UIComponents.showToast(`Could not re-broadcast: ${e.message}`, 'danger');
        }
      }));

    if (!canManage) return;

    const checked = () => Array.from(container.querySelectorAll('.notice-row-check:checked')).map((c) => c.value);
    const syncCount = () => {
      const el = container.querySelector('#notice-selected-count');
      if (el) el.innerText = checked().length;
    };
    const selectedNotices = () => notices.filter((n) => checked().includes(n.id));

    container.querySelectorAll('.notice-row-check').forEach((c) => c.addEventListener('change', syncCount));

    const selAllBtn = container.querySelector('#btn-notice-select-all');
    if (selAllBtn) {
      selAllBtn.addEventListener('click', () => {
        container.querySelectorAll('.notice-row-check').forEach((c) => { c.checked = true; });
        syncCount();
      });
    }
    const clearBtn = container.querySelector('#btn-notice-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        container.querySelectorAll('.notice-row-check').forEach((c) => { c.checked = false; });
        syncCount();
      });
    }
    const bulkDelete = container.querySelector('#btn-notice-bulk-delete');
    if (bulkDelete) {
      bulkDelete.addEventListener('click', () => {
        const rows = selectedNotices();
        if (!rows.length) { UIComponents.showToast('Select at least one circular.', 'warning'); return; }
        this.deleteNotices(rows, container);
      });
    }
    const bulkExport = container.querySelector('#btn-notice-bulk-export');
    if (bulkExport) {
      bulkExport.addEventListener('click', async () => {
        const rows = selectedNotices();
        if (!rows.length) { UIComponents.showToast('Select at least one circular.', 'warning'); return; }
        const esc = (v) => UIComponents.escapeHtml(v);
        const html = rows.map((n) => `
          <div class="notice-block">
            <h3>${esc(n.title)}</h3>
            <div class="doc-sub">${esc(n.category)} • ${esc(n.target)} • ${esc(n.priority)} Priority • ${esc(n.date || '')}</div>
            <p>${esc(n.content)}</p>
            <div style="font-size:11px;">Dispatched by ${esc(n.publishedBy || 'Executive Office')}</div>
          </div>`).join('');
        const { exportPdf } = await import('./export-utils.js');
        exportPdf('TMS-Circulars', html);
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Create / Edit / Delete                                              */
  /* ------------------------------------------------------------------ */

  static openNoticeModal(notice, container) {
    const esc = (v) => UIComponents.escapeHtml(v);
    const n = notice || {};
    const isEdit = !!notice;

    const opts = (list, current) => list.map((v) => `<option ${current === v ? 'selected' : ''}>${esc(v)}</option>`).join('');

    UIComponents.openModal({
      title: isEdit ? `Edit Circular — ${n.title || ''}` : 'Publish Official Circular',
      bodyHtml: `
        <form id="form-new-notice">
          <div class="form-group">
            <label class="form-label">Notice Headline / Title *</label>
            <input class="form-input" id="not-title" required value="${esc(n.title || '')}" placeholder="e.g. Schedule for Mid-Term Examination 2026">
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
            <div class="form-group">
              <label class="form-label">Category</label>
              <select class="form-select" id="not-category">${opts(CATEGORIES, n.category)}</select>
            </div>
            <div class="form-group">
              <label class="form-label">Target Audience</label>
              <select class="form-select" id="not-target">${opts(TARGETS, n.target)}</select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Priority Level</label>
            <select class="form-select" id="not-priority">${opts(PRIORITIES, n.priority)}</select>
          </div>
          <div class="form-group">
            <label class="form-label">Circular Content / Message *</label>
            <textarea class="form-textarea" id="not-content" rows="4" required placeholder="Detailed circular content...">${esc(n.content || '')}</textarea>
          </div>
          <label style="display:flex; align-items:center; gap:8px; font-size:0.82rem; color:var(--text-muted);">
            <input type="checkbox" id="not-notify" ${isEdit ? '' : 'checked'}>
            Also send an in-app notification to the selected audience
          </label>
        </form>
      `,
      footerHtml: `
        <button class="btn btn-secondary" id="not-cancel">Cancel</button>
        ${isEdit ? '<button class="btn btn-secondary" id="not-delete" style="color:#ef4444;"><i data-lucide="trash-2"></i> Delete</button>' : ''}
        <button class="btn btn-primary" id="btn-save-notice"><i data-lucide="send"></i> ${isEdit ? 'Save Changes' : 'Publish & Broadcast'}</button>
      `
    });

    document.getElementById('not-cancel').addEventListener('click', () => UIComponents.closeModal());
    const delBtn = document.getElementById('not-delete');
    if (delBtn) delBtn.addEventListener('click', () => { UIComponents.closeModal(); this.deleteNotices([n], container); });

    document.getElementById('btn-save-notice').addEventListener('click', async () => {
      const title = document.getElementById('not-title').value.trim();
      const category = document.getElementById('not-category').value;
      const target = document.getElementById('not-target').value;
      const priority = document.getElementById('not-priority').value;
      const content = document.getElementById('not-content').value.trim();
      const alsoNotify = document.getElementById('not-notify').checked;

      if (!title || !content) {
        UIComponents.showToast('Please fill all required fields.', 'warning');
        return;
      }

      const user = authService.getCurrentUser() || {};
      const payload = {
        title,
        category,
        target,
        priority,
        content,
        date: (n.date || new Date().toISOString().split('T')[0]),
        publishedBy: n.publishedBy || user.name || 'Executive Administration'
      };

      const res = isEdit
        ? await dbService.update('notices', n.id, payload)
        : await dbService.insert('notices', payload);

      if (res && res._syncError) {
        UIComponents.showToast(`Notice could not be saved: ${res._syncError}`, 'danger');
        return;
      }

      if (alsoNotify) {
        try {
          await notificationService.create({
            title,
            message: content,
            audience: audienceForTarget(target),
            priority
          });
        } catch (e) {
          UIComponents.showToast(`Circular saved, but the notification failed: ${e.message}`, 'warning');
        }
      }

      await auditService.log(isEdit ? 'CIRCULAR_UPDATED' : 'CIRCULAR_PUBLISHED', 'COMMUNICATION', { title, target, priority }, isEdit ? n.id : (res && res.id));
      UIComponents.closeModal();
      UIComponents.showToast(isEdit ? 'Circular updated.' : 'Notice published and broadcast successfully!', 'success');
      await CommunicationModule.render(container);
    });

    UIComponents.refreshIcons();
  }

  static async deleteNotices(rows, container) {
    const label = rows.length === 1 ? `Delete "${rows[0].title}"?` : `Delete ${rows.length} circulars?`;
    if (!confirm(`${label}\n\nThis permanently removes the circular. This cannot be undone.`)) return;
    for (const n of rows) {
      // eslint-disable-next-line no-await-in-loop
      await dbService.delete('notices', n.id);
      // eslint-disable-next-line no-await-in-loop
      await auditService.log('CIRCULAR_DELETED', 'COMMUNICATION', { title: n.title }, n.id);
    }
    UIComponents.showToast(`${rows.length} circular(s) deleted.`, 'success');
    await CommunicationModule.render(container);
  }
}

export default CommunicationModule;
