/**
 * THAIBA PUBLIC SCHOOL — Staff & Human Resources Module
 *
 * Registry of every employee plus full lifecycle management:
 *   - appoint new staff (creates the record AND a real login),
 *   - edit staff details,
 *   - view / edit / resend / delete the issued login credentials,
 *   - select rows and run bulk actions (delete / activate / deactivate / export),
 *   - delete a staff member together with their login.
 */

import { TMS_CONFIG } from './config.js';
import { dbService } from './supabase-client.js';
import { UIComponents } from './ui-components.js';
import { auditService } from './audit-service.js';
import { PermissionEngine, CAPABILITIES } from './permission-engine.js';
import { staffService } from './staff-service.js';
import { exportPdf, downloadCsv } from './export-utils.js';

const ROLE_OPTIONS = [
  { value: 'teacher', label: 'Teaching Faculty' },
  { value: 'coordinator', label: 'Academic Coordinator' },
  { value: 'finance', label: 'Finance & Accounts' },
  { value: 'hr', label: 'HR & Administration' },
  { value: 'librarian', label: 'Librarian' },
  { value: 'operations', label: 'Operations & Transport' },
  { value: 'office_boy', label: 'Office Boy (Admission Data Entry)' },
  { value: 'principal', label: 'Principal' }
];

const ROLE_LABELS = ROLE_OPTIONS.reduce((acc, r) => {
  acc[r.value] = r.label;
  return acc;
}, {});

const esc = (v) => UIComponents.escapeHtml(v);

function fmtDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB');
}

export class StaffModule {
  static async render(container) {
    const canManage = PermissionEngine.can(CAPABILITIES.MANAGE_STAFF);

    let staff = [];
    let credentials = [];
    try {
      staff = await dbService.select('staff');
    } catch (e) {
      staff = [];
    }
    if (canManage) {
      try {
        credentials = await staffService.listCredentials();
      } catch (e) {
        credentials = [];
      }
    }
    const credByStaff = credentials.reduce((acc, c) => {
      if (c.staffId) acc[c.staffId] = c;
      return acc;
    }, {});

    this._staff = staff;
    this._credByStaff = credByStaff;

    const teachingCount = staff.filter((s) => s.role === 'teacher').length;
    const supportCount = Math.max(0, staff.length - teachingCount);
    const payrollTotal = staff.reduce((sum, s) => sum + (parseFloat(s.basicPay) || 0), 0);

    container.innerHTML = `
      <div style="margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
          <div>
            <h1 style="font-size: 1.8rem;">Staff &amp; Human Resources</h1>
            <p style="color: var(--text-muted); font-size: 0.9rem;">
              Faculty registry, departments, designations, employment contracts and login credentials.
              Appointing a staff member also creates their username &amp; password and adds them to Users &amp; Roles.
            </p>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn btn-secondary" id="btn-export-staff"><i data-lucide="file-spreadsheet"></i> Export CSV</button>
            ${canManage ? '<button class="btn btn-primary" id="btn-add-staff"><i data-lucide="user-plus"></i> Appoint New Staff</button>' : ''}
          </div>
        </div>
      </div>

      <div class="kpi-grid">
        ${UIComponents.renderKpiCard({ title: 'Total Faculty & Staff', value: `${staff.length}`, icon: 'briefcase', color: 'blue', subtitle: 'Permanent & Contracted' })}
        ${UIComponents.renderKpiCard({ title: 'Teaching Faculty', value: `${teachingCount}`, icon: 'graduation-cap', color: 'emerald', subtitle: 'High School & Secondary' })}
        ${UIComponents.renderKpiCard({ title: 'Non-Teaching / Support', value: `${supportCount}`, icon: 'wrench', color: 'amber', subtitle: 'Admin, Lab & Transport' })}
        ${UIComponents.renderKpiCard({ title: 'Monthly Payroll Budget', value: `₹ ${payrollTotal.toLocaleString()}`, icon: 'wallet', color: 'rose', subtitle: 'Authorized CTC' })}
      </div>

      <div class="card">
        <div class="card-header" style="flex-wrap:wrap; gap:12px;">
          <div>
            <h3 class="card-title">Employees Directory</h3>
            <p class="card-desc">Select rows for bulk actions, click <strong>Edit</strong> to change details or <strong>Login</strong> to view the issued credentials.</p>
          </div>
        </div>

        ${canManage ? `
        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:12px;">
          <button class="btn btn-secondary btn-sm" id="btn-staff-select-all"><i data-lucide="check-square"></i> Select All</button>
          <button class="btn btn-secondary btn-sm" id="btn-staff-clear">Clear</button>
          <button class="btn btn-secondary btn-sm" id="btn-staff-bulk-activate"><i data-lucide="check-circle"></i> Set Active</button>
          <button class="btn btn-secondary btn-sm" id="btn-staff-bulk-deactivate"><i data-lucide="pause-circle"></i> Set Inactive</button>
          <button class="btn btn-secondary btn-sm" id="btn-staff-bulk-export"><i data-lucide="download"></i> Export Selected</button>
          <button class="btn btn-secondary btn-sm" id="btn-staff-bulk-delete" style="color:#ef4444;"><i data-lucide="trash-2"></i> Delete Selected (<span id="staff-selected-count">0</span>)</button>
        </div>` : ''}

        <div class="table-responsive">
          <table class="tms-table" id="staff-table">
            <thead>
              <tr>
                ${canManage ? '<th style="width:34px;"><input type="checkbox" id="staff-select-all"></th>' : ''}
                <th>Emp ID</th>
                <th>Employee</th>
                <th>Department</th>
                <th>Designation</th>
                <th>Role</th>
                <th>Phone</th>
                <th>Joined</th>
                <th>Status</th>
                <th>Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${staff.length ? staff.map((emp) => {
                const cred = credByStaff[emp.id];
                return `
                <tr data-id="${esc(emp.id)}">
                  ${canManage ? `<td><input type="checkbox" class="staff-row-check" value="${esc(emp.id)}"></td>` : ''}
                  <td><span class="font-mono" style="font-weight: 600;">${esc(emp.empId)}</span></td>
                  <td>
                    <strong>${esc(emp.name)}</strong>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${esc(emp.email)}</div>
                  </td>
                  <td>${esc(emp.department)}</td>
                  <td><strong>${esc(emp.designation)}</strong></td>
                  <td>${esc(ROLE_LABELS[emp.role] || emp.role || '—')}</td>
                  <td class="font-mono" style="font-size: 0.82rem;">${esc(emp.phone)}</td>
                  <td>${fmtDate(emp.joiningDate)}</td>
                  <td><span class="badge ${emp.status === 'Active' ? 'badge-success' : 'badge-warning'}">${esc(emp.status || '—')}</span></td>
                  <td>
                    ${cred
                      ? `<span class="font-mono" style="font-size:0.78rem;">${esc(cred.username)}</span>`
                      : '<span style="color:var(--text-muted);font-size:0.78rem;">No login</span>'}
                  </td>
                  <td style="white-space:nowrap;">
                    ${canManage ? `
                      <button class="btn btn-secondary btn-sm btn-edit-staff" data-id="${esc(emp.id)}" title="Edit details"><i data-lucide="pencil"></i></button>
                      <button class="btn btn-secondary btn-sm btn-login-staff" data-id="${esc(emp.id)}" title="Login credentials"><i data-lucide="key-round"></i></button>
                      <button class="btn btn-secondary btn-sm btn-del-staff" data-id="${esc(emp.id)}" title="Delete staff" style="color:#ef4444;"><i data-lucide="trash-2"></i></button>
                    ` : `
                      <button class="btn btn-secondary btn-sm" onclick="alert('Viewing service file for ${esc(emp.name)}')"><i data-lucide="file-text"></i></button>
                    `}
                  </td>
                </tr>`;
              }).join('') : `
                <tr>
                  <td colspan="${canManage ? 11 : 10}" style="text-align: center; color: var(--text-muted); padding: 30px;">No records available yet.</td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    `;

    this.bindEvents(container, canManage);
    UIComponents.refreshIcons();
  }

  static bindEvents(container, canManage) {
    const staff = this._staff || [];

    const addBtn = container.querySelector('#btn-add-staff');
    if (addBtn) addBtn.addEventListener('click', () => this.openStaffModal(null, container));

    container.querySelectorAll('.btn-edit-staff').forEach((b) =>
      b.addEventListener('click', () => {
        const emp = staff.find((s) => s.id === b.dataset.id);
        if (emp) this.openStaffModal(emp, container);
      }));

    container.querySelectorAll('.btn-login-staff').forEach((b) =>
      b.addEventListener('click', () => {
        const emp = staff.find((s) => s.id === b.dataset.id);
        if (emp) this.openCredentialsModal(emp, container);
      }));

    container.querySelectorAll('.btn-del-staff').forEach((b) =>
      b.addEventListener('click', () => {
        const emp = staff.find((s) => s.id === b.dataset.id);
        if (emp) this.deleteStaff([emp], container);
      }));

    const exportBtn = container.querySelector('#btn-export-staff');
    if (exportBtn) exportBtn.addEventListener('click', () => this.exportCsv(staff));

    if (!canManage) return;

    const checked = () => Array.from(container.querySelectorAll('.staff-row-check:checked')).map((c) => c.value);
    const syncCount = () => {
      const el = container.querySelector('#staff-selected-count');
      if (el) el.innerText = checked().length;
    };
    container.querySelectorAll('.staff-row-check').forEach((c) => c.addEventListener('change', syncCount));

    const selectAllBox = container.querySelector('#staff-select-all');
    if (selectAllBox) {
      selectAllBox.addEventListener('change', () => {
        container.querySelectorAll('.staff-row-check').forEach((c) => { c.checked = selectAllBox.checked; });
        syncCount();
      });
    }
    const selectAllBtn = container.querySelector('#btn-staff-select-all');
    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', () => {
        container.querySelectorAll('.staff-row-check').forEach((c) => { c.checked = true; });
        syncCount();
      });
    }
    const clearBtn = container.querySelector('#btn-staff-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        container.querySelectorAll('.staff-row-check').forEach((c) => { c.checked = false; });
        syncCount();
      });
    }

    const selectedStaff = () => staff.filter((s) => checked().includes(s.id));

    const bulkDelete = container.querySelector('#btn-staff-bulk-delete');
    if (bulkDelete) {
      bulkDelete.addEventListener('click', () => {
        const rows = selectedStaff();
        if (!rows.length) { UIComponents.showToast('Select at least one staff member.', 'warning'); return; }
        this.deleteStaff(rows, container);
      });
    }

    const bulkActivate = container.querySelector('#btn-staff-bulk-activate');
    if (bulkActivate) bulkActivate.addEventListener('click', () => this.bulkSetStatus(selectedStaff(), 'Active', container));

    const bulkDeactivate = container.querySelector('#btn-staff-bulk-deactivate');
    if (bulkDeactivate) bulkDeactivate.addEventListener('click', () => this.bulkSetStatus(selectedStaff(), 'Inactive', container));

    const bulkExport = container.querySelector('#btn-staff-bulk-export');
    if (bulkExport) {
      bulkExport.addEventListener('click', () => {
        const rows = selectedStaff();
        if (!rows.length) { UIComponents.showToast('Select at least one staff member.', 'warning'); return; }
        this.exportCsv(rows);
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Create / Edit                                                       */
  /* ------------------------------------------------------------------ */

  static nextEmpId(existing) {
    const maxSeq = existing.reduce((max, s) => {
      const m = String(s.empId || '').match(/(\d+)\s*$/);
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    return `TMS-EMP-${(maxSeq + 1).toString().padStart(3, '0')}`;
  }

  static openStaffModal(emp, container) {
    const isEdit = !!emp;
    const e = emp || {};
    const classes = ['', ...(TMS_CONFIG.academic && TMS_CONFIG.academic.classes ? TMS_CONFIG.academic.classes : [])];
    const sections = ['', ...(TMS_CONFIG.academic && TMS_CONFIG.academic.sections ? TMS_CONFIG.academic.sections : ['A', 'B', 'C'])];

    const bodyHtml = `
      <form id="form-new-staff">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
          <div class="form-group">
            <label class="form-label">Full Name *</label>
            <input class="form-input" id="stf-name" required value="${esc(e.name || '')}" placeholder="e.g. Mrs. Khadija Beevi">
          </div>
          <div class="form-group">
            <label class="form-label">Official Email *</label>
            <input type="email" class="form-input" id="stf-email" required value="${esc(e.email || '')}" placeholder="khadija@thaibaschool.edu.in">
            <span style="font-size:0.7rem; color:var(--text-subtle);">This becomes their sign-in account e-mail.</span>
          </div>
          <div class="form-group">
            <label class="form-label">Role Category</label>
            <select class="form-select" id="stf-role">
              ${ROLE_OPTIONS.map((r) => `<option value="${esc(r.value)}" ${e.role === r.value ? 'selected' : ''}>${esc(r.label)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Department *</label>
            <input class="form-input" id="stf-dept" required value="${esc(e.department || '')}" placeholder="e.g. Science / English / IT">
          </div>
          <div class="form-group">
            <label class="form-label">Designation *</label>
            <input class="form-input" id="stf-desig" required value="${esc(e.designation || '')}" placeholder="e.g. PGT Physics">
          </div>
          <div class="form-group">
            <label class="form-label">Phone Number</label>
            <input class="form-input" id="stf-phone" value="${esc(e.phone || '')}" placeholder="+91 98470 12345">
          </div>
          <div class="form-group">
            <label class="form-label">Basic Salary (₹)</label>
            <input type="number" class="form-input" id="stf-salary" value="${e.basicPay != null ? esc(e.basicPay) : ''}" placeholder="35000">
          </div>
          <div class="form-group">
            <label class="form-label">Joining Date</label>
            <input type="date" class="form-input" id="stf-joining" value="${esc((e.joiningDate || new Date().toISOString()).slice(0, 10))}">
          </div>
          <div class="form-group">
            <label class="form-label">Assigned Class</label>
            <select class="form-select" id="stf-class">
              ${classes.map((c) => `<option value="${esc(c)}" ${e.assignedClass === c ? 'selected' : ''}>${c ? esc(c) : '—'}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Assigned Section</label>
            <select class="form-select" id="stf-section">
              ${sections.map((s) => `<option value="${esc(s)}" ${e.assignedSection === s ? 'selected' : ''}>${s || '—'}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Employment Status</label>
            <select class="form-select" id="stf-status">
              <option ${e.status === 'Active' || !e.status ? 'selected' : ''}>Active</option>
              <option ${e.status === 'Inactive' ? 'selected' : ''}>Inactive</option>
              <option ${e.status === 'On Leave' ? 'selected' : ''}>On Leave</option>
              <option ${e.status === 'Resigned' ? 'selected' : ''}>Resigned</option>
            </select>
          </div>
          ${isEdit ? '' : `
          <div class="form-group" style="grid-column:1/-1; border-top:1px solid var(--border-color); padding-top:12px;">
            <label class="form-label">Login Credentials</label>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <input class="form-input font-mono" id="stf-username" placeholder="Username (auto-generated if blank)">
              <input class="form-input font-mono" id="stf-password" placeholder="Password (auto-generated if blank)">
            </div>
            <span style="font-size:0.72rem; color:var(--text-subtle);">A username and password are generated automatically, shown to you after saving, and listed in Admin → Users &amp; Roles.</span>
          </div>`}
        </div>
      </form>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" id="btn-cancel-staff">Cancel</button>
      <button class="btn btn-primary" id="btn-save-staff"><i data-lucide="save"></i> ${isEdit ? 'Save Changes' : 'Issue Appointment'}</button>
    `;

    UIComponents.openModal({
      title: isEdit ? `Edit Staff — ${e.name || ''}` : 'Appoint New Staff Member',
      bodyHtml,
      footerHtml
    });

    document.getElementById('btn-cancel-staff').addEventListener('click', () => UIComponents.closeModal());
    document.getElementById('btn-save-staff').addEventListener('click', async () => {
      if (isEdit) await this.saveStaffEdit(e, container);
      else await this.createStaff(container);
    });
    UIComponents.refreshIcons();
  }

  static readStaffForm() {
    return {
      name: document.getElementById('stf-name').value.trim(),
      email: document.getElementById('stf-email').value.trim(),
      role: document.getElementById('stf-role').value,
      department: document.getElementById('stf-dept').value.trim(),
      designation: document.getElementById('stf-desig').value.trim(),
      phone: document.getElementById('stf-phone').value.trim(),
      basicPay: parseFloat(document.getElementById('stf-salary').value) || 0,
      joiningDate: document.getElementById('stf-joining').value,
      assignedClass: document.getElementById('stf-class').value,
      assignedSection: document.getElementById('stf-section').value,
      status: document.getElementById('stf-status').value
    };
  }

  static async createStaff(container) {
    const form = this.readStaffForm();
    if (!form.name || !form.email) {
      UIComponents.showToast('Please enter the employee name and email.', 'warning');
      return;
    }

    const usernameInput = document.getElementById('stf-username');
    const passwordInput = document.getElementById('stf-password');
    const customUsername = usernameInput ? usernameInput.value.trim() : '';
    const customPassword = passwordInput ? passwordInput.value : '';

    const existing = this._staff || [];
    if (existing.some((s) => String(s.email || '').toLowerCase() === form.email.toLowerCase())) {
      UIComponents.showToast('A staff member with this email already exists.', 'warning');
      return;
    }
    if (customUsername && await staffService.usernameTaken(customUsername)) {
      UIComponents.showToast('That username is already taken. Please choose another.', 'warning');
      return;
    }

    const empId = this.nextEmpId(existing);

    const record = await dbService.insert('staff', {
      empId,
      name: form.name,
      email: form.email,
      role: form.role,
      department: form.department,
      designation: form.designation,
      phone: form.phone,
      basicPay: form.basicPay,
      joiningDate: form.joiningDate || null,
      assignedClass: form.assignedClass || null,
      assignedSection: form.assignedSection || null,
      status: form.status || 'Active'
    });

    if (record._syncError) {
      UIComponents.showToast(`Appointment could not be saved: ${record._syncError}`, 'danger');
      return;
    }

    UIComponents.showToast('Staff saved. Creating login…', 'info');

    const provision = await staffService.provision({
      staffId: record.id,
      name: form.name,
      email: form.email,
      role: form.role,
      title: form.designation,
      department: form.department,
      assignedClass: form.assignedClass || null,
      assignedSection: form.assignedSection || null,
      username: customUsername || null,
      password: customPassword || null
    });

    if (provision.userId) {
      await dbService.update('staff', record.id, { userId: provision.userId });
    }

    await auditService.log('STAFF_APPOINTED', 'HR', {
      empId, name: form.name, designation: form.designation, department: form.department,
      username: provision.username || null, loginCreated: !!provision.userId
    }, record.id);

    UIComponents.closeModal();

    if (provision.userId) {
      this.showCredentialsModal({
        name: form.name,
        email: form.email,
        username: provision.username,
        password: provision.password,
        title: 'Staff Login Created'
      });
      UIComponents.showToast(`${form.name} appointed — login created and added to Users & Roles.`, 'success');
    } else {
      UIComponents.showToast(
        `Staff saved, but the login could not be created: ${provision.error || 'unknown error'}`,
        'warning'
      );
      if (provision.profileError) console.warn('Profile provisioning issue:', provision.profileError);
    }

    await StaffModule.render(container);
  }

  static async saveStaffEdit(emp, container) {
    const form = this.readStaffForm();
    if (!form.name || !form.email) {
      UIComponents.showToast('Please enter the employee name and email.', 'warning');
      return;
    }

    const updated = await dbService.update('staff', emp.id, {
      name: form.name,
      email: form.email,
      role: form.role,
      department: form.department,
      designation: form.designation,
      phone: form.phone,
      basicPay: form.basicPay,
      joiningDate: form.joiningDate || null,
      assignedClass: form.assignedClass || null,
      assignedSection: form.assignedSection || null,
      status: form.status
    });

    if (updated && updated._syncError) {
      UIComponents.showToast(`Could not save changes: ${updated._syncError}`, 'danger');
      return;
    }

    // Keep the linked login profile (Users & Roles) in sync.
    if (emp.userId) {
      await staffService.applyProfile(emp.userId, {
        name: form.name,
        email: form.email,
        role: form.role,
        title: form.designation,
        department: form.department,
        assignedClass: form.assignedClass || null,
        assignedSection: form.assignedSection || null
      });
      const cred = (this._credByStaff || {})[emp.id];
      if (cred && form.email && form.email !== cred.email) {
        await staffService.updateCredentials(cred, { email: form.email });
      }
    }

    await auditService.log('STAFF_UPDATED', 'HR', { staffId: emp.id, name: form.name, role: form.role }, emp.id);
    UIComponents.showToast('Staff details updated.', 'success');
    UIComponents.closeModal();
    await StaffModule.render(container);
  }

  /* ------------------------------------------------------------------ */
  /* Credentials                                                         */
  /* ------------------------------------------------------------------ */

  static showCredentialsModal({ name, email, username, password, title }) {
    const bodyHtml = `
      <div style="border:1.5px dashed #b45309; border-radius:10px; padding:16px; background:#fffbeb;">
        <div style="font-weight:800; font-size:1rem; margin-bottom:10px;">${esc(title || 'Login Credentials')}</div>
        <table class="tms-table" style="font-size:0.9rem; background:transparent;">
          <tbody>
            <tr><th style="text-align:left;">Name</th><td>${esc(name || '—')}</td></tr>
            <tr><th style="text-align:left;">Username</th><td><strong class="font-mono" id="cred-out-username">${esc(username || '—')}</strong></td></tr>
            <tr><th style="text-align:left;">Password</th><td><strong class="font-mono" id="cred-out-password">${esc(password || '—')}</strong></td></tr>
            <tr><th style="text-align:left;">Sign-in e-mail</th><td class="font-mono">${esc(email || '—')}</td></tr>
          </tbody>
        </table>
        <p style="font-size:0.78rem; color:#92400e; margin-top:10px;">
          Note these down and hand them to the staff member. They can sign in with the username or the e-mail above.
          The account also appears in Admin → Users &amp; Roles.
        </p>
      </div>
    `;
    const footerHtml = `
      <button class="btn btn-secondary" id="cred-copy"><i data-lucide="copy"></i> Copy</button>
      <button class="btn btn-secondary" id="cred-print"><i data-lucide="printer"></i> Print Slip</button>
      <button class="btn btn-primary" id="cred-done">Done</button>
    `;
    UIComponents.openModal({ title: 'Staff Login Credentials', bodyHtml, footerHtml });

    document.getElementById('cred-done').addEventListener('click', () => UIComponents.closeModal());
    document.getElementById('cred-copy').addEventListener('click', async () => {
      const text = `THAIBA PUBLIC SCHOOL — Staff Login\nName: ${name}\nUsername: ${username}\nPassword: ${password}\nE-mail: ${email}`;
      try {
        await navigator.clipboard.writeText(text);
        UIComponents.showToast('Credentials copied.', 'success');
      } catch (e) {
        UIComponents.showToast('Copy failed — please note them manually.', 'warning');
      }
    });
    document.getElementById('cred-print').addEventListener('click', () => {
      exportPdf(`Staff-Login-${username || 'staff'}`, `
        <div class="doc-title">${esc(TMS_CONFIG.institution.name)}</div>
        <div class="doc-sub">Staff Portal Login Slip</div>
        <table>
          <tbody>
            <tr><th style="text-align:left;">Name</th><td>${esc(name)}</td></tr>
            <tr><th style="text-align:left;">Username</th><td>${esc(username)}</td></tr>
            <tr><th style="text-align:left;">Password</th><td>${esc(password)}</td></tr>
            <tr><th style="text-align:left;">Sign-in e-mail</th><td>${esc(email)}</td></tr>
          </tbody>
        </table>
        <p style="margin-top:14px; font-size:11px;">Keep this slip confidential and change the password after the first sign-in.</p>
      `);
    });
    UIComponents.refreshIcons();
  }

  static async openCredentialsModal(emp, container) {
    let cred = await staffService.getCredentials(emp.id);

    if (!cred) {
      const bodyHtml = `
        <p style="margin-bottom:14px;">No login has been issued for <strong>${esc(emp.name)}</strong> yet.</p>
        <div class="form-group">
          <label class="form-label">Username (blank = auto)</label>
          <input class="form-input font-mono" id="cu-username">
        </div>
        <div class="form-group">
          <label class="form-label">Password (blank = auto)</label>
          <input class="form-input font-mono" id="cu-password">
        </div>
      `;
      const footerHtml = `
        <button class="btn btn-secondary" id="cu-cancel">Cancel</button>
        <button class="btn btn-primary" id="cu-create"><i data-lucide="user-plus"></i> Create Login</button>
      `;
      UIComponents.openModal({ title: `Login — ${emp.name}`, bodyHtml, footerHtml });
      document.getElementById('cu-cancel').addEventListener('click', () => UIComponents.closeModal());
      document.getElementById('cu-create').addEventListener('click', async () => {
        const username = document.getElementById('cu-username').value.trim() || null;
        const password = document.getElementById('cu-password').value || null;
        const res = await staffService.provision({
          staffId: emp.id,
          name: emp.name,
          email: emp.email,
          role: emp.role,
          title: emp.designation,
          department: emp.department,
          assignedClass: emp.assignedClass,
          assignedSection: emp.assignedSection,
          username,
          password
        });
        if (!res.userId) {
          UIComponents.showToast(`Could not create the login: ${res.error || 'unknown error'}`, 'danger');
          return;
        }
        await dbService.update('staff', emp.id, { userId: res.userId });
        await auditService.log('STAFF_LOGIN_CREATED', 'HR', { staffId: emp.id, username: res.username }, emp.id);
        UIComponents.closeModal();
        this.showCredentialsModal({ name: emp.name, email: emp.email, username: res.username, password: res.password, title: 'Staff Login Created' });
        await StaffModule.render(container);
      });
      UIComponents.refreshIcons();
      return;
    }

    cred = { ...cred };
    const bodyHtml = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
        <div class="form-group">
          <label class="form-label">Username</label>
          <input class="form-input font-mono" id="cu-username" value="${esc(cred.username || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Sign-in e-mail</label>
          <input class="form-input font-mono" id="cu-email" value="${esc(cred.email || emp.email || '')}">
        </div>
        <div class="form-group" style="grid-column:1/-1;">
          <label class="form-label">Password</label>
          <input class="form-input font-mono" id="cu-password" value="${esc(cred.password || '')}">
          <span style="font-size:0.72rem; color:var(--text-subtle);">Changing the password here also updates the real sign-in password.</span>
        </div>
        <div style="grid-column:1/-1; font-size:0.78rem; color:var(--text-muted);">
          Linked user account: <span class="font-mono">${esc(cred.userId || 'not linked')}</span>
        </div>
        ${cred.userId ? '' : `
        <div style="grid-column:1/-1; padding:10px 12px; border-radius:8px; background:#fffbeb; border:1px solid #fcd34d; color:#92400e; font-size:0.78rem;">
          This login has not been created in the authentication system yet. Click
          <strong>Activate Login</strong> to create it (needed before the staff member can sign in).
        </div>`}
      </div>
    `;
    const footerHtml = `
      <button class="btn btn-secondary" id="cu-cancel">Close</button>
      ${cred.userId ? '' : '<button class="btn btn-primary" id="cu-activate"><i data-lucide="key-round"></i> Activate Login</button>'}
      <button class="btn btn-secondary" id="cu-delete" style="color:#ef4444;"><i data-lucide="trash-2"></i> Delete Login</button>
      <button class="btn btn-primary" id="cu-save"><i data-lucide="save"></i> Save Credentials</button>
    `;
    UIComponents.openModal({ title: `Login — ${emp.name}`, bodyHtml, footerHtml });

    document.getElementById('cu-cancel').addEventListener('click', () => UIComponents.closeModal());

    const activateBtn = document.getElementById('cu-activate');
    if (activateBtn) {
      activateBtn.addEventListener('click', async () => {
        activateBtn.disabled = true;
        activateBtn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Activating…';
        UIComponents.refreshIcons();
        const username = document.getElementById('cu-username').value.trim() || cred.username;
        const email = document.getElementById('cu-email').value.trim() || cred.email;
        const password = document.getElementById('cu-password').value || cred.password;
        const res = await staffService.provision({
          staffId: emp.id,
          name: emp.name,
          email,
          role: emp.role,
          title: emp.designation,
          department: emp.department,
          assignedClass: emp.assignedClass,
          assignedSection: emp.assignedSection,
          username,
          password
        });
        if (!res.userId) {
          UIComponents.showToast(`Could not activate the login: ${res.error || 'unknown error'}`, 'danger');
          activateBtn.disabled = false;
          activateBtn.innerHTML = '<i data-lucide="key-round"></i> Activate Login';
          UIComponents.refreshIcons();
          return;
        }
        await dbService.update('staff', emp.id, { userId: res.userId });
        await auditService.log('STAFF_LOGIN_ACTIVATED', 'HR', { staffId: emp.id, username: res.username }, emp.id);
        UIComponents.closeModal();
        this.showCredentialsModal({ name: emp.name, email, username: res.username, password: res.password, title: 'Staff Login Activated' });
        await StaffModule.render(container);
      });
    }
    document.getElementById('cu-save').addEventListener('click', async () => {
      const username = document.getElementById('cu-username').value.trim();
      const email = document.getElementById('cu-email').value.trim();
      const password = document.getElementById('cu-password').value;
      if (!username || !email) { UIComponents.showToast('Username and e-mail are required.', 'warning'); return; }
      const res = await staffService.updateCredentials(cred, { username, email, password, role: emp.role });
      if (res.error) { UIComponents.showToast(`Could not save credentials: ${res.error}`, 'danger'); return; }
      await auditService.log('STAFF_CREDENTIALS_UPDATED', 'HR', { staffId: emp.id, username }, emp.id);
      UIComponents.showToast('Credentials updated.', 'success');
      UIComponents.closeModal();
      await StaffModule.render(container);
    });
    document.getElementById('cu-delete').addEventListener('click', async () => {
      if (!confirm('Delete this staff login? The staff record will be kept but they will no longer be able to sign in.')) return;
      await staffService.removeCredentials(emp.id);
      const del = await staffService.deleteUserAccount(cred.userId);
      if (!del.success) UIComponents.showToast(`Credentials removed, but the login account could not be deleted: ${del.error}`, 'warning');
      if (del.success) await dbService.update('staff', emp.id, { userId: null });
      await auditService.log('STAFF_CREDENTIALS_DELETED', 'HR', { staffId: emp.id }, emp.id);
      UIComponents.showToast('Staff login deleted.', 'success');
      UIComponents.closeModal();
      await StaffModule.render(container);
    });
    UIComponents.refreshIcons();
  }

  /* ------------------------------------------------------------------ */
  /* Delete / bulk                                                       */
  /* ------------------------------------------------------------------ */

  static async deleteStaff(rows, container) {
    const names = rows.map((r) => r.name).join(', ');
    const label = rows.length === 1 ? `Delete ${names}?` : `Delete ${rows.length} staff members?`;
    if (!confirm(`${label}\n\nThis removes their employee record, login credentials and portal account. This cannot be undone.`)) return;

    for (const emp of rows) {
      // eslint-disable-next-line no-await-in-loop
      const cred = await staffService.getCredentials(emp.id);
      // eslint-disable-next-line no-await-in-loop
      if (cred) await staffService.removeCredentials(emp.id);
      // eslint-disable-next-line no-await-in-loop
      const del = await staffService.deleteUserAccount(emp.userId || (cred && cred.userId));
      if (!del.success && del.error) {
        UIComponents.showToast(`Login for ${emp.name} could not be removed: ${del.error}`, 'warning');
      }
      // eslint-disable-next-line no-await-in-loop
      await dbService.delete('staff', emp.id);
      // eslint-disable-next-line no-await-in-loop
      await auditService.log('STAFF_DELETED', 'HR', { staffId: emp.id, empId: emp.empId, name: emp.name }, emp.id);
    }

    UIComponents.showToast(`${rows.length} staff member(s) deleted.`, 'success');
    await StaffModule.render(container);
  }

  static async bulkSetStatus(rows, status, container) {
    if (!rows.length) { UIComponents.showToast('Select at least one staff member.', 'warning'); return; }
    for (const emp of rows) {
      // eslint-disable-next-line no-await-in-loop
      await dbService.update('staff', emp.id, { status });
      if (emp.userId) {
        // Reflect the active flag on the linked login too.
        // eslint-disable-next-line no-await-in-loop
        await dbService.update('profiles', emp.userId, { isActive: status === 'Active' });
      }
    }
    await auditService.log('STAFF_BULK_STATUS', 'HR', { status, count: rows.length });
    UIComponents.showToast(`${rows.length} staff member(s) set to ${status}.`, 'success');
    await StaffModule.render(container);
  }

  static exportCsv(rows) {
    const list = rows || [];
    if (!list.length) { UIComponents.showToast('Nothing to export.', 'warning'); return; }
    const header = ['Emp ID', 'Name', 'Email', 'Role', 'Department', 'Designation', 'Phone', 'Joined', 'Status', 'Username'];
    const data = list.map((s) => {
      const cred = (this._credByStaff || {})[s.id];
      return [
        s.empId, s.name, s.email, s.role, s.department, s.designation,
        s.phone, s.joiningDate, s.status, cred ? cred.username : ''
      ];
    });
    downloadCsv(`TMS-Staff-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...data]);
    UIComponents.showToast('Staff CSV exported.', 'success');
  }
}

export default StaffModule;
