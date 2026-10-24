/**
 * THAIBA PUBLIC SCHOOL — Class Timetable & Academic Schedule Engine
 * Interactive Weekly Period Matrix, Teacher Workload Assignment & Printable A4 Class Schedule
 */

import { TMS_CONFIG } from './config.js';
import { dbService } from './supabase-client.js';
import { UIComponents } from './ui-components.js';
import { auditService } from './audit-service.js';
import { TMS_LOGO } from './logo.js';

export const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const PERIODS = [
  { id: 'P1', name: 'Period 1', time: '08:50 - 09:35' },
  { id: 'P2', name: 'Period 2', time: '09:35 - 10:20' },
  { id: 'P3', name: 'Period 3', time: '10:20 - 11:05' },
  { id: 'BREAK', name: 'Recess', time: '11:05 - 11:20', isBreak: true },
  { id: 'P4', name: 'Period 4', time: '11:20 - 12:05' },
  { id: 'P5', name: 'Period 5', time: '12:05 - 12:50' },
  { id: 'LUNCH', name: 'Lunch & Dhuhr', time: '12:50 - 01:30', isBreak: true },
  { id: 'P6', name: 'Period 6', time: '01:30 - 02:15' },
  { id: 'P7', name: 'Period 7', time: '02:15 - 03:00' },
  { id: 'P8', name: 'Period 8', time: '03:00 - 03:40' }
];

export const CORE_SUBJECTS = [
  'Mathematics', 'English Language', 'Bengali / Urdu', 'General Science', 
  'Physics', 'Chemistry', 'Biology', 'Social Science', 'Computer Applications', 
  'Islamic & Moral Studies', 'Art & Craft', 'Physical Education / Sports', 'Library Period'
];

export class TimetableModule {
  static async render(container) {
    const esc = (v) => UIComponents.escapeHtml(v);

    this._selectedGrade = this._selectedGrade || (TMS_CONFIG.academic.classes[0] || 'Grade 1');
    this._selectedSection = this._selectedSection || 'A';
    this._activeView = this._activeView || 'matrix'; // 'matrix' | 'substitution'
    this._subDate = this._subDate || new Date().toISOString().slice(0, 10);
    this._absentTeacher = this._absentTeacher || '';

    // Fetch timetables, staff directory, and substitutions
    const [allTimetables, allStaff, allSubs] = await Promise.all([
      dbService.select('timetables'),
      dbService.select('staff_directory'),
      dbService.select('teacher_substitutions')
    ]);

    this._timetables = allTimetables || [];
    this._staff = allStaff || [];
    this._substitutions = allSubs || [];

    const recordId = `tt_${this._selectedGrade}_${this._selectedSection}`.replace(/\s+/g, '_');
    const existing = this._timetables.find(t => 
      t.grade === this._selectedGrade && (t.section || 'A') === this._selectedSection
    );
    this._currentSchedule = existing?.schedule || {};

    container.innerHTML = `
      <div style="margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
          <div>
            <h1 style="font-size: 1.8rem; display: flex; align-items: center; gap: 10px;">
              <span style="color: #2563eb;"><i data-lucide="calendar-days"></i></span> Timetable &amp; Teacher Substitution Matrix
            </h1>
            <p style="color: var(--text-muted); font-size: 0.9rem;">
              Weekly period routine, teacher schedule allocations, and automated daily teacher absence &amp; substitution engine.
            </p>
          </div>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            ${this._activeView === 'matrix' ? `
              <button class="btn btn-secondary" id="btn-print-timetable"><i data-lucide="printer"></i> Print Class Timetable (A4)</button>
              <button class="btn btn-primary" id="btn-save-timetable"><i data-lucide="save"></i> Save Schedule</button>
            ` : `
              <button class="btn btn-primary" id="btn-print-substitution-slips"><i data-lucide="printer"></i> Print Daily Proxy Slips (A4)</button>
            `}
          </div>
        </div>
      </div>

      <!-- Module View Tabs -->
      <div class="tms-tab-rail-wrapper">
        <div class="tms-segmented-tabs">
          <button class="tms-tab-pill ${this._activeView === 'matrix' ? 'active' : ''}" id="tab-tt-matrix">
            <i data-lucide="grid"></i>
            <span>Class Timetable Matrix</span>
          </button>
          <button class="tms-tab-pill ${this._activeView === 'substitution' ? 'active' : ''}" id="tab-tt-sub">
            <i data-lucide="refresh-cw" style="color: #6366f1;"></i>
            <span>Proxy &amp; Substitution Engine</span>
          </button>
        </div>
      </div>

      ${this._activeView === 'matrix' ? `
      <!-- Filters & Class Picker -->
      <div class="card" style="margin-bottom: 20px;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; align-items: flex-end;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-weight: 600;">Grade / Class</label>
            <select class="form-select" id="tt-grade-select">
              ${TMS_CONFIG.academic.classes.map(c => `
                <option value="${esc(c)}" ${this._selectedGrade === c ? 'selected' : ''}>${esc(c)}</option>
              `).join('')}
            </select>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-weight: 600;">Section</label>
            <select class="form-select" id="tt-section-select">
              ${['A', 'B', 'C'].map(s => `
                <option value="${s}" ${this._selectedSection === s ? 'selected' : ''}>Section ${s}</option>
              `).join('')}
            </select>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-weight: 600;">Academic Session</label>
            <input type="text" class="form-input" disabled value="${esc(TMS_CONFIG.academic.currentYear)}">
          </div>
          <div>
            <button class="btn btn-secondary" id="btn-autofill-sample" style="width: 100%;">
              <i data-lucide="sparkles"></i> Auto-Fill Balanced Routine
            </button>
          </div>
        </div>
      </div>

      <!-- Main Timetable Matrix Card -->
      <div class="card">
        <div class="card-header" style="flex-wrap: wrap; gap: 10px;">
          <div>
            <h3 class="card-title">${esc(this._selectedGrade)} — Section ${esc(this._selectedSection)} Timetable</h3>
            <p class="card-desc">Click any period slot to assign or update the subject, teacher, and room.</p>
          </div>
          <span class="badge badge-info font-mono">Academic Year ${TMS_CONFIG.academic.currentYear}</span>
        </div>

        <div class="table-responsive">
          <table class="tms-table" id="timetable-matrix-table" style="font-size: 0.82rem; border-collapse: separate; border-spacing: 2px;">
            <thead>
              <tr style="background: var(--bg-subtle, #f1f5f9);">
                <th style="width: 100px; text-align: center;">Day / Period</th>
                ${PERIODS.map(p => `
                  <th style="text-align: center; min-width: ${p.isBreak ? '70px' : '110px'}; background: ${p.isBreak ? 'rgba(245, 158, 11, 0.08)' : 'inherit'};">
                    <div style="font-weight: 700;">${esc(p.name)}</div>
                    <div style="font-size: 0.68rem; color: var(--text-muted); font-weight: 400;">${p.time}</div>
                  </th>
                `).join('')}
              </tr>
            </thead>
            <tbody>
              ${DAYS_OF_WEEK.map(day => `
                <tr>
                  <td style="font-weight: 700; text-align: center; background: var(--bg-subtle, #f8fafc);">${day.slice(0, 3)}</td>
                  ${PERIODS.map(p => {
                    if (p.isBreak) {
                      return `
                        <td style="text-align: center; background: rgba(245, 158, 11, 0.06); color: #d97706; font-size: 0.72rem; font-weight: 600; vertical-align: middle;">
                          ${p.id === 'BREAK' ? '☕ Recess' : '🕌 Lunch'}
                        </td>
                      `;
                    }

                    const slotKey = `${day}_${p.id}`;
                    const slot = this._currentSchedule[slotKey] || {};
                    const hasData = slot.subject && slot.subject !== '—';

                    return `
                      <td class="tt-slot-cell" data-day="${day}" data-period="${p.id}" style="cursor: pointer; padding: 6px; border: 1px dashed var(--border-color); border-radius: 6px; text-align: center; background: ${hasData ? 'rgba(37, 99, 235, 0.04)' : 'transparent'}; transition: all 0.2s;">
                        ${hasData ? `
                          <div style="font-weight: 700; color: #1e40af; font-size: 0.8rem; line-height: 1.2;">${esc(slot.subject)}</div>
                          <div style="font-size: 0.7rem; color: #64748b; margin-top: 2px;">${esc(slot.teacher || '')}</div>
                          ${slot.room ? `<div style="font-size: 0.65rem; color: #94a3b8;">Rm ${esc(slot.room)}</div>` : ''}
                        ` : `
                          <span style="color: var(--text-muted); font-size: 0.75rem; opacity: 0.6;">+ Assign</span>
                        `}
                      </td>
                    `;
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      ` : `
      <!-- Daily Substitution & Proxy Engine View -->
      ${(() => {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayIdx = new Date(this._subDate).getDay();
        const dayName = days[dayIdx];

        // Find classes where absent teacher was scheduled on this day
        const assignedPeriods = [];
        if (this._absentTeacher && dayName !== 'Sunday') {
          this._timetables.forEach(t => {
            const sched = t.schedule || {};
            PERIODS.filter(p => !p.isBreak).forEach(p => {
              const slot = sched[`${dayName}_${p.id}`];
              if (slot && slot.teacher === this._absentTeacher) {
                assignedPeriods.push({
                  grade: t.grade,
                  section: t.section || 'A',
                  periodId: p.id,
                  periodName: p.name,
                  time: p.time,
                  subject: slot.subject || 'Class',
                  room: slot.room || ''
                });
              }
            });
          });
        }

        const dateSubs = this._substitutions.filter(s => s.date === this._subDate);

        return `
          <!-- Toolbar Card -->
          <div class="card" style="margin-bottom: 20px;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; align-items: flex-end;">
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" style="font-weight: 600;">Date of Absence</label>
                <input type="date" class="form-input" id="sub-date-input" value="${esc(this._subDate)}">
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" style="font-weight: 600;">Day of Week</label>
                <input type="text" class="form-input" disabled value="${esc(dayName)}">
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" style="font-weight: 600;">Select Absent Faculty Member *</label>
                <select class="form-select" id="sub-teacher-select">
                  <option value="">— Select Teacher on Leave —</option>
                  ${this._staff.map(st => `
                    <option value="${esc(st.name)}" ${this._absentTeacher === st.name ? 'selected' : ''}>
                      ${esc(st.name)} (${esc(st.department || 'Academics')})
                    </option>
                  `).join('')}
                </select>
              </div>
            </div>
          </div>

          <!-- Periods Scanner Matrix -->
          <div class="card" style="margin-bottom: 20px;">
            <div class="card-header" style="flex-wrap: wrap; gap: 10px;">
              <div>
                <h3 class="card-title" style="color: #6366f1; display: flex; align-items: center; gap: 8px;">
                  <i data-lucide="zap"></i> Automated Timetable Substitution Scanner
                </h3>
                <p class="card-desc">
                  ${this._absentTeacher 
                    ? `Showing ${assignedPeriods.length} scheduled periods for <strong>${esc(this._absentTeacher)}</strong> on ${esc(dayName)}.`
                    : 'Select a teacher on leave above to scan their scheduled classes and discover available free substitutes.'}
                </p>
              </div>
            </div>

            ${this._absentTeacher ? (assignedPeriods.length ? `
              <div class="table-responsive">
                <table class="tms-table">
                  <thead>
                    <tr>
                      <th>Period &amp; Time</th>
                      <th>Class &amp; Section</th>
                      <th>Subject</th>
                      <th>Classroom</th>
                      <th>Available Free Teachers</th>
                      <th style="text-align: right;">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${assignedPeriods.map((ap, idx) => {
                      const freeTeachers = this._staff.filter(st => {
                        if (st.name === this._absentTeacher) return false;
                        const isOccupied = this._timetables.some(t => {
                          const s = t.schedule && t.schedule[`${dayName}_${ap.periodId}`];
                          return s && s.teacher === st.name;
                        });
                        return !isOccupied;
                      });

                      const existingSub = dateSubs.find(s => 
                        s.grade === ap.grade && s.section === ap.section && s.period === ap.periodId && s.absentTeacherName === this._absentTeacher
                      );

                      return `
                        <tr>
                          <td>
                            <strong>${esc(ap.periodName)}</strong>
                            <div style="font-size: 0.72rem; color: var(--text-muted);">${esc(ap.time)}</div>
                          </td>
                          <td><span class="badge badge-info" style="font-weight: 700;">${esc(ap.grade)} (${esc(ap.section)})</span></td>
                          <td><strong>${esc(ap.subject)}</strong></td>
                          <td>${esc(ap.room || 'Main Room')}</td>
                          <td>
                            ${existingSub ? `
                              <span class="badge badge-success" style="font-size: 0.8rem; padding: 4px 8px;">
                                <i data-lucide="check" style="width: 12px; height: 12px; display: inline;"></i> Assigned: <strong>${esc(existingSub.substituteTeacherName)}</strong>
                              </span>
                            ` : `
                              <select class="form-select form-select-sm select-sub-candidate" id="sel-sub-${idx}" style="font-size: 0.82rem; max-width: 280px;">
                                <option value="">— Select from ${freeTeachers.length} Free Teachers —</option>
                                ${freeTeachers.map(ft => `<option value="${esc(ft.name)}">${esc(ft.name)} (Free in this period)</option>`).join('')}
                              </select>
                            `}
                          </td>
                          <td style="text-align: right;">
                            ${existingSub ? `
                              <button class="btn btn-secondary btn-sm btn-delete-sub" data-id="${esc(existingSub.id)}" style="color: #ef4444;" title="Cancel Substitution">
                                <i data-lucide="x-circle"></i>
                              </button>
                            ` : `
                              <button class="btn btn-primary btn-sm btn-assign-sub" 
                                data-idx="${idx}"
                                data-date="${esc(this._subDate)}"
                                data-absent-name="${esc(this._absentTeacher)}"
                                data-grade="${esc(ap.grade)}"
                                data-section="${esc(ap.section)}"
                                data-period="${esc(ap.periodId)}"
                                data-subject="${esc(ap.subject)}">
                                <i data-lucide="check"></i> Assign Proxy
                              </button>
                            `}
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            ` : `
              <div style="padding: 36px; text-align: center; color: var(--text-muted);">
                <strong>${esc(this._absentTeacher)}</strong> has no classes scheduled on ${esc(dayName)} in the school timetable.
              </div>
            `) : `
              <div style="padding: 40px; text-align: center; color: var(--text-muted);">
                <i data-lucide="user-x" style="width: 32px; height: 32px; margin-bottom: 8px; color: #94a3b8;"></i>
                <p>Please select an absent teacher from the dropdown above to calculate their schedule and match available faculty.</p>
              </div>
            `}
          </div>

          <!-- Daily Assigned Substitutions Ledger Card -->
          <div class="card">
            <div class="card-header" style="flex-wrap: wrap; gap: 10px;">
              <div>
                <h3 class="card-title">Daily Proxy &amp; Substitution Ledger — ${esc(this._subDate)}</h3>
                <p class="card-desc">Permanent record of assigned faculty substitutions for today's morning bulletin.</p>
              </div>
            </div>

            <div class="table-responsive">
              <table class="tms-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Period</th>
                    <th>Class</th>
                    <th>Subject</th>
                    <th>Teacher on Leave</th>
                    <th>Assigned Substitute</th>
                    <th>Status</th>
                    <th style="text-align: right;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${dateSubs.length ? dateSubs.map(s => `
                    <tr>
                      <td><span class="font-mono">${esc(s.date)}</span></td>
                      <td><strong>Period ${esc(s.period)}</strong></td>
                      <td>${esc(s.grade)} (${esc(s.section)})</td>
                      <td><strong>${esc(s.subject)}</strong></td>
                      <td><span style="color: #ef4444; font-weight: 600;">${esc(s.absentTeacherName)}</span></td>
                      <td><span style="color: #16a34a; font-weight: 700;">${esc(s.substituteTeacherName)}</span></td>
                      <td><span class="badge badge-success">Assigned</span></td>
                      <td style="text-align: right;">
                        <button class="btn btn-secondary btn-sm btn-delete-sub" data-id="${esc(s.id)}" style="color: #ef4444;" title="Cancel">
                          <i data-lucide="trash-2"></i>
                        </button>
                      </td>
                    </tr>
                  `).join('') : `
                    <tr>
                      <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 30px;">
                        No substitutions assigned yet for ${esc(this._subDate)}.
                      </td>
                    </tr>
                  `}
                </tbody>
              </table>
            </div>
          </div>
        `;
      })()}
      `}
    `;

    this.bindEvents(container);
    UIComponents.refreshIcons();
  }

  static bindEvents(container) {
    const esc = (v) => UIComponents.escapeHtml(v);

    // View Switching Tabs
    const tabMatrix = container.querySelector('#tab-tt-matrix');
    const tabSub = container.querySelector('#tab-tt-sub');
    if (tabMatrix) {
      tabMatrix.addEventListener('click', () => {
        this._activeView = 'matrix';
        this.render(container);
      });
    }
    if (tabSub) {
      tabSub.addEventListener('click', () => {
        this._activeView = 'substitution';
        this.render(container);
      });
    }

    // Substitution controls
    const subDate = container.querySelector('#sub-date-input');
    if (subDate) {
      subDate.addEventListener('change', (e) => {
        this._subDate = e.target.value;
        this.render(container);
      });
    }

    const subTeacher = container.querySelector('#sub-teacher-select');
    if (subTeacher) {
      subTeacher.addEventListener('change', (e) => {
        this._absentTeacher = e.target.value;
        this.render(container);
      });
    }

    // Assign Substitution button
    container.querySelectorAll('.btn-assign-sub').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const idx = e.currentTarget.dataset.idx;
        const sel = container.querySelector(`#sel-sub-${idx}`);
        const subName = sel ? sel.value : '';

        if (!subName) {
          UIComponents.showToast('Please select an available substitute teacher.', 'warning');
          return;
        }

        const date = e.currentTarget.dataset.date;
        const absentName = e.currentTarget.dataset.absentName;
        const grade = e.currentTarget.dataset.grade;
        const section = e.currentTarget.dataset.section;
        const period = parseInt(e.currentTarget.dataset.period) || 1;
        const subject = e.currentTarget.dataset.subject;

        const record = {
          id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          date: date,
          absent_teacher_name: absentName,
          substitute_teacher_name: subName,
          period: period,
          grade: grade,
          section: section,
          subject: subject,
          status: 'assigned'
        };

        const res = await dbService.insert('teacher_substitutions', record);
        if (res && res._syncError) {
          UIComponents.showToast(`Error assigning proxy: ${res._syncError}`, 'danger');
          return;
        }

        UIComponents.showToast(`Proxy assigned: ${subName} will cover Period ${period} (${grade})!`, 'success');
        await this.render(container);
      });
    });

    // Delete Substitution button
    container.querySelectorAll('.btn-delete-sub').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        if (!confirm('Cancel this assigned substitution?')) return;
        await dbService.delete('teacher_substitutions', id);
        UIComponents.showToast('Substitution removed.', 'info');
        await this.render(container);
      });
    });

    // Print Substitution Slips
    const printSlipsBtn = container.querySelector('#btn-print-substitution-slips');
    if (printSlipsBtn) {
      printSlipsBtn.addEventListener('click', () => {
        this.openSubstitutionSlipsModal();
      });
    }

    // Class / Section dropdowns
    const gradeSelect = container.querySelector('#tt-grade-select');
    if (gradeSelect) {
      gradeSelect.addEventListener('change', (e) => {
        this._selectedGrade = e.target.value;
        this.render(container);
      });
    }

    const secSelect = container.querySelector('#tt-section-select');
    if (secSelect) {
      secSelect.addEventListener('change', (e) => {
        this._selectedSection = e.target.value;
        this.render(container);
      });
    }

    // Auto-fill balanced routine
    const autofillBtn = container.querySelector('#btn-autofill-sample');
    if (autofillBtn) {
      autofillBtn.addEventListener('click', () => {
        if (!confirm(`Generate a balanced weekly period schedule for ${this._selectedGrade} Section ${this._selectedSection}?`)) return;

        const subjects = [
          'Mathematics', 'English Language', 'General Science', 'Bengali / Urdu',
          'Social Science', 'Computer Applications', 'Islamic & Moral Studies', 'Art & Craft', 'Physical Education / Sports'
        ];
        const staffList = this._staff.length ? this._staff.map(s => s.name) : ['Mr. Rahman', 'Ms. Fatima', 'Mr. Banerjee', 'Dr. Ali', 'Mrs. Khatun'];

        this._currentSchedule = {};
        DAYS_OF_WEEK.forEach((day, dayIdx) => {
          PERIODS.filter(p => !p.isBreak).forEach((p, pIdx) => {
            const subjIdx = (dayIdx * 2 + pIdx) % subjects.length;
            const staffIdx = subjIdx % staffList.length;
            this._currentSchedule[`${day}_${p.id}`] = {
              subject: subjects[subjIdx],
              teacher: staffList[staffIdx],
              room: `10${(dayIdx % 3) + 1}`
            };
          });
        });

        this.render(container);
        UIComponents.showToast('Balanced routine generated. Click "Save Schedule" to store.', 'success');
      });
    }

    // Click slot to edit
    container.querySelectorAll('.tt-slot-cell').forEach(cell => {
      cell.addEventListener('click', (e) => {
        const day = cell.dataset.day;
        const period = cell.dataset.period;
        const periodObj = PERIODS.find(p => p.id === period);
        const slotKey = `${day}_${period}`;
        const slot = this._currentSchedule[slotKey] || {};

        const staffOptions = this._staff.map(st => `
          <option value="${esc(st.name)}" ${slot.teacher === st.name ? 'selected' : ''}>${esc(st.name)} (${esc(st.designation || 'Faculty')})</option>
        `).join('');

        UIComponents.openModal({
          title: `Assign Period: ${day} • ${periodObj?.name} (${periodObj?.time})`,
          bodyHtml: `
            <form id="form-edit-slot">
              <div class="form-group">
                <label class="form-label" style="font-weight: 600;">Subject *</label>
                <select class="form-select" id="slot-subject-select">
                  <option value="">— Select Subject or Free Period —</option>
                  ${CORE_SUBJECTS.map(s => `
                    <option value="${esc(s)}" ${slot.subject === s ? 'selected' : ''}>${esc(s)}</option>
                  `).join('')}
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" style="font-weight: 600;">Assigned Teacher / Faculty</label>
                <select class="form-select" id="slot-teacher-select">
                  <option value="">— Assign Teacher —</option>
                  ${staffOptions}
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" style="font-weight: 600;">Classroom / Lab Number</label>
                <input type="text" class="form-input" id="slot-room-input" value="${esc(slot.room || '')}" placeholder="e.g. Room 102 or Computer Lab 1">
              </div>
            </form>
          `,
          footerHtml: `
            <button class="btn btn-secondary" onclick="document.getElementById('global-modal-close').click()">Cancel</button>
            <button class="btn btn-secondary btn-sm" id="btn-clear-slot" style="color: #ef4444;"><i data-lucide="trash-2"></i> Clear Slot</button>
            <button class="btn btn-primary" id="btn-save-slot"><i data-lucide="check"></i> Apply</button>
          `
        });

        const modal = document.querySelector('.tms-modal');
        if (!modal) return;

        modal.querySelector('#btn-clear-slot').addEventListener('click', () => {
          delete this._currentSchedule[slotKey];
          UIComponents.closeModal();
          this.render(container);
        });

        modal.querySelector('#btn-save-slot').addEventListener('click', () => {
          const subject = modal.querySelector('#slot-subject-select').value;
          const teacher = modal.querySelector('#slot-teacher-select').value;
          const room = modal.querySelector('#slot-room-input').value.trim();

          if (!subject) {
            delete this._currentSchedule[slotKey];
          } else {
            this._currentSchedule[slotKey] = { subject, teacher, room };
          }

          UIComponents.closeModal();
          this.render(container);
        });

        UIComponents.refreshIcons();
      });
    });

    // Save Timetable to Supabase
    const saveBtn = container.querySelector('#btn-save-timetable');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        saveBtn.disabled = true;
        saveBtn.innerText = 'Saving...';

        const recordId = `tt_${this._selectedGrade}_${this._selectedSection}`.replace(/\s+/g, '_');
        const existing = this._timetables.find(t => 
          t.grade === this._selectedGrade && (t.section || 'A') === this._selectedSection
        );

        const payload = {
          id: existing ? existing.id : recordId,
          grade: this._selectedGrade,
          section: this._selectedSection,
          academicYear: TMS_CONFIG.academic.currentYear,
          schedule: this._currentSchedule,
          updatedAt: new Date().toISOString()
        };

        try {
          if (existing) {
            await dbService.update('timetables', existing.id, payload);
          } else {
            await dbService.insert('timetables', payload);
          }

          await auditService.log('TIMETABLE_SAVED', 'ACADEMICS', {
            grade: this._selectedGrade,
            section: this._selectedSection,
            slotsCount: Object.keys(this._currentSchedule).length
          });

          UIComponents.showToast(`Timetable for ${this._selectedGrade} Section ${this._selectedSection} saved successfully!`, 'success');
          this.render(container);
        } catch (err) {
          console.error('Timetable save error:', err);
          UIComponents.showToast('Failed to save timetable.', 'error');
          saveBtn.disabled = false;
          saveBtn.innerText = 'Save Schedule';
        }
      });
    }

    // Print Class Timetable (A4)
    const printBtn = container.querySelector('#btn-print-timetable');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        this.openPrintTimetableModal();
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Official Printable Class Schedule Poster                           */
  /* ------------------------------------------------------------------ */
  static openPrintTimetableModal() {
    const esc = (v) => UIComponents.escapeHtml(v);
    const emblem = TMS_LOGO.emblemSvg(56);

    const bodyHtml = `
      <style>
        @media print {
          @page {
            size: A4 landscape;
            margin: 8mm;
          }
          body * {
            visibility: hidden;
          }
          #printable-timetable-sheet, #printable-timetable-sheet * {
            visibility: visible;
          }
          #printable-timetable-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            border: 2px solid #16a34a !important;
          }
          .tms-modal-overlay, .tms-modal, .tms-modal-content {
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
          }
          .tms-modal-header, .tms-modal-footer, #app-sidebar, header {
            display: none !important;
          }
        }
      </style>

      <div id="printable-timetable-sheet" style="background: #fff; color: #0f172a; padding: 24px; border: 2px solid #16a34a; border-radius: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <!-- Header -->
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #16a34a; padding-bottom: 12px; margin-bottom: 14px;">
          <div>${emblem}</div>
          <div style="text-align: center; flex: 1;">
            <h1 style="font-size: 1.4rem; font-weight: 800; color: #166534; text-transform: uppercase; margin: 0;">
              ${esc(TMS_CONFIG.institution.name)}
            </h1>
            <p style="font-size: 0.78rem; font-weight: 700; color: #15803d; margin: 2px 0;">
              ${esc(TMS_CONFIG.institution.subtitle || 'Run by : Thaiba Heritage, Kolkata')}
            </p>
            <div style="font-size: 0.72rem; color: #64748b;">
              ${esc(TMS_CONFIG.institution.address.campus)}, ${esc(TMS_CONFIG.institution.address.city)}
            </div>
          </div>
          <div style="text-align: right; background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; padding: 6px 12px;">
            <div style="font-size: 1rem; font-weight: 800; color: #166534;">${esc(this._selectedGrade)} - ${esc(this._selectedSection)}</div>
            <div style="font-size: 0.72rem; color: #15803d; font-weight: 600;">Academic Session ${esc(TMS_CONFIG.academic.currentYear)}</div>
          </div>
        </div>

        <!-- Schedule Grid -->
        <table style="width: 100%; border-collapse: collapse; font-size: 0.75rem; border: 1px solid #cbd5e1; margin-bottom: 24px;">
          <thead>
            <tr style="background: #f1f5f9; border-bottom: 2px solid #94a3b8;">
              <th style="padding: 6px; border: 1px solid #cbd5e1; width: 60px;">Day</th>
              ${PERIODS.map(p => `
                <th style="padding: 6px 4px; border: 1px solid #cbd5e1; text-align: center; width: ${p.isBreak ? '50px' : 'auto'}; background: ${p.isBreak ? '#fef3c7' : 'inherit'};">
                  <strong>${esc(p.name)}</strong>
                  <div style="font-size: 0.62rem; color: #64748b; font-weight: 400;">${p.time}</div>
                </th>
              `).join('')}
            </tr>
          </thead>
          <tbody>
            ${DAYS_OF_WEEK.map(day => `
              <tr style="border-bottom: 1px solid #cbd5e1;">
                <td style="padding: 8px 4px; border: 1px solid #cbd5e1; font-weight: 700; text-align: center; background: #f8fafc;">${day.slice(0, 3)}</td>
                ${PERIODS.map(p => {
                  if (p.isBreak) {
                    return `<td style="padding: 4px; border: 1px solid #cbd5e1; text-align: center; background: #fffbeb; color: #d97706; font-size: 0.65rem; font-weight: 700;">${p.id === 'BREAK' ? 'Recess' : 'Lunch'}</td>`;
                  }
                  const slotKey = `${day}_${p.id}`;
                  const slot = this._currentSchedule[slotKey] || {};
                  return `
                    <td style="padding: 6px 4px; border: 1px solid #cbd5e1; text-align: center; vertical-align: middle;">
                      ${slot.subject ? `
                        <div style="font-weight: 700; color: #0f172a; font-size: 0.76rem;">${esc(slot.subject)}</div>
                        <div style="font-size: 0.65rem; color: #475569;">${esc(slot.teacher || '')}</div>
                      ` : '<span style="color: #cbd5e1;">—</span>'}
                    </td>
                  `;
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- Signatures -->
        <div style="display: flex; justify-content: space-between; align-items: flex-end; padding-top: 20px; font-size: 0.75rem; text-align: center;">
          <div style="width: 180px;">
            <div style="border-bottom: 1px solid #0f172a; margin-bottom: 4px; padding-bottom: 20px;"></div>
            <strong>Class Teacher</strong>
          </div>
          <div style="width: 180px;">
            <div style="border-bottom: 1px solid #0f172a; margin-bottom: 4px; padding-bottom: 20px;"></div>
            <strong>Academic Coordinator</strong>
          </div>
          <div style="width: 180px;">
            <div style="border-bottom: 1px solid #0f172a; margin-bottom: 4px; padding-bottom: 20px;"></div>
            <strong>Principal (Official Seal)</strong>
          </div>
        </div>
      </div>
    `;

    UIComponents.openModal({
      title: `Class Timetable Poster — ${this._selectedGrade} (${this._selectedSection})`,
      bodyHtml,
      footerHtml: `
        <button class="btn btn-secondary" onclick="document.getElementById('global-modal-close').click()">Close</button>
        <button class="btn btn-primary" onclick="window.print()"><i data-lucide="printer"></i> Print Official Schedule (A4)</button>
      `
    });

    UIComponents.refreshIcons();
  }

  /* ------------------------------------------------------------------ */
  /* Daily Faculty Substitution Slips (A4 Printable)                    */
  /* ------------------------------------------------------------------ */
  static openSubstitutionSlipsModal() {
    const esc = (v) => UIComponents.escapeHtml(v);
    const dateSubs = this._substitutions.filter(s => s.date === this._subDate);
    const emblem = TMS_LOGO.emblemSvg(40);

    if (!dateSubs.length) {
      UIComponents.showToast(`No substitutions have been assigned yet for ${this._subDate}.`, 'warning');
      return;
    }

    const bodyHtml = `
      <style>
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body * { visibility: hidden; }
          #substitution-slips-print, #substitution-slips-print * { visibility: visible; }
          #substitution-slips-print { position: fixed; left: 0; top: 0; width: 100%; border: none !important; }
        }
      </style>

      <div id="substitution-slips-print" style="background:#fff; color:#0f172a; padding:16px; font-family:'Plus Jakarta Sans', sans-serif;">
        <div style="text-align:center; border-bottom:2px solid #6366f1; padding-bottom:10px; margin-bottom:16px;">
          <h2 style="font-size:1.25rem; font-weight:800; color:#3730a3; text-transform:uppercase; margin:0;">${esc(TMS_CONFIG.institution.name)}</h2>
          <div style="font-size:0.75rem; color:#475569; font-weight:600;">DAILY FACULTY PROXY &amp; CLASSROOM SUBSTITUTION NOTICE</div>
          <div style="font-size:0.72rem; color:#6366f1; font-weight:700; margin-top:2px;">Date: ${esc(this._subDate)} • Morning Assembly Bulletin</div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
          ${dateSubs.map((sub, i) => `
            <div style="border:1.5px dashed #4f46e5; border-radius:8px; padding:12px; background:#f8fafc; font-size:0.75rem; line-height:1.4; page-break-inside:avoid;">
              <div style="display:flex; justify-content:space-between; border-bottom:1px solid #cbd5e1; padding-bottom:4px; margin-bottom:6px;">
                <span style="font-weight:800; color:#4f46e5;">SLIP #${i + 1} • Period ${esc(sub.period)}</span>
                <span style="font-weight:700; color:#0f172a;">${esc(sub.grade)} (${esc(sub.section)})</span>
              </div>
              <div><strong>Assigned Substitute:</strong> <span style="color:#16a34a; font-weight:700;">${esc(sub.substituteTeacherName)}</span></div>
              <div><strong>Faculty on Leave:</strong> <span style="color:#ef4444;">${esc(sub.absentTeacherName)}</span></div>
              <div><strong>Subject / Activity:</strong> ${esc(sub.subject)}</div>
              <div style="margin-top:8px; font-size:0.68rem; color:#64748b;">
                Please report to the assigned classroom promptly at the bell. Supervise ongoing class assignments.
              </div>
              <div style="display:flex; justify-content:space-between; margin-top:14px; font-size:0.65rem; border-top:1px solid #cbd5e1; padding-top:4px;">
                <span>Coordinator Sign</span>
                <span>Faculty Acknowledgment</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    UIComponents.openModal({
      title: `Daily Substitution Slips — ${this._subDate}`,
      bodyHtml,
      footerHtml: `
        <button class="btn btn-secondary" onclick="document.getElementById('global-modal-close').click()">Close</button>
        <button class="btn btn-primary" onclick="window.print()"><i data-lucide="printer"></i> Print All Slips (A4)</button>
      `
    });

    UIComponents.refreshIcons();
  }
}

export default TimetableModule;
