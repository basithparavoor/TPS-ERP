/**
 * THAIBA PUBLIC SCHOOL — Institutional ID Card & Smart Badge Studio
 * Batch A4 Printable Student & Staff ID Cards with Dynamic QR Verification
 */

import { TMS_CONFIG } from './config.js';
import { dbService } from './supabase-client.js';
import { UIComponents } from './ui-components.js';
import { TMS_LOGO } from './logo.js';
import { QRCodeGenerator } from './qr-generator.js';

export class IdCardsModule {
  static async render(container) {
    const esc = (v) => UIComponents.escapeHtml(v);

    const [allStudents, allStaff] = await Promise.all([
      dbService.select('students'),
      dbService.select('staff_directory')
    ]);

    this._students = allStudents || [];
    this._staff = allStaff || [];
    this._activeTab = 'students'; // 'students' | 'staff'
    this._selectedGrade = 'all';
    this._selectedDept = 'all';
    this._cardFormat = 'landscape'; // 'landscape' | 'portrait'

    container.innerHTML = `
      <div style="margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
          <div>
            <h1 style="font-size: 1.8rem; display: flex; align-items: center; gap: 10px;">
              <span style="color: #16a34a;"><i data-lucide="contact-2"></i></span> ID Card &amp; Smart Badge Studio
            </h1>
            <p style="color: var(--text-muted); font-size: 0.9rem;">
              Generate and batch-print official institutional CR-80 PVC ID cards &amp; staff badges with scannable QR verification.
            </p>
          </div>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button class="btn btn-secondary" id="btn-toggle-card-format">
              <i data-lucide="refresh-cw"></i> Switch to <span id="lbl-next-format">Vertical Portrait</span>
            </button>
            <button class="btn btn-primary" id="btn-batch-print-id-cards">
              <i data-lucide="printer"></i> Print Batch A4 Sheets
            </button>
          </div>
        </div>
      </div>

      <!-- KPI Summary -->
      <div class="kpi-grid">
        ${UIComponents.renderKpiCard({ title: 'Student Directory', value: `${this._students.length}`, icon: 'graduation-cap', color: 'emerald', subtitle: 'Enrolled Pupils' })}
        ${UIComponents.renderKpiCard({ title: 'Faculty & Employees', value: `${this._staff.length}`, icon: 'users', color: 'blue', subtitle: 'Active Campus Staff' })}
        ${UIComponents.renderKpiCard({ title: 'Card Standard', value: 'CR-80 PVC', icon: 'credit-card', color: 'amber', subtitle: '85.6 × 54.0 mm' })}
        ${UIComponents.renderKpiCard({ title: 'Academic Session', value: TMS_CONFIG.academic.currentYear, icon: 'calendar', color: 'rose', subtitle: 'Valid Thru 2028' })}
      </div>

      <!-- Controls & Filter Toolbar -->
      <div class="card" style="margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
          <!-- Tabs -->
          <div style="display: flex; gap: 8px;">
            <button class="btn ${this._activeTab === 'students' ? 'btn-primary' : 'btn-secondary'} btn-sm" id="tab-id-students">
              <i data-lucide="graduation-cap"></i> Student ID Cards (${this._students.length})
            </button>
            <button class="btn ${this._activeTab === 'staff' ? 'btn-primary' : 'btn-secondary'} btn-sm" id="tab-id-staff">
              <i data-lucide="users"></i> Faculty &amp; Staff Badges (${this._staff.length})
            </button>
          </div>

          <!-- Filters -->
          <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;" id="id-filter-container">
            <!-- Injected dynamically based on tab -->
          </div>
        </div>
      </div>

      <!-- Printable ID Cards Canvas Area -->
      <div id="id-cards-print-area">
        <div id="id-cards-grid" style="display: flex; flex-wrap: wrap; gap: 20px; justify-content: flex-start;">
          <!-- Card Markups rendered here -->
        </div>
      </div>
    `;

    this.renderToolbarFilters(container);
    this.renderCardsGrid(container);
    this.bindEvents(container);
    UIComponents.refreshIcons();
  }

  static renderToolbarFilters(container) {
    const filterBox = container.querySelector('#id-filter-container');
    if (!filterBox) return;

    if (this._activeTab === 'students') {
      const grades = [...new Set(this._students.map(s => s.grade).filter(Boolean))].sort();
      filterBox.innerHTML = `
        <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-muted);">Class Filter:</label>
        <select class="form-input" id="filter-id-grade" style="padding: 4px 8px; font-size: 0.85rem; width: auto;">
          <option value="all">All Classes (${this._students.length} Pupils)</option>
          ${grades.map(g => `<option value="${g}" ${this._selectedGrade === g ? 'selected' : ''}>Class ${g}</option>`).join('')}
        </select>
        <span style="font-size: 0.8rem; color: var(--text-muted);" id="lbl-id-card-count"></span>
      `;
    } else {
      const depts = [...new Set(this._staff.map(s => s.department).filter(Boolean))].sort();
      filterBox.innerHTML = `
        <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-muted);">Department Filter:</label>
        <select class="form-input" id="filter-id-dept" style="padding: 4px 8px; font-size: 0.85rem; width: auto;">
          <option value="all">All Departments (${this._staff.length} Staff)</option>
          ${depts.map(d => `<option value="${d}" ${this._selectedDept === d ? 'selected' : ''}>${d}</option>`).join('')}
        </select>
        <span style="font-size: 0.8rem; color: var(--text-muted);" id="lbl-id-card-count"></span>
      `;
    }

    const gradeSelect = filterBox.querySelector('#filter-id-grade');
    if (gradeSelect) {
      gradeSelect.addEventListener('change', (e) => {
        this._selectedGrade = e.target.value;
        this.renderCardsGrid(container);
      });
    }

    const deptSelect = filterBox.querySelector('#filter-id-dept');
    if (deptSelect) {
      deptSelect.addEventListener('change', (e) => {
        this._selectedDept = e.target.value;
        this.renderCardsGrid(container);
      });
    }
  }

  static renderCardsGrid(container) {
    const grid = container.querySelector('#id-cards-grid');
    if (!grid) return;

    const countLabel = container.querySelector('#lbl-id-card-count');

    if (this._activeTab === 'students') {
      let list = this._students;
      if (this._selectedGrade !== 'all') {
        list = list.filter(s => s.grade === this._selectedGrade);
      }
      if (countLabel) countLabel.textContent = `Showing ${list.length} cards`;

      if (!list.length) {
        grid.innerHTML = `<div style="padding: 40px; text-align: center; width: 100%; color: var(--text-muted);">No student records found for the selected filter.</div>`;
        return;
      }

      grid.innerHTML = list.map((s, idx) => this.renderStudentCardHtml(s, idx)).join('');

      // Render Dynamic QRs
      list.forEach((s, idx) => {
        const qrEl = grid.querySelector(`#qr-student-${idx}`);
        if (qrEl) {
          const verifyData = `TMS-VERIFY:STU:${s.admissionNo || s.id}:${s.fullName}`;
          QRCodeGenerator.render(qrEl, verifyData, { width: 34, height: 34 });
        }
      });
    } else {
      let list = this._staff;
      if (this._selectedDept !== 'all') {
        list = list.filter(s => s.department === this._selectedDept);
      }
      if (countLabel) countLabel.textContent = `Showing ${list.length} staff badges`;

      if (!list.length) {
        grid.innerHTML = `<div style="padding: 40px; text-align: center; width: 100%; color: var(--text-muted);">No staff records found for the selected department.</div>`;
        return;
      }

      grid.innerHTML = list.map((st, idx) => this.renderStaffCardHtml(st, idx)).join('');

      // Render Dynamic QRs
      list.forEach((st, idx) => {
        const qrEl = grid.querySelector(`#qr-staff-${idx}`);
        if (qrEl) {
          const verifyData = `TMS-VERIFY:STAFF:${st.staffId || st.id}:${st.name}`;
          QRCodeGenerator.render(qrEl, verifyData, { width: 34, height: 34 });
        }
      });
    }

    UIComponents.refreshIcons();
  }

  static renderStudentCardHtml(s, idx) {
    const esc = (v) => UIComponents.escapeHtml(v);
    const photo = s.photoUrl || s.avatar || '';
    const blood = s.bloodGroup || s.blood_group || 'O+';

    return `
      <div class="id-card-wrapper" style="page-break-inside: avoid; margin-bottom: 16px;">
        <div class="pvc-id-card-pair" style="display: inline-flex; gap: 14px; font-family: 'Plus Jakarta Sans', sans-serif;">
          <!-- FRONT SIDE (CR-80 Dimensions: 336px x 212px) -->
          <div class="pvc-card-side" style="width: 336px; height: 212px; border-radius: 12px; background: linear-gradient(135deg, #064e3b 0%, #0f172a 100%); color: #fff; position: relative; overflow: hidden; border: 2px solid #16a34a; box-shadow: 0 4px 14px rgba(0,0,0,0.18); display: flex; flex-direction: column; justify-content: space-between; padding: 10px; box-sizing: border-box;">
            <!-- Subtle Watermark -->
            <div style="position: absolute; top: -35px; right: -35px; width: 110px; height: 110px; border-radius: 50%; background: radial-gradient(circle, rgba(34,197,94,0.22) 0%, transparent 70%); pointer-events: none;"></div>
            
            <!-- Header -->
            <div style="display: flex; align-items: center; gap: 8px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 5px;">
              <div style="flex-shrink: 0;">${TMS_LOGO.emblemSvg(30)}</div>
              <div style="flex: 1; line-height: 1.15;">
                <div style="font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 800; letter-spacing: 0.04em; color: #4ade80; text-transform: uppercase;">
                  ${esc(TMS_CONFIG.institution.name)}
                </div>
                <div style="font-size: 7px; color: #cbd5e1;">
                  Run by : Thaiba Heritage, Kolkata
                </div>
              </div>
              <span style="font-size: 7px; background: #16a34a; color: #fff; padding: 2px 5px; border-radius: 4px; font-weight: 800; text-transform: uppercase;">Student</span>
            </div>

            <!-- Body -->
            <div style="display: flex; gap: 10px; align-items: center; margin: 3px 0;">
              <div style="width: 68px; height: 80px; border: 2px solid #22c55e; border-radius: 6px; overflow: hidden; background: #fff; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                ${photo ? `<img src="${esc(photo)}" alt="Photo" style="width: 100%; height: 100%; object-fit: cover;">` : `<i data-lucide="user" style="width: 28px; height: 28px; color: #94a3b8;"></i>`}
              </div>
              <div style="flex: 1; min-width: 0; line-height: 1.25;">
                <div style="font-size: 12.5px; font-weight: 800; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${esc(s.fullName || 'Student Name')}
                </div>
                <div style="font-size: 9px; color: #38bdf8; font-weight: 700; margin-bottom: 3px;">
                  Class ${esc(s.grade || '')} • Sec ${esc(s.section || 'A')} • Roll #${esc(s.rollNo || '—')}
                </div>
                <div style="font-size: 7.5px; color: #cbd5e1; background: rgba(255,255,255,0.08); padding: 3px 6px; border-radius: 4px;">
                  <div><strong>Adm No:</strong> <span class="font-mono" style="color: #fde047; font-weight: 700;">${esc(s.admissionNo || '—')}</span></div>
                  <div><strong>Blood Group:</strong> <span style="color: #ef4444; font-weight: 800;">${esc(blood)}</span> &nbsp;•&nbsp; <strong>DOB:</strong> ${esc((s.dob || '').slice(0, 10))}</div>
                  <div><strong>Emergency:</strong> <span class="font-mono">${esc(s.phone || s.guardianPhone || s.parentPhone || '—')}</span></div>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.15); padding-top: 3px; font-size: 7px; color: #94a3b8;">
              <div>Session ${TMS_CONFIG.academic.currentYear} • Campus Smart Pass</div>
              <div id="qr-student-${idx}" style="width: 34px; height: 34px; background: #fff; padding: 1px; border-radius: 3px; display: inline-flex; align-items: center; justify-content: center;"></div>
            </div>
          </div>

          <!-- BACK SIDE -->
          <div class="pvc-card-side" style="width: 336px; height: 212px; border-radius: 12px; background: #0f172a; color: #cbd5e1; position: relative; overflow: hidden; border: 2px solid #334155; box-shadow: 0 4px 14px rgba(0,0,0,0.18); display: flex; flex-direction: column; justify-content: space-between; padding: 10px; font-size: 7.5px; line-height: 1.35; box-sizing: border-box;">
            <div style="border-bottom: 1px solid #334155; padding-bottom: 3px; display: flex; justify-content: space-between; align-items: center;">
              <strong style="color: #38bdf8; font-size: 8px; text-transform: uppercase;">Official Campus Pass</strong>
              <span style="font-size: 6.5px; color: #64748b;">Terms of Possession</span>
            </div>

            <ul style="list-style: disc; margin: 3px 0 3px 12px; padding: 0; font-size: 7px; color: #94a3b8;">
              <li>This card is institutional property and must be displayed on campus.</li>
              <li>Entitles the student to library access, lab entries, and campus facilities.</li>
              <li>If found, please return to THAIBA PUBLIC SCHOOL, Baghait, Tapan, WB.</li>
            </ul>

            <div style="background: rgba(255,255,255,0.04); padding: 3px 6px; border-radius: 4px; font-size: 7px; color: #cbd5e1;">
              <div><strong>Residential Address:</strong> ${esc(s.address || 'Kolkata Campus Jurisdiction')}</div>
              <div><strong>Parent / Guardian:</strong> ${esc(s.fatherName || s.guardianName || 'Guardian')}</div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: flex-end; padding-top: 3px; border-top: 1px solid #334155;">
              <div>
                <span style="font-size: 6.5px; color: #64748b;">Helpline: ${esc(TMS_CONFIG.institution.contact.phone)}</span>
              </div>
              <div style="text-align: center; border-top: 1px dashed #64748b; padding-top: 2px; min-width: 90px;">
                <span style="font-size: 6.5px; color: #94a3b8; font-weight: 700;">Principal / Headmaster</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  static renderStaffCardHtml(st, idx) {
    const esc = (v) => UIComponents.escapeHtml(v);
    const photo = st.avatar || st.photoUrl || '';

    return `
      <div class="id-card-wrapper" style="page-break-inside: avoid; margin-bottom: 16px;">
        <div class="pvc-id-card-pair" style="display: inline-flex; gap: 14px; font-family: 'Plus Jakarta Sans', sans-serif;">
          <!-- FRONT SIDE (Faculty Crimson / Sapphire Badge) -->
          <div class="pvc-card-side" style="width: 336px; height: 212px; border-radius: 12px; background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%); color: #fff; position: relative; overflow: hidden; border: 2px solid #6366f1; box-shadow: 0 4px 14px rgba(0,0,0,0.18); display: flex; flex-direction: column; justify-content: space-between; padding: 10px; box-sizing: border-box;">
            <!-- Header -->
            <div style="display: flex; align-items: center; gap: 8px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 5px;">
              <div style="flex-shrink: 0;">${TMS_LOGO.emblemSvg(30)}</div>
              <div style="flex: 1; line-height: 1.15;">
                <div style="font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 800; letter-spacing: 0.04em; color: #818cf8; text-transform: uppercase;">
                  ${esc(TMS_CONFIG.institution.name)}
                </div>
                <div style="font-size: 7px; color: #cbd5e1;">
                  Run by : Thaiba Heritage, Kolkata
                </div>
              </div>
              <span style="font-size: 7px; background: #4f46e5; color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: 800; text-transform: uppercase;">Faculty</span>
            </div>

            <!-- Body -->
            <div style="display: flex; gap: 10px; align-items: center; margin: 3px 0;">
              <div style="width: 68px; height: 80px; border: 2px solid #6366f1; border-radius: 6px; overflow: hidden; background: #fff; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                ${photo ? `<img src="${esc(photo)}" alt="Photo" style="width: 100%; height: 100%; object-fit: cover;">` : `<i data-lucide="user-check" style="width: 28px; height: 28px; color: #6366f1;"></i>`}
              </div>
              <div style="flex: 1; min-width: 0; line-height: 1.25;">
                <div style="font-size: 13px; font-weight: 800; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${esc(st.name || 'Staff Member')}
                </div>
                <div style="font-size: 9.5px; color: #a5b4fc; font-weight: 700; margin-bottom: 3px;">
                  ${esc(st.designation || st.role || 'Faculty')}
                </div>
                <div style="font-size: 7.5px; color: #cbd5e1; background: rgba(255,255,255,0.08); padding: 3px 6px; border-radius: 4px;">
                  <div><strong>Staff ID:</strong> <span class="font-mono" style="color: #fde047; font-weight: 700;">${esc(st.staffId || st.id || '—')}</span></div>
                  <div><strong>Department:</strong> ${esc(st.department || 'Academics')}</div>
                  <div><strong>Emergency Contact:</strong> <span class="font-mono">${esc(st.phone || '—')}</span></div>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.15); padding-top: 3px; font-size: 7px; color: #94a3b8;">
              <div>Institutional Employee Credentials • Kolkata</div>
              <div id="qr-staff-${idx}" style="width: 34px; height: 34px; background: #fff; padding: 1px; border-radius: 3px; display: inline-flex; align-items: center; justify-content: center;"></div>
            </div>
          </div>

          <!-- BACK SIDE -->
          <div class="pvc-card-side" style="width: 336px; height: 212px; border-radius: 12px; background: #0f172a; color: #cbd5e1; position: relative; overflow: hidden; border: 2px solid #334155; box-shadow: 0 4px 14px rgba(0,0,0,0.18); display: flex; flex-direction: column; justify-content: space-between; padding: 10px; font-size: 7.5px; line-height: 1.35; box-sizing: border-box;">
            <div style="border-bottom: 1px solid #334155; padding-bottom: 3px; display: flex; justify-content: space-between; align-items: center;">
              <strong style="color: #818cf8; font-size: 8px; text-transform: uppercase;">Faculty Identity Card</strong>
              <span style="font-size: 6.5px; color: #64748b;">Official Authorization</span>
            </div>

            <ul style="list-style: disc; margin: 3px 0 3px 12px; padding: 0; font-size: 7px; color: #94a3b8;">
              <li>This badge certifies the bearer as an authorized faculty/staff member.</li>
              <li>Must be produced upon request by campus administrative authorities.</li>
              <li>Non-transferable; surrender upon termination of service.</li>
            </ul>

            <div style="background: rgba(255,255,255,0.04); padding: 3px 6px; border-radius: 4px; font-size: 7px; color: #cbd5e1;">
              <div><strong>Email:</strong> ${esc(st.email || '—')}</div>
              <div><strong>Campus Jurisdiction:</strong> West Bengal, India</div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: flex-end; padding-top: 3px; border-top: 1px solid #334155;">
              <div>
                <span style="font-size: 6.5px; color: #64748b;">Campus Office: ${esc(TMS_CONFIG.institution.contact.phone)}</span>
              </div>
              <div style="text-align: center; border-top: 1px dashed #64748b; padding-top: 2px; min-width: 90px;">
                <span style="font-size: 6.5px; color: #94a3b8; font-weight: 700;">Director / Registrar</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  static bindEvents(container) {
    const tabStudents = container.querySelector('#tab-id-students');
    const tabStaff = container.querySelector('#tab-id-staff');

    if (tabStudents) {
      tabStudents.addEventListener('click', () => {
        this._activeTab = 'students';
        tabStudents.className = 'btn btn-primary btn-sm';
        if (tabStaff) tabStaff.className = 'btn btn-secondary btn-sm';
        this.renderToolbarFilters(container);
        this.renderCardsGrid(container);
      });
    }

    if (tabStaff) {
      tabStaff.addEventListener('click', () => {
        this._activeTab = 'staff';
        tabStaff.className = 'btn btn-primary btn-sm';
        if (tabStudents) tabStudents.className = 'btn btn-secondary btn-sm';
        this.renderToolbarFilters(container);
        this.renderCardsGrid(container);
      });
    }

    const printBtn = container.querySelector('#btn-batch-print-id-cards');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        window.print();
      });
    }
  }
}

export default IdCardsModule;
