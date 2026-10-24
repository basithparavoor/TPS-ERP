/**
 * THAIBA PUBLIC SCHOOL — Digital Homework & Class Assignment Diary Module
 * Daily Homework Logs, Submission Deadlines, WhatsApp Broadcast & Printable A4 Diary Sheets
 */

import { TMS_CONFIG } from './config.js';
import { dbService } from './supabase-client.js';
import { UIComponents } from './ui-components.js';
import { auditService } from './audit-service.js';
import { WhatsAppService } from './whatsapp-service.js';
import { TMS_LOGO } from './logo.js';

export class HomeworkModule {
  static async render(container) {
    const esc = (v) => UIComponents.escapeHtml(v);

    this._assignments = (await dbService.select('assignments')) || [];
    this._students = (await dbService.select('students')) || [];
    this._staff = (await dbService.select('staff_directory')) || [];

    // Pre-populate sample assignments if empty
    if (!this._assignments.length) {
      const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const nextWeek = new Date(Date.now() + 86400000 * 4).toISOString().slice(0, 10);

      const defaults = [
        { id: 'hw_1', grade: 'Grade 5', section: 'A', subject: 'Mathematics', title: 'Fractions & Decimals Exercise 4.2', description: 'Complete textbook questions 1 to 15 in homework notebook. Show all intermediate calculation steps.', due_date: tomorrow, assigned_by: 'Mr. Rahman', status: 'active' },
        { id: 'hw_2', grade: 'Grade 5', section: 'A', subject: 'English', title: 'Poem Comprehension & Vocabulary Drill', description: 'Read Chapter 3: "The Silver Arrow". Answer comprehension questions A and B on page 42.', due_date: tomorrow, assigned_by: 'Ms. Fatima', status: 'active' },
        { id: 'hw_3', grade: 'Grade 7', section: 'B', subject: 'General Science', title: 'Plant Cell Structure Diagram Project', description: 'Draw and label a neat diagram of a plant cell on A4 chart paper showing chloroplast and cell wall.', due_date: nextWeek, assigned_by: 'Dr. Ali', status: 'active' }
      ];

      for (const hw of defaults) {
        await dbService.insert('assignments', hw);
      }
      this._assignments = (await dbService.select('assignments')) || [];
    }

    this._selectedGrade = this._selectedGrade || 'all';
    this._selectedSubject = this._selectedSubject || 'all';

    const classes = TMS_CONFIG.academic.classes || [];
    const subjects = [
      'Mathematics', 'English Language', 'General Science', 'Bengali / Urdu',
      'Social Science', 'Computer Applications', 'Islamic & Moral Studies'
    ];

    // Filter assignments
    let filtered = this._assignments;
    if (this._selectedGrade !== 'all') {
      filtered = filtered.filter(a => a.grade === this._selectedGrade);
    }
    if (this._selectedSubject !== 'all') {
      filtered = filtered.filter(a => a.subject === this._selectedSubject);
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const activeCount = this._assignments.filter(a => a.status === 'active').length;
    const dueTodayCount = this._assignments.filter(a => a.due_date === todayStr).length;

    container.innerHTML = `
      <div style="margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
          <div>
            <h1 style="font-size: 1.8rem; display: flex; align-items: center; gap: 10px;">
              <span style="color: #16a34a;"><i data-lucide="book-open"></i></span> Digital Homework &amp; Assignment Diary
            </h1>
            <p style="color: var(--text-muted); font-size: 0.9rem;">
              Daily coursework tracking, submission deadlines, 1-click WhatsApp broadcast to parent groups, and A4 printable diary sheets.
            </p>
          </div>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button class="btn btn-secondary" id="btn-print-hw-sheet"><i data-lucide="printer"></i> Print Weekly Homework Sheet (A4)</button>
            <button class="btn btn-primary" id="btn-post-new-hw"><i data-lucide="plus"></i> Post Assignment</button>
          </div>
        </div>
      </div>

      <!-- KPI Summary -->
      <div class="kpi-grid">
        ${UIComponents.renderKpiCard({ title: 'Active Homework Tasks', value: `${activeCount}`, icon: 'book-open', color: 'emerald', subtitle: 'Pending Student Submissions' })}
        ${UIComponents.renderKpiCard({ title: 'Due Today', value: `${dueTodayCount}`, icon: 'clock', color: dueTodayCount > 0 ? 'rose' : 'blue', subtitle: 'Target Submissions' })}
        ${UIComponents.renderKpiCard({ title: 'Selected Class', value: this._selectedGrade === 'all' ? 'All Classes' : this._selectedGrade, icon: 'layers', color: 'amber' })}
        ${UIComponents.renderKpiCard({ title: 'Academic Session', value: TMS_CONFIG.academic.currentYear, icon: 'calendar', color: 'purple' })}
      </div>

      <!-- Filters Card -->
      <div class="card" style="margin-bottom: 20px;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; align-items: flex-end;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-weight: 600;">Filter by Class</label>
            <select class="form-select" id="hw-filter-grade">
              <option value="all" ${this._selectedGrade === 'all' ? 'selected' : ''}>All Classes</option>
              ${classes.map(c => `<option value="${esc(c)}" ${this._selectedGrade === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-weight: 600;">Filter by Subject</label>
            <select class="form-select" id="hw-filter-subject">
              <option value="all" ${this._selectedSubject === 'all' ? 'selected' : ''}>All Subjects</option>
              ${subjects.map(s => `<option value="${esc(s)}" ${this._selectedSubject === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <!-- Assignments Cards Grid -->
      <div class="card">
        <div class="card-header" style="flex-wrap: wrap; gap: 10px;">
          <div>
            <h3 class="card-title">Class Assignments Ledger</h3>
            <p class="card-desc">Showing ${filtered.length} homework entries. Click WhatsApp to broadcast tasks to parents.</p>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; padding: 6px;">
          ${filtered.length ? filtered.map(hw => {
            const isDueSoon = hw.due_date && (hw.due_date <= todayStr);
            return `
              <div class="card" style="border: 1px solid var(--border-color); background: var(--bg-card); display: flex; flex-direction: column; justify-content: space-between; margin-bottom: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                <div>
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 8px;">
                    <span class="badge badge-info" style="font-weight: 700;">${esc(hw.grade)} (${esc(hw.section || 'A')})</span>
                    <span style="font-size: 0.72rem; font-weight: 700; color: ${isDueSoon ? '#dc2626' : '#166534'}; background: ${isDueSoon ? '#fee2e2' : '#f0fdf4'}; padding: 2px 8px; border-radius: 4px;">
                      Due: ${esc(hw.due_date || 'Ongoing')}
                    </span>
                  </div>
                  <h4 style="font-size: 1rem; font-weight: 700; margin-bottom: 4px; color: var(--text-color);">
                    ${esc(hw.title)}
                  </h4>
                  <div style="font-size: 0.78rem; font-weight: 600; color: #2563eb; margin-bottom: 8px;">
                    ${esc(hw.subject)} • Assigned by ${esc(hw.assigned_by || 'Teacher')}
                  </div>
                  <p style="font-size: 0.82rem; color: var(--text-muted); line-height: 1.4; margin-bottom: 12px; background: var(--bg-subtle, #f8fafc); padding: 8px; border-radius: 6px;">
                    ${esc(hw.description || 'Complete exercises as instructed in class.')}
                  </p>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 10px; margin-top: 4px;">
                  <button class="btn btn-secondary btn-sm btn-hw-wa" 
                    data-grade="${esc(hw.grade)}" 
                    data-section="${esc(hw.section || 'A')}" 
                    data-subject="${esc(hw.subject)}" 
                    data-title="${esc(hw.title)}" 
                    data-desc="${esc(hw.description || '')}" 
                    data-due="${esc(hw.due_date || '')}" 
                    style="color: #16a34a; font-weight: 600;" 
                    title="Broadcast via WhatsApp">
                    <i data-lucide="message-circle"></i> WhatsApp Broadcast
                  </button>
                  <div style="display: flex; gap: 4px;">
                    <button class="btn btn-secondary btn-sm btn-edit-hw" data-id="${esc(hw.id)}" title="Edit"><i data-lucide="pencil"></i></button>
                    <button class="btn btn-secondary btn-sm btn-del-hw" data-id="${esc(hw.id)}" style="color: #ef4444;" title="Delete"><i data-lucide="trash-2"></i></button>
                  </div>
                </div>
              </div>
            `;
          }).join('') : `
            <div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">
              No homework assignments recorded for the selected filter. Click "Post Assignment" to add one.
            </div>
          `}
        </div>
      </div>
    `;

    this.bindEvents(container);
    UIComponents.refreshIcons();
  }

  static bindEvents(container) {
    const gradeSelect = container.querySelector('#hw-filter-grade');
    if (gradeSelect) {
      gradeSelect.addEventListener('change', (e) => {
        this._selectedGrade = e.target.value;
        this.render(container);
      });
    }

    const subjSelect = container.querySelector('#hw-filter-subject');
    if (subjSelect) {
      subjSelect.addEventListener('change', (e) => {
        this._selectedSubject = e.target.value;
        this.render(container);
      });
    }

    container.querySelector('#btn-post-new-hw')?.addEventListener('click', () => {
      this.openHomeworkModal(null, container);
    });

    container.querySelector('#btn-print-hw-sheet')?.addEventListener('click', () => {
      this.openPrintHomeworkModal();
    });

    // WhatsApp Broadcast
    container.querySelectorAll('.btn-hw-wa').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const d = e.currentTarget.dataset;
        WhatsAppService.sendHomeworkBroadcast(d.grade, d.section, d.subject, d.title, d.desc, d.due, '');
      });
    });

    // Edit
    container.querySelectorAll('.btn-edit-hw').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const hw = this._assignments.find(x => String(x.id) === String(id));
        if (hw) this.openHomeworkModal(hw, container);
      });
    });

    // Delete
    container.querySelectorAll('.btn-del-hw').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        if (!confirm('Delete this homework assignment?')) return;
        await dbService.delete('assignments', id);
        UIComponents.showToast('Assignment deleted.', 'info');
        await this.render(container);
      });
    });
  }

  static openHomeworkModal(assignment, container) {
    const esc = (v) => UIComponents.escapeHtml(v);
    const hw = assignment || {};
    const isEdit = !!assignment;
    const classes = TMS_CONFIG.academic.classes || [];
    const subjects = [
      'Mathematics', 'English Language', 'General Science', 'Bengali / Urdu',
      'Social Science', 'Computer Applications', 'Islamic & Moral Studies', 'General Knowledge'
    ];

    const bodyHtml = `
      <form id="form-hw-modal">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
          <div class="form-group">
            <label class="form-label">Grade / Class *</label>
            <select class="form-select" id="hw-in-grade">
              ${classes.map(c => `<option value="${esc(c)}" ${hw.grade === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Section</label>
            <select class="form-select" id="hw-in-sec">
              ${['A', 'B', 'C'].map(s => `<option value="${s}" ${hw.section === s ? 'selected' : ''}>Section ${s}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Subject *</label>
            <select class="form-select" id="hw-in-subject">
              ${subjects.map(s => `<option value="${esc(s)}" ${hw.subject === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Submission Due Date *</label>
            <input type="date" class="form-input" id="hw-in-due" required value="${esc(hw.due_date || new Date(Date.now() + 86400000).toISOString().slice(0, 10))}">
          </div>
          <div class="form-group" style="grid-column: 1/-1;">
            <label class="form-label">Topic / Task Title *</label>
            <input class="form-input" id="hw-in-title" required placeholder="e.g. Chapter 4 Exercise 2 Problems 1-10" value="${esc(hw.title || '')}">
          </div>
          <div class="form-group" style="grid-column: 1/-1;">
            <label class="form-label">Detailed Instructions / Questions</label>
            <textarea class="form-input" id="hw-in-desc" rows="3" placeholder="Specify textbook pages, question numbers, or essay guidelines...">${esc(hw.description || '')}</textarea>
          </div>
          <div class="form-group" style="grid-column: 1/-1;">
            <label class="form-label">Assigned by Faculty Member</label>
            <select class="form-select" id="hw-in-teacher">
              ${this._staff.map(st => `<option value="${esc(st.name)}" ${hw.assigned_by === st.name ? 'selected' : ''}>${esc(st.name)} (${esc(st.department || 'Faculty')})</option>`).join('')}
            </select>
          </div>
        </div>
      </form>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" id="btn-hw-modal-cancel">Cancel</button>
      <button class="btn btn-primary" id="btn-hw-modal-save"><i data-lucide="save"></i> ${isEdit ? 'Save Assignment' : 'Post Homework'}</button>
    `;

    UIComponents.openModal({
      title: isEdit ? `Edit Homework — ${hw.title}` : 'Post Class Homework Assignment',
      bodyHtml,
      footerHtml
    });

    document.getElementById('btn-hw-modal-cancel').addEventListener('click', () => UIComponents.closeModal());

    document.getElementById('btn-hw-modal-save').addEventListener('click', async () => {
      const title = document.getElementById('hw-in-title').value.trim();
      const grade = document.getElementById('hw-in-grade').value;
      const subject = document.getElementById('hw-in-subject').value;
      const due = document.getElementById('hw-in-due').value;

      if (!title || !due) {
        UIComponents.showToast('Please fill in title and due date.', 'warning');
        return;
      }

      const payload = {
        id: hw.id || `hw_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        grade: grade,
        section: document.getElementById('hw-in-sec').value,
        subject: subject,
        title: title,
        description: document.getElementById('hw-in-desc').value.trim(),
        due_date: due,
        assigned_by: document.getElementById('hw-in-teacher').value,
        status: 'active'
      };

      if (isEdit) {
        await dbService.update('assignments', hw.id, payload);
      } else {
        await dbService.insert('assignments', payload);
      }

      UIComponents.showToast(`Homework "${title}" posted for ${grade}!`, 'success');
      UIComponents.closeModal();
      await HomeworkModule.render(container);
    });

    UIComponents.refreshIcons();
  }

  static openPrintHomeworkModal() {
    const esc = (v) => UIComponents.escapeHtml(v);
    const emblem = TMS_LOGO.emblemSvg(50);
    const dateStr = new Date().toLocaleDateString('en-GB');

    const bodyHtml = `
      <style>
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body * { visibility: hidden; }
          #hw-sheet-print, #hw-sheet-print * { visibility: visible; }
          #hw-sheet-print { position: fixed; left: 0; top: 0; width: 100%; border: none !important; }
        }
      </style>

      <div id="hw-sheet-print" style="background:#fff; color:#0f172a; padding:20px; font-family:'Plus Jakarta Sans', sans-serif;">
        <div style="text-align:center; border-bottom:2px solid #16a34a; padding-bottom:12px; margin-bottom:16px;">
          <div style="display:flex; justify-content:center; margin-bottom:4px;">${emblem}</div>
          <h2 style="font-size:1.35rem; font-weight:800; color:#166534; text-transform:uppercase; margin:0;">${esc(TMS_CONFIG.institution.name)}</h2>
          <div style="font-size:0.8rem; font-weight:600; color:#15803d;">Run by : Thaiba Heritage, Kolkata • Academic Session ${TMS_CONFIG.academic.currentYear}</div>
          <div style="font-size:0.75rem; color:#64748b;">WEEKLY CLASS HOMEWORK &amp; STUDY ASSIGNMENT SHEET</div>
        </div>

        <div style="display:flex; justify-content:space-between; margin-bottom:12px; font-size:0.82rem;">
          <div>Class Filter: <strong>${this._selectedGrade === 'all' ? 'All Classes' : this._selectedGrade}</strong></div>
          <div>Date: <strong>${dateStr}</strong></div>
        </div>

        <table style="width:100%; border-collapse:collapse; font-size:0.75rem; border:1px solid #cbd5e1;">
          <thead>
            <tr style="background:#f1f5f9; text-align:left;">
              <th style="padding:6px 10px; border:1px solid #cbd5e1;">Class</th>
              <th style="padding:6px 10px; border:1px solid #cbd5e1;">Subject</th>
              <th style="padding:6px 10px; border:1px solid #cbd5e1;">Task / Homework Details</th>
              <th style="padding:6px 10px; border:1px solid #cbd5e1;">Due Date</th>
              <th style="padding:6px 10px; border:1px solid #cbd5e1;">Teacher</th>
            </tr>
          </thead>
          <tbody>
            ${this._assignments.map(hw => `
              <tr>
                <td style="padding:6px 10px; border:1px solid #cbd5e1; font-weight:700;">${esc(hw.grade)} (${esc(hw.section || 'A')})</td>
                <td style="padding:6px 10px; border:1px solid #cbd5e1;"><strong>${esc(hw.subject)}</strong></td>
                <td style="padding:6px 10px; border:1px solid #cbd5e1;">
                  <strong>${esc(hw.title)}</strong>
                  <div style="font-size:0.7rem; color:#64748b; margin-top:2px;">${esc(hw.description || '')}</div>
                </td>
                <td style="padding:6px 10px; border:1px solid #cbd5e1;" class="font-mono">${esc(hw.due_date || '—')}</td>
                <td style="padding:6px 10px; border:1px solid #cbd5e1;">${esc(hw.assigned_by || '—')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="display:flex; justify-content:space-between; margin-top:30px; font-size:0.75rem; text-align:center;">
          <div style="width:40%;">
            <div style="border-bottom:1.5px solid #0f172a; margin-bottom:4px; padding-bottom:20px;"></div>
            <strong>Class Teacher In-Charge</strong>
          </div>
          <div style="width:40%;">
            <div style="border-bottom:1.5px solid #0f172a; margin-bottom:4px; padding-bottom:20px;"></div>
            <strong>Principal (Official Seal)</strong>
          </div>
        </div>
      </div>
    `;

    UIComponents.openModal({
      title: 'Weekly Homework Sheet (A4)',
      bodyHtml,
      footerHtml: `
        <button class="btn btn-secondary" onclick="document.getElementById('global-modal-close').click()">Close</button>
        <button class="btn btn-primary" onclick="window.print()"><i data-lucide="printer"></i> Print Homework Sheet (A4)</button>
      `
    });

    UIComponents.refreshIcons();
  }
}

export default HomeworkModule;
