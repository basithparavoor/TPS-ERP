/**
 * THAIBA PUBLIC SCHOOL — Institutional Event & Academic Calendar Planner
 * Visual Month & List Calendar, Event Categories, and Smartphone iCal (.ics) Sync
 */

import { TMS_CONFIG } from './config.js';
import { dbService } from './supabase-client.js';
import { UIComponents } from './ui-components.js';
import { auditService } from './audit-service.js';
import { TMS_LOGO } from './logo.js';

export const EVENT_CATEGORIES = [
  { id: 'all', name: 'All Categories', color: '#64748b' },
  { id: 'holiday', name: 'School Holiday / Break', color: '#16a34a', icon: 'sun' },
  { id: 'exam', name: 'Examination & Tests', color: '#dc2626', icon: 'award' },
  { id: 'ptm', name: 'Parent-Teacher Meeting (PTM)', color: '#9333ea', icon: 'users' },
  { id: 'sports', name: 'Sports & Athletics', color: '#ea580c', icon: 'trophy' },
  { id: 'cultural', name: 'Cultural & Annual Events', color: '#2563eb', icon: 'sparkles' },
  { id: 'fee', name: 'Fee Collection Deadline', color: '#d97706', icon: 'credit-card' }
];

export class CalendarModule {
  static async render(container) {
    const esc = (v) => UIComponents.escapeHtml(v);

    this._events = (await dbService.select('calendar_events')) || [];

    // Pre-populate standard events if empty
    if (!this._events.length) {
      const defaultEvents = [
        { id: 'ev_1', title: 'Session Inauguration & Orientation', category: 'cultural', start_date: '2027-04-05', end_date: '2027-04-05', description: 'Welcome assembly for all students and parents.', target_audience: 'all' },
        { id: 'ev_2', title: 'Term 1 Tuition Fee Due', category: 'fee', start_date: '2027-04-15', end_date: '2027-04-15', description: 'Last date for clearing Term 1 fees without late fine.', target_audience: 'parents' },
        { id: 'ev_3', title: 'Summer Vacation Begins', category: 'holiday', start_date: '2027-05-18', end_date: '2027-06-12', description: 'Campus closed for annual summer recess.', target_audience: 'all' },
        { id: 'ev_4', title: 'Mid-Term Unit Assessments', category: 'exam', start_date: '2027-07-20', end_date: '2027-07-28', description: 'Unit evaluations for Grades 1 through 12.', target_audience: 'students' },
        { id: 'ev_5', title: 'Term 1 Parent-Teacher Conference (PTM)', category: 'ptm', start_date: '2027-08-07', end_date: '2027-08-07', description: 'Progress review and report card distribution.', target_audience: 'parents' },
        { id: 'ev_6', title: 'Independence Day Observance', category: 'cultural', start_date: '2027-08-15', end_date: '2027-08-15', description: 'Flag hoisting ceremony and student parade.', target_audience: 'all' },
        { id: 'ev_7', title: 'Half-Yearly Term 1 Examinations', category: 'exam', start_date: '2027-09-15', end_date: '2027-09-26', description: 'Comprehensive mid-session examinations.', target_audience: 'students' },
        { id: 'ev_8', title: 'Durga Puja & Autumn Recess', category: 'holiday', start_date: '2027-10-14', end_date: '2027-10-24', description: 'Campus holiday for festival celebrations.', target_audience: 'all' },
        { id: 'ev_9', title: 'Annual Inter-House Sports Meet', category: 'sports', start_date: '2027-12-10', end_date: '2027-12-11', description: 'Track & field events at campus grounds.', target_audience: 'all' },
        { id: 'ev_10', title: 'Annual Final Examinations', category: 'exam', start_date: '2028-02-15', end_date: '2028-02-28', description: 'Final session examinations.', target_audience: 'students' }
      ];

      for (const ev of defaultEvents) {
        await dbService.insert('calendar_events', ev);
      }
      this._events = (await dbService.select('calendar_events')) || [];
    }

    this._currentDate = this._currentDate || new Date();
    this._selectedCategory = this._selectedCategory || 'all';

    const year = this._currentDate.getFullYear();
    const month = this._currentDate.getMonth();
    const monthName = this._currentDate.toLocaleString('default', { month: 'long' });

    // KPI numbers
    const totalEvents = this._events.length;
    const holidays = this._events.filter(e => e.category === 'holiday').length;
    const exams = this._events.filter(e => e.category === 'exam').length;
    const ptms = this._events.filter(e => e.category === 'ptm').length;

    container.innerHTML = `
      <div style="margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
          <div>
            <h1 style="font-size: 1.8rem; display: flex; align-items: center; gap: 10px;">
              <span style="color: #16a34a;"><i data-lucide="calendar"></i></span> Institutional Event &amp; Academic Planner
            </h1>
            <p style="color: var(--text-muted); font-size: 0.9rem;">
              School calendar, holidays, exam schedules, PTMs, and smartphone iCal (.ics) integration.
            </p>
          </div>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button class="btn btn-secondary" id="btn-export-ics"><i data-lucide="download"></i> Export to Phone Calendar (.ics)</button>
            <button class="btn btn-secondary" id="btn-print-academic-cal"><i data-lucide="printer"></i> Print Annual Calendar (A4)</button>
            <button class="btn btn-primary" id="btn-add-cal-event"><i data-lucide="plus"></i> Add Event</button>
          </div>
        </div>
      </div>

      <!-- KPI Summary -->
      <div class="kpi-grid">
        ${UIComponents.renderKpiCard({ title: 'Total Calendar Events', value: `${totalEvents}`, icon: 'calendar', color: 'emerald', subtitle: 'Academic Session ' + TMS_CONFIG.academic.currentYear })}
        ${UIComponents.renderKpiCard({ title: 'School Holidays & Breaks', value: `${holidays}`, icon: 'sun', color: 'blue', subtitle: 'Scheduled Recesses' })}
        ${UIComponents.renderKpiCard({ title: 'Examination Windows', value: `${exams}`, icon: 'award', color: 'rose', subtitle: 'Assessment Cycles' })}
        ${UIComponents.renderKpiCard({ title: 'PTM Conferences', value: `${ptms}`, icon: 'users', color: 'amber', subtitle: 'Parent Meetings' })}
      </div>

      <!-- Controls Toolbar -->
      <div class="card" style="margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
          <!-- Month Navigator -->
          <div style="display: flex; align-items: center; gap: 12px;">
            <button class="btn btn-secondary btn-sm" id="btn-prev-month"><i data-lucide="chevron-left"></i></button>
            <h3 style="font-size: 1.25rem; font-weight: 700; min-width: 180px; text-align: center; margin: 0;">
              ${monthName} ${year}
            </h3>
            <button class="btn btn-secondary btn-sm" id="btn-next-month"><i data-lucide="chevron-right"></i></button>
            <button class="btn btn-secondary btn-sm" id="btn-today-month" style="margin-left: 6px;">Today</button>
          </div>

          <!-- Category Filter Pills -->
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            ${EVENT_CATEGORIES.map(cat => `
              <button class="btn ${this._selectedCategory === cat.id ? 'btn-primary' : 'btn-secondary'} btn-sm btn-filter-cat" data-cat="${cat.id}" style="font-size: 0.75rem; padding: 4px 10px;">
                ${cat.name}
              </button>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Main Calendar Grid Card -->
      <div class="card">
        <div class="table-responsive">
          ${this.renderMonthGridHtml(year, month)}
        </div>
      </div>
    `;

    this.bindEvents(container);
    UIComponents.refreshIcons();
  }

  static renderMonthGridHtml(year, month) {
    const esc = (v) => UIComponents.escapeHtml(v);
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Filter events
    let filteredEvents = this._events;
    if (this._selectedCategory !== 'all') {
      filteredEvents = filteredEvents.filter(e => e.category === this._selectedCategory);
    }

    let rowsHtml = '';
    let currentDay = 1;

    for (let row = 0; row < 6; row++) {
      if (currentDay > totalDays) break;
      rowsHtml += '<tr>';

      for (let col = 0; col < 7; col++) {
        if ((row === 0 && col < firstDayIndex) || currentDay > totalDays) {
          rowsHtml += '<td style="background: var(--bg-subtle, #f8fafc); border: 1px solid var(--border-color); height: 95px; width: 14.28%;"></td>';
        } else {
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
          const isSunday = col === 0;

          // Find events matching this day
          const dayEvents = filteredEvents.filter(e => {
            const start = e.start_date || '';
            const end = e.end_date || start;
            return dateStr >= start && dateStr <= end;
          });

          rowsHtml += `
            <td style="border: 1px solid var(--border-color); height: 95px; width: 14.28%; vertical-align: top; padding: 6px; background: ${isSunday ? 'rgba(239, 68, 68, 0.03)' : 'var(--bg-card)'};">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="font-weight: 700; font-size: 0.85rem; color: ${isSunday ? '#ef4444' : 'var(--text-color)'};">
                  ${currentDay}
                </span>
                ${dayEvents.length ? `<span class="badge badge-info" style="font-size: 0.65rem; padding: 1px 4px;">${dayEvents.length}</span>` : ''}
              </div>
              <div style="display: flex; flex-direction: column; gap: 3px; max-height: 65px; overflow-y: auto;">
                ${dayEvents.map(ev => {
                  const catObj = EVENT_CATEGORIES.find(c => c.id === ev.category) || EVENT_CATEGORIES[1];
                  return `
                    <div class="cal-event-chip" data-id="${esc(ev.id)}" style="background: ${catObj.color}15; border-left: 3px solid ${catObj.color}; color: ${catObj.color}; font-size: 0.7rem; font-weight: 600; padding: 2px 4px; border-radius: 3px; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${esc(ev.title)}">
                      ${esc(ev.title)}
                    </div>
                  `;
                }).join('')}
              </div>
            </td>
          `;
          currentDay++;
        }
      }
      rowsHtml += '</tr>';
    }

    return `
      <table class="tms-table" style="width: 100%; border-collapse: collapse; table-layout: fixed;">
        <thead>
          <tr style="background: var(--bg-subtle, #f8fafc);">
            ${dayNames.map((d, i) => `
              <th style="text-align: center; padding: 8px; font-size: 0.8rem; color: ${i === 0 ? '#ef4444' : 'var(--text-color)'};">
                ${d}
              </th>
            `).join('')}
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;
  }

  static bindEvents(container) {
    // Month navigation
    container.querySelector('#btn-prev-month')?.addEventListener('click', () => {
      this._currentDate.setMonth(this._currentDate.getMonth() - 1);
      this.render(container);
    });

    container.querySelector('#btn-next-month')?.addEventListener('click', () => {
      this._currentDate.setMonth(this._currentDate.getMonth() + 1);
      this.render(container);
    });

    container.querySelector('#btn-today-month')?.addEventListener('click', () => {
      this._currentDate = new Date();
      this.render(container);
    });

    // Category filters
    container.querySelectorAll('.btn-filter-cat').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this._selectedCategory = e.currentTarget.dataset.cat;
        this.render(container);
      });
    });

    // Add Event
    container.querySelector('#btn-add-cal-event')?.addEventListener('click', () => {
      this.openEventModal(null, container);
    });

    // Event chips click
    container.querySelectorAll('.cal-event-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const ev = this._events.find(x => String(x.id) === String(id));
        if (ev) this.openEventModal(ev, container);
      });
    });

    // Export .ics
    container.querySelector('#btn-export-ics')?.addEventListener('click', () => {
      this.exportIcsCalendar();
    });

    // Print A4 Calendar
    container.querySelector('#btn-print-academic-cal')?.addEventListener('click', () => {
      this.openPrintCalendarModal();
    });
  }

  static openEventModal(event, container) {
    const esc = (v) => UIComponents.escapeHtml(v);
    const ev = event || {};
    const isEdit = !!event;

    const bodyHtml = `
      <form id="form-cal-event">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
          <div class="form-group" style="grid-column: 1/-1;">
            <label class="form-label">Event Title *</label>
            <input class="form-input" id="ev-title" required placeholder="e.g. Term 1 Half-Yearly Examinations" value="${esc(ev.title || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">Category *</label>
            <select class="form-select" id="ev-category">
              ${EVENT_CATEGORIES.filter(c => c.id !== 'all').map(c => `
                <option value="${c.id}" ${ev.category === c.id ? 'selected' : ''}>${c.name}</option>
              `).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Target Audience</label>
            <select class="form-select" id="ev-audience">
              <option value="all" ${ev.target_audience === 'all' ? 'selected' : ''}>All Campus (Students, Parents, Faculty)</option>
              <option value="parents" ${ev.target_audience === 'parents' ? 'selected' : ''}>Parents Only</option>
              <option value="students" ${ev.target_audience === 'students' ? 'selected' : ''}>Students Only</option>
              <option value="staff" ${ev.target_audience === 'staff' ? 'selected' : ''}>Faculty &amp; Staff Only</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Start Date *</label>
            <input type="date" class="form-input" id="ev-start" required value="${esc(ev.start_date || new Date().toISOString().slice(0, 10))}">
          </div>
          <div class="form-group">
            <label class="form-label">End Date (Optional for multi-day)</label>
            <input type="date" class="form-input" id="ev-end" value="${esc(ev.end_date || '')}">
          </div>
          <div class="form-group" style="grid-column: 1/-1;">
            <label class="form-label">Description / Instructions</label>
            <textarea class="form-input" id="ev-desc" rows="3" placeholder="Provide any details, dress codes, or timings...">${esc(ev.description || '')}</textarea>
          </div>
        </div>
      </form>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" id="btn-ev-cancel">Cancel</button>
      ${isEdit ? '<button class="btn btn-secondary" id="btn-ev-del" style="color: #ef4444;"><i data-lucide="trash-2"></i> Delete</button>' : ''}
      <button class="btn btn-primary" id="btn-ev-save"><i data-lucide="save"></i> ${isEdit ? 'Save Changes' : 'Add Event'}</button>
    `;

    UIComponents.openModal({
      title: isEdit ? `Edit Event — ${ev.title}` : 'Schedule New Institutional Event',
      bodyHtml,
      footerHtml
    });

    document.getElementById('btn-ev-cancel').addEventListener('click', () => UIComponents.closeModal());

    const delBtn = document.getElementById('btn-ev-del');
    if (delBtn) {
      delBtn.addEventListener('click', async () => {
        if (!confirm(`Delete event "${ev.title}"?`)) return;
        await dbService.delete('calendar_events', ev.id);
        UIComponents.showToast('Event removed.', 'info');
        UIComponents.closeModal();
        await CalendarModule.render(container);
      });
    }

    document.getElementById('btn-ev-save').addEventListener('click', async () => {
      const title = document.getElementById('ev-title').value.trim();
      const start = document.getElementById('ev-start').value;
      if (!title || !start) {
        UIComponents.showToast('Title and start date are required.', 'warning');
        return;
      }

      const payload = {
        id: ev.id || `ev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: title,
        category: document.getElementById('ev-category').value,
        target_audience: document.getElementById('ev-audience').value,
        start_date: start,
        end_date: document.getElementById('ev-end').value || start,
        description: document.getElementById('ev-desc').value.trim()
      };

      if (isEdit) {
        await dbService.update('calendar_events', ev.id, payload);
      } else {
        await dbService.insert('calendar_events', payload);
      }

      UIComponents.showToast(`Event "${title}" saved.`, 'success');
      UIComponents.closeModal();
      await CalendarModule.render(container);
    });

    UIComponents.refreshIcons();
  }

  /**
   * Generates and downloads RFC 5545 iCalendar (.ics) file
   */
  static exportIcsCalendar() {
    let ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Thaiba Public School//Academic Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Thaiba Public School Calendar',
      'X-WR-TIMEZONE:Asia/Kolkata'
    ];

    this._events.forEach(ev => {
      const dtStart = (ev.start_date || '').replace(/-/g, '');
      const dtEnd = (ev.end_date || ev.start_date || '').replace(/-/g, '');
      if (!dtStart) return;

      ics.push(
        'BEGIN:VEVENT',
        `UID:${ev.id}@thaibamodelschool.edu.in`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
        `DTSTART;VALUE=DATE:${dtStart}`,
        `DTEND;VALUE=DATE:${dtEnd}`,
        `SUMMARY:${ev.title || 'School Event'}`,
        `DESCRIPTION:${(ev.description || '').replace(/\n/g, '\\n')}`,
        'LOCATION:Thaiba Public School, Kolkata, West Bengal',
        'STATUS:CONFIRMED',
        'END:VEVENT'
      );
    });

    ics.push('END:VCALENDAR');

    const blob = new Blob([ics.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `TMS_Academic_Calendar_${TMS_CONFIG.academic.currentYear.replace(/\s+/g, '_')}.ics`;
    link.click();
    URL.revokeObjectURL(link.href);

    UIComponents.showToast('Calendar exported (.ics)! Open the file to add to Google/iPhone Calendar.', 'success');
  }

  /**
   * Official Printable Annual Academic Calendar Poster (A4)
   */
  static openPrintCalendarModal() {
    const esc = (v) => UIComponents.escapeHtml(v);
    const emblem = TMS_LOGO.emblemSvg(50);
    const sorted = [...this._events].sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''));

    const bodyHtml = `
      <style>
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body * { visibility: hidden; }
          #annual-cal-print, #annual-cal-print * { visibility: visible; }
          #annual-cal-print { position: fixed; left: 0; top: 0; width: 100%; border: none !important; }
        }
      </style>

      <div id="annual-cal-print" style="background:#fff; color:#0f172a; padding:20px; font-family:'Plus Jakarta Sans', sans-serif;">
        <div style="text-align:center; border-bottom:2px solid #16a34a; padding-bottom:12px; margin-bottom:16px;">
          <div style="display:flex; justify-content:center; margin-bottom:4px;">${emblem}</div>
          <h2 style="font-size:1.35rem; font-weight:800; color:#166534; text-transform:uppercase; margin:0;">${esc(TMS_CONFIG.institution.name)}</h2>
          <div style="font-size:0.8rem; font-weight:600; color:#15803d;">Run by : Thaiba Heritage, Kolkata</div>
          <div style="font-size:0.75rem; color:#64748b;">ANNUAL INSTITUTIONAL ACADEMIC &amp; EVENT CALENDAR • SESSION ${esc(TMS_CONFIG.academic.currentYear)}</div>
        </div>

        <table style="width:100%; border-collapse:collapse; font-size:0.75rem; border:1px solid #cbd5e1;">
          <thead>
            <tr style="background:#f1f5f9; color:#0f172a; text-align:left;">
              <th style="padding:6px 10px; border:1px solid #cbd5e1;">Dates</th>
              <th style="padding:6px 10px; border:1px solid #cbd5e1;">Event &amp; Observance</th>
              <th style="padding:6px 10px; border:1px solid #cbd5e1;">Category</th>
              <th style="padding:6px 10px; border:1px solid #cbd5e1;">Target Audience</th>
              <th style="padding:6px 10px; border:1px solid #cbd5e1;">Details / Guidelines</th>
            </tr>
          </thead>
          <tbody>
            ${sorted.map(ev => {
              const cat = EVENT_CATEGORIES.find(c => c.id === ev.category) || EVENT_CATEGORIES[1];
              const dateDisplay = ev.start_date === ev.end_date || !ev.end_date
                ? ev.start_date
                : `${ev.start_date} to ${ev.end_date}`;

              return `
                <tr>
                  <td style="padding:6px 10px; border:1px solid #cbd5e1; font-weight:700;" class="font-mono">${esc(dateDisplay)}</td>
                  <td style="padding:6px 10px; border:1px solid #cbd5e1;"><strong>${esc(ev.title)}</strong></td>
                  <td style="padding:6px 10px; border:1px solid #cbd5e1;">
                    <span style="color:${cat.color}; font-weight:700;">${esc(cat.name)}</span>
                  </td>
                  <td style="padding:6px 10px; border:1px solid #cbd5e1; text-transform:capitalize;">${esc(ev.target_audience)}</td>
                  <td style="padding:6px 10px; border:1px solid #cbd5e1; font-size:0.7rem; color:#64748b;">${esc(ev.description || '—')}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div style="display:flex; justify-content:space-between; margin-top:30px; font-size:0.75rem; text-align:center;">
          <div style="width:40%;">
            <div style="border-bottom:1.5px solid #0f172a; margin-bottom:4px; padding-bottom:20px;"></div>
            <strong>Academic Committee Secretary</strong>
          </div>
          <div style="width:40%;">
            <div style="border-bottom:1.5px solid #0f172a; margin-bottom:4px; padding-bottom:20px;"></div>
            <strong>Principal (Official Seal)</strong>
          </div>
        </div>
      </div>
    `;

    UIComponents.openModal({
      title: 'Annual Academic Calendar (A4)',
      bodyHtml,
      footerHtml: `
        <button class="btn btn-secondary" onclick="document.getElementById('global-modal-close').click()">Close</button>
        <button class="btn btn-primary" onclick="window.print()"><i data-lucide="printer"></i> Print Calendar Sheet (A4)</button>
      `
    });

    UIComponents.refreshIcons();
  }
}

export default CalendarModule;
