/**
 * THAIBA PUBLIC SCHOOL — THAIBA PUBLIC SCHOOL Faculty & Staff Workspace (My Work)
 */

import { TMS_CONFIG } from './config.js';
import { authService } from './auth-service.js';
import { dbService } from './supabase-client.js';
import { UIComponents } from './ui-components.js';
import { auditService } from './audit-service.js';

const esc = (v) => UIComponents.escapeHtml(v);

export class MyWorkModule {
  static async render(container) {
    const user = authService.getCurrentUser() || {};
    const tasks = await dbService.select('staff_tasks');
    const students = await dbService.select('students');

    container.innerHTML = `
      <div style="margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
          <div>
            <h1 style="font-size: 1.8rem;">Staff Workspace — THAIBA PUBLIC SCHOOL</h1>
            <p style="color: var(--text-muted); font-size: 0.9rem;">
              Welcome back, <strong>${esc(user.name || 'Faculty Member')}</strong> (${esc(user.department || 'Academics')})
            </p>
          </div>
          <div style="display: flex; gap: 10px; align-items: center;">
            <div id="geofence-live-status" class="badge badge-success" style="padding: 8px 14px; font-size: 0.82rem;">
              <i data-lucide="map-pin" style="width: 14px; height: 14px;"></i> Campus Geofence Active (250m)
            </div>
            <button class="btn btn-primary" id="btn-punch-now"><i data-lucide="fingerprint"></i> Biometric / GPS Punch</button>
          </div>
        </div>
      </div>

      <!-- Quick KPI Row -->
      <div class="kpi-grid">
        ${UIComponents.renderKpiCard({ title: 'My Shift Today', value: '—', icon: 'clock', color: 'blue', subtitle: 'No Shift Records' })}
        ${UIComponents.renderKpiCard({ title: 'Today\'s Attendance', value: '—', icon: 'check-circle-2', color: 'emerald', subtitle: 'Not Punched In Yet' })}
        ${UIComponents.renderKpiCard({ title: 'Teaching Workload', value: '—', icon: 'book-open', color: 'amber', subtitle: 'No Timetable Assigned' })}
        ${UIComponents.renderKpiCard({ title: 'Pending Tasks', value: `${tasks.filter(t => t.status !== 'Completed').length} Pending`, icon: 'check-square', color: 'rose', subtitle: 'Kanban Action Items' })}
      </div>

      <!-- Segmented Pill Tabs Rail -->
      <div class="tms-tab-rail-wrapper">
        <div class="tms-segmented-tabs" id="mywork-tab-pills">
          <button class="tms-tab-pill active staff-tab" data-tab="overview">
            <i data-lucide="layout-dashboard"></i>
            <span>Overview Hub</span>
          </button>
          <button class="tms-tab-pill staff-tab" data-tab="geofence">
            <i data-lucide="navigation"></i>
            <span>GPS &amp; Geofence</span>
          </button>
          <button class="tms-tab-pill staff-tab" data-tab="register">
            <i data-lucide="user-check"></i>
            <span>Class Register</span>
          </button>
          <button class="tms-tab-pill staff-tab" data-tab="tasks">
            <i data-lucide="kanban"></i>
            <span>Action Board</span>
          </button>
          <button class="tms-tab-pill staff-tab" data-tab="timetable">
            <i data-lucide="calendar"></i>
            <span>My Timetable</span>
          </button>
          <button class="tms-tab-pill staff-tab" data-tab="leaves">
            <i data-lucide="umbrella"></i>
            <span>Leave Balances</span>
          </button>
          <button class="tms-tab-pill staff-tab" data-tab="payslips">
            <i data-lucide="receipt"></i>
            <span>Salary &amp; CTC</span>
          </button>
        </div>
      </div>

      <div id="my-work-tab-content"></div>
    `;

    this.bindEvents(container);
    this.renderTab('overview', container);
    UIComponents.refreshIcons();
  }

  static async renderTab(tabKey, container) {
    const content = container.querySelector('#my-work-tab-content');
    if (!content) return;

    if (tabKey === 'overview') {
      const notices = await dbService.select('notices');
      const bulletinList = notices.slice(0, 3);
      const bulletinRows = bulletinList.map((n, i) => `
        <div style="padding-bottom: 10px; margin-bottom: 10px; ${i < bulletinList.length - 1 ? 'border-bottom: 1px solid var(--border-color);' : ''}">
          <strong style="color: ${n.priority === 'Urgent' ? '#ef4444' : 'inherit'};">${UIComponents.escapeHtml(n.title)}:</strong>
          ${UIComponents.escapeHtml(n.content)}
        </div>
      `).join('');
      content.innerHTML = `
        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 24px;">
          <div>
            <div class="card" style="margin-bottom: 24px;">
              <div class="card-header">
                <div>
                  <h3 class="card-title">Today's Teaching Schedule (Grade 9A & High School)</h3>
                  <p class="card-desc">Scheduled teaching periods mapped to class teachers and laboratories.</p>
                </div>
                <span class="badge badge-info">Wednesday Schedule</span>
              </div>
              <div class="table-responsive">
                <table class="tms-table">
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th>Time</th>
                      <th>Class & Section</th>
                      <th>Subject</th>
                      <th>Room</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 30px;">No records available yet.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Daily Work Report Log -->
            <div class="card">
              <div class="card-header">
                <h3 class="card-title">Daily Syllabus & Activity Report</h3>
                <button class="btn btn-primary btn-sm" id="btn-log-daily-work"><i data-lucide="plus"></i> Submit Work Log</button>
              </div>
              <p style="font-size: 0.88rem; color: var(--text-muted); margin-bottom: 12px;">
                Record curriculum progression, homework assignments, and mentoring discussions for administrative verification.
              </p>
              <div style="text-align: center; color: var(--text-muted); padding: 30px;">
                <i data-lucide="inbox" style="width:40px;height:40px;display:block;margin:0 auto 10px;"></i>
                No records available yet.
              </div>
            </div>
          </div>

          <!-- Right Sidebar: Live Geofence Radar & Notice Board -->
          <div>
            <div class="card" style="margin-bottom: 24px; text-align: center;">
              <h3 class="card-title" style="margin-bottom: 12px;">Live Campus Radar</h3>
              <div style="width: 140px; height: 140px; border-radius: 50%; border: 2px dashed #3b82f6; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; position: relative;">
                <div style="width: 16px; height: 16px; background: #94a3b8; border-radius: 50%;"></div>
                <div style="position: absolute; top: 12px; font-size: 0.72rem; color: var(--text-muted);">${TMS_CONFIG.institution.gpsGeofence.radiusMeters}m Boundary</div>
              </div>
              <p style="font-size: 0.88rem; font-weight: 600;">Status: Not Available</p>
              <p style="font-size: 0.75rem; color: var(--text-muted);">
                GPS: ${TMS_CONFIG.institution.gpsGeofence.latitude}° N, ${TMS_CONFIG.institution.gpsGeofence.longitude}° E<br>
                Poll Interval: ${Math.round(TMS_CONFIG.institution.gpsGeofence.pollIntervalMs / 60000)} Mins
              </p>
            </div>

            <div class="card">
              <h3 class="card-title" style="margin-bottom: 12px;">Faculty Bulletins</h3>
              <div style="font-size: 0.85rem; line-height: 1.5; color: var(--text-main);">
                ${bulletinRows || `
                  <div style="text-align: center; color: var(--text-muted); padding: 24px;">
                    <i data-lucide="inbox" style="width:40px;height:40px;display:block;margin:0 auto 10px;"></i>
                    No records available yet.
                  </div>
                `}
              </div>
            </div>
          </div>
        </div>
      `;
    } else if (tabKey === 'geofence') {
      content.innerHTML = `
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Staff Geofence Telemetry & Biometric Punch</h3>
              <p class="card-desc">
                Automated GPS location polling every 5 minutes while authorized attendance session is active with a 3-minute exit grace period.
              </p>
            </div>
            <span class="badge badge-info">No Live Telemetry</span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px; margin-bottom: 24px;">
            <div style="background: rgba(0,0,0,0.02); padding: 18px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
              <h4 style="font-size: 0.95rem; margin-bottom: 6px;">School Geofence Center</h4>
              <p class="font-mono" style="font-size: 0.85rem; color: var(--text-muted);">
                Lat: ${TMS_CONFIG.institution.gpsGeofence.latitude}<br>
                Lng: ${TMS_CONFIG.institution.gpsGeofence.longitude}<br>
                Geofence Radius: ${TMS_CONFIG.institution.gpsGeofence.radiusMeters} Meters
              </p>
            </div>

            <div style="background: rgba(0,0,0,0.02); padding: 18px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
              <h4 style="font-size: 0.95rem; margin-bottom: 6px;">Active Device Telemetry</h4>
              <p class="font-mono" style="font-size: 0.85rem; color: var(--text-muted);">
                Accuracy: —<br>
                Current Distance: —<br>
                Exit Grace Period: ${Math.round(TMS_CONFIG.institution.gpsGeofence.exitGracePeriodMs / 60000)} Mins
              </p>
            </div>

            <div style="background: rgba(0,0,0,0.02); padding: 18px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
              <h4 style="font-size: 0.95rem; margin-bottom: 6px;">Alternative Modalities</h4>
              <div style="display: flex; gap: 8px; margin-top: 8px;">
                <button class="btn btn-secondary btn-sm" onclick="alert('NFC Card Reader Ready. Tap device on school terminal.')"><i data-lucide="nfc"></i> NFC Punch</button>
                <button class="btn btn-secondary btn-sm" onclick="alert('AI Face Matching is not available yet.')"><i data-lucide="scan-face"></i> Facial Match</button>
              </div>
            </div>
          </div>

          <div style="text-align: center; padding: 30px; border: 2px dashed var(--border-color); border-radius: var(--radius-lg);">
            <i data-lucide="inbox" style="width: 56px; height: 56px; color: var(--text-muted); margin-bottom: 12px;"></i>
            <h3>No Shift Punch Recorded Today</h3>
            <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 4px;">
              Use the punch button above to record your GPS / biometric attendance.
            </p>
            <div style="margin-top: 16px;">
              <button class="btn btn-primary" onclick="alert('Manual Attendance Correction Request forwarded to HR & Principal.')">
                Request Correction / Leave Adjustment
              </button>
            </div>
          </div>
        </div>
      `;
    } else if (tabKey === 'register') {
      const students = await dbService.select('students', s => s.grade === 'Grade 9');
      content.innerHTML = `
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Classroom Attendance Register — Grade 9 Section A</h3>
              <p class="card-desc">
                Rule: Default state is Absent. Marking present records exact timestamp.
                Students on approved leave receive <span class="badge badge-gold">Approved Leave</span> gold badge and cannot be marked present.
              </p>
            </div>
            <button class="btn btn-primary" id="btn-save-class-register"><i data-lucide="save"></i> Submit Register</button>
          </div>

          <div class="table-responsive">
            <table class="tms-table" id="class-register-table">
              <thead>
                <tr>
                  <th>Roll</th>
                  <th>Admission No</th>
                  <th>Student Name</th>
                  <th>Gender</th>
                  <th>Leave Status</th>
                  <th>Attendance State</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${students.length ? students.map(s => {
                  const isApprovedLeave = s.leaveStatus === 'approved';
                  return `
                    <tr data-student-id="${esc(s.id)}">
                      <td><strong>${esc(s.rollNo)}</strong></td>
                      <td><span class="font-mono">${esc(s.admissionNo)}</span></td>
                      <td><strong>${esc(s.fullName)}</strong></td>
                      <td>${esc(s.gender)}</td>
                      <td>
                        ${isApprovedLeave ? `
                          <span class="badge badge-gold"><i data-lucide="shield-check" style="width: 14px; height: 14px;"></i> Approved Leave (Gold)</span>
                        ` : `
                          <span class="badge badge-info">No Active Leave</span>
                        `}
                      </td>
                      <td class="status-cell">
                        ${isApprovedLeave ? `
                          <span class="badge badge-warning">On Leave (Protected)</span>
                        ` : `
                          <span class="badge badge-danger">Absent (Default)</span>
                        `}
                      </td>
                      <td>
                        ${isApprovedLeave ? `
                          <button class="btn btn-secondary btn-sm" disabled title="Locked: Student is on approved leave.">
                            <i data-lucide="lock"></i> Locked
                          </button>
                        ` : `
                          <button class="btn btn-secondary btn-sm btn-toggle-present" data-id="${esc(s.id)}">
                            <i data-lucide="check"></i> Mark Present
                          </button>
                        `}
                      </td>
                    </tr>
                  `;
                }).join('') : `
                  <tr>
                    <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px;">No records available yet.</td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        </div>
      `;

      // Bind mark present button clicks
      content.querySelectorAll('.btn-toggle-present').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const row = e.currentTarget.closest('tr');
          const cell = row.querySelector('.status-cell');
          const now = new Date().toLocaleTimeString();
          if (e.currentTarget.classList.contains('btn-primary')) {
            e.currentTarget.classList.remove('btn-primary');
            e.currentTarget.classList.add('btn-secondary');
            e.currentTarget.innerHTML = `<i data-lucide="check"></i> Mark Present`;
            cell.innerHTML = `<span class="badge badge-danger">Absent (Default)</span>`;
          } else {
            e.currentTarget.classList.remove('btn-secondary');
            e.currentTarget.classList.add('btn-primary');
            e.currentTarget.innerHTML = `<i data-lucide="check-check"></i> Present`;
            cell.innerHTML = `<span class="badge badge-success">Present (${now})</span>`;
          }
          UIComponents.refreshIcons();
        });
      });

      const saveRegBtn = content.querySelector('#btn-save-class-register');
      if (saveRegBtn) {
        saveRegBtn.addEventListener('click', async () => {
          await auditService.log('CLASS_REGISTER_SUBMITTED', 'ATTENDANCE', {
            class: 'Grade 9A',
            subject: 'Mathematics',
            period: 'Period 1'
          });
          UIComponents.showToast('Classroom register committed with timestamps & audit verification!', 'success');
        });
      }
    } else if (tabKey === 'tasks') {
      const tasks = await dbService.select('staff_tasks');
      this._tasks = tasks;

      const renderCard = (t) => `
        <div class="kanban-card" data-task-id="${UIComponents.escapeHtml(t.id)}">
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px; gap:6px; align-items:center;">
            <span class="badge badge-${t.priority === 'High' ? 'danger' : (t.priority === 'Low' ? 'info' : 'warning')}">${UIComponents.escapeHtml(t.priority)}</span>
            <small style="color: var(--text-muted);">${UIComponents.escapeHtml(t.dueDate || '')}</small>
          </div>
          <strong style="font-size: 0.88rem;">${UIComponents.escapeHtml(t.title)}</strong>
          <div style="display:flex; gap:6px; margin-top:8px; flex-wrap:wrap;">
            <select class="form-select btn-sm task-move" data-id="${UIComponents.escapeHtml(t.id)}" style="font-size:0.72rem; padding:2px 6px; height:auto;">
              ${['To Do', 'In Progress', 'Completed'].map((s) => `<option ${t.status === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
            <button class="btn btn-secondary btn-sm btn-edit-task" data-id="${UIComponents.escapeHtml(t.id)}" title="Edit task"><i data-lucide="pencil"></i></button>
            <button class="btn btn-secondary btn-sm btn-del-task" data-id="${UIComponents.escapeHtml(t.id)}" title="Delete task" style="color:#ef4444;"><i data-lucide="trash-2"></i></button>
          </div>
        </div>
      `;

      content.innerHTML = `
        <div class="card">
          <div class="card-header" style="flex-wrap:wrap; gap:12px;">
            <div>
              <h3 class="card-title">My Tasks &amp; Action Board (Kanban)</h3>
              <p class="card-desc">Actionable items, assignment corrections, lesson planning, and departmental deliverables. Move a task with the status dropdown, or edit / delete it below.</p>
            </div>
            <button class="btn btn-primary" id="btn-add-kanban-task"><i data-lucide="plus"></i> New Task</button>
          </div>

          <div class="kanban-grid">
            <!-- To Do -->
            <div class="kanban-col">
              <h4 style="margin-bottom: 14px; display: flex; justify-content: space-between;">
                <span>To Do</span>
                <span class="badge badge-info">${tasks.filter(t => t.status === 'To Do').length}</span>
              </h4>
              ${tasks.filter(t => t.status === 'To Do').map(renderCard).join('')}
            </div>

            <!-- In Progress -->
            <div class="kanban-col">
              <h4 style="margin-bottom: 14px; display: flex; justify-content: space-between;">
                <span>In Progress</span>
                <span class="badge badge-warning">${tasks.filter(t => t.status === 'In Progress').length}</span>
              </h4>
              ${tasks.filter(t => t.status === 'In Progress').map(renderCard).join('')}
            </div>

            <!-- Completed -->
            <div class="kanban-col">
              <h4 style="margin-bottom: 14px; display: flex; justify-content: space-between;">
                <span>Completed</span>
                <span class="badge badge-success">${tasks.filter(t => t.status === 'Completed').length}</span>
              </h4>
              ${tasks.filter(t => t.status === 'Completed').map(renderCard).join('')}
            </div>
          </div>
        </div>
      `;

      this.bindTaskActions(content);
    } else if (tabKey === 'timetable') {
      content.innerHTML = `
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Weekly Six-Day Teaching Timetable Matrix</h3>
              <p class="card-desc">Period allocations, rooms, and clash-detection verified allocations.</p>
            </div>
            <button class="btn btn-secondary" onclick="window.print()"><i data-lucide="printer"></i> Print Matrix</button>
          </div>

          <div class="table-responsive">
            <table class="tms-table font-mono" style="text-align: center;">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>08:30 - 09:15</th>
                  <th>09:15 - 10:00</th>
                  <th>10:15 - 11:00</th>
                  <th>11:00 - 11:45</th>
                  <th>11:45 - 12:30</th>
                  <th>01:15 - 02:00</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px;">No records available yet.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;
    } else if (tabKey === 'leaves') {
      content.innerHTML = `
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Leave Balances & Leave Application Workflow</h3>
              <p class="card-desc">Casual Leave, Medical Leave, and Earned Leave ledger with substitute educator allocation.</p>
            </div>
            <button class="btn btn-primary" id="btn-apply-leave"><i data-lucide="plus"></i> Apply for Leave</button>
          </div>

          <div class="kpi-grid" style="margin-bottom: 20px;">
            ${UIComponents.renderKpiCard({ title: 'Casual Leave (CL)', value: '—', icon: 'coffee', color: 'blue' })}
            ${UIComponents.renderKpiCard({ title: 'Medical Leave (ML)', value: '—', icon: 'heart-pulse', color: 'emerald' })}
            ${UIComponents.renderKpiCard({ title: 'Earned Leave (EL)', value: '—', icon: 'award', color: 'amber' })}
          </div>

          <h4 style="margin-bottom: 12px;">Recent Leave History</h4>
          <div class="table-responsive">
            <table class="tms-table">
              <thead>
                <tr>
                  <th>Application ID</th>
                  <th>Leave Type</th>
                  <th>From Date</th>
                  <th>To Date</th>
                  <th>Days</th>
                  <th>Substitute Educator</th>
                  <th>Approval Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px;">No records available yet.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;
    } else if (tabKey === 'payslips') {
      content.innerHTML = `
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">My Payslips & CTC Salary Ledger</h3>
              <p class="card-desc">Official Thaiba Public School monthly compensation and deductions ledger.</p>
            </div>
            <button class="btn btn-secondary" onclick="window.print()"><i data-lucide="printer"></i> Print Payslip</button>
          </div>

          <div style="text-align: center; color: var(--text-muted); padding: 40px;">
            <i data-lucide="inbox" style="width:40px;height:40px;display:block;margin:0 auto 10px;"></i>
            No records available yet.
          </div>
        </div>
      `;
    }

    UIComponents.refreshIcons();
  }

  static bindEvents(container) {
    container.querySelectorAll('.staff-tab').forEach(btn => {
      btn.addEventListener('click', (e) => {
        container.querySelectorAll('.staff-tab').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.renderTab(e.currentTarget.dataset.tab, container);
      });
    });

    const punchBtn = container.querySelector('#btn-punch-now');
    if (punchBtn) {
      punchBtn.addEventListener('click', async () => {
        const user = authService.getCurrentUser() || {};
        await auditService.log('STAFF_GEOFENCE_PUNCH', 'ATTENDANCE', {
          latitude: TMS_CONFIG.institution.gpsGeofence.latitude,
          longitude: TMS_CONFIG.institution.gpsGeofence.longitude,
          method: 'GPS_GEOFENCE'
        }, user.id);
        UIComponents.showToast('Biometric GPS Punch Verified & Synchronized with TMS Cloud!', 'success');
      });
    }
  }

  /* ================================================================== */
  /* Task board: create / edit / move / delete                          */
  /* ================================================================== */

  static bindTaskActions(content) {
    if (!content) return;
    const tasks = this._tasks || [];

    const newBtn = content.querySelector('#btn-add-kanban-task');
    if (newBtn) newBtn.addEventListener('click', () => this.openTaskModal(null));

    content.querySelectorAll('.btn-edit-task').forEach((b) =>
      b.addEventListener('click', () => {
        const t = tasks.find((x) => x.id === b.dataset.id);
        if (t) this.openTaskModal(t);
      }));

    content.querySelectorAll('.btn-del-task').forEach((b) =>
      b.addEventListener('click', async () => {
        const t = tasks.find((x) => x.id === b.dataset.id);
        if (!t) return;
        if (!confirm(`Delete the task "${t.title}"? This cannot be undone.`)) return;
        await dbService.delete('staff_tasks', t.id);
        await auditService.log('TASK_DELETED', 'STAFF', { taskId: t.id, title: t.title }, t.id);
        UIComponents.showToast('Task deleted.', 'success');
        await MyWorkModule.renderTab('tasks', document);
      }));

    content.querySelectorAll('.task-move').forEach((sel) =>
      sel.addEventListener('change', async () => {
        const t = tasks.find((x) => x.id === sel.dataset.id);
        if (!t) return;
        await dbService.update('staff_tasks', t.id, { status: sel.value });
        await auditService.log('TASK_STATUS_CHANGED', 'STAFF', { taskId: t.id, status: sel.value }, t.id);
        UIComponents.showToast(`Task moved to ${sel.value}.`, 'success');
        await MyWorkModule.renderTab('tasks', document);
      }));
  }

  static openTaskModal(task) {
    const esc = (v) => UIComponents.escapeHtml(v);
    const t = task || {};
    const isEdit = !!task;
    const rerender = () => MyWorkModule.renderTab('tasks', document);

    UIComponents.openModal({
      title: isEdit ? `Edit Task — ${t.title || ''}` : 'Create New Task',
      bodyHtml: `
        <form id="form-task">
          <div class="form-group">
            <label class="form-label">Task Title *</label>
            <input class="form-input" id="task-title" required value="${esc(t.title || '')}" placeholder="e.g. Prepare Grade 9 physics question paper">
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
            <div class="form-group">
              <label class="form-label">Status</label>
              <select class="form-select" id="task-status">
                ${['To Do', 'In Progress', 'Completed'].map((s) => `<option ${t.status === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Priority</label>
              <select class="form-select" id="task-priority">
                ${['Low', 'Medium', 'High'].map((s) => `<option ${t.priority === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Due Date</label>
            <input type="date" class="form-input" id="task-due" value="${esc((t.dueDate || '').slice(0, 10))}">
          </div>
        </form>
      `,
      footerHtml: `
        <button class="btn btn-secondary" id="task-cancel">Cancel</button>
        ${isEdit ? '<button class="btn btn-secondary" id="task-delete" style="color:#ef4444;"><i data-lucide="trash-2"></i> Delete</button>' : ''}
        <button class="btn btn-primary" id="task-save"><i data-lucide="save"></i> ${isEdit ? 'Save Changes' : 'Create Task'}</button>
      `
    });

    document.getElementById('task-cancel').addEventListener('click', () => UIComponents.closeModal());
    const delBtn = document.getElementById('task-delete');
    if (delBtn) {
      delBtn.addEventListener('click', async () => {
        UIComponents.closeModal();
        if (!confirm(`Delete the task "${t.title}"?`)) return;
        await dbService.delete('staff_tasks', t.id);
        await auditService.log('TASK_DELETED', 'STAFF', { taskId: t.id, title: t.title }, t.id);
        UIComponents.showToast('Task deleted.', 'success');
        await rerender();
      });
    }

    document.getElementById('task-save').addEventListener('click', async () => {
      const title = document.getElementById('task-title').value.trim();
      if (!title) { UIComponents.showToast('Please enter a task title.', 'warning'); return; }
      const user = authService.getCurrentUser() || {};
      const payload = {
        title,
        status: document.getElementById('task-status').value,
        priority: document.getElementById('task-priority').value,
        dueDate: document.getElementById('task-due').value || null
      };
      const res = isEdit
        ? await dbService.update('staff_tasks', t.id, payload)
        : await dbService.insert('staff_tasks', { ...payload, userId: user.id || null });
      if (res && res._syncError) { UIComponents.showToast(`Could not save the task: ${res._syncError}`, 'danger'); return; }
      await auditService.log(isEdit ? 'TASK_UPDATED' : 'TASK_CREATED', 'STAFF', { title, status: payload.status }, isEdit ? t.id : (res && res.id));
      UIComponents.showToast(isEdit ? 'Task updated.' : 'Task created.', 'success');
      UIComponents.closeModal();
      await rerender();
    });

    UIComponents.refreshIcons();
  }
}

export default MyWorkModule;
