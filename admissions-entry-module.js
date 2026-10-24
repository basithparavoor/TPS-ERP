/**
 * THAIBA PUBLIC SCHOOL — Admissions Entry (Office Boy workspace)
 * Lets data-entry staff open the admission form (which records "done by" them)
 * and review the applications they have entered.
 */

import { authService } from './auth-service.js';
import { admissionService } from './admission-service.js';
import { auditService } from './audit-service.js';
import { UIComponents } from './ui-components.js';

const esc = (v) => UIComponents.escapeHtml(v);

function fmtDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB');
}

export class AdmissionsEntryModule {
  static async render(container) {
    const user = authService.getCurrentUser() || {};
    let apps = [];
    try {
      apps = await admissionService.listApplications();
    } catch (e) { /* ignore */ }

    const mine = apps.filter((a) => a.submittedBy && a.submittedBy === user.id);
    const pending = mine.filter((a) => a.status === 'Submitted' || a.status === 'Under Verification').length;
    const fees = mine.reduce((s, a) => s + Number(a.feeTotal || 0), 0);

    container.innerHTML = `
      <div style="margin-bottom: 24px;">
        <h1 style="font-size: 1.8rem;">Admission Entry Desk</h1>
        <p style="color: var(--text-muted); font-size: 0.9rem;">
          Welcome, <strong>${esc(user.name || 'Staff')}</strong>. Applications you submit from this desk are recorded as entered by you.
        </p>
      </div>

      <div class="kpi-grid" style="margin-bottom: 22px;">
        ${UIComponents.renderKpiCard({ title: 'Applications Entered', value: mine.length, icon: 'file-text', color: 'blue' })}
        ${UIComponents.renderKpiCard({ title: 'Awaiting Verification', value: pending, icon: 'clock', color: 'amber' })}
        ${UIComponents.renderKpiCard({ title: 'Fees Recorded', value: `₹ ${fees.toLocaleString('en-IN')}`, icon: 'indian-rupee', color: 'emerald' })}
      </div>

      <div class="card" style="margin-bottom: 22px; border-left: 4px solid #16a34a;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap;">
          <div>
            <h3 style="font-size:1.1rem; margin-bottom:4px;">New Admission Entry</h3>
            <p style="font-size:0.85rem; color:var(--text-muted);">
              Open the admission form. The applicant's parent login credentials are generated on submission.
            </p>
          </div>
          <button class="btn btn-primary" id="btn-open-admission-form"><i data-lucide="clipboard-pen"></i> Open Admission Form</button>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Applications Entered by You</h3>
          <span class="badge badge-info">${mine.length} record(s)</span>
        </div>
        <div class="table-responsive">
          <table class="tms-table" style="font-size:0.85rem;">
            <thead><tr><th>Form No</th><th>Candidate</th><th>Class</th><th>Phone</th><th>Fees</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              ${mine.length ? mine.map((a) => `<tr>
                <td class="font-mono">${esc(a.appId || a.id)}</td>
                <td style="font-weight:600;">${esc(a.studentName || '—')}</td>
                <td>${esc(a.grade || '—')}</td>
                <td class="font-mono">${esc(a.phone || '—')}</td>
                <td>₹ ${Number(a.feeTotal || 0).toLocaleString('en-IN')}</td>
                <td><span class="badge badge-info">${esc(a.status || '—')}</span></td>
                <td>${fmtDate(a.createdAt)}</td>
              </tr>`).join('') : '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:30px;">You have not entered any applications yet.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;

    const btn = document.getElementById('btn-open-admission-form');
    if (btn) {
      btn.addEventListener('click', async () => {
        await auditService.log('ADMISSION_ENTRY_OPENED', 'ADMISSIONS', { by: user.name });
        window.open('student-admission-portal.html', '_blank');
      });
    }

    UIComponents.refreshIcons();
  }
}

export default AdmissionsEntryModule;
