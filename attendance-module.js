/**
 * THAIBA PUBLIC SCHOOL — Attendance Engine, Smart Kiosk & Telemetry Module
 * Daily Registers, 1-Click Status Toggles, Smart QR/Barcode Kiosk Terminal, CSV Reporting
 */

import { TMS_CONFIG } from './config.js';
import { dbService } from './supabase-client.js';
import { UIComponents } from './ui-components.js';
import { auditService } from './audit-service.js';
import { downloadCsv } from './export-utils.js';
import { WhatsAppService } from './whatsapp-service.js';

export class AttendanceModule {
  static async render(container) {
    const esc = (v) => UIComponents.escapeHtml(v);

    this._selectedDate = this._selectedDate || new Date().toISOString().split('T')[0];
    this._selectedGrade = this._selectedGrade || 'all';
    this._selectedSection = this._selectedSection || 'all';

    // Fetch students and attendance records
    const [allStudents, allRecords] = await Promise.all([
      dbService.select('students'),
      dbService.select('attendance_records')
    ]);

    this._students = allStudents || [];
    this._records = allRecords || [];

    // Filter students by grade and section
    const filteredStudents = this._students.filter(s => {
      const matchGrade = this._selectedGrade === 'all' || s.grade === this._selectedGrade;
      const matchSec = this._selectedSection === 'all' || s.section === this._selectedSection;
      return matchGrade && matchSec;
    });

    // Map of records for selected date: studentId -> record
    const dateRecords = {};
    this._records.filter(r => r.date === this._selectedDate).forEach(r => {
      if (r.studentId) dateRecords[r.studentId] = r;
      if (r.admissionNo) dateRecords[r.admissionNo] = r;
    });

    // KPI computations
    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    let excusedCount = 0;

    filteredStudents.forEach(s => {
      const rec = dateRecords[s.id] || dateRecords[s.admissionNo];
      const status = rec ? rec.status : (s.leaveStatus === 'approved' ? 'excused' : 'unrecorded');
      if (status === 'present') presentCount++;
      else if (status === 'late') lateCount++;
      else if (status === 'absent') absentCount++;
      else if (status === 'excused') excusedCount++;
    });

    const recordedTotal = presentCount + lateCount + absentCount + excusedCount;
    const presentRate = filteredStudents.length > 0 ? `${Math.round(((presentCount + lateCount) / filteredStudents.length) * 100)}%` : '—';

    container.innerHTML = `
      <div style="margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
          <div>
            <h1 style="font-size: 1.8rem; display: flex; align-items: center; gap: 10px;">
              <span style="color: #16a34a;"><i data-lucide="check-square"></i></span> Attendance & Smart Campus Telemetry
            </h1>
            <p style="color: var(--text-muted); font-size: 0.9rem;">
              Daily morning registers, 1-click status toggles, and Smart QR/Barcode Campus Kiosk Terminal.
            </p>
          </div>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button class="btn btn-secondary" id="btn-export-att"><i data-lucide="download"></i> Export Register (CSV)</button>
            <button class="btn btn-secondary" id="btn-mark-all-present"><i data-lucide="check-check"></i> Mark All Present</button>
            <button class="btn btn-primary" id="btn-qr-scanner"><i data-lucide="qr-code"></i> Launch QR Kiosk</button>
          </div>
        </div>
      </div>

      <div class="kpi-grid">
        ${UIComponents.renderKpiCard({ title: 'Attendance Today', value: presentRate, icon: 'users', color: 'emerald', subtitle: `${presentCount + lateCount} / ${filteredStudents.length} Present` })}
        ${UIComponents.renderKpiCard({ title: 'Late Arrivals', value: `${lateCount}`, icon: 'clock', color: 'amber', subtitle: 'Punched past 09:00 AM' })}
        ${UIComponents.renderKpiCard({ title: 'Absent Unexcused', value: `${absentCount}`, icon: 'user-x', color: 'rose', subtitle: 'Requires Parent Alert' })}
        ${UIComponents.renderKpiCard({ title: 'Approved Leaves', value: `${excusedCount}`, icon: 'shield-check', color: 'blue', subtitle: 'Protected Excused Status' })}
      </div>

      <!-- Filters Row -->
      <div class="card" style="margin-bottom: 24px;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; align-items: flex-end;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-weight: 600;">Select Grade / Class</label>
            <select class="form-select" id="att-filter-grade">
              <option value="all" ${this._selectedGrade === 'all' ? 'selected' : ''}>All Classes</option>
              ${TMS_CONFIG.academic.classes.map(c => `<option value="${esc(c)}" ${this._selectedGrade === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-weight: 600;">Section</label>
            <select class="form-select" id="att-filter-section">
              <option value="all" ${this._selectedSection === 'all' ? 'selected' : ''}>All Sections</option>
              <option value="A" ${this._selectedSection === 'A' ? 'selected' : ''}>Section A</option>
              <option value="B" ${this._selectedSection === 'B' ? 'selected' : ''}>Section B</option>
              <option value="C" ${this._selectedSection === 'C' ? 'selected' : ''}>Section C</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-weight: 600;">Date</label>
            <input type="date" class="form-input" id="att-filter-date" value="${esc(this._selectedDate)}">
          </div>
          <div>
            <button class="btn btn-primary" style="width: 100%;" id="btn-refresh-att"><i data-lucide="filter"></i> Filter Register</button>
          </div>
        </div>
      </div>

      <!-- Active Register Card -->
      <div class="card">
        <div class="card-header" style="flex-wrap: wrap; gap: 10px;">
          <div>
            <h3 class="card-title">Daily Register — ${new Date(this._selectedDate).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
            <p class="card-desc">Click P (Present), L (Late), A (Absent), or E (Excused) to instantly record or update student attendance.</p>
          </div>
          <span class="badge ${recordedTotal === filteredStudents.length && filteredStudents.length > 0 ? 'badge-success' : 'badge-info'}">
            ${recordedTotal} / ${filteredStudents.length} Marked
          </span>
        </div>

        <div class="table-responsive">
          <table class="tms-table" id="master-attendance-table">
            <thead>
              <tr>
                <th style="width: 50px;">Roll</th>
                <th>Admission No</th>
                <th>Student Name</th>
                <th>Grade & Section</th>
                <th>Punch Time</th>
                <th>Source</th>
                <th>Status</th>
                <th style="text-align: right;">Quick Status Toggle</th>
              </tr>
            </thead>
            <tbody>
              ${filteredStudents.length ? filteredStudents.map(s => {
                const rec = dateRecords[s.id] || dateRecords[s.admissionNo];
                const isLeave = s.leaveStatus === 'approved';
                const status = rec ? rec.status : (isLeave ? 'excused' : 'unrecorded');
                const punchTime = rec ? (rec.punchTime || new Date(rec.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) : '—';
                const source = rec ? (rec.source === 'kiosk_qr' ? 'QR Kiosk' : rec.source === 'nfc' ? 'NFC Smartcard' : 'Manual') : '—';

                return `
                  <tr data-student-id="${esc(s.id)}" data-adm="${esc(s.admissionNo)}">
                    <td><strong>${esc(s.rollNo || '—')}</strong></td>
                    <td><span class="font-mono">${esc(s.admissionNo || '—')}</span></td>
                    <td>
                      <div style="display: flex; align-items: center; gap: 8px;">
                        ${s.photo ? `<img src="${esc(s.photo)}" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover;">` : `<div style="width: 28px; height: 28px; border-radius: 50%; background: #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700;">${esc((s.fullName || 'S').slice(0, 1))}</div>`}
                        <strong>${esc(s.fullName)}</strong>
                      </div>
                    </td>
                    <td>${esc(s.grade)} ${s.section ? `• Sec ${esc(s.section)}` : ''}</td>
                    <td class="font-mono" style="font-size: 0.85rem;">${punchTime}</td>
                    <td>
                      <span style="font-size: 0.78rem; color: #64748b;">${source}</span>
                    </td>
                    <td>
                      ${status === 'present' ? `
                        <span class="badge badge-success"><i data-lucide="check" style="width: 12px; height: 12px;"></i> Present</span>
                      ` : status === 'late' ? `
                        <span class="badge badge-warning"><i data-lucide="clock" style="width: 12px; height: 12px;"></i> Late</span>
                      ` : status === 'absent' ? `
                        <span class="badge badge-danger"><i data-lucide="x" style="width: 12px; height: 12px;"></i> Absent</span>
                      ` : status === 'excused' ? `
                        <span class="badge badge-info"><i data-lucide="shield-check" style="width: 12px; height: 12px;"></i> Excused</span>
                      ` : `
                        <span class="badge" style="background: #f1f5f9; color: #64748b;">Unrecorded</span>
                      `}
                    </td>
                    <td style="text-align: right;">
                      <div style="display: inline-flex; gap: 4px;">
                        <button class="btn btn-sm btn-mark-status ${status === 'present' ? 'btn-primary' : 'btn-secondary'}" data-status="present" data-student-id="${esc(s.id)}" title="Mark Present" style="padding: 3px 8px; font-weight: 700;">P</button>
                        <button class="btn btn-sm btn-mark-status ${status === 'late' ? 'btn-primary' : 'btn-secondary'}" data-status="late" data-student-id="${esc(s.id)}" title="Mark Late" style="padding: 3px 8px; font-weight: 700;">L</button>
                        <button class="btn btn-sm btn-mark-status ${status === 'absent' ? 'btn-danger' : 'btn-secondary'}" data-status="absent" data-student-id="${esc(s.id)}" title="Mark Absent" style="padding: 3px 8px; font-weight: 700;">A</button>
                        <button class="btn btn-sm btn-mark-status ${status === 'excused' ? 'btn-primary' : 'btn-secondary'}" data-status="excused" data-student-id="${esc(s.id)}" title="Mark Excused" style="padding: 3px 8px; font-weight: 700;">E</button>
                        ${status === 'absent' ? `
                          <button class="btn btn-sm btn-secondary btn-wa-absence" data-student-id="${esc(s.id)}" title="Send WhatsApp Absence Alert to Parent" style="padding: 3px 6px; color:#16a34a;">
                            <i data-lucide="message-circle" style="width:14px; height:14px;"></i>
                          </button>
                        ` : ''}
                      </div>
                    </td>
                  </tr>
                `;
              }).join('') : `
                <tr>
                  <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 36px;">
                    No students found for this class and section filter.
                  </td>
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

  static bindEvents(container) {
    const esc = (v) => UIComponents.escapeHtml(v);

    // Refresh / Filter
    const refreshBtn = container.querySelector('#btn-refresh-att');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this._selectedGrade = container.querySelector('#att-filter-grade').value;
        this._selectedSection = container.querySelector('#att-filter-section').value;
        this._selectedDate = container.querySelector('#att-filter-date').value;
        this.render(container);
      });
    }

    // Individual Quick Status Toggle (P / L / A / E)
    container.querySelectorAll('.btn-mark-status').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const status = e.currentTarget.dataset.status;
        const studentId = e.currentTarget.dataset.studentId;
        const student = this._students.find(s => s.id === studentId);
        if (!student) return;

        btn.disabled = true;
        await this.recordAttendance(student, status, 'manual');
        this.render(container);
        UIComponents.showToast(`${student.fullName} marked as ${status.toUpperCase()}.`, 'info');
      });
    });

    // 1-Click WhatsApp Absence Alert
    container.querySelectorAll('.btn-wa-absence').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const studentId = e.currentTarget.dataset.studentId;
        const student = this._students.find(s => s.id === studentId);
        if (student) {
          WhatsAppService.sendAbsenceAlert(student, this._selectedDate);
        }
      });
    });

    // Mark All Present
    const markAllBtn = container.querySelector('#btn-mark-all-present');
    if (markAllBtn) {
      markAllBtn.addEventListener('click', async () => {
        const filteredStudents = this._students.filter(s => {
          const matchGrade = this._selectedGrade === 'all' || s.grade === this._selectedGrade;
          const matchSec = this._selectedSection === 'all' || s.section === this._selectedSection;
          return matchGrade && matchSec;
        });

        if (!filteredStudents.length) return;
        if (!confirm(`Mark all ${filteredStudents.length} students in this register as PRESENT for ${this._selectedDate}?`)) return;

        markAllBtn.disabled = true;
        markAllBtn.innerText = 'Marking...';

        for (const s of filteredStudents) {
          // eslint-disable-next-line no-await-in-loop
          await this.recordAttendance(s, 'present', 'manual');
        }

        await auditService.log('BULK_ATTENDANCE_MARKED', 'ATTENDANCE', {
          date: this._selectedDate,
          grade: this._selectedGrade,
          count: filteredStudents.length
        });

        UIComponents.showToast(`Marked ${filteredStudents.length} students as PRESENT!`, 'success');
        this.render(container);
      });
    }

    // Export Registers
    const exportBtn = container.querySelector('#btn-export-att');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const filteredStudents = this._students.filter(s => {
          const matchGrade = this._selectedGrade === 'all' || s.grade === this._selectedGrade;
          const matchSec = this._selectedSection === 'all' || s.section === this._selectedSection;
          return matchGrade && matchSec;
        });

        const dateRecords = {};
        this._records.filter(r => r.date === this._selectedDate).forEach(r => {
          if (r.studentId) dateRecords[r.studentId] = r;
          if (r.admissionNo) dateRecords[r.admissionNo] = r;
        });

        const rows = [
          ['Date', 'Roll No', 'Admission No', 'Student Name', 'Grade', 'Section', 'Status', 'Punch Time', 'Source']
        ];

        filteredStudents.forEach(s => {
          const rec = dateRecords[s.id] || dateRecords[s.admissionNo];
          const status = rec ? rec.status : (s.leaveStatus === 'approved' ? 'excused' : 'unrecorded');
          const punchTime = rec ? (rec.punchTime || '') : '';
          const source = rec ? (rec.source || 'manual') : '';

          rows.push([
            this._selectedDate,
            s.rollNo || '',
            s.admissionNo || '',
            s.fullName || '',
            s.grade || '',
            s.section || '',
            status.toUpperCase(),
            punchTime,
            source
          ]);
        });

        downloadCsv(`Attendance_Register_${this._selectedDate}_${this._selectedGrade}`, rows);
        UIComponents.showToast('Attendance register exported to CSV.', 'success');
      });
    }

    // QR Kiosk Launcher
    const qrBtn = container.querySelector('#btn-qr-scanner');
    if (qrBtn) {
      qrBtn.addEventListener('click', () => {
        this.openKioskModal(container);
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Database Save Helper                                               */
  /* ------------------------------------------------------------------ */
  static async recordAttendance(student, status, source = 'manual') {
    const existing = this._records.find(r => 
      (r.studentId === student.id || r.admissionNo === student.admissionNo) && 
      r.date === this._selectedDate
    );

    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const recordData = {
      id: existing ? existing.id : `att_${student.id}_${this._selectedDate}_${Date.now()}`,
      studentId: student.id,
      studentName: student.fullName,
      admissionNo: student.admissionNo,
      grade: student.grade,
      section: student.section,
      date: this._selectedDate,
      status,
      punchTime: nowStr,
      source,
      updatedAt: new Date().toISOString()
    };

    if (existing) {
      await dbService.update('attendance_records', existing.id, recordData);
      const idx = this._records.findIndex(r => r.id === existing.id);
      if (idx >= 0) this._records[idx] = { ...this._records[idx], ...recordData };
    } else {
      await dbService.insert('attendance_records', recordData);
      this._records.push(recordData);
    }

    return recordData;
  }

  /* ------------------------------------------------------------------ */
  /* Audio Feedback Synthesizer                                         */
  /* ------------------------------------------------------------------ */
  static playChime(type = 'success') {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.1); // A5
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else if (type === 'duplicate') {
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.setValueAtTime(330, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch (e) {
      // Audio not permitted or supported
    }
  }

  /* ------------------------------------------------------------------ */
  /* Smart Campus QR & Barcode Attendance Kiosk                         */
  /* ------------------------------------------------------------------ */
  static openKioskModal(container) {
    const esc = (v) => UIComponents.escapeHtml(v);
    const today = new Date().toISOString().split('T')[0];

    const bodyHtml = `
      <div style="background: #ffffff; color: var(--text-main); border-radius: 12px; padding: 20px; text-align: center; border: 1px solid var(--border-color);">
        <!-- Kiosk Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 14px; margin-bottom: 20px;">
          <div style="text-align: left;">
            <div style="font-size: 0.75rem; text-transform: uppercase; color: #16a34a; font-weight: 700; letter-spacing: 1px; display: flex; align-items: center; gap: 6px;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: #16a34a; display: inline-block; animation: pulse 1.5s infinite;"></span>
              GATE 01 • MAIN ENTRY TERMINAL ONLINE
            </div>
            <div style="font-size: 1.1rem; font-weight: 700; color: var(--text-main);">${esc(TMS_CONFIG.institution.name)}</div>
          </div>
          <div style="text-align: right;">
            <div id="kiosk-live-clock" style="font-size: 1.25rem; font-weight: 800; font-family: monospace; color: #16a34a;">--:--:--</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</div>
          </div>
        </div>

        <!-- Scanner / Input Zone -->
        <div style="max-width: 480px; margin: 0 auto 24px;">
          <!-- Camera Scanner Toggle & Stream Preview -->
          <div style="display: flex; justify-content: center; gap: 8px; margin-bottom: 12px;">
            <button type="button" class="btn btn-secondary btn-sm" id="btn-toggle-cam" style="display: inline-flex; align-items: center; gap: 6px;">
              <i data-lucide="camera"></i> <span>Open Camera Scanner</span>
            </button>
          </div>

          <div id="kiosk-cam-container" style="display: none; max-width: 320px; margin: 0 auto 16px; position: relative; border-radius: 12px; overflow: hidden; background: #000; border: 2px solid #16a34a;">
            <video id="kiosk-cam-video" autoplay playsinline muted style="width: 100%; height: 200px; object-fit: cover; display: block;"></video>
            <div style="position: absolute; inset: 0; pointer-events: none; border: 2px dashed rgba(74, 222, 128, 0.7); margin: 20px; border-radius: 8px;"></div>
            <div style="position: absolute; bottom: 8px; left: 0; right: 0; text-align: center; color: #fff; font-size: 0.72rem; text-shadow: 0 1px 3px rgba(0,0,0,0.8);">
              Align student QR badge inside frame
            </div>
          </div>

          <div id="kiosk-scan-icon-box" style="width: 120px; height: 120px; border: 3px solid #16a34a; border-radius: 16px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; background: rgba(22, 163, 74, 0.08); position: relative;">
            <i data-lucide="scan" style="width: 60px; height: 60px; color: #16a34a;"></i>
          </div>

          <label style="display: block; font-size: 0.85rem; color: var(--text-main); margin-bottom: 8px; font-weight: 600;">
            Scan Student QR / Barcode Card or Enter Admission No:
          </label>
          <div style="display: flex; gap: 8px;">
            <input type="text" id="kiosk-scan-input" class="form-input font-mono" placeholder="Scan or enter Admission No (e.g. TMS/2027/001)" autofocus style="font-size: 1.05rem; padding: 10px 14px; text-align: center; background: #ffffff; color: var(--text-main); border: 1.5px solid var(--border-color);">
            <button class="btn btn-primary" id="kiosk-punch-btn" style="padding: 0 20px;"><i data-lucide="corner-down-left"></i> Punch</button>
          </div>
          <div style="font-size: 0.74rem; color: var(--text-muted); margin-top: 6px;">
            Supports Live Camera Video, USB Barcode Guns, 2D Scanners, and manual input.
          </div>
        </div>

        <!-- Live Punch Result Display Box -->
        <div id="kiosk-punch-feedback" style="min-height: 100px; background: #f8fafc; border: 1px dashed var(--border-color); border-radius: 10px; padding: 16px; margin-bottom: 20px; display: flex; align-items: center; justify-content: center;">
          <span style="color: var(--text-muted); font-size: 0.9rem;">Awaiting student scan or badge swipe...</span>
        </div>

        <!-- Recent Punches Roster -->
        <div style="text-align: left;">
          <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px;">
            Recent Terminal Punches Today:
          </div>
          <div id="kiosk-recent-punches" style="max-height: 160px; overflow-y: auto; background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 8px;">
            <div style="text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 12px;">No check-ins recorded in this session yet.</div>
          </div>
        </div>
      </div>
    `;

    UIComponents.openModal({
      title: 'Smart Campus Attendance Terminal',
      bodyHtml,
      footerHtml: `
        <button class="btn btn-secondary" onclick="document.getElementById('global-modal-close').click()">Close Kiosk</button>
      `
    });

    UIComponents.refreshIcons();

    const modal = document.querySelector('.tms-modal');
    if (!modal) return;

    // Live clock ticker
    const clockEl = modal.querySelector('#kiosk-live-clock');
    const timerId = setInterval(() => {
      if (!document.contains(clockEl)) {
        clearInterval(timerId);
        return;
      }
      clockEl.innerText = new Date().toLocaleTimeString();
    }, 1000);

    const input = modal.querySelector('#kiosk-scan-input');
    const punchBtn = modal.querySelector('#kiosk-punch-btn');
    const feedbackBox = modal.querySelector('#kiosk-punch-feedback');
    const recentBox = modal.querySelector('#kiosk-recent-punches');

    const recentList = [];

    const handlePunch = async () => {
      const query = input.value.trim();
      if (!query) return;
      input.value = '';
      input.focus();

      // Find student by admissionNo or id or fullName or aadhaar
      const student = this._students.find(s => 
        (s.admissionNo && s.admissionNo.toLowerCase() === query.toLowerCase()) ||
        (s.id && s.id.toLowerCase() === query.toLowerCase()) ||
        (s.rollNo && s.rollNo.toString() === query) ||
        (s.fullName && s.fullName.toLowerCase().includes(query.toLowerCase()))
      );

      if (!student) {
        this.playChime('duplicate');
        feedbackBox.innerHTML = `
          <div style="color: #f87171; font-weight: 700; display: flex; align-items: center; gap: 8px;">
            <i data-lucide="alert-circle" style="width: 22px; height: 22px;"></i>
            <span>No student found matching "${esc(query)}". Please verify admission number.</span>
          </div>
        `;
        UIComponents.refreshIcons();
        return;
      }

      // Check if already checked in today
      const alreadyPunched = this._records.find(r => 
        (r.studentId === student.id || r.admissionNo === student.admissionNo) && 
        r.date === today &&
        r.status === 'present'
      );

      if (alreadyPunched) {
        this.playChime('duplicate');
        feedbackBox.innerHTML = `
          <div style="display: flex; align-items: center; gap: 14px; text-align: left; width: 100%;">
            <div style="width: 50px; height: 50px; border-radius: 50%; background: #ca8a04; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; font-weight: 800; color: #fff;">
              ${student.photo ? `<img src="${esc(student.photo)}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover;">` : esc(student.fullName.slice(0, 1))}
            </div>
            <div>
              <div style="color: #facc15; font-size: 0.8rem; font-weight: 800; text-transform: uppercase;">ALREADY CHECKED IN</div>
              <div style="font-size: 1.1rem; font-weight: 700; color: #fff;">${esc(student.fullName)}</div>
              <div style="font-size: 0.78rem; color: #94a3b8;">${esc(student.grade)} • Admission No: <span class="font-mono">${esc(student.admissionNo)}</span> • Punched at: ${esc(alreadyPunched.punchTime || 'Earlier')}</div>
            </div>
          </div>
        `;
        UIComponents.refreshIcons();
        return;
      }

      // Record as present (or late if after 9:00 AM)
      const now = new Date();
      const isLate = now.getHours() >= 9 && now.getMinutes() > 0;
      const statusToSet = isLate ? 'late' : 'present';

      const rec = await this.recordAttendance(student, statusToSet, 'kiosk_qr');
      this.playChime('success');

      feedbackBox.innerHTML = `
        <div style="display: flex; align-items: center; gap: 14px; text-align: left; width: 100%;">
          <div style="width: 56px; height: 56px; border-radius: 50%; background: ${isLate ? '#d97706' : '#16a34a'}; border: 3px solid ${isLate ? '#f59e0b' : '#4ade80'}; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; font-weight: 800; color: #fff;">
            ${student.photo ? `<img src="${esc(student.photo)}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover;">` : esc(student.fullName.slice(0, 1))}
          </div>
          <div>
            <div style="color: ${isLate ? '#f59e0b' : '#4ade80'}; font-size: 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
              ${isLate ? '⚠ LATE ARRIVAL RECORDED' : '✓ CHECK-IN SUCCESSFUL • PRESENT'}
            </div>
            <div style="font-size: 1.15rem; font-weight: 800; color: #ffffff;">${esc(student.fullName)}</div>
            <div style="font-size: 0.8rem; color: #cbd5e1;">
              ${esc(student.grade)} ${student.section ? `• Sec ${esc(student.section)}` : ''} • Adm: <strong class="font-mono">${esc(student.admissionNo)}</strong> • Time: <strong>${rec.punchTime}</strong>
            </div>
          </div>
        </div>
      `;

      recentList.unshift({
        name: student.fullName,
        adm: student.admissionNo,
        grade: student.grade,
        time: rec.punchTime,
        status: statusToSet
      });

      recentBox.innerHTML = recentList.slice(0, 8).map(item => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; border-bottom: 1px solid var(--border-color); font-size: 0.82rem;">
          <div>
            <strong>${esc(item.name)}</strong>
            <span style="color: var(--text-muted); font-size: 0.75rem; margin-left: 6px;">(${esc(item.adm)} • ${esc(item.grade)})</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="font-mono" style="color: #16a34a; font-weight: 700;">${esc(item.time)}</span>
            <span class="badge ${item.status === 'present' ? 'badge-success' : 'badge-warning'}" style="font-size: 0.7rem;">${item.status.toUpperCase()}</span>
          </div>
        </div>
      `).join('');

      await auditService.log('KIOSK_PUNCH', 'ATTENDANCE', {
        student: student.fullName,
        admissionNo: student.admissionNo,
        status: statusToSet,
        punchTime: rec.punchTime
      });

      UIComponents.refreshIcons();
    };

    punchBtn.addEventListener('click', handlePunch);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handlePunch();
      }
    });

    // Camera Live Scanner Controller
    const btnToggleCam = modal.querySelector('#btn-toggle-cam');
    const camContainer = modal.querySelector('#kiosk-cam-container');
    const camVideo = modal.querySelector('#kiosk-cam-video');
    const scanIconBox = modal.querySelector('#kiosk-scan-icon-box');

    let activeStream = null;
    let scanInterval = null;
    let recentDetectedCode = null;

    const stopCamera = () => {
      if (scanInterval) {
        clearInterval(scanInterval);
        scanInterval = null;
      }
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
        activeStream = null;
      }
      if (camVideo) camVideo.srcObject = null;
      if (camContainer) camContainer.style.display = 'none';
      if (scanIconBox) scanIconBox.style.display = 'flex';
      if (btnToggleCam) {
        btnToggleCam.innerHTML = '<i data-lucide="camera"></i> <span>Open Camera Scanner</span>';
        UIComponents.refreshIcons();
      }
    };

    const startCamera = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        UIComponents.showToast('Camera access is not supported by this browser.', 'warning');
        return;
      }

      try {
        activeStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
        });
        camVideo.srcObject = activeStream;
        camContainer.style.display = 'block';
        scanIconBox.style.display = 'none';
        btnToggleCam.innerHTML = '<i data-lucide="camera-off"></i> <span>Stop Camera</span>';
        UIComponents.refreshIcons();

        // Native BarcodeDetector loop if supported
        if ('BarcodeDetector' in window) {
          const detector = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13'] });
          scanInterval = setInterval(async () => {
            if (camVideo.readyState >= 2) {
              try {
                const barcodes = await detector.detect(camVideo);
                if (barcodes.length > 0) {
                  const val = barcodes[0].rawValue.trim();
                  if (val && val !== recentDetectedCode) {
                    recentDetectedCode = val;
                    input.value = val;
                    handlePunch();
                    setTimeout(() => { recentDetectedCode = null; }, 3000);
                  }
                }
              } catch (e) { /* ignore detection frame drop */ }
            }
          }, 300);
        } else {
          feedbackBox.innerHTML = `
            <div style="font-size:0.85rem; color:#16a34a; font-weight:600;">
              Camera live stream active. If QR code scanner is unassisted, enter Admission No or use hardware scanner gun.
            </div>
          `;
        }
      } catch (err) {
        console.error('Camera access failed:', err);
        UIComponents.showToast('Camera access denied or unavailable: ' + err.message, 'warning');
        stopCamera();
      }
    };

    if (btnToggleCam) {
      btnToggleCam.addEventListener('click', () => {
        if (activeStream) {
          stopCamera();
        } else {
          startCamera();
        }
      });
    }

    // Ensure camera stops when modal closes
    const closeBtn = document.getElementById('global-modal-close');
    if (closeBtn) {
      const origClose = closeBtn.onclick;
      closeBtn.onclick = (e) => {
        stopCamera();
        if (typeof origClose === 'function') origClose(e);
      };
    }

    // Auto-focus input
    setTimeout(() => input?.focus(), 150);
  }
}

export default AttendanceModule;
