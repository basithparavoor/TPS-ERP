/**
 * THAIBA PUBLIC SCHOOL — Student Lifecycle, Admissions & Identity Module
 */

import { TMS_CONFIG } from './config.js';
import { dbService } from './supabase-client.js';
import { UIComponents } from './ui-components.js';
import { auditService } from './audit-service.js';
import { PermissionEngine, CAPABILITIES } from './permission-engine.js';
import { downloadCsv } from './export-utils.js';
import { TMS_LOGO } from './logo.js';
import { admissionService } from './admission-service.js';

export class StudentModule {
  static async render(container) {
    const students = await dbService.select('students');
    const esc = (v) => UIComponents.escapeHtml(v);
    const canManage = PermissionEngine.can(CAPABILITIES.MANAGE_STUDENTS);

    const applications = await dbService.select('admissions_applications');
    const invoices = await dbService.select('invoices');
    this._students = students;
    const totalBilled = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const totalCollected = invoices.reduce((sum, inv) => sum + (inv.paid || 0), 0);
    const clearanceValue = totalBilled > 0 ? `${((totalCollected / totalBilled) * 100).toFixed(1)}%` : '—';

    container.innerHTML = `
      <div style="margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
          <div>
            <h1 style="font-size: 1.8rem;">Student Lifecycle & Directory</h1>
            <p style="color: var(--text-muted); font-size: 0.9rem;">
              Student information system, admissions pipeline, guardian records, and printable biometric ID cards.
            </p>
          </div>
          <div style="display: flex; gap: 10px; flex-wrap:wrap;">
            <button class="btn btn-secondary" id="btn-infirmary-roster"><i data-lucide="cross"></i> Medical &amp; Infirmary Roster</button>
            <button class="btn btn-secondary" id="btn-bulk-print-id-cards"><i data-lucide="printer"></i> Bulk Print PVC ID Cards</button>
            <a href="student-admission-portal.html" target="_blank" class="btn btn-secondary"><i data-lucide="file-text"></i> Admission Form (A4)</a>
            ${canManage ? `<button class="btn btn-primary" id="btn-new-admission"><i data-lucide="user-plus"></i> New Enrollment</button>` : ''}
          </div>
        </div>
      </div>

      <div class="kpi-grid">
        ${UIComponents.renderKpiCard({ title: 'Total Enrolled Students', value: `${students.length}`, icon: 'users', color: 'blue', subtitle: TMS_CONFIG.academic.currentYear })}
        ${UIComponents.renderKpiCard({ title: 'Active Students', value: `${students.filter(s => s.status === 'Active').length}`, icon: 'check-circle', color: 'emerald', subtitle: 'Regular Attendance' })}
        ${UIComponents.renderKpiCard({ title: 'New Admissions', value: `${applications.length} Applied`, icon: 'file-text', color: 'amber', subtitle: 'Submitted Applications' })}
        ${UIComponents.renderKpiCard({ title: 'Fee Clearance Ratio', value: clearanceValue, icon: 'receipt', color: 'rose', subtitle: 'Term 1 Invoices' })}
      </div>

      <!-- Students List Card -->
      <div class="card">
        <div class="card-header">
          <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap; width: 100%;">
            <div>
              <h3 class="card-title">Enrolled Students Roster</h3>
              <p class="card-desc" style="margin-top: 2px;">Comprehensive student profiles with zero horizontal scrolling.</p>
            </div>
            <div style="margin-left: auto; display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
              <div class="tms-view-toggle" id="student-view-toggle">
                <button type="button" class="view-btn" data-view="cards" title="Switch to Cards View">
                  <i data-lucide="layout-grid"></i> Cards
                </button>
                <button type="button" class="view-btn" data-view="table" title="Switch to Table View">
                  <i data-lucide="table"></i> Table
                </button>
              </div>
              <input type="text" class="form-input" id="search-student-input" placeholder="Search by name or admission no..." style="width: 250px; padding: 6px 12px;">
            </div>
          </div>
        </div>

        ${canManage ? `
        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:12px;">
          <button class="btn btn-secondary btn-sm" id="btn-students-select-all"><i data-lucide="check-square"></i> Select All</button>
          <button class="btn btn-secondary btn-sm" id="btn-students-clear">Clear</button>
          <button class="btn btn-secondary btn-sm" id="btn-students-bulk-activate"><i data-lucide="check-circle"></i> Set Active</button>
          <button class="btn btn-secondary btn-sm" id="btn-students-bulk-export"><i data-lucide="download"></i> Export Selected</button>
          <button class="btn btn-secondary btn-sm" id="btn-students-bulk-delete" style="color:#ef4444;"><i data-lucide="trash-2"></i> Delete Selected (<span id="students-selected-count">0</span>)</button>
        </div>` : ''}

        <!-- Cards View (Default on Mobile, zero side scroll) -->
        <div id="students-cards-view-container" class="tms-cards-grid">
          ${students.length ? students.map(s => `
            <div class="tms-data-card student-card" data-student-card="${esc(s.id)}">
              <div class="tms-data-card-header">
                <div style="display: flex; gap: 10px; align-items: center;">
                  ${canManage ? `<input type="checkbox" class="student-row-check" value="${esc(s.id)}">` : ''}
                  <div>
                    <div class="tms-data-card-title">${esc(s.fullName)}</div>
                    <div class="tms-data-card-subtitle font-mono">${esc(s.admissionNo)} • Roll: ${esc(s.rollNo || '—')}</div>
                  </div>
                </div>
                <span class="badge ${s.status === 'Active' ? 'badge-success' : 'badge-warning'}">${esc(s.status)}</span>
              </div>
              <div class="tms-data-card-body">
                <div class="tms-data-card-row">
                  <span class="tms-data-card-label">Class & Section</span>
                  <span class="tms-data-card-value">${esc(s.grade)} - ${esc(s.section)}</span>
                </div>
                <div class="tms-data-card-row">
                  <span class="tms-data-card-label">Blood Group</span>
                  <span class="tms-data-card-value">${esc(s.bloodGroup || s.blood_group || '—')}</span>
                </div>
                <div class="tms-data-card-row">
                  <span class="tms-data-card-label">Guardian</span>
                  <span class="tms-data-card-value">${esc(s.guardianName || '—')}</span>
                </div>
                <div class="tms-data-card-row">
                  <span class="tms-data-card-label">Contact</span>
                  <span class="tms-data-card-value">
                    ${s.guardianPhone ? `<a href="tel:${esc(s.guardianPhone)}" style="color: #16a34a; text-decoration: none; font-family: var(--font-mono);">${esc(s.guardianPhone)}</a>` : '—'}
                  </span>
                </div>
                ${(s.allergies || s.medical_conditions) ? `
                  <div class="tms-data-card-row full-width">
                    <span class="badge badge-danger" style="font-size: 0.72rem; align-self: flex-start;">
                      <i data-lucide="alert-circle" style="width: 12px; height: 12px; display: inline;"></i> ${esc(s.allergies ? `Allergy: ${s.allergies}` : s.medical_conditions)}
                    </span>
                  </div>
                ` : ''}
              </div>
              <div class="tms-data-card-actions">
                <button class="btn btn-secondary btn-sm btn-print-id" data-id="${esc(s.id)}" title="Print ID Card"><i data-lucide="id-card"></i> ID</button>
                <button class="btn btn-secondary btn-sm btn-merit-log" data-id="${esc(s.id)}" title="Merits &amp; Conduct" style="color: #16a34a;"><i data-lucide="shield-check"></i> Merit</button>
                <button class="btn btn-secondary btn-sm btn-view-profile" data-id="${esc(s.id)}" title="View Details"><i data-lucide="eye"></i> View</button>
                ${canManage ? `
                  <button class="btn btn-secondary btn-sm btn-edit-student" data-id="${esc(s.id)}" title="Edit student"><i data-lucide="pencil"></i></button>
                  <button class="btn btn-secondary btn-sm btn-del-student" data-id="${esc(s.id)}" title="Delete student" style="color:#ef4444;"><i data-lucide="trash-2"></i></button>
                ` : ''}
              </div>
            </div>
          `).join('') : '<p style="text-align:center; color:var(--text-muted); padding:30px; grid-column: 1 / -1;">No students enrolled yet.</p>'}
        </div>

        <!-- Table View -->
        <div class="table-responsive" id="students-table-view-container" style="display: none; margin-top: 14px;">
          <table class="tms-table" id="students-table">
            <thead>
              <tr>
                ${canManage ? '<th style="width:34px;"><input type="checkbox" id="students-select-all-cb"></th>' : ''}
                <th>Admission No</th>
                <th>Roll</th>
                <th>Student Full Name</th>
                <th>Class & Section</th>
                <th>Guardian Contact</th>
                <th>Blood Group</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${students.length ? students.map(s => `
                <tr data-student-row="${esc(s.id)}">
                  ${canManage ? `<td><input type="checkbox" class="student-row-check" value="${esc(s.id)}"></td>` : ''}
                  <td><span class="font-mono" style="font-weight: 600;">${esc(s.admissionNo)}</span></td>
                  <td><strong>${esc(s.rollNo)}</strong></td>
                  <td>
                    <strong>${esc(s.fullName)}</strong>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${esc(s.gender)} • DOB: ${esc(s.dob)}</div>
                    ${s.allergies || s.medical_conditions ? `
                      <div style="margin-top: 3px;">
                        <span class="badge badge-danger" style="font-size: 0.65rem; padding: 1px 5px;" title="${esc(s.allergies || s.medical_conditions)}">
                          <i data-lucide="alert-circle" style="width: 10px; height: 10px; display: inline;"></i> ${esc(s.allergies ? `Allergy: ${s.allergies}` : s.medical_conditions)}
                        </span>
                      </div>
                    ` : ''}
                  </td>
                  <td>${esc(s.grade)} - ${esc(s.section)}</td>
                  <td>
                    <div>${esc(s.guardianName)}</div>
                    <small style="color: var(--text-muted); font-family: var(--font-mono);">${esc(s.guardianPhone)}</small>
                  </td>
                  <td><span class="badge ${s.bloodGroup ? 'badge-info' : 'badge-secondary'}" style="font-weight: 700;">${esc(s.bloodGroup || s.blood_group || '—')}</span></td>
                  <td><span class="badge ${s.status === 'Active' ? 'badge-success' : 'badge-warning'}">${esc(s.status)}</span></td>
                  <td>
                    <div style="display: flex; gap: 6px; flex-wrap:wrap;">
                      <button class="btn btn-secondary btn-sm btn-print-id" data-id="${esc(s.id)}" title="Print ID Card"><i data-lucide="id-card"></i> ID</button>
                      <button class="btn btn-secondary btn-sm btn-merit-log" data-id="${esc(s.id)}" title="Merits &amp; Demerits / Conduct" style="color: #16a34a;"><i data-lucide="shield-check"></i> Merit</button>
                      <button class="btn btn-secondary btn-sm btn-view-profile" data-id="${esc(s.id)}" title="View Details"><i data-lucide="eye"></i> View</button>
                      ${canManage ? `
                      <button class="btn btn-secondary btn-sm btn-edit-student" data-id="${esc(s.id)}" title="Edit student"><i data-lucide="pencil"></i></button>
                      <button class="btn btn-secondary btn-sm btn-del-student" data-id="${esc(s.id)}" title="Delete student" style="color:#ef4444;"><i data-lucide="trash-2"></i></button>` : ''}
                    </div>
                  </td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="${canManage ? 9 : 8}" style="text-align: center; color: var(--text-muted); padding: 30px;">No records available yet.</td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    `;

    this.bindEvents(container);
    UIComponents.refreshIcons();
  }

  static openStudentEditModal(student, container) {
    const esc = (v) => UIComponents.escapeHtml(v);
    const s = student || {};
    const bodyHtml = `
      <form id="form-edit-student">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
          <div class="form-group">
            <label class="form-label">Admission No</label>
            <input class="form-input font-mono" id="ed-admission" value="${esc(s.admissionNo || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">Roll No</label>
            <input class="form-input" id="ed-roll" value="${esc(s.rollNo || '')}">
          </div>
          <div class="form-group" style="grid-column:1/-1;">
            <label class="form-label">Full Name *</label>
            <input class="form-input" id="ed-name" value="${esc(s.fullName || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">Gender</label>
            <select class="form-select" id="ed-gender">
              <option ${s.gender === 'Male' ? 'selected' : ''}>Male</option>
              <option ${s.gender === 'Female' ? 'selected' : ''}>Female</option>
              <option ${s.gender === 'Other' ? 'selected' : ''}>Other</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Date of Birth</label>
            <input type="date" class="form-input" id="ed-dob" value="${esc((s.dob || '').slice(0, 10))}">
          </div>
          <div class="form-group">
            <label class="form-label">Class / Grade</label>
            <select class="form-select" id="ed-grade">
              ${TMS_CONFIG.academic.classes.map((c) => `<option ${s.grade === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Section</label>
            <select class="form-select" id="ed-section">
              ${TMS_CONFIG.academic.sections.map((sec) => `<option ${s.section === sec ? 'selected' : ''}>${esc(sec)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Guardian Name</label>
            <input class="form-input" id="ed-guardian" value="${esc(s.guardianName || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">Guardian Phone</label>
            <input class="form-input" id="ed-phone" value="${esc(s.guardianPhone || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">Blood Group</label>
            <select class="form-select" id="ed-blood">
              ${['', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(b => `<option value="${b}" ${(s.bloodGroup === b || s.blood_group === b) ? 'selected' : ''}>${b || 'Not Recorded'}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-select" id="ed-status">
              <option ${s.status === 'Active' || !s.status ? 'selected' : ''}>Active</option>
              <option ${s.status === 'Inactive' ? 'selected' : ''}>Inactive</option>
              <option ${s.status === 'On Leave' ? 'selected' : ''}>On Leave</option>
              <option ${s.status === 'Transferred' ? 'selected' : ''}>Transferred</option>
            </select>
          </div>
          <div class="form-group" style="grid-column:1/-1;">
            <label class="form-label">Address</label>
            <input class="form-input" id="ed-address" value="${esc(s.address || '')}">
          </div>

          <!-- Medical & Emergency Information -->
          <div style="grid-column:1/-1; border-top:1px dashed var(--border-color); padding-top:10px; margin-top:4px;">
            <div style="font-weight:700; color:#dc2626; font-size:0.85rem; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
              <i data-lucide="cross"></i> Medical, Health &amp; Emergency Alert Records
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Known Allergies (Food / Medication)</label>
            <input class="form-input" id="ed-allergies" placeholder="e.g. Peanuts, Penicillin, Dust" value="${esc(s.allergies || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">Chronic Conditions / Physical Limitations</label>
            <input class="form-input" id="ed-conditions" placeholder="e.g. Asthma (Inhaler), Type 1 Diabetes, Epilepsy" value="${esc(s.medical_conditions || s.medicalConditions || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">Emergency Physician / Clinic</label>
            <input class="form-input" id="ed-physician" placeholder="e.g. Dr. B. Sen (Kolkata)" value="${esc(s.emergency_physician || s.emergencyPhysician || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">Emergency Hospital / Ambulance Contact</label>
            <input class="form-input font-mono" id="ed-hospital-phone" placeholder="e.g. +91 98300 12345" value="${esc(s.emergency_hospital_phone || s.emergencyHospitalPhone || '')}">
          </div>
        </div>
      </form>
    `;
    const footerHtml = `
      <button class="btn btn-secondary" id="ed-cancel">Cancel</button>
      <button class="btn btn-secondary" id="ed-delete" style="color:#ef4444;"><i data-lucide="trash-2"></i> Delete</button>
      <button class="btn btn-primary" id="ed-save"><i data-lucide="save"></i> Save Changes</button>
    `;
    UIComponents.openModal({ title: `Edit Student — ${s.fullName || ''}`, bodyHtml, footerHtml });

    document.getElementById('ed-cancel').addEventListener('click', () => UIComponents.closeModal());
    document.getElementById('ed-delete').addEventListener('click', () => {
      UIComponents.closeModal();
      this.deleteStudents([s], container);
    });
    document.getElementById('ed-save').addEventListener('click', async () => {
      const name = document.getElementById('ed-name').value.trim();
      if (!name) { UIComponents.showToast('Student name is required.', 'warning'); return; }
      const res = await dbService.update('students', s.id, {
        admissionNo: document.getElementById('ed-admission').value.trim(),
        rollNo: document.getElementById('ed-roll').value.trim(),
        fullName: name,
        gender: document.getElementById('ed-gender').value,
        dob: document.getElementById('ed-dob').value || null,
        grade: document.getElementById('ed-grade').value,
        section: document.getElementById('ed-section').value,
        guardianName: document.getElementById('ed-guardian').value.trim(),
        guardianPhone: document.getElementById('ed-phone').value.trim(),
        bloodGroup: document.getElementById('ed-blood').value.trim(),
        blood_group: document.getElementById('ed-blood').value.trim(),
        allergies: document.getElementById('ed-allergies').value.trim(),
        medical_conditions: document.getElementById('ed-conditions').value.trim(),
        emergency_physician: document.getElementById('ed-physician').value.trim(),
        emergency_hospital_phone: document.getElementById('ed-hospital-phone').value.trim(),
        address: document.getElementById('ed-address').value.trim(),
        status: document.getElementById('ed-status').value
      });
      if (res && res._syncError) { UIComponents.showToast(`Could not save: ${res._syncError}`, 'danger'); return; }
      await auditService.log('STUDENT_UPDATED', 'STUDENTS', { studentId: s.id, name }, s.id);
      UIComponents.showToast('Student details updated.', 'success');
      UIComponents.closeModal();
      await StudentModule.render(container);
    });
    UIComponents.refreshIcons();
  }

  static async deleteStudents(rows, container) {
    const label = rows.length === 1 ? `Delete ${rows[0].fullName}?` : `Delete ${rows.length} selected students?`;
    const ok = await UIComponents.confirm({
      title: 'Delete Student Record(s)',
      message: `Are you sure you want to proceed? ${label} This removes student records, guardian links, and credentials permanently.`,
      confirmText: 'Delete Permanently',
      cancelText: 'Cancel',
      type: 'danger',
      icon: 'trash-2'
    });
    if (!ok) return;
    for (const s of rows) {
      // eslint-disable-next-line no-await-in-loop
      await dbService.delete('students', s.id);
      // eslint-disable-next-line no-await-in-loop
      await auditService.log('STUDENT_DELETED', 'STUDENTS', { studentId: s.id, admissionNo: s.admissionNo, name: s.fullName }, s.id);
    }
    UIComponents.showToast(`${rows.length} student(s) deleted.`, 'success');
    await StudentModule.render(container);
  }

  static bindEvents(container) {
    // View Switcher (Cards vs Table)
    const viewToggle = container.querySelector('#student-view-toggle');
    const cardsContainer = container.querySelector('#students-cards-view-container');
    const tableContainer = container.querySelector('#students-table-view-container');
    const savedView = localStorage.getItem('tms_student_view_mode') || (window.innerWidth <= 768 ? 'cards' : 'cards');

    const setView = (mode) => {
      localStorage.setItem('tms_student_view_mode', mode);
      if (viewToggle) {
        viewToggle.querySelectorAll('.view-btn').forEach((b) => {
          b.classList.toggle('active', b.dataset.view === mode);
        });
      }
      if (cardsContainer) cardsContainer.style.display = mode === 'cards' ? 'grid' : 'none';
      if (tableContainer) tableContainer.style.display = mode === 'table' ? 'block' : 'none';
    };

    if (viewToggle) {
      viewToggle.querySelectorAll('.view-btn').forEach((b) => {
        b.addEventListener('click', () => setView(b.dataset.view));
      });
    }
    setView(savedView);

    const searchInput = container.querySelector('#search-student-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        // Filter table rows
        const rows = container.querySelectorAll('#students-table tbody tr');
        rows.forEach(row => {
          const text = row.innerText.toLowerCase();
          row.style.display = text.includes(query) ? '' : 'none';
        });
        // Filter cards
        const cards = container.querySelectorAll('.student-card');
        cards.forEach(card => {
          const text = card.innerText.toLowerCase();
          card.style.display = text.includes(query) ? 'flex' : 'none';
        });
      });
    }

    /* ---- Selection, bulk actions, edit & delete ---- */
    const students = this._students || [];
    const canManage = PermissionEngine.can(CAPABILITIES.MANAGE_STUDENTS);
    const checked = () => Array.from(container.querySelectorAll('.student-row-check:checked')).map((c) => c.value);
    const syncCount = () => {
      const el = container.querySelector('#students-selected-count');
      if (el) el.innerText = checked().length;
    };
    const selectedStudents = () => students.filter((s) => checked().includes(s.id));

    container.querySelectorAll('.student-row-check').forEach((c) => c.addEventListener('change', syncCount));
    const selectAllCb = container.querySelector('#students-select-all-cb');
    if (selectAllCb) {
      selectAllCb.addEventListener('change', () => {
        container.querySelectorAll('.student-row-check').forEach((c) => { c.checked = selectAllCb.checked; });
        syncCount();
      });
    }
    const selectAllBtn = container.querySelector('#btn-students-select-all');
    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', () => {
        container.querySelectorAll('.student-row-check').forEach((c) => { c.checked = true; });
        syncCount();
      });
    }
    const clearBtn = container.querySelector('#btn-students-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        container.querySelectorAll('.student-row-check').forEach((c) => { c.checked = false; });
        syncCount();
      });
    }
    const bulkDelete = container.querySelector('#btn-students-bulk-delete');
    if (bulkDelete) {
      bulkDelete.addEventListener('click', () => {
        const rows = selectedStudents();
        if (!rows.length) { UIComponents.showToast('Select at least one student.', 'warning'); return; }
        this.deleteStudents(rows, container);
      });
    }
    const bulkActivate = container.querySelector('#btn-students-bulk-activate');
    if (bulkActivate) {
      bulkActivate.addEventListener('click', async () => {
        const rows = selectedStudents();
        if (!rows.length) { UIComponents.showToast('Select at least one student.', 'warning'); return; }
        for (const s of rows) {
          // eslint-disable-next-line no-await-in-loop
          await dbService.update('students', s.id, { status: 'Active' });
        }
        UIComponents.showToast(`${rows.length} student(s) set to Active.`, 'success');
        await StudentModule.render(container);
      });
    }
    const bulkExport = container.querySelector('#btn-students-bulk-export');
    if (bulkExport) {
      bulkExport.addEventListener('click', () => {
        const rows = selectedStudents();
        if (!rows.length) { UIComponents.showToast('Select at least one student.', 'warning'); return; }
        const header = ['Admission No', 'Roll', 'Name', 'Gender', 'DOB', 'Class', 'Section', 'Guardian', 'Phone', 'Blood', 'Status'];
        const data = rows.map((s) => [s.admissionNo, s.rollNo, s.fullName, s.gender, s.dob, s.grade, s.section, s.guardianName, s.guardianPhone, s.bloodGroup, s.status]);
        downloadCsv(`TMS-Students-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...data]);
        UIComponents.showToast('Selected students exported.', 'success');
      });
    }
    container.querySelectorAll('.btn-edit-student').forEach((b) =>
      b.addEventListener('click', () => {
        const s = students.find((x) => x.id === b.dataset.id);
        if (s) this.openStudentEditModal(s, container);
      }));
    container.querySelectorAll('.btn-del-student').forEach((b) =>
      b.addEventListener('click', () => {
        const s = students.find((x) => x.id === b.dataset.id);
        if (s) this.deleteStudents([s], container);
      }));

    const newAdmBtn = container.querySelector('#btn-new-admission');
    if (newAdmBtn) {
      newAdmBtn.addEventListener('click', () => {
        UIComponents.openModal({
          title: 'Enroll New Student — THAIBA PUBLIC SCHOOL',
          bodyHtml: `
            <form id="form-enroll-student">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
                <div class="form-group">
                  <label class="form-label">Full Name</label>
                  <input class="form-input" id="adm-fullname" required placeholder="e.g. Adil Mansoor">
                </div>
                <div class="form-group">
                  <label class="form-label">Date of Birth</label>
                  <input type="date" class="form-input" id="adm-dob" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Gender</label>
                  <select class="form-select" id="adm-gender">
                    <option>Male</option>
                    <option>Female</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Blood Group</label>
                  <select class="form-select" id="adm-blood">
                    <option>O+</option><option>O-</option><option>A+</option><option>A-</option>
                    <option>B+</option><option>B-</option><option>AB+</option><option>AB-</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Class / Grade</label>
                  <select class="form-select" id="adm-grade">
                    ${TMS_CONFIG.academic.classes.map(c => `<option value="${c}">${c}</option>`).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Section</label>
                  <select class="form-select" id="adm-section">
                    <option>A</option><option>B</option><option>C</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Guardian Name</label>
                  <input class="form-input" id="adm-guardian" required placeholder="Father / Mother Name">
                </div>
                <div class="form-group">
                  <label class="form-label">Guardian Phone</label>
                  <input class="form-input" id="adm-phone" required placeholder="+91 98470 00000">
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Residential Address</label>
                <textarea class="form-textarea" id="adm-address" rows="2" placeholder="Full residential address"></textarea>
              </div>
            </form>
          `,
          footerHtml: `
            <button class="btn btn-secondary" onclick="document.getElementById('global-modal-close').click()">Cancel</button>
            <button class="btn btn-primary" id="btn-save-enrollment">Confirm Enrollment</button>
          `
        });

        document.getElementById('btn-save-enrollment').addEventListener('click', async () => {
          const fullName = document.getElementById('adm-fullname').value;
          const dob = document.getElementById('adm-dob').value;
          const gender = document.getElementById('adm-gender').value;
          const bloodGroup = document.getElementById('adm-blood').value;
          const grade = document.getElementById('adm-grade').value;
          const section = document.getElementById('adm-section').value;
          const guardianName = document.getElementById('adm-guardian').value;
          const guardianPhone = document.getElementById('adm-phone').value;
          const address = document.getElementById('adm-address').value;

          if (!fullName) {
            UIComponents.showToast('Please enter student full name', 'warning');
            return;
          }

          const existing = await dbService.select('students');
          const maxSeq = existing.reduce((max, s) => {
            const m = String(s.admissionNo || '').match(/(\d+)\s*$/);
            return m ? Math.max(max, parseInt(m[1], 10)) : max;
          }, 0);
          const nextSeq = maxSeq + 1;
          const admissionNo = `TMS/${new Date().getFullYear()}/${nextSeq.toString().padStart(3, '0')}`;
          const rollNo = nextSeq.toString().padStart(2, '0');

          const newStudent = await dbService.insert('students', {
            admissionNo,
            rollNo,
            fullName,
            dob,
            gender,
            bloodGroup,
            grade,
            section,
            guardianName,
            guardianPhone,
            address,
            status: 'Active',
            leaveStatus: null
          });

          if (newStudent._syncError) {
            UIComponents.showToast(`Enrollment could not be saved: ${newStudent._syncError}`, 'danger');
            return;
          }

          await auditService.log('STUDENT_ENROLLED', 'ACADEMIC', { admissionNo, fullName, grade }, newStudent.id);
          UIComponents.closeModal();
          UIComponents.showToast(`Student ${fullName} enrolled with ID ${admissionNo}!`, 'success');
          StudentModule.render(container);
        });
      });
    }

    // Bulk ID Card generator button
    const bulkIdBtn = container.querySelector('#btn-bulk-print-id-cards');
    if (bulkIdBtn) {
      bulkIdBtn.addEventListener('click', () => StudentModule.openBulkIdCardModal());
    }

    // Medical & Infirmary Roster Button
    const infirmaryBtn = container.querySelector('#btn-infirmary-roster');
    if (infirmaryBtn) {
      infirmaryBtn.addEventListener('click', () => StudentModule.openInfirmaryRosterModal(this._students || []));
    }

    // Individual ID Card generator
    container.querySelectorAll('.btn-print-id').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        const students = await dbService.select('students');
        const s = students.find(item => item.id === id);
        if (!s) return;
        await StudentModule.openStudentIdCardModal(s);
      });
    });

    // Merit & Demerit Log Modal
    container.querySelectorAll('.btn-merit-log').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        const students = await dbService.select('students');
        const s = students.find(item => item.id === id);
        if (!s) return;
        await StudentModule.openMeritModal(s, container);
      });
    });

    // Comprehensive Student Profile Modal
    container.querySelectorAll('.btn-view-profile').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        const students = await dbService.select('students');
        const s = students.find(item => item.id === id);
        if (!s) return;
        await StudentModule.openStudentProfileModal(s, container);
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Student Behavioral Merit & Demerit Conduct Ledger                  */
  /* ------------------------------------------------------------------ */
  static async openMeritModal(student, container) {
    const esc = (v) => UIComponents.escapeHtml(v);
    const allMerits = await dbService.select('student_merits') || [];
    const studentMerits = allMerits.filter(m => m.studentId === student.id || m.admissionNo === student.admissionNo);

    // Compute Net Points
    let netScore = 0;
    studentMerits.forEach(m => {
      const pts = parseInt(m.points, 10) || 0;
      if (m.type === 'merit') netScore += pts;
      else netScore -= Math.abs(pts);
    });

    const bodyHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <!-- Student Header -->
        <div style="display: flex; align-items: center; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px;">
          <div>
            <div style="font-size: 1.15rem; font-weight: 800; color: #0f172a;">${esc(student.fullName)}</div>
            <div style="font-size: 0.8rem; color: #64748b;">Adm: <strong class="font-mono">${esc(student.admissionNo)}</strong> • Roll: <strong>${esc(student.rollNo || '—')}</strong> • Class: <strong>${esc(student.grade)} ${esc(student.section || 'A')}</strong></div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.72rem; text-transform: uppercase; color: #64748b; font-weight: 700;">Conduct Score</div>
            <span class="badge ${netScore >= 20 ? 'badge-success' : netScore >= 0 ? 'badge-info' : 'badge-danger'}" style="font-size: 1.05rem; padding: 4px 12px; margin-top: 2px;">
              ${netScore > 0 ? '+' : ''}${netScore} Points
            </span>
          </div>
        </div>

        <!-- Add Award / Demerit Form -->
        <div style="background: #ffffff; border: 1.5px solid #16a34a; border-radius: 8px; padding: 14px; margin-bottom: 16px;">
          <div style="font-size: 0.88rem; font-weight: 700; color: #166534; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
            <i data-lucide="plus-circle" style="width: 16px; height: 16px;"></i> Award Merit Badge or Record Disciplinary Notice
          </div>
          <div style="display: grid; grid-template-columns: 140px 1fr 100px; gap: 10px; margin-bottom: 10px;">
            <div>
              <label class="form-label" style="font-size: 0.75rem;">Action Type</label>
              <select class="form-select" id="inp-merit-type" style="padding: 6px 10px; font-size: 0.82rem;">
                <option value="merit">🌟 Merit Badge</option>
                <option value="demerit">⚠️ Demerit / Notice</option>
              </select>
            </div>
            <div>
              <label class="form-label" style="font-size: 0.75rem;">Category / Recognition</label>
              <select class="form-select" id="inp-merit-cat" style="padding: 6px 10px; font-size: 0.82rem;">
                <option value="Quranic Adab & Sunnah Etiquette|10">🌟 Quranic Adab & Sunnah Etiquette (+10 pts)</option>
                <option value="Academic Excellence & Olympiad|15">📚 Academic Excellence & Olympiad (+15 pts)</option>
                <option value="100% Punctuality & Perfect Attendance|10">⏰ 100% Punctuality & Attendance (+10 pts)</option>
                <option value="Peer Assistance & Campus Service|10">🤝 Peer Assistance & Campus Service (+10 pts)</option>
                <option value="Co-Curricular, Arts & Speech Contest|10">🎨 Co-Curricular & Speech (+10 pts)</option>
                <option value="Late Arrival to Morning Assembly|5">⚠️ Late Arrival to Morning Assembly (-5 pts)</option>
                <option value="Homework Incompletion / Neglect|5">⚠️ Homework Incompletion (-5 pts)</option>
                <option value="Uniform / Dress Code Infraction|5">⚠️ Uniform / Dress Code Infraction (-5 pts)</option>
                <option value="Classroom Disruptive Behavior|10">⚠️ Classroom Disruptive Behavior (-10 pts)</option>
              </select>
            </div>
            <div>
              <label class="form-label" style="font-size: 0.75rem;">Points</label>
              <input type="number" class="form-input font-mono" id="inp-merit-points" value="10" style="padding: 6px 10px; font-size: 0.82rem; text-align: center;">
            </div>
          </div>
          <div style="display: flex; gap: 10px; align-items: flex-end;">
            <div style="flex: 1;">
              <label class="form-label" style="font-size: 0.75rem;">Teacher's Note / Context</label>
              <input type="text" class="form-input" id="inp-merit-notes" placeholder="e.g. Demonstrated exceptional humility and kindness helping Grade 1 students." style="padding: 6px 10px; font-size: 0.82rem;">
            </div>
            <button class="btn btn-primary" id="btn-save-merit-entry" style="padding: 6px 16px; font-size: 0.82rem;">
              <i data-lucide="check"></i> Record Entry
            </button>
          </div>
        </div>

        <!-- History Ledger -->
        <div>
          <div style="font-size: 0.82rem; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px;">
            Conduct &amp; Merit History Timeline:
          </div>
          <div style="max-height: 240px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
            ${studentMerits.length ? `
              <table class="tms-table" style="font-size: 0.8rem;">
                <thead>
                  <tr style="background: #f8fafc;">
                    <th style="width: 80px;">Type</th>
                    <th>Category</th>
                    <th>Teacher's Note</th>
                    <th style="width: 75px; text-align: center;">Points</th>
                    <th style="width: 90px;">Date</th>
                  </tr>
                </thead>
                <tbody>
                  ${studentMerits.map(m => `
                    <tr>
                      <td>
                        <span class="badge ${m.type === 'merit' ? 'badge-success' : 'badge-danger'}" style="font-size: 0.7rem;">
                          ${m.type === 'merit' ? 'MERIT' : 'DEMERIT'}
                        </span>
                      </td>
                      <td><strong>${esc(m.category)}</strong></td>
                      <td style="color: #64748b;">${esc(m.reason || '—')}</td>
                      <td style="text-align: center; font-weight: 700; color: ${m.type === 'merit' ? '#16a34a' : '#dc2626'};" class="font-mono">
                        ${m.type === 'merit' ? '+' : '-'}${Math.abs(m.points)}
                      </td>
                      <td style="font-size: 0.75rem; color: #64748b;">${esc(m.date || (m.createdAt || '').slice(0, 10))}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : `
              <div style="text-align: center; color: var(--text-muted); padding: 24px; font-size: 0.85rem;">
                No merit or discipline events recorded yet for this student. Student is in perfect standing.
              </div>
            `}
          </div>
        </div>
      </div>
    `;

    UIComponents.openModal({
      title: `Student Behavioral & Merit Log — ${student.fullName}`,
      bodyHtml,
      footerHtml: `
        <button class="btn btn-secondary" onclick="document.getElementById('global-modal-close').click()">Close</button>
      `
    });

    UIComponents.refreshIcons();

    // Auto-update points when category changes
    const catSelect = document.getElementById('inp-merit-cat');
    const ptsInput = document.getElementById('inp-merit-points');
    const typeSelect = document.getElementById('inp-merit-type');
    if (catSelect && ptsInput) {
      catSelect.addEventListener('change', () => {
        const parts = catSelect.value.split('|');
        if (parts[1]) ptsInput.value = parts[1];
        if (parts[0].startsWith('⚠️')) {
          typeSelect.value = 'demerit';
        } else {
          typeSelect.value = 'merit';
        }
      });
    }

    // Save entry
    const saveBtn = document.getElementById('btn-save-merit-entry');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const catVal = catSelect.value.split('|')[0];
        const points = parseInt(ptsInput.value, 10) || 10;
        const notes = document.getElementById('inp-merit-notes').value.trim();
        const type = typeSelect.value;

        saveBtn.disabled = true;
        saveBtn.innerText = 'Saving...';

        await dbService.insert('student_merits', {
          studentId: student.id,
          studentName: student.fullName,
          admissionNo: student.admissionNo,
          grade: student.grade,
          type,
          category: catVal,
          points,
          reason: notes,
          date: new Date().toISOString().split('T')[0]
        });

        await auditService.log('MERIT_AWARDED', 'STUDENTS', {
          student: student.fullName,
          admissionNo: student.admissionNo,
          type,
          category: catVal,
          points
        });

        UIComponents.showToast(`${type === 'merit' ? '🌟 Merit badge' : '⚠️ Disciplinary note'} saved!`, 'success');
        StudentModule.openMeritModal(student, container);
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Comprehensive 360-Degree Student Profile Viewer                    */
  /* ------------------------------------------------------------------ */
  static async openStudentProfileModal(student, container) {
    const esc = (v) => UIComponents.escapeHtml(v);
    const [allMerits, allInvoices, allAttendance] = await Promise.all([
      dbService.select('student_merits'),
      dbService.select('invoices'),
      dbService.select('attendance_records')
    ]);

    const merits = (allMerits || []).filter(m => m.studentId === student.id || m.admissionNo === student.admissionNo);
    const invoices = (allInvoices || []).filter(i => i.studentId === student.id || i.admissionNo === student.admissionNo || (i.studentName && i.studentName.toLowerCase() === (student.fullName || '').toLowerCase()));
    const attList = (allAttendance || []).filter(a => a.studentId === student.id || a.admissionNo === student.admissionNo);

    const totalDue = invoices.reduce((s, i) => s + (parseFloat(i.balance) || 0), 0);
    const presentCount = attList.filter(a => a.status === 'present').length;
    const attRate = attList.length ? `${Math.round((presentCount / attList.length) * 100)}%` : '100%';

    let netMerit = 0;
    merits.forEach(m => {
      netMerit += (m.type === 'merit' ? 1 : -1) * (parseInt(m.points, 10) || 0);
    });

    const bodyHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <!-- Header Banner -->
        <div style="display: flex; gap: 16px; align-items: center; background: linear-gradient(135deg, #064e3b, #0f172a); color: #fff; padding: 18px; border-radius: 12px; margin-bottom: 20px;">
          <div style="width: 72px; height: 72px; border-radius: 50%; overflow: hidden; background: #e2e8f0; border: 3px solid #16a34a; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
            ${student.photo ? `<img src="${esc(student.photo)}" style="width: 100%; height: 100%; object-fit: cover;">` : `<span style="font-size: 1.8rem; font-weight: 800; color: #0f172a;">${(student.fullName || 'S').slice(0, 1)}</span>`}
          </div>
          <div style="flex: 1;">
            <div style="font-size: 1.35rem; font-weight: 800; color: #4ade80;">${esc(student.fullName)}</div>
            <div style="font-size: 0.85rem; color: #cbd5e1; margin-top: 2px;">
              Admission: <strong class="font-mono" style="color: #fff;">${esc(student.admissionNo)}</strong> • Roll: <strong>${esc(student.rollNo || '—')}</strong> • Class: <strong>${esc(student.grade)} ${esc(student.section || 'A')}</strong>
            </div>
            <div style="margin-top: 6px; display: flex; gap: 8px;">
              <span class="badge badge-success">${esc(student.status || 'Active')}</span>
              <span class="badge badge-info">Session ${esc(TMS_CONFIG.academic.currentYear)}</span>
            </div>
          </div>
        </div>

        <!-- Metric KPI Cards -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center;">
            <div style="font-size: 0.72rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Attendance Rate</div>
            <div style="font-size: 1.25rem; font-weight: 800; color: #16a34a; margin-top: 2px;">${attRate}</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center;">
            <div style="font-size: 0.72rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Conduct Score</div>
            <div style="font-size: 1.25rem; font-weight: 800; color: ${netMerit >= 0 ? '#16a34a' : '#dc2626'}; margin-top: 2px;">${netMerit > 0 ? '+' : ''}${netMerit} Pts</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center;">
            <div style="font-size: 0.72rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Outstanding Fee</div>
            <div style="font-size: 1.25rem; font-weight: 800; color: ${totalDue > 0 ? '#dc2626' : '#16a34a'}; margin-top: 2px;">₹ ${totalDue.toLocaleString()}</div>
          </div>
        </div>

        <!-- Particulars & Emergency Details -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; font-size: 0.85rem; margin-bottom: 16px;">
          <div><strong>Date of Birth:</strong> ${esc(student.dob || student.dateOfBirth || '—')}</div>
          <div><strong>Gender:</strong> ${esc(student.gender || '—')}</div>
          <div><strong>Blood Group:</strong> <span class="badge badge-info">${esc(student.bloodGroup || student.blood_group || '—')}</span></div>
          <div><strong>Father / Guardian:</strong> ${esc(student.guardianName || student.parentName || '—')}</div>
          <div><strong>Guardian Phone:</strong> <span class="font-mono">${esc(student.guardianPhone || '—')}</span></div>
          <div><strong>Address:</strong> ${esc(student.address || '—')}</div>
          <div style="grid-column: 1/-1; border-top: 1px dashed #cbd5e1; padding-top: 8px; margin-top: 4px;">
            <strong style="color: #dc2626;">Allergies / Medical Notes:</strong>
            <span style="color: #475569;">${esc(student.allergies || student.medical_conditions || 'None recorded.')}</span>
          </div>
        </div>
      </div>
    `;

    UIComponents.openModal({
      title: `Student 360° Profile — ${student.fullName}`,
      bodyHtml,
      footerHtml: `
        <button class="btn btn-secondary" onclick="document.getElementById('global-modal-close').click()">Close</button>
        <button class="btn btn-secondary" id="btn-profile-open-merit" style="color: #16a34a;"><i data-lucide="shield-check"></i> Merit Ledger</button>
        <button class="btn btn-primary" id="btn-profile-print-id"><i data-lucide="id-card"></i> Print ID Badge</button>
      `
    });

    UIComponents.refreshIcons();

    document.getElementById('btn-profile-open-merit')?.addEventListener('click', () => {
      UIComponents.closeModal();
      StudentModule.openMeritModal(student, container);
    });

    document.getElementById('btn-profile-print-id')?.addEventListener('click', () => {
      UIComponents.closeModal();
      StudentModule.openStudentIdCardModal(student);
    });
  }

  static renderIdCardMarkup(s, photoUrl, cardPrefix = 'id-card-qr') {
    const esc = (v) => UIComponents.escapeHtml(v);
    const photoHtml = photoUrl
      ? `<img src="${esc(photoUrl)}" alt="Photo" style="width:100%; height:100%; object-fit:cover; display:block;">`
      : `<div style="width:100%; height:100%; background:#e2e8f0; display:flex; align-items:center; justify-content:center; color:#64748b; font-size:9px; text-align:center;"><i data-lucide="user" style="width:28px;height:28px;color:#94a3b8;"></i></div>`;

    const qrContainerId = `${cardPrefix}-${String(s.id || s.admissionNo).replace(/[^a-zA-Z0-9]/g, '-')}`;

    return `
      <div class="pvc-id-card-pair" style="display:inline-flex; gap:16px; margin:10px; font-family:'Plus Jakarta Sans', sans-serif; text-align:left;">
        <!-- FRONT SIDE -->
        <div class="pvc-card-side" style="width:336px; height:212px; border-radius:12px; background:linear-gradient(135deg, #064e3b 0%, #0f172a 100%); color:#fff; position:relative; overflow:hidden; border:2px solid #16a34a; box-shadow:0 6px 20px rgba(0,0,0,0.25); display:flex; flex-direction:column; justify-content:space-between; padding:12px; box-sizing:border-box;">
          <div style="position:absolute; top:-35px; right:-35px; width:110px; height:110px; border-radius:50%; background:radial-gradient(circle, rgba(34,197,94,0.22) 0%, transparent 70%); pointer-events:none;"></div>
          
          <!-- Header -->
          <div style="display:flex; align-items:center; gap:8px; border-bottom:1px solid rgba(255,255,255,0.2); padding-bottom:6px;">
            <div style="flex-shrink:0;">${TMS_LOGO.emblemSvg(32)}</div>
            <div style="flex:1; line-height:1.15;">
              <div style="font-family:'Outfit', sans-serif; font-size:11.5px; font-weight:800; letter-spacing:0.04em; color:#4ade80; text-transform:uppercase;">
                ${esc(TMS_CONFIG.institution.name)}
              </div>
              <div style="font-size:7px; color:#cbd5e1; letter-spacing:0.02em;">
                Run by : Thaiba Heritage, Kolkata
              </div>
            </div>
            <span style="font-size:7px; background:#16a34a; color:#fff; padding:2px 6px; border-radius:4px; font-weight:800; text-transform:uppercase; letter-spacing:0.05em;">Student</span>
          </div>

          <!-- Body -->
          <div style="display:flex; gap:10px; align-items:center; margin:4px 0;">
            <div style="width:68px; height:82px; border:2px solid #22c55e; border-radius:6px; overflow:hidden; background:#fff; flex-shrink:0;">
              ${photoHtml}
            </div>
            <div style="flex:1; min-width:0; line-height:1.25;">
              <div style="font-size:13px; font-weight:800; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                ${esc(s.fullName || 'Student Name')}
              </div>
              <div style="font-size:9.5px; color:#38bdf8; font-weight:700; margin-bottom:4px;">
                ${esc(s.grade || '')} • Sec ${esc(s.section || 'A')} • Roll #${esc(s.rollNo || '—')}
              </div>
              <div style="font-size:8px; color:#cbd5e1; background:rgba(255,255,255,0.08); padding:4px 6px; border-radius:4px;">
                <div><strong>Adm No:</strong> <span class="font-mono" style="color:#fde047; font-weight:700;">${esc(s.admissionNo || '—')}</span></div>
                <div><strong>Blood:</strong> <span style="color:#ef4444; font-weight:800;">${esc(s.bloodGroup || 'O+')}</span> &nbsp;•&nbsp; <strong>DOB:</strong> ${esc((s.dob || '').slice(0, 10))}</div>
                <div><strong>Emergency:</strong> <span class="font-mono">${esc(s.guardianPhone || '—')}</span></div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(255,255,255,0.15); padding-top:4px; font-size:7px; color:#94a3b8;">
            <div>Session 2027 - 2028 • Smart Campus Pass</div>
            <div id="${qrContainerId}" class="qr-target" data-value="TMS-VERIFY:${esc(s.admissionNo)}:${esc(s.fullName)}" style="width:28px; height:28px; background:#fff; padding:1px; border-radius:3px; display:inline-block;"></div>
          </div>
        </div>

        <!-- BACK SIDE -->
        <div class="pvc-card-side" style="width:336px; height:212px; border-radius:12px; background:#0f172a; color:#cbd5e1; position:relative; overflow:hidden; border:2px solid #334155; box-shadow:0 6px 20px rgba(0,0,0,0.25); display:flex; flex-direction:column; justify-content:space-between; padding:12px; font-size:8px; line-height:1.35; box-sizing:border-box;">
          <div style="border-bottom:1px solid #334155; padding-bottom:4px; display:flex; justify-content:space-between; align-items:center;">
            <strong style="color:#38bdf8; font-size:8.5px; text-transform:uppercase;">Institutional Smart Card</strong>
            <span style="font-size:7px; color:#64748b;">Terms of Issue</span>
          </div>

          <ul style="list-style:disc; margin:4px 0 4px 14px; padding:0; font-size:7.5px; color:#94a3b8;">
            <li>This card is institutional property and must be worn inside campus.</li>
            <li>If found, please return to THAIBA PUBLIC SCHOOL, Baghait, Tapan.</li>
            <li>Lost cards must be reported to the school office immediately.</li>
          </ul>

          <div style="background:rgba(255,255,255,0.04); padding:4px 6px; border-radius:4px; font-size:7.5px; color:#cbd5e1;">
            <div><strong>Parent / Guardian:</strong> ${esc(s.guardianName || '—')}</div>
            <div><strong>Residential Address:</strong> ${esc((s.address || '').slice(0, 50))}</div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:flex-end; border-top:1px solid #334155; padding-top:4px;">
            <div style="font-size:7px; color:#64748b; line-height:1.2;">
              ${esc(TMS_CONFIG.institution.name)}<br>
              Baghait, Tapan, Dakshin Dinajpur - 733127<br>
              Helpline: +91 8653382851, +91 8167782851
            </div>
            <div style="text-align:center;">
              <div style="font-family:'Brush Script MT', cursive, sans-serif; font-size:12px; color:#22c55e; margin-bottom:1px;">Thaiba Authority</div>
              <div style="font-size:7px; font-weight:700; color:#fff; border-top:1px dashed #64748b; padding-top:1px;">Principal / Controller</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  static async openStudentIdCardModal(s) {
    let photoUrl = '';
    if (s.photo) {
      photoUrl = (await admissionService.getSignedUrl('admission-docs', s.photo, 3600)) || '';
    }

    const cardMarkup = StudentModule.renderIdCardMarkup(s, photoUrl, 'single-id-qr');

    UIComponents.openModal({
      title: `Printable Smart PVC ID Card — ${s.fullName}`,
      bodyHtml: `
        <div style="text-align:center; margin-bottom:14px; font-size:0.85rem; color:var(--text-muted);">
          Official CR-80 PVC dimensions (Front &amp; Back). Includes scannable verification QR Code.
        </div>
        <div id="single-id-print-area" style="text-align:center;">
          ${cardMarkup}
        </div>
      `,
      footerHtml: `
        <button class="btn btn-secondary" onclick="document.getElementById('global-modal-close').click()">Close</button>
        <button class="btn btn-primary" id="btn-print-single-card"><i data-lucide="printer"></i> Print PVC Card</button>
      `,
      maxWidth: '780px'
    });

    // Generate real QR code in target element
    setTimeout(() => {
      const qrTarget = document.querySelector('#single-id-print-area .qr-target');
      if (qrTarget && window.QRCode) {
        qrTarget.innerHTML = '';
        new window.QRCode(qrTarget, {
          text: qrTarget.dataset.value || s.admissionNo,
          width: 26,
          height: 26,
          colorDark: '#000000',
          colorLight: '#ffffff',
          correctLevel: window.QRCode.CorrectLevel.M
        });
      }
      UIComponents.refreshIcons();
    }, 50);

    const printBtn = document.getElementById('btn-print-single-card');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        const printContent = document.getElementById('single-id-print-area').innerHTML;
        const win = window.open('', '_blank');
        win.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>ID Card — ${s.fullName}</title>
            <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&family=Plus+Jakarta+Sans:wght@500;600;700;800&family=JetBrains+Mono:wght@700&display=swap" rel="stylesheet">
            <style>
              body { margin: 20px; background: #fff; font-family: 'Plus Jakarta Sans', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              @media print { body { margin: 0; } }
            </style>
          </head>
          <body>
            ${printContent}
            <script>window.onload = function() { window.print(); window.close(); }<\/script>
          </body>
          </html>
        `);
        win.document.close();
      });
    }

    UIComponents.refreshIcons();
  }

  static async openBulkIdCardModal() {
    const students = await dbService.select('students');
    const classes = TMS_CONFIG.academic.classes;

    const bodyHtml = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
        <div>
          <label style="font-size:0.85rem; font-weight:700; margin-right:8px;">Filter by Class:</label>
          <select class="form-select" id="bulk-id-grade-select" style="width:160px; display:inline-block;">
            <option value="all">All Classes (${students.length})</option>
            ${classes.map(c => {
              const count = students.filter(s => s.grade === c).length;
              return `<option value="${c}">${c} (${count})</option>`;
            }).join('')}
          </select>
        </div>
        <div style="font-size:0.82rem; color:var(--text-muted);">
          Generates batch PVC ID card print sheet for cutting and laminating.
        </div>
      </div>
      <div id="bulk-id-preview-container" style="max-height:60vh; overflow-y:auto; text-align:center; padding:10px; background:var(--bg-subtle); border-radius:10px; border:1px solid var(--border-color);">
        <p style="color:var(--text-muted); font-size:0.85rem;">Loading student cards…</p>
      </div>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="document.getElementById('global-modal-close').click()">Close</button>
      <button class="btn btn-primary" id="btn-print-bulk-sheet"><i data-lucide="printer"></i> Print Batch ID Sheet</button>
    `;

    UIComponents.openModal({
      title: 'Bulk PVC Student ID Card Generator',
      bodyHtml,
      footerHtml,
      maxWidth: '920px'
    });

    const container = document.getElementById('bulk-id-preview-container');
    const select = document.getElementById('bulk-id-grade-select');

    const renderBatch = (list) => {
      if (!list.length) {
        container.innerHTML = '<p style="color:var(--text-muted); padding:30px;">No students enrolled in this selection.</p>';
        return;
      }
      container.innerHTML = list.map((s, idx) => StudentModule.renderIdCardMarkup(s, null, `bulk-qr-${idx}`)).join('');

      // Generate QR codes
      setTimeout(() => {
        container.querySelectorAll('.qr-target').forEach((el) => {
          if (window.QRCode) {
            el.innerHTML = '';
            new window.QRCode(el, {
              text: el.dataset.value || 'TMS',
              width: 26,
              height: 26,
              colorDark: '#000000',
              colorLight: '#ffffff',
              correctLevel: window.QRCode.CorrectLevel.M
            });
          }
        });
        UIComponents.refreshIcons();
      }, 50);
    };

    renderBatch(students);

    if (select) {
      select.addEventListener('change', (e) => {
        const val = e.target.value;
        const filtered = val === 'all' ? students : students.filter(s => s.grade === val);
        renderBatch(filtered);
      });
    }

    const printBulkBtn = document.getElementById('btn-print-bulk-sheet');
    if (printBulkBtn) {
      printBulkBtn.addEventListener('click', () => {
        const printContent = container.innerHTML;
        const win = window.open('', '_blank');
        win.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>TMS Student ID Cards — Batch Print</title>
            <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&family=Plus+Jakarta+Sans:wght@500;600;700;800&family=JetBrains+Mono:wght@700&display=swap" rel="stylesheet">
            <style>
              body { margin: 10px; background: #fff; font-family: 'Plus Jakarta Sans', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .pvc-id-card-pair { page-break-inside: avoid; margin-bottom: 20px; }
              @media print { body { margin: 0; } }
            </style>
          </head>
          <body>
            <div style="display:flex; flex-wrap:wrap; justify-content:center;">
              ${printContent}
            </div>
            <script>window.onload = function() { window.print(); window.close(); }<\/script>
          </body>
          </html>
        `);
        win.document.close();
      });
    }

    UIComponents.refreshIcons();
  }

  /* ------------------------------------------------------------------ */
  /* Campus Medical, Allergy & Infirmary Roster (A4 Printable)          */
  /* ------------------------------------------------------------------ */
  static openInfirmaryRosterModal(students) {
    const esc = (v) => UIComponents.escapeHtml(v);
    const dateStr = new Date().toLocaleDateString('en-GB');
    const emblem = TMS_LOGO.emblemSvg(50);

    const bodyHtml = `
      <div id="infirmary-roster-print" style="background:#fff; color:#0f172a; padding:20px; font-family:'Plus Jakarta Sans', sans-serif;">
        <!-- Header -->
        <div style="text-align:center; border-bottom:2px solid #dc2626; padding-bottom:12px; margin-bottom:16px;">
          <div style="display:flex; justify-content:center; margin-bottom:4px;">${emblem}</div>
          <h2 style="font-size:1.3rem; font-weight:800; color:#991b1b; text-transform:uppercase; margin:0;">${esc(TMS_CONFIG.institution.name)}</h2>
          <div style="font-size:0.75rem; color:#64748b; font-weight:600;">CAMPUS HEALTH SERVICES • OFFICIAL STUDENT INFIRMARY &amp; EMERGENCY ROSTER</div>
          <div style="display:inline-block; margin-top:6px; background:#fee2e2; border:1px solid #f87171; color:#991b1b; padding:2px 10px; border-radius:4px; font-size:0.75rem; font-weight:700;">
            Academic Session ${TMS_CONFIG.academic.currentYear} • Confidential Medical Document
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; font-size:0.8rem;">
          <div>Total Pupils Enrolled: <strong>${students.length}</strong></div>
          <div>Report Generated: <strong>${dateStr}</strong></div>
        </div>

        <div class="table-responsive">
          <table class="tms-table" style="font-size:0.76rem; border:1px solid #cbd5e1; width:100%;">
            <thead>
              <tr style="background:#fef2f2; color:#991b1b;">
                <th>Adm No</th>
                <th>Student Name</th>
                <th>Class</th>
                <th>Blood</th>
                <th>Allergies &amp; Alerts</th>
                <th>Chronic Conditions</th>
                <th>Emergency Physician</th>
                <th>Guardian Phone</th>
              </tr>
            </thead>
            <tbody>
              ${students.map(s => {
                const hasAlert = s.allergies || s.medical_conditions;
                return `
                  <tr style="${hasAlert ? 'background:#fff5f5; font-weight:600;' : ''}">
                    <td><span class="font-mono">${esc(s.admissionNo || '—')}</span></td>
                    <td><strong>${esc(s.fullName)}</strong></td>
                    <td>${esc(s.grade || '')} - ${esc(s.section || 'A')}</td>
                    <td><span class="badge ${s.bloodGroup || s.blood_group ? 'badge-info' : 'badge-secondary'}">${esc(s.bloodGroup || s.blood_group || '—')}</span></td>
                    <td>
                      ${s.allergies ? `<span style="color:#dc2626; font-weight:700;">⚠️ ${esc(s.allergies)}</span>` : '<span style="color:#64748b;">None reported</span>'}
                    </td>
                    <td>
                      ${s.medical_conditions ? `<span style="color:#b45309; font-weight:700;">${esc(s.medical_conditions)}</span>` : '<span style="color:#64748b;">None</span>'}
                    </td>
                    <td>${esc(s.emergency_physician || 'Campus Infirmary')}</td>
                    <td><span class="font-mono">${esc(s.phone || s.guardianPhone || '—')}</span></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <div style="display:flex; justify-content:space-between; margin-top:24px; font-size:0.72rem; text-align:center;">
          <div style="width:30%;">
            <div style="border-bottom:1px solid #0f172a; padding-bottom:20px; margin-bottom:4px;"></div>
            <strong>Campus Medical Officer</strong>
          </div>
          <div style="width:30%;">
            <div style="border-bottom:1px solid #0f172a; padding-bottom:20px; margin-bottom:4px;"></div>
            <strong>Physical Education In-Charge</strong>
          </div>
          <div style="width:30%;">
            <div style="border-bottom:1px solid #0f172a; padding-bottom:20px; margin-bottom:4px;"></div>
            <strong>Principal (Official Seal)</strong>
          </div>
        </div>
      </div>
    `;

    UIComponents.openModal({
      title: 'Campus Medical & Infirmary Emergency Roster',
      bodyHtml,
      footerHtml: `
        <button class="btn btn-secondary" onclick="document.getElementById('global-modal-close').click()">Close</button>
        <button class="btn btn-primary" onclick="window.print()"><i data-lucide="printer"></i> Print Medical Roster (A4)</button>
      `
    });

    UIComponents.refreshIcons();
  }
}

export default StudentModule;
