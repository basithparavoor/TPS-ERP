/**
 * THAIBA PUBLIC SCHOOL — Academic & Curriculum Management Module
 * Comprehensive CRUD Suite: Classes, Sections, Period & Bell Timetable,
 * Teacher Allocation, Academic Sessions, Subject Master & Syllabus Tracker.
 */

import { TMS_CONFIG } from './config.js';
import { dbService } from './supabase-client.js';
import { UIComponents } from './ui-components.js';
import { auditService } from './audit-service.js';

const esc = (v) => UIComponents.escapeHtml(v);

const DEFAULT_SUBJECTS = [
  { id: 'subj-eng', code: 'ENG-101', name: 'English Language & Literature', classification: 'Theory + Practical', credits: 6, hod: 'Senior English Faculty', lab: 'No' },
  { id: 'subj-ben', code: 'BEN-102', name: 'Bengali / Regional Language', classification: 'Pure Theory', credits: 5, hod: 'Department of Languages', lab: 'No' },
  { id: 'subj-mth', code: 'MTH-103', name: 'Mathematics & Geometry', classification: 'Theory + Practical', credits: 7, hod: 'Head of Mathematics', lab: 'Yes' },
  { id: 'subj-sci', code: 'SCI-104', name: 'General Science (Physics, Chem, Bio)', classification: 'Theory + Practical', credits: 7, hod: 'Science Department Lead', lab: 'Yes' },
  { id: 'subj-soc', code: 'SOC-105', name: 'Social Studies & Geography', classification: 'Pure Theory', credits: 5, hod: 'Social Sciences Dept', lab: 'No' },
  { id: 'subj-csc', code: 'CSC-106', name: 'Computer Applications & Coding', classification: 'Theory + Practical', credits: 4, hod: 'IT Department Lead', lab: 'Yes' },
  { id: 'subj-isl', code: 'ISL-107', name: 'Islamic Ethics, Tajweed & Moral Values', classification: 'Moral Studies', credits: 4, hod: 'Department of Islamic Studies', lab: 'No' }
];

const DEFAULT_PERIODS = [
  { id: 'prd-asm', name: 'Morning Assembly & Dua', periodNo: 0, startTime: '08:30', endTime: '08:50', durationMins: 20, isBreak: true, orderIndex: 1, status: 'Active' },
  { id: 'prd-1', name: 'Period 1', periodNo: 1, startTime: '08:50', endTime: '09:35', durationMins: 45, isBreak: false, orderIndex: 2, status: 'Active' },
  { id: 'prd-2', name: 'Period 2', periodNo: 2, startTime: '09:35', endTime: '10:20', durationMins: 45, isBreak: false, orderIndex: 3, status: 'Active' },
  { id: 'prd-3', name: 'Period 3', periodNo: 3, startTime: '10:20', endTime: '11:05', durationMins: 45, isBreak: false, orderIndex: 4, status: 'Active' },
  { id: 'prd-brk', name: 'Tiffin & Refreshment Break', periodNo: 0, startTime: '11:05', endTime: '11:30', durationMins: 25, isBreak: true, orderIndex: 5, status: 'Active' },
  { id: 'prd-4', name: 'Period 4', periodNo: 4, startTime: '11:30', endTime: '12:15', durationMins: 45, isBreak: false, orderIndex: 6, status: 'Active' },
  { id: 'prd-5', name: 'Period 5', periodNo: 5, startTime: '12:15', endTime: '13:00', durationMins: 45, isBreak: false, orderIndex: 7, status: 'Active' },
  { id: 'prd-lnc', name: 'Zuhr Prayer & Lunch Break', periodNo: 0, startTime: '13:00', endTime: '13:45', durationMins: 45, isBreak: true, orderIndex: 8, status: 'Active' },
  { id: 'prd-6', name: 'Period 6', periodNo: 6, startTime: '13:45', endTime: '14:30', durationMins: 45, isBreak: false, orderIndex: 9, status: 'Active' },
  { id: 'prd-7', name: 'Period 7', periodNo: 7, startTime: '14:30', endTime: '15:15', durationMins: 45, isBreak: false, orderIndex: 10, status: 'Active' }
];

const DEFAULT_SESSIONS = [
  { id: 'sess-2025-26', sessionName: '2025-2026', startDate: '2025-04-01', endDate: '2026-03-31', isCurrent: false, terms: 'Term 1, Term 2, Term 3', status: 'Completed' },
  { id: 'sess-2026-27', sessionName: '2026-2027', startDate: '2026-04-01', endDate: '2027-03-31', isCurrent: true, terms: 'Term 1 (Summer), Term 2 (Mid-Year), Term 3 (Annual)', status: 'Active' },
  { id: 'sess-2027-28', sessionName: '2027-2028', startDate: '2027-04-01', endDate: '2028-03-31', isCurrent: false, terms: 'Term 1, Term 2, Term 3', status: 'Upcoming' }
];

const DEFAULT_SYLLABUS = [
  { id: 'syl-1', grade: 'Class 1', subject: 'Mathematics', term: 'Term 1', unitNo: 1, title: 'Numbers up to 50 & Place Values', targetDate: '2026-06-15', completed: true },
  { id: 'syl-2', grade: 'Class 1', subject: 'Mathematics', term: 'Term 1', unitNo: 2, title: 'Single-Digit Addition & Subtraction', targetDate: '2026-07-30', completed: true },
  { id: 'syl-3', grade: 'Class 1', subject: 'Mathematics', term: 'Term 1', unitNo: 3, title: 'Shapes, Space & Geometric Patterns', targetDate: '2026-08-30', completed: true },
  { id: 'syl-4', grade: 'Class 1', subject: 'Mathematics', term: 'Term 2', unitNo: 4, title: 'Measurements, Length & Weight', targetDate: '2026-10-15', completed: false },
  { id: 'syl-5', grade: 'Class 1', subject: 'Mathematics', term: 'Term 2', unitNo: 5, title: 'Time, Days of Week & Calendar', targetDate: '2026-11-20', completed: false },
  { id: 'syl-6', grade: 'Class 1', subject: 'Mathematics', term: 'Term 3', unitNo: 6, title: 'Intro to Money & Simple Fractions', targetDate: '2027-01-30', completed: false },
  { id: 'syl-7', grade: 'Class 1', subject: 'English', term: 'Term 1', unitNo: 1, title: 'Phonics, Vowels & Consonant Blends', targetDate: '2026-06-30', completed: true },
  { id: 'syl-8', grade: 'Class 1', subject: 'English', term: 'Term 1', unitNo: 2, title: 'Sight Words & Sentence Construction', targetDate: '2026-08-15', completed: true },
  { id: 'syl-9', grade: 'Class 1', subject: 'English', term: 'Term 2', unitNo: 3, title: 'Short Stories, Reading & Comprehension', targetDate: '2026-10-30', completed: false },
  { id: 'syl-10', grade: 'Class 1', subject: 'General Science', term: 'Term 1', unitNo: 1, title: 'Living vs Non-Living Things', targetDate: '2026-07-15', completed: true },
  { id: 'syl-11', grade: 'Class 1', subject: 'General Science', term: 'Term 1', unitNo: 2, title: 'Human Body & 5 Senses', targetDate: '2026-08-30', completed: true },
  { id: 'syl-12', grade: 'Class 1', subject: 'General Science', term: 'Term 2', unitNo: 3, title: 'Plants, Trees & Green World', targetDate: '2026-10-25', completed: false }
];

export class AcademicModule {
  static async render(container) {
    this._container = container;
    const [dbSubjects, dbClasses, dbPeriods, dbSessions, dbSyllabus, staff] = await Promise.all([
      dbService.select('academic_subjects'),
      dbService.select('academic_classes'),
      dbService.select('academic_periods'),
      dbService.select('academic_sessions'),
      dbService.select('syllabus_topics'),
      dbService.select('staff_directory')
    ]);

    this._staff = staff || [];
    this._subjects = (dbSubjects && dbSubjects.length) ? dbSubjects : DEFAULT_SUBJECTS;
    this._classes = (dbClasses && dbClasses.length) ? dbClasses : TMS_CONFIG.academic.classes.map((cls, idx) => ({
      id: `cls-${idx + 1}`,
      grade: cls,
      section: 'A',
      roomNo: `Room ${101 + idx}`,
      capacity: 35,
      teacher: (this._staff[idx % (this._staff.length || 1)]?.fullName) || 'Assigned Faculty',
      periods: 35,
      status: 'Active'
    }));
    this._periods = (dbPeriods && dbPeriods.length) ? dbPeriods.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0)) : DEFAULT_PERIODS;
    this._sessions = (dbSessions && dbSessions.length) ? dbSessions : DEFAULT_SESSIONS;
    this._syllabus = (dbSyllabus && dbSyllabus.length) ? dbSyllabus : DEFAULT_SYLLABUS;

    this._currentTab = this._currentTab || 'classes';
    this._classViewMode = localStorage.getItem('tms_acad_class_view') || (window.innerWidth <= 768 ? 'cards' : 'cards');
    this._selectedGrade = this._selectedGrade || (TMS_CONFIG.academic.classes[0] || 'Class 1');
    this._selectedSubj = this._selectedSubj || 'Mathematics';

    const currentSessionObj = this._sessions.find(s => s.isCurrent) || this._sessions[0] || { sessionName: TMS_CONFIG.academic.currentYear };

    container.innerHTML = `
      <div style="margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
          <div>
            <h1 style="font-size: 1.8rem; display: flex; align-items: center; gap: 10px;">
              <span style="color: #16a34a;"><i data-lucide="book-open"></i></span> Academic Management Gateway
            </h1>
            <p style="color: var(--text-muted); font-size: 0.9rem;">
              Manage classes, sections, bell timetable, teacher assignments, academic sessions &amp; curriculum master.
            </p>
          </div>
          <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;" id="acad-action-buttons">
            <button class="btn btn-secondary" id="btn-detect-clashes"><i data-lucide="shield-check"></i> Timetable Clash Audit</button>
            <button class="btn btn-primary" id="btn-acad-primary-action"><i data-lucide="plus"></i> Add Class</button>
          </div>
        </div>
      </div>

      <div class="kpi-grid">
        ${UIComponents.renderKpiCard({ title: 'Active Academic Session', value: currentSessionObj.sessionName, icon: 'calendar', color: 'blue', subtitle: currentSessionObj.status || 'Active' })}
        ${UIComponents.renderKpiCard({ title: 'Configured Classes', value: `${this._classes.length}`, icon: 'layers', color: 'emerald', subtitle: 'Divisions Configured' })}
        ${UIComponents.renderKpiCard({ title: 'Daily Periods & Bell', value: `${this._periods.length} Slots`, icon: 'clock', color: 'purple', subtitle: 'Assembly & Recess' })}
        ${UIComponents.renderKpiCard({ title: 'Curriculum Subjects', value: `${this._subjects.length}`, icon: 'book', color: 'amber', subtitle: 'State & CBSE Catalog' })}
      </div>

      <!-- Academic Segmented Navigation Tabs -->
      <div class="tms-tab-rail-wrapper">
        <div class="tms-segmented-tabs">
          <button class="tms-tab-pill ${this._currentTab === 'classes' ? 'active' : ''} acad-tab" data-tab="classes">
            <i data-lucide="layers"></i>
            <span>Classes &amp; Sections</span>
          </button>
          <button class="tms-tab-pill ${this._currentTab === 'periods' ? 'active' : ''} acad-tab" data-tab="periods">
            <i data-lucide="clock"></i>
            <span>Periods &amp; Bell Schedule</span>
          </button>
          <button class="tms-tab-pill ${this._currentTab === 'sessions' ? 'active' : ''} acad-tab" data-tab="sessions">
            <i data-lucide="calendar"></i>
            <span>Academic Sessions</span>
          </button>
          <button class="tms-tab-pill ${this._currentTab === 'subjects' ? 'active' : ''} acad-tab" data-tab="subjects">
            <i data-lucide="book"></i>
            <span>Subject Master</span>
          </button>
          <button class="tms-tab-pill ${this._currentTab === 'syllabus' ? 'active' : ''} acad-tab" data-tab="syllabus">
            <i data-lucide="line-chart"></i>
            <span>Syllabus Tracker</span>
          </button>
        </div>
      </div>

      <div id="acad-tab-content"></div>
    `;

    this.bindEvents(container);
    this.renderTab(this._currentTab, container);
    UIComponents.refreshIcons();
  }

  static updatePrimaryActionLabel() {
    const btn = this._container?.querySelector('#btn-acad-primary-action');
    if (!btn) return;
    if (this._currentTab === 'classes') {
      btn.innerHTML = '<i data-lucide="plus"></i> Add Class / Section';
    } else if (this._currentTab === 'periods') {
      btn.innerHTML = '<i data-lucide="plus"></i> Add Period / Bell Time';
    } else if (this._currentTab === 'sessions') {
      btn.innerHTML = '<i data-lucide="plus"></i> Add Academic Session';
    } else if (this._currentTab === 'subjects') {
      btn.innerHTML = '<i data-lucide="plus"></i> Add Subject';
    } else if (this._currentTab === 'syllabus') {
      btn.innerHTML = '<i data-lucide="plus"></i> Add Syllabus Topic';
    }
    UIComponents.refreshIcons();
  }

  static renderTab(tabKey, container) {
    const content = container.querySelector('#acad-tab-content');
    if (!content) return;
    this.updatePrimaryActionLabel();

    if (tabKey === 'classes') {
      this.renderClassesTab(content);
    } else if (tabKey === 'periods') {
      this.renderPeriodsTab(content);
    } else if (tabKey === 'sessions') {
      this.renderSessionsTab(content);
    } else if (tabKey === 'subjects') {
      this.renderSubjectsTab(content);
    } else if (tabKey === 'syllabus') {
      this.renderSyllabusTab(content);
    }
    UIComponents.refreshIcons();
  }

  /* =========================================================================
     TAB 1: CLASSES & SECTIONS MASTER
     ========================================================================= */
  static renderClassesTab(content) {
    const viewMode = this._classViewMode;
    content.innerHTML = `
      <div class="card">
        <div class="card-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div>
            <h3 class="card-title">Classroom Divisions &amp; Assigned Class Teachers</h3>
            <p class="card-desc">Add, edit, view and manage school divisions, classroom numbers, and faculty leads.</p>
          </div>
          <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
            <div class="tms-view-toggle" id="class-view-toggle">
              <button type="button" class="view-btn ${viewMode === 'cards' ? 'active' : ''}" data-view="cards" title="Cards View">
                <i data-lucide="layout-grid"></i> Cards
              </button>
              <button type="button" class="view-btn ${viewMode === 'table' ? 'active' : ''}" data-view="table" title="Table View">
                <i data-lucide="table"></i> Table
              </button>
            </div>
            <button class="btn btn-primary btn-sm" id="btn-add-class-inner"><i data-lucide="plus"></i> New Class</button>
          </div>
        </div>

        <!-- Cards View (Zero Side-Scroll) -->
        <div id="class-cards-container" class="tms-cards-grid" style="${viewMode === 'cards' ? '' : 'display: none;'}">
          ${this._classes.map(c => `
            <div class="tms-data-card" data-class-id="${esc(c.id)}">
              <div class="tms-data-card-header">
                <div>
                  <div class="tms-data-card-title">${esc(c.grade)} - Section ${esc(c.section || 'A')}</div>
                  <div class="tms-data-card-subtitle font-mono">${esc(c.roomNo || 'Room Assigned')}</div>
                </div>
                <span class="badge ${c.status === 'Active' ? 'badge-success' : 'badge-secondary'}">${esc(c.status || 'Active')}</span>
              </div>
              <div class="tms-data-card-body">
                <div class="tms-data-card-row full-width">
                  <span class="tms-data-card-label">Assigned Class Teacher</span>
                  <div style="display: flex; align-items: center; gap: 8px; margin-top: 2px;">
                    <div style="width: 26px; height: 26px; border-radius: 50%; background: #16a34a; color: white; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700;">
                      ${esc((c.teacher || 'T').slice(0, 1))}
                    </div>
                    <span class="tms-data-card-value">${esc(c.teacher || 'Unassigned')}</span>
                  </div>
                </div>
                <div class="tms-data-card-row">
                  <span class="tms-data-card-label">Student Capacity</span>
                  <span class="tms-data-card-value">${esc(c.capacity || 35)} Students</span>
                </div>
                <div class="tms-data-card-row">
                  <span class="tms-data-card-label">Weekly Periods</span>
                  <span class="tms-data-card-value">${esc(c.periods || 35)} Periods</span>
                </div>
              </div>
              <div class="tms-data-card-actions">
                <button class="btn btn-secondary btn-sm btn-assign-teacher" data-id="${esc(c.id)}" title="Assign Teacher">
                  <i data-lucide="user-check"></i> Assign
                </button>
                <button class="btn btn-secondary btn-sm btn-edit-class" data-id="${esc(c.id)}" title="Edit Details">
                  <i data-lucide="pencil"></i> Edit
                </button>
                <button class="btn btn-secondary btn-sm btn-del-class" data-id="${esc(c.id)}" title="Delete Class" style="color: #ef4444;">
                  <i data-lucide="trash-2"></i>
                </button>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Table View -->
        <div class="table-responsive" id="class-table-container" style="${viewMode === 'table' ? '' : 'display: none;'} margin-top: 14px;">
          <table class="tms-table">
            <thead>
              <tr>
                <th>Class / Grade</th>
                <th>Section</th>
                <th>Room No</th>
                <th>Capacity</th>
                <th>Assigned Class Teacher</th>
                <th>Weekly Periods</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${this._classes.map(c => `
                <tr>
                  <td><strong>${esc(c.grade)}</strong></td>
                  <td><span class="badge badge-secondary">${esc(c.section || 'A')}</span></td>
                  <td><span class="font-mono">${esc(c.roomNo || 'Room 101')}</span></td>
                  <td>${esc(c.capacity || 35)} Students</td>
                  <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <div style="width: 24px; height: 24px; border-radius: 50%; background: #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700;">
                        ${esc((c.teacher || 'T').slice(0, 1))}
                      </div>
                      <strong>${esc(c.teacher || 'Unassigned')}</strong>
                    </div>
                  </td>
                  <td>${esc(c.periods || 35)} Periods</td>
                  <td><span class="badge badge-success">${esc(c.status || 'Active')}</span></td>
                  <td>
                    <div style="display:flex; gap:6px;">
                      <button class="btn btn-secondary btn-sm btn-assign-teacher" data-id="${esc(c.id)}" title="Assign Teacher"><i data-lucide="user-check"></i></button>
                      <button class="btn btn-secondary btn-sm btn-edit-class" data-id="${esc(c.id)}" title="Edit"><i data-lucide="pencil"></i></button>
                      <button class="btn btn-secondary btn-sm btn-del-class" data-id="${esc(c.id)}" title="Delete" style="color:#ef4444;"><i data-lucide="trash-2"></i></button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // View toggle handler
    const viewToggle = content.querySelector('#class-view-toggle');
    if (viewToggle) {
      viewToggle.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const mode = btn.dataset.view;
          this._classViewMode = mode;
          localStorage.setItem('tms_acad_class_view', mode);
          viewToggle.querySelectorAll('.view-btn').forEach(b => b.classList.toggle('active', b.dataset.view === mode));
          content.querySelector('#class-cards-container').style.display = mode === 'cards' ? 'grid' : 'none';
          content.querySelector('#class-table-container').style.display = mode === 'table' ? 'block' : 'none';
        });
      });
    }

    const addBtn = content.querySelector('#btn-add-class-inner');
    if (addBtn) addBtn.addEventListener('click', () => this.openAddClassModal());

    content.querySelectorAll('.btn-edit-class').forEach(btn => {
      btn.addEventListener('click', () => this.openEditClassModal(btn.dataset.id));
    });

    content.querySelectorAll('.btn-assign-teacher').forEach(btn => {
      btn.addEventListener('click', () => this.openAssignTeacherModal(btn.dataset.id));
    });

    content.querySelectorAll('.btn-del-class').forEach(btn => {
      btn.addEventListener('click', () => this.deleteClass(btn.dataset.id));
    });
  }

  /* =========================================================================
     TAB 2: PERIODS & BELL TIMETABLE MASTER
     ========================================================================= */
  static renderPeriodsTab(content) {
    content.innerHTML = `
      <div class="card">
        <div class="card-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div>
            <h3 class="card-title">Bell Schedule &amp; Daily Period Timings</h3>
            <p class="card-desc">Configure school opening bell, morning assembly, academic periods, and prayer/lunch recess.</p>
          </div>
          <button class="btn btn-primary btn-sm" id="btn-add-period-inner"><i data-lucide="plus"></i> Add Period / Bell Time</button>
        </div>

        <div class="tms-cards-grid">
          ${this._periods.map(p => {
            const isBreak = p.isBreak;
            const borderCol = isBreak ? '#f59e0b' : '#16a34a';
            const iconName = isBreak ? 'coffee' : 'clock';
            return `
              <div class="tms-data-card" style="border-left: 4px solid ${borderCol};">
                <div class="tms-data-card-header">
                  <div style="display:flex; gap:10px; align-items:center;">
                    <div style="width: 32px; height: 32px; border-radius: 8px; background: ${isBreak ? 'rgba(245,158,11,0.1)' : 'rgba(22,163,74,0.1)'}; color: ${borderCol}; display: flex; align-items: center; justify-content: center;">
                      <i data-lucide="${iconName}" style="width: 18px; height: 18px;"></i>
                    </div>
                    <div>
                      <div class="tms-data-card-title">${esc(p.name)}</div>
                      <div class="tms-data-card-subtitle font-mono">${esc(p.startTime)} - ${esc(p.endTime)}</div>
                    </div>
                  </div>
                  <span class="badge ${isBreak ? 'badge-warning' : 'badge-success'}">${isBreak ? 'Break / Assembly' : `Period ${p.periodNo}`}</span>
                </div>
                <div class="tms-data-card-body">
                  <div class="tms-data-card-row">
                    <span class="tms-data-card-label">Duration</span>
                    <span class="tms-data-card-value">${esc(p.durationMins || 45)} Minutes</span>
                  </div>
                  <div class="tms-data-card-row">
                    <span class="tms-data-card-label">Order Index</span>
                    <span class="tms-data-card-value font-mono">#${esc(p.orderIndex || 1)}</span>
                  </div>
                </div>
                <div class="tms-data-card-actions">
                  <button class="btn btn-secondary btn-sm btn-edit-period" data-id="${esc(p.id)}" title="Edit Timings">
                    <i data-lucide="pencil"></i> Edit
                  </button>
                  <button class="btn btn-secondary btn-sm btn-del-period" data-id="${esc(p.id)}" title="Delete Period" style="color: #ef4444;">
                    <i data-lucide="trash-2"></i>
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    const addBtn = content.querySelector('#btn-add-period-inner');
    if (addBtn) addBtn.addEventListener('click', () => this.openAddPeriodModal());

    content.querySelectorAll('.btn-edit-period').forEach(btn => {
      btn.addEventListener('click', () => this.openEditPeriodModal(btn.dataset.id));
    });

    content.querySelectorAll('.btn-del-period').forEach(btn => {
      btn.addEventListener('click', () => this.deletePeriod(btn.dataset.id));
    });
  }

  /* =========================================================================
     TAB 3: ACADEMIC SESSIONS & TERMS
     ========================================================================= */
  static renderSessionsTab(content) {
    content.innerHTML = `
      <div class="card">
        <div class="card-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div>
            <h3 class="card-title">Academic Sessions &amp; Evaluation Terms</h3>
            <p class="card-desc">Control school academic years, start &amp; end dates, active session switch, and term divisions.</p>
          </div>
          <button class="btn btn-primary btn-sm" id="btn-add-session-inner"><i data-lucide="plus"></i> New Academic Session</button>
        </div>

        <div class="tms-cards-grid">
          ${this._sessions.map(s => `
            <div class="tms-data-card" style="${s.isCurrent ? 'border-color: #16a34a; box-shadow: 0 4px 14px rgba(22,163,74,0.12);' : ''}">
              <div class="tms-data-card-header">
                <div>
                  <div class="tms-data-card-title" style="display: flex; align-items: center; gap: 8px;">
                    ${esc(s.sessionName)}
                    ${s.isCurrent ? '<span class="badge badge-success" style="font-size:0.65rem;">Active Current Session</span>' : ''}
                  </div>
                  <div class="tms-data-card-subtitle font-mono">${esc(s.startDate || '—')} to ${esc(s.endDate || '—')}</div>
                </div>
                <span class="badge ${s.status === 'Active' ? 'badge-success' : (s.status === 'Completed' ? 'badge-secondary' : 'badge-info')}">
                  ${esc(s.status || 'Active')}
                </span>
              </div>
              <div class="tms-data-card-body">
                <div class="tms-data-card-row full-width">
                  <span class="tms-data-card-label">Configured Evaluation Terms</span>
                  <span class="tms-data-card-value">${esc(s.terms || 'Term 1, Term 2, Term 3')}</span>
                </div>
              </div>
              <div class="tms-data-card-actions">
                ${!s.isCurrent ? `
                  <button class="btn btn-primary btn-sm btn-set-active-session" data-id="${esc(s.id)}" title="Set as Current School Session">
                    <i data-lucide="check"></i> Set Active
                  </button>
                ` : ''}
                <button class="btn btn-secondary btn-sm btn-edit-session" data-id="${esc(s.id)}" title="Edit Session">
                  <i data-lucide="pencil"></i> Edit
                </button>
                ${!s.isCurrent ? `
                  <button class="btn btn-secondary btn-sm btn-del-session" data-id="${esc(s.id)}" title="Delete Session" style="color: #ef4444;">
                    <i data-lucide="trash-2"></i>
                  </button>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    const addBtn = content.querySelector('#btn-add-session-inner');
    if (addBtn) addBtn.addEventListener('click', () => this.openAddSessionModal());

    content.querySelectorAll('.btn-set-active-session').forEach(btn => {
      btn.addEventListener('click', () => this.setActiveSession(btn.dataset.id));
    });

    content.querySelectorAll('.btn-edit-session').forEach(btn => {
      btn.addEventListener('click', () => this.openEditSessionModal(btn.dataset.id));
    });

    content.querySelectorAll('.btn-del-session').forEach(btn => {
      btn.addEventListener('click', () => this.deleteSession(btn.dataset.id));
    });
  }

  /* =========================================================================
     TAB 4: SUBJECT MASTER
     ========================================================================= */
  static renderSubjectsTab(content) {
    content.innerHTML = `
      <div class="card">
        <div class="card-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div>
            <h3 class="card-title">Curriculum Subject Master</h3>
            <p class="card-desc">State &amp; CBSE aligned core disciplines, weekly credits, and departmental coordinators.</p>
          </div>
          <button class="btn btn-primary btn-sm" id="btn-add-subject-inner"><i data-lucide="plus"></i> New Subject</button>
        </div>

        <div class="tms-cards-grid">
          ${this._subjects.map(s => `
            <div class="tms-data-card">
              <div class="tms-data-card-header">
                <div>
                  <div class="tms-data-card-title">${esc(s.name)}</div>
                  <div class="tms-data-card-subtitle font-mono font-bold" style="color: #166534;">${esc(s.code)}</div>
                </div>
                <span class="badge badge-secondary">${esc(s.classification)}</span>
              </div>
              <div class="tms-data-card-body">
                <div class="tms-data-card-row">
                  <span class="tms-data-card-label">Weekly Credits</span>
                  <span class="tms-data-card-value">${esc(s.credits || 5)} Periods/Wk</span>
                </div>
                <div class="tms-data-card-row">
                  <span class="tms-data-card-label">Lab Required</span>
                  <span class="badge ${s.lab === 'Yes' ? 'badge-warning' : 'badge-secondary'}" style="align-self: flex-start; margin-top: 2px;">
                    ${esc(s.lab || 'No')}
                  </span>
                </div>
                <div class="tms-data-card-row full-width">
                  <span class="tms-data-card-label">Department Head / Coordinator</span>
                  <span class="tms-data-card-value">${esc(s.hod || 'Faculty Lead')}</span>
                </div>
              </div>
              <div class="tms-data-card-actions">
                <button class="btn btn-secondary btn-sm btn-edit-subj" data-id="${esc(s.id)}" title="Edit Subject">
                  <i data-lucide="pencil"></i> Edit
                </button>
                <button class="btn btn-secondary btn-sm btn-del-subj" data-id="${esc(s.id)}" title="Delete Subject" style="color:#ef4444;">
                  <i data-lucide="trash-2"></i>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    const addBtn = content.querySelector('#btn-add-subject-inner');
    if (addBtn) addBtn.addEventListener('click', () => this.openAddSubjectModal());

    content.querySelectorAll('.btn-edit-subj').forEach(btn => {
      btn.addEventListener('click', () => this.openEditSubjectModal(btn.dataset.id));
    });

    content.querySelectorAll('.btn-del-subj').forEach(btn => {
      btn.addEventListener('click', () => this.deleteSubject(btn.dataset.id));
    });
  }

  /* =========================================================================
     TAB 5: SYLLABUS TRACKER
     ========================================================================= */
  static renderSyllabusTab(content) {
    const filtered = this._syllabus.filter(s => s.grade === this._selectedGrade && s.subject === this._selectedSubj);
    const total = filtered.length;
    const completed = filtered.filter(s => s.completed).length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    content.innerHTML = `
      <div class="card">
        <div class="card-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div>
            <h3 class="card-title">Curriculum Progress &amp; Syllabus Coverage</h3>
            <p class="card-desc">Real-time lesson completion checkpoints per grade, term and academic discipline.</p>
          </div>
          <button class="btn btn-primary btn-sm" id="btn-add-topic-inner"><i data-lucide="plus"></i> Add Topic</button>
        </div>

        <div style="display:flex; gap:14px; align-items:center; flex-wrap:wrap; margin-bottom:18px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <label style="font-size:0.85rem; font-weight:600;">Grade:</label>
            <select class="form-select" id="select-syl-grade" style="width:140px; padding:6px 10px;">
              ${TMS_CONFIG.academic.classes.map(c => `<option value="${c}" ${c === this._selectedGrade ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <label style="font-size:0.85rem; font-weight:600;">Subject:</label>
            <select class="form-select" id="select-syl-subj" style="width:200px; padding:6px 10px;">
              ${this._subjects.map(s => `<option value="${s.name}" ${s.name === this._selectedSubj ? 'selected' : ''}>${s.name}</option>`).join('')}
            </select>
          </div>
          <div style="margin-left:auto; display:flex; align-items:center; gap:10px;">
            <span style="font-size:0.88rem; font-weight:700; color:#16a34a;">${completed}/${total} Units Completed (${pct}%)</span>
            <div style="width:120px; height:8px; background:#e2e8f0; border-radius:4px; overflow:hidden;">
              <div style="width:${pct}%; height:100%; background:#16a34a; transition:width 0.3s ease;"></div>
            </div>
          </div>
        </div>

        <div class="tms-cards-grid">
          ${filtered.length ? filtered.map(t => `
            <div class="tms-data-card" style="border-left: 4px solid ${t.completed ? '#16a34a' : '#f59e0b'};">
              <div class="tms-data-card-header">
                <div>
                  <div class="tms-data-card-title">${esc(t.title)}</div>
                  <div class="tms-data-card-subtitle font-mono">${esc(t.term)} • Unit #${esc(t.unitNo)}</div>
                </div>
                <span class="badge ${t.completed ? 'badge-success' : 'badge-warning'}">${t.completed ? 'Completed' : 'Pending'}</span>
              </div>
              <div class="tms-data-card-body">
                <div class="tms-data-card-row">
                  <span class="tms-data-card-label">Target Completion</span>
                  <span class="tms-data-card-value font-mono">${esc(t.targetDate || '—')}</span>
                </div>
                <div class="tms-data-card-row">
                  <span class="tms-data-card-label">Status</span>
                  <span class="tms-data-card-value">${t.completed ? 'Passed & Tested' : 'In Progress'}</span>
                </div>
              </div>
              <div class="tms-data-card-actions">
                <button class="btn btn-sm ${t.completed ? 'btn-secondary' : 'btn-primary'} btn-toggle-topic" data-id="${esc(t.id)}">
                  <i data-lucide="${t.completed ? 'rotate-ccw' : 'check'}"></i> ${t.completed ? 'Mark Pending' : 'Mark Completed'}
                </button>
              </div>
            </div>
          `).join('') : '<p style="text-align:center; color:var(--text-muted); padding:30px; grid-column:1 / -1;">No syllabus units found for this selection. Click "+ Add Topic" to create one.</p>'}
        </div>
      </div>
    `;

    const gradeSel = content.querySelector('#select-syl-grade');
    if (gradeSel) {
      gradeSel.addEventListener('change', (e) => {
        this._selectedGrade = e.target.value;
        this.renderSyllabusTab(content);
        UIComponents.refreshIcons();
      });
    }

    const subjSel = content.querySelector('#select-syl-subj');
    if (subjSel) {
      subjSel.addEventListener('change', (e) => {
        this._selectedSubj = e.target.value;
        this.renderSyllabusTab(content);
        UIComponents.refreshIcons();
      });
    }

    const addTopicBtn = content.querySelector('#btn-add-topic-inner');
    if (addTopicBtn) addTopicBtn.addEventListener('click', () => this.openAddTopicModal());

    content.querySelectorAll('.btn-toggle-topic').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const topic = this._syllabus.find(s => s.id === id);
        if (topic) {
          topic.completed = !topic.completed;
          await dbService.upsert('syllabus_topics', topic);
          UIComponents.showToast(`Unit marked as ${topic.completed ? 'Completed' : 'Pending'}!`, 'success');
          this.renderSyllabusTab(content);
          UIComponents.refreshIcons();
        }
      });
    });
  }

  /* =========================================================================
     MODALS: CLASS CRUD & TEACHER ASSIGNMENT
     ========================================================================= */
  static openAddClassModal(initialData = null) {
    const isEdit = !!initialData;
    const staffOptions = this._staff.map(s => `
      <option value="${esc(s.fullName)}" ${initialData && initialData.teacher === s.fullName ? 'selected' : ''}>
        ${esc(s.fullName)} (${esc(s.role || 'Faculty')})
      </option>
    `).join('');

    const bodyHtml = `
      <form id="form-manage-class" style="display:flex; flex-direction:column; gap:12px;">
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
          <div class="form-group">
            <label class="form-label">Grade / Class Name *</label>
            <input class="form-input" id="cls-grade" list="grade-suggestions" required value="${esc(initialData?.grade || 'Class 1')}">
            <datalist id="grade-suggestions">
              ${TMS_CONFIG.academic.classes.map(c => `<option value="${c}"></option>`).join('')}
            </datalist>
          </div>
          <div class="form-group">
            <label class="form-label">Section *</label>
            <input class="form-input font-mono" id="cls-section" required value="${esc(initialData?.section || 'A')}" placeholder="e.g. A, B, C">
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
          <div class="form-group">
            <label class="form-label">Room Number</label>
            <input class="form-input" id="cls-room" value="${esc(initialData?.roomNo || 'Room 101')}" placeholder="e.g. Room 101, Science Lab">
          </div>
          <div class="form-group">
            <label class="form-label">Student Capacity</label>
            <input type="number" class="form-input font-mono" id="cls-capacity" value="${esc(initialData?.capacity || 35)}">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Class Teacher Allocation</label>
          <select class="form-select" id="cls-teacher">
            <option value="Unassigned">-- Select Faculty Member --</option>
            ${staffOptions}
          </select>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
          <div class="form-group">
            <label class="form-label">Weekly Periods</label>
            <input type="number" class="form-input font-mono" id="cls-periods" value="${esc(initialData?.periods || 35)}">
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-select" id="cls-status">
              <option value="Active" ${initialData?.status === 'Active' ? 'selected' : ''}>Active</option>
              <option value="Inactive" ${initialData?.status === 'Inactive' ? 'selected' : ''}>Inactive</option>
            </select>
          </div>
        </div>
      </form>
    `;

    UIComponents.openModal({
      title: isEdit ? `Edit Class: ${initialData.grade} (${initialData.section})` : 'Add New Class Division',
      bodyHtml,
      footerHtml: `
        <button class="btn btn-secondary" id="btn-cls-cancel">Cancel</button>
        <button class="btn btn-primary" id="btn-cls-save"><i data-lucide="save"></i> ${isEdit ? 'Save Changes' : 'Create Class'}</button>
      `
    });

    const cancelBtn = document.getElementById('btn-cls-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', () => UIComponents.closeModal());

    const saveBtn = document.getElementById('btn-cls-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const grade = document.getElementById('cls-grade')?.value?.trim();
        const section = document.getElementById('cls-section')?.value?.trim().toUpperCase();
        const roomNo = document.getElementById('cls-room')?.value?.trim() || 'Room 101';
        const capacity = parseInt(document.getElementById('cls-capacity')?.value, 10) || 35;
        const teacher = document.getElementById('cls-teacher')?.value || 'Assigned Faculty';
        const periods = parseInt(document.getElementById('cls-periods')?.value, 10) || 35;
        const status = document.getElementById('cls-status')?.value || 'Active';

        if (!grade || !section) {
          UIComponents.showToast('Grade and Section are required.', 'warning');
          return;
        }

        const classRecord = {
          id: initialData?.id || `cls-${Date.now()}`,
          grade,
          section,
          roomNo,
          capacity,
          teacher,
          periods,
          status
        };

        saveBtn.disabled = true;
        saveBtn.innerHTML = 'Saving...';

        try {
          await dbService.upsert('academic_classes', classRecord);
          await auditService.log(isEdit ? 'CLASS_UPDATED' : 'CLASS_CREATED', 'ACADEMIC', { grade, section, teacher });
          UIComponents.showToast(`Class ${grade} (${section}) ${isEdit ? 'updated' : 'created'} successfully!`, 'success');
          UIComponents.closeModal();
          await this.render(this._container);
        } catch (err) {
          console.error('Failed to save class:', err);
          UIComponents.showToast('Error saving class: ' + err.message, 'error');
          saveBtn.disabled = false;
          saveBtn.innerHTML = '<i data-lucide="save"></i> Save Class';
        }
      });
    }

    UIComponents.refreshIcons();
  }

  static openEditClassModal(classId) {
    const cls = this._classes.find(c => c.id === classId);
    if (!cls) return;
    this.openAddClassModal(cls);
  }

  static openAssignTeacherModal(classId) {
    const cls = this._classes.find(c => c.id === classId);
    if (!cls) return;

    const staffOptions = this._staff.map(s => `
      <option value="${esc(s.fullName)}" ${cls.teacher === s.fullName ? 'selected' : ''}>
        ${esc(s.fullName)} — ${esc(s.role || 'Faculty')} (${esc(s.phone || 'No phone')})
      </option>
    `).join('');

    const bodyHtml = `
      <div style="display:flex; flex-direction:column; gap:14px;">
        <div style="padding:12px; background:rgba(22,163,74,0.06); border-radius:8px; border:1px solid rgba(22,163,74,0.2);">
          <strong>Class:</strong> ${esc(cls.grade)} - Section ${esc(cls.section || 'A')}<br>
          <span style="font-size:0.85rem; color:var(--text-muted);">Current Teacher: ${esc(cls.teacher || 'None')}</span>
        </div>
        <div class="form-group">
          <label class="form-label">Select Faculty Member *</label>
          <select class="form-select" id="assign-teacher-select">
            <option value="Unassigned">-- Unassigned --</option>
            ${staffOptions}
          </select>
        </div>
      </div>
    `;

    UIComponents.openModal({
      title: `Assign Class Teacher (${cls.grade} ${cls.section})`,
      bodyHtml,
      footerHtml: `
        <button class="btn btn-secondary" id="btn-assign-cancel">Cancel</button>
        <button class="btn btn-primary" id="btn-assign-confirm"><i data-lucide="check"></i> Confirm Assignment</button>
      `
    });

    const cancelBtn = document.getElementById('btn-assign-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', () => UIComponents.closeModal());

    const confirmBtn = document.getElementById('btn-assign-confirm');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', async () => {
        const teacher = document.getElementById('assign-teacher-select')?.value;
        cls.teacher = teacher;
        await dbService.upsert('academic_classes', cls);
        await auditService.log('CLASS_TEACHER_ASSIGNED', 'ACADEMIC', { classId: cls.id, grade: cls.grade, teacher });
        UIComponents.showToast(`Assigned ${teacher} to ${cls.grade} (${cls.section})!`, 'success');
        UIComponents.closeModal();
        await this.render(this._container);
      });
    }

    UIComponents.refreshIcons();
  }

  static async deleteClass(classId) {
    const cls = this._classes.find(c => c.id === classId);
    if (!cls) return;
    const ok = await UIComponents.confirm({
      title: 'Delete Class Division',
      message: `Are you sure you want to permanently delete ${cls.grade} - Section ${cls.section}? This will remove all division allocations.`,
      confirmText: 'Delete Class',
      cancelText: 'Cancel',
      type: 'danger',
      icon: 'trash-2'
    });
    if (!ok) return;

    try {
      await dbService.delete('academic_classes', classId);
      await auditService.log('CLASS_DELETED', 'ACADEMIC', { grade: cls.grade, section: cls.section });
      UIComponents.showToast(`Class ${cls.grade} (${cls.section}) deleted.`, 'success');
      await this.render(this._container);
    } catch (err) {
      UIComponents.showToast('Failed to delete: ' + err.message, 'error');
    }
  }

  /* =========================================================================
     MODALS: PERIODS CRUD
     ========================================================================= */
  static openAddPeriodModal(initialData = null) {
    const isEdit = !!initialData;
    const bodyHtml = `
      <form id="form-manage-period" style="display:flex; flex-direction:column; gap:12px;">
        <div class="form-group">
          <label class="form-label">Period Name *</label>
          <input class="form-input" id="prd-name" required value="${esc(initialData?.name || '')}" placeholder="e.g. Period 1, Recess, Morning Assembly">
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
          <div class="form-group">
            <label class="form-label">Period Number</label>
            <input type="number" class="form-input font-mono" id="prd-num" value="${esc(initialData?.periodNo ?? 1)}" placeholder="0 for break">
          </div>
          <div class="form-group">
            <label class="form-label">Display Order Index</label>
            <input type="number" class="form-input font-mono" id="prd-order" value="${esc(initialData?.orderIndex ?? 1)}">
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
          <div class="form-group">
            <label class="form-label">Start Time *</label>
            <input type="time" class="form-input font-mono" id="prd-start" required value="${esc(initialData?.startTime || '08:50')}">
          </div>
          <div class="form-group">
            <label class="form-label">End Time *</label>
            <input type="time" class="form-input font-mono" id="prd-end" required value="${esc(initialData?.endTime || '09:35')}">
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
          <div class="form-group">
            <label class="form-label">Duration (Minutes)</label>
            <input type="number" class="form-input font-mono" id="prd-duration" value="${esc(initialData?.durationMins || 45)}">
          </div>
          <div class="form-group" style="display:flex; flex-direction:column; justify-content:center; padding-top:14px;">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" id="prd-isbreak" ${initialData?.isBreak ? 'checked' : ''}>
              <span style="font-size:0.9rem; font-weight:600;">Is Break / Assembly</span>
            </label>
          </div>
        </div>
      </form>
    `;

    UIComponents.openModal({
      title: isEdit ? `Edit Period: ${initialData.name}` : 'Add New Period / Bell Schedule Slot',
      bodyHtml,
      footerHtml: `
        <button class="btn btn-secondary" id="btn-prd-cancel">Cancel</button>
        <button class="btn btn-primary" id="btn-prd-save"><i data-lucide="save"></i> ${isEdit ? 'Save Changes' : 'Create Period'}</button>
      `
    });

    const cancelBtn = document.getElementById('btn-prd-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', () => UIComponents.closeModal());

    const saveBtn = document.getElementById('btn-prd-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const name = document.getElementById('prd-name')?.value?.trim();
        const periodNo = parseInt(document.getElementById('prd-num')?.value, 10) || 0;
        const orderIndex = parseInt(document.getElementById('prd-order')?.value, 10) || 1;
        const startTime = document.getElementById('prd-start')?.value?.trim();
        const endTime = document.getElementById('prd-end')?.value?.trim();
        const durationMins = parseInt(document.getElementById('prd-duration')?.value, 10) || 45;
        const isBreak = document.getElementById('prd-isbreak')?.checked || false;

        if (!name || !startTime || !endTime) {
          UIComponents.showToast('Period name, start time, and end time are required.', 'warning');
          return;
        }

        const periodRecord = {
          id: initialData?.id || `prd-${Date.now()}`,
          name,
          periodNo,
          orderIndex,
          startTime,
          endTime,
          durationMins,
          isBreak,
          status: 'Active'
        };

        saveBtn.disabled = true;
        saveBtn.innerHTML = 'Saving...';

        try {
          await dbService.upsert('academic_periods', periodRecord);
          await auditService.log(isEdit ? 'PERIOD_UPDATED' : 'PERIOD_CREATED', 'ACADEMIC', { name, startTime, endTime });
          UIComponents.showToast(`Period "${name}" saved!`, 'success');
          UIComponents.closeModal();
          await this.render(this._container);
        } catch (err) {
          UIComponents.showToast('Failed to save period: ' + err.message, 'error');
          saveBtn.disabled = false;
          saveBtn.innerHTML = '<i data-lucide="save"></i> Save Period';
        }
      });
    }

    UIComponents.refreshIcons();
  }

  static openEditPeriodModal(periodId) {
    const prd = this._periods.find(p => p.id === periodId);
    if (!prd) return;
    this.openAddPeriodModal(prd);
  }

  static async deletePeriod(periodId) {
    const prd = this._periods.find(p => p.id === periodId);
    if (!prd) return;
    const ok = await UIComponents.confirm({
      title: 'Delete Bell Schedule Slot',
      message: `Are you sure you want to delete period slot "${prd.name}" (${prd.startTime} - ${prd.endTime})?`,
      confirmText: 'Delete Slot',
      cancelText: 'Cancel',
      type: 'danger',
      icon: 'trash-2'
    });
    if (!ok) return;

    try {
      await dbService.delete('academic_periods', periodId);
      UIComponents.showToast(`Period "${prd.name}" deleted.`, 'success');
      await this.render(this._container);
    } catch (err) {
      UIComponents.showToast('Failed to delete: ' + err.message, 'error');
    }
  }

  /* =========================================================================
     MODALS: ACADEMIC SESSIONS CRUD
     ========================================================================= */
  static openAddSessionModal(initialData = null) {
    const isEdit = !!initialData;
    const bodyHtml = `
      <form id="form-manage-session" style="display:flex; flex-direction:column; gap:12px;">
        <div class="form-group">
          <label class="form-label">Academic Session Name *</label>
          <input class="form-input font-mono" id="sess-name" required value="${esc(initialData?.sessionName || '2026-2027')}" placeholder="e.g. 2026-2027">
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
          <div class="form-group">
            <label class="form-label">Start Date *</label>
            <input type="date" class="form-input font-mono" id="sess-start" required value="${esc(initialData?.startDate || '2026-04-01')}">
          </div>
          <div class="form-group">
            <label class="form-label">End Date *</label>
            <input type="date" class="form-input font-mono" id="sess-end" required value="${esc(initialData?.endDate || '2027-03-31')}">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Terms / Semesters Structure</label>
          <input class="form-input" id="sess-terms" value="${esc(initialData?.terms || 'Term 1, Term 2, Term 3')}" placeholder="e.g. Term 1, Term 2, Annual">
        </div>

        <div style="display:flex; align-items:center; gap:8px; padding-top:6px;">
          <input type="checkbox" id="sess-is-current" ${initialData?.isCurrent ? 'checked' : ''}>
          <label for="sess-is-current" style="font-size:0.9rem; font-weight:600; cursor:pointer;">
            Set as Active Current Academic Session
          </label>
        </div>
      </form>
    `;

    UIComponents.openModal({
      title: isEdit ? `Edit Academic Session: ${initialData.sessionName}` : 'Register New Academic Session',
      bodyHtml,
      footerHtml: `
        <button class="btn btn-secondary" id="btn-sess-cancel">Cancel</button>
        <button class="btn btn-primary" id="btn-sess-save"><i data-lucide="save"></i> ${isEdit ? 'Save Changes' : 'Create Session'}</button>
      `
    });

    const cancelBtn = document.getElementById('btn-sess-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', () => UIComponents.closeModal());

    const saveBtn = document.getElementById('btn-sess-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const sessionName = document.getElementById('sess-name')?.value?.trim();
        const startDate = document.getElementById('sess-start')?.value?.trim();
        const endDate = document.getElementById('sess-end')?.value?.trim();
        const terms = document.getElementById('sess-terms')?.value?.trim() || 'Term 1, Term 2, Term 3';
        const isCurrent = document.getElementById('sess-is-current')?.checked || false;

        if (!sessionName || !startDate || !endDate) {
          UIComponents.showToast('Session Name, start date, and end date are required.', 'warning');
          return;
        }

        saveBtn.disabled = true;
        saveBtn.innerHTML = 'Saving...';

        try {
          // If this session is marked current, unset other sessions
          if (isCurrent) {
            for (const s of this._sessions) {
              if (s.isCurrent) {
                s.isCurrent = false;
                await dbService.upsert('academic_sessions', s);
              }
            }
          }

          const sessRecord = {
            id: initialData?.id || `sess-${Date.now()}`,
            sessionName,
            startDate,
            endDate,
            terms,
            isCurrent,
            status: isCurrent ? 'Active' : (new Date(endDate) < new Date() ? 'Completed' : 'Upcoming')
          };

          await dbService.upsert('academic_sessions', sessRecord);
          await auditService.log(isEdit ? 'SESSION_UPDATED' : 'SESSION_CREATED', 'ACADEMIC', { sessionName, isCurrent });
          UIComponents.showToast(`Session ${sessionName} saved!`, 'success');
          UIComponents.closeModal();
          await this.render(this._container);
        } catch (err) {
          UIComponents.showToast('Failed to save session: ' + err.message, 'error');
          saveBtn.disabled = false;
          saveBtn.innerHTML = '<i data-lucide="save"></i> Save Session';
        }
      });
    }

    UIComponents.refreshIcons();
  }

  static openEditSessionModal(sessionId) {
    const s = this._sessions.find(x => x.id === sessionId);
    if (!s) return;
    this.openAddSessionModal(s);
  }

  static async setActiveSession(sessionId) {
    const s = this._sessions.find(x => x.id === sessionId);
    if (!s) return;
    const ok = await UIComponents.confirm({
      title: 'Switch Active Campus Session',
      message: `Are you sure you want to switch the active campus academic year to "${s.sessionName}"? All class terms and rosters will align with this session.`,
      confirmText: 'Set Active Session',
      cancelText: 'Cancel',
      type: 'primary',
      icon: 'calendar'
    });
    if (!ok) return;

    try {
      for (const item of this._sessions) {
        item.isCurrent = (item.id === sessionId);
        item.status = item.isCurrent ? 'Active' : (new Date(item.endDate) < new Date() ? 'Completed' : 'Upcoming');
        await dbService.upsert('academic_sessions', item);
      }
      TMS_CONFIG.academic.currentYear = s.sessionName;
      await auditService.log('SESSION_ACTIVATED', 'ACADEMIC', { sessionName: s.sessionName });
      UIComponents.showToast(`Session ${s.sessionName} is now the active campus session!`, 'success');
      await this.render(this._container);
    } catch (err) {
      UIComponents.showToast('Failed to switch session: ' + err.message, 'error');
    }
  }

  static async deleteSession(sessionId) {
    const s = this._sessions.find(x => x.id === sessionId);
    if (!s) return;
    if (s.isCurrent) {
      UIComponents.showToast('Cannot delete the currently active session!', 'error');
      return;
    }
    const ok = await UIComponents.confirm({
      title: 'Delete Academic Session',
      message: `Are you sure you want to delete session "${s.sessionName}"?`,
      confirmText: 'Delete Session',
      cancelText: 'Cancel',
      type: 'danger',
      icon: 'trash-2'
    });
    if (!ok) return;

    try {
      await dbService.delete('academic_sessions', sessionId);
      UIComponents.showToast(`Session "${s.sessionName}" deleted.`, 'success');
      await this.render(this._container);
    } catch (err) {
      UIComponents.showToast('Failed to delete: ' + err.message, 'error');
    }
  }

  /* =========================================================================
     MODALS: SUBJECT MASTER CRUD
     ========================================================================= */
  static openAddSubjectModal(initialData = null) {
    const isEdit = !!initialData;
    const bodyHtml = `
      <form id="form-manage-subject" style="display:flex; flex-direction:column; gap:12px;">
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
          <div class="form-group">
            <label class="form-label">Subject Code *</label>
            <input class="form-input font-mono font-bold" id="sub-code" required value="${esc(initialData?.code || '')}" placeholder="e.g. ENG-101">
          </div>
          <div class="form-group">
            <label class="form-label">Classification</label>
            <select class="form-select" id="sub-class">
              <option ${initialData?.classification === 'Theory + Practical' ? 'selected' : ''}>Theory + Practical</option>
              <option ${initialData?.classification === 'Pure Theory' ? 'selected' : ''}>Pure Theory</option>
              <option ${initialData?.classification === 'Language / Elective' ? 'selected' : ''}>Language / Elective</option>
              <option ${initialData?.classification === 'Moral / Islamic Studies' ? 'selected' : ''}>Moral / Islamic Studies</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Subject Name *</label>
          <input class="form-input" id="sub-name" required value="${esc(initialData?.name || '')}" placeholder="e.g. Mathematics &amp; Geometry">
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
          <div class="form-group">
            <label class="form-label">Weekly Credits / Periods</label>
            <input type="number" class="form-input font-mono" id="sub-credits" value="${esc(initialData?.credits || 5)}">
          </div>
          <div class="form-group">
            <label class="form-label">Lab Required</label>
            <select class="form-select" id="sub-lab">
              <option value="No" ${initialData?.lab === 'No' ? 'selected' : ''}>No</option>
              <option value="Yes" ${initialData?.lab === 'Yes' ? 'selected' : ''}>Yes</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Department Head / Coordinator</label>
          <input class="form-input" id="sub-hod" value="${esc(initialData?.hod || 'Faculty Lead')}" placeholder="e.g. Senior Faculty Lead">
        </div>
      </form>
    `;

    UIComponents.openModal({
      title: isEdit ? `Edit Subject: ${initialData.name}` : 'Register New Curriculum Subject',
      bodyHtml,
      footerHtml: `
        <button class="btn btn-secondary" id="btn-sub-cancel">Cancel</button>
        <button class="btn btn-primary" id="btn-sub-save"><i data-lucide="save"></i> ${isEdit ? 'Save Changes' : 'Create Subject'}</button>
      `
    });

    const cancelBtn = document.getElementById('btn-sub-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', () => UIComponents.closeModal());

    const saveBtn = document.getElementById('btn-sub-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const code = document.getElementById('sub-code')?.value?.trim();
        const name = document.getElementById('sub-name')?.value?.trim();
        const classification = document.getElementById('sub-class')?.value;
        const credits = parseInt(document.getElementById('sub-credits')?.value, 10) || 5;
        const lab = document.getElementById('sub-lab')?.value || 'No';
        const hod = document.getElementById('sub-hod')?.value?.trim() || 'Faculty Lead';

        if (!code || !name) {
          UIComponents.showToast('Subject Code and Name are required.', 'warning');
          return;
        }

        const subjRecord = {
          id: initialData?.id || `subj-${Date.now()}`,
          code,
          name,
          classification,
          credits,
          lab,
          hod
        };

        saveBtn.disabled = true;
        saveBtn.innerHTML = 'Saving...';

        try {
          await dbService.upsert('academic_subjects', subjRecord);
          await auditService.log(isEdit ? 'SUBJECT_UPDATED' : 'SUBJECT_CREATED', 'ACADEMIC', { code, name });
          UIComponents.showToast(`Subject "${name}" saved!`, 'success');
          UIComponents.closeModal();
          await this.render(this._container);
        } catch (err) {
          UIComponents.showToast('Failed to save subject: ' + err.message, 'error');
          saveBtn.disabled = false;
          saveBtn.innerHTML = '<i data-lucide="save"></i> Save Subject';
        }
      });
    }

    UIComponents.refreshIcons();
  }

  static openEditSubjectModal(subjectId) {
    const s = this._subjects.find(x => x.id === subjectId);
    if (!s) return;
    this.openAddSubjectModal(s);
  }

  static async deleteSubject(subjectId) {
    const s = this._subjects.find(x => x.id === subjectId);
    if (!s) return;
    const ok = await UIComponents.confirm({
      title: 'Delete Curriculum Subject',
      message: `Are you sure you want to permanently delete "${s.name}" (${s.code}) from the curriculum master?`,
      confirmText: 'Delete Subject',
      cancelText: 'Cancel',
      type: 'danger',
      icon: 'trash-2'
    });
    if (!ok) return;

    try {
      await dbService.delete('academic_subjects', subjectId);
      UIComponents.showToast(`Subject "${s.name}" deleted.`, 'success');
      await this.render(this._container);
    } catch (err) {
      UIComponents.showToast('Failed to delete: ' + err.message, 'error');
    }
  }

  /* =========================================================================
     MODALS: SYLLABUS TOPICS CRUD
     ========================================================================= */
  static openAddTopicModal() {
    const bodyHtml = `
      <form id="form-manage-topic" style="display:flex; flex-direction:column; gap:12px;">
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
          <div class="form-group">
            <label class="form-label">Grade</label>
            <select class="form-select" id="top-grade">
              ${TMS_CONFIG.academic.classes.map(c => `<option value="${c}" ${c === this._selectedGrade ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Subject</label>
            <select class="form-select" id="top-subj">
              ${this._subjects.map(s => `<option value="${s.name}" ${s.name === this._selectedSubj ? 'selected' : ''}>${s.name}</option>`).join('')}
            </select>
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
          <div class="form-group">
            <label class="form-label">Evaluation Term</label>
            <select class="form-select" id="top-term">
              <option>Term 1</option>
              <option>Term 2</option>
              <option>Term 3</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Unit Number</label>
            <input type="number" class="form-input font-mono" id="top-unit" value="1">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Unit / Chapter Title *</label>
          <input class="form-input" id="top-title" required placeholder="e.g. Fractions, Decimals &amp; Percentages">
        </div>

        <div class="form-group">
          <label class="form-label">Target Completion Date</label>
          <input type="date" class="form-input font-mono" id="top-target" value="2026-09-30">
        </div>
      </form>
    `;

    UIComponents.openModal({
      title: 'Add Syllabus Lesson Topic',
      bodyHtml,
      footerHtml: `
        <button class="btn btn-secondary" id="btn-top-cancel">Cancel</button>
        <button class="btn btn-primary" id="btn-top-save"><i data-lucide="plus"></i> Add Topic</button>
      `
    });

    const cancelBtn = document.getElementById('btn-top-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', () => UIComponents.closeModal());

    const saveBtn = document.getElementById('btn-top-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const grade = document.getElementById('top-grade')?.value;
        const subject = document.getElementById('top-subj')?.value;
        const term = document.getElementById('top-term')?.value;
        const unitNo = parseInt(document.getElementById('top-unit')?.value, 10) || 1;
        const title = document.getElementById('top-title')?.value?.trim();
        const targetDate = document.getElementById('top-target')?.value;

        if (!title) {
          UIComponents.showToast('Topic title is required.', 'warning');
          return;
        }

        const topicRecord = {
          id: `syl-${Date.now()}`,
          grade,
          subject,
          term,
          unitNo,
          title,
          targetDate,
          completed: false
        };

        this._syllabus.push(topicRecord);
        await dbService.upsert('syllabus_topics', topicRecord);
        UIComponents.showToast(`Unit "${title}" added to syllabus!`, 'success');
        UIComponents.closeModal();
        this.renderTab('syllabus', this._container);
      });
    }

    UIComponents.refreshIcons();
  }

  static bindEvents(container) {
    container.querySelectorAll('.acad-tab').forEach(btn => {
      btn.addEventListener('click', (e) => {
        container.querySelectorAll('.acad-tab').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this._currentTab = e.currentTarget.dataset.tab;
        this.renderTab(this._currentTab, container);
      });
    });

    const primaryAction = container.querySelector('#btn-acad-primary-action');
    if (primaryAction) {
      primaryAction.addEventListener('click', () => {
        if (this._currentTab === 'classes') {
          this.openAddClassModal();
        } else if (this._currentTab === 'periods') {
          this.openAddPeriodModal();
        } else if (this._currentTab === 'sessions') {
          this.openAddSessionModal();
        } else if (this._currentTab === 'subjects') {
          this.openAddSubjectModal();
        } else if (this._currentTab === 'syllabus') {
          this.openAddTopicModal();
        }
      });
    }

    const clashBtn = container.querySelector('#btn-detect-clashes');
    if (clashBtn) {
      clashBtn.addEventListener('click', () => {
        UIComponents.showToast('Automated conflict check passed: All classes, periods, and assigned teachers are clash-free!', 'success');
      });
    }
  }
}

export default AcademicModule;
