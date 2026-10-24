/**
 * THAIBA PUBLIC SCHOOL — Campus Facilities & Infrastructure Module
 * Single-Institution Architecture exclusively for TMS
 */

import { TMS_CONFIG } from './config.js';
import { dbService } from './supabase-client.js';
import { UIComponents } from './ui-components.js';
import { auditService } from './audit-service.js';
import { downloadCsv } from './export-utils.js';

export class InstitutionModule {
  static async render(container) {
    const facilities = await dbService.select('facilities');
    const esc = (v) => UIComponents.escapeHtml(v);
    this._facilities = facilities;

    const academicBlocks = new Set(facilities.map(f => f.building).filter(Boolean)).size;
    const labCount = facilities.filter(f => /lab/i.test(String(f.name || ''))).length;
    const totalSeating = facilities.reduce((sum, f) => sum + (parseInt(f.capacity, 10) || 0), 0);

    container.innerHTML = `
      <div style="margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
          <div>
            <h1 style="font-size: 1.8rem;">Campus Infrastructure &amp; Facilities</h1>
            <p style="color: var(--text-muted); font-size: 0.9rem;">Building directory, laboratory spaces, seating capacities, and maintenance log for THAIBA PUBLIC SCHOOL.</p>
          </div>
          <button class="btn btn-primary" id="btn-add-facility"><i data-lucide="plus-circle"></i> Add Facility / Room</button>
        </div>
      </div>

      <div class="kpi-grid">
        ${UIComponents.renderKpiCard({ title: 'Academic Blocks', value: `${academicBlocks}`, icon: 'building', color: 'blue' })}
        ${UIComponents.renderKpiCard({ title: 'Configured Classrooms', value: `${facilities.length}`, icon: 'door-open', color: 'emerald' })}
        ${UIComponents.renderKpiCard({ title: 'Specialized Labs', value: `${labCount}`, icon: 'flask-conical', color: 'amber' })}
        ${UIComponents.renderKpiCard({ title: 'Total Seating Capacity', value: `${totalSeating.toLocaleString()}`, icon: 'users', color: 'rose' })}
      </div>

      <div class="card">
        <div class="card-header" style="flex-wrap:wrap; gap:12px;">
          <div>
            <h3 class="card-title">School Physical Spaces Directory</h3>
            <p class="card-desc">Classrooms, science labs, computer wings, library, and faculty lounges.</p>
          </div>
        </div>

        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:12px;">
          <button class="btn btn-secondary btn-sm" id="btn-fac-select-all"><i data-lucide="check-square"></i> Select All</button>
          <button class="btn btn-secondary btn-sm" id="btn-fac-clear">Clear</button>
          <button class="btn btn-secondary btn-sm" id="btn-fac-bulk-export"><i data-lucide="download"></i> Export Selected</button>
          <button class="btn btn-secondary btn-sm" id="btn-fac-bulk-delete" style="color:#ef4444;"><i data-lucide="trash-2"></i> Delete Selected (<span id="fac-selected-count">0</span>)</button>
        </div>

        <div class="table-responsive">
          <table class="tms-table" id="facilities-table">
            <thead>
              <tr>
                <th style="width:34px;"><input type="checkbox" id="fac-select-all-cb"></th>
                <th>Facility ID</th>
                <th>Building / Wing</th>
                <th>Floor</th>
                <th>Room Name</th>
                <th>Seating Capacity</th>
                <th>Operating Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${facilities.length ? facilities.map(f => `
                <tr>
                  <td><input type="checkbox" class="fac-row-check" value="${esc(f.id)}"></td>
                  <td><span class="font-mono" style="font-weight: 600; font-size:0.74rem;">${esc(f.id)}</span></td>
                  <td><strong>${esc(f.building)}</strong></td>
                  <td>${esc(f.floor)}</td>
                  <td>${esc(f.name)}</td>
                  <td>${esc(f.capacity)} Seats</td>
                  <td><span class="badge ${/maint/i.test(String(f.status || '')) ? 'badge-warning' : 'badge-success'}">${esc(f.status || 'Active')}</span></td>
                  <td style="white-space:nowrap;">
                    <button class="btn btn-secondary btn-sm btn-maint-facility" data-id="${esc(f.id)}" title="Toggle maintenance status"><i data-lucide="wrench"></i></button>
                    <button class="btn btn-secondary btn-sm btn-edit-facility" data-id="${esc(f.id)}" title="Edit facility"><i data-lucide="pencil"></i></button>
                    <button class="btn btn-secondary btn-sm btn-del-facility" data-id="${esc(f.id)}" title="Delete facility" style="color:#ef4444;"><i data-lucide="trash-2"></i></button>
                  </td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 30px;">No records available yet.</td>
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
    const facilities = this._facilities || [];

    const addBtn = container.querySelector('#btn-add-facility');
    if (addBtn) addBtn.addEventListener('click', () => this.openFacilityModal(null, container));

    container.querySelectorAll('.btn-edit-facility').forEach((b) =>
      b.addEventListener('click', () => {
        const f = facilities.find((x) => x.id === b.dataset.id);
        if (f) this.openFacilityModal(f, container);
      }));

    container.querySelectorAll('.btn-del-facility').forEach((b) =>
      b.addEventListener('click', () => {
        const f = facilities.find((x) => x.id === b.dataset.id);
        if (f) this.deleteFacilities([f], container);
      }));

    container.querySelectorAll('.btn-maint-facility').forEach((b) =>
      b.addEventListener('click', async () => {
        const f = facilities.find((x) => x.id === b.dataset.id);
        if (!f) return;
        const next = /maint/i.test(String(f.status || '')) ? 'Active' : 'Under Maintenance';
        // eslint-disable-next-line no-await-in-loop
        await dbService.update('facilities', f.id, { status: next });
        // eslint-disable-next-line no-await-in-loop
        await auditService.log('FACILITY_MAINTENANCE_LOGGED', 'OPERATIONS', { facilityId: f.id, status: next }, f.id);
        UIComponents.showToast(`${f.name} marked as ${next}.`, 'success');
        await InstitutionModule.render(container);
      }));

    const checked = () => Array.from(container.querySelectorAll('.fac-row-check:checked')).map((c) => c.value);
    const syncCount = () => {
      const el = container.querySelector('#fac-selected-count');
      if (el) el.innerText = checked().length;
    };
    const selectedFacilities = () => facilities.filter((f) => checked().includes(f.id));

    container.querySelectorAll('.fac-row-check').forEach((c) => c.addEventListener('change', syncCount));
    const selAllCb = container.querySelector('#fac-select-all-cb');
    if (selAllCb) {
      selAllCb.addEventListener('change', () => {
        container.querySelectorAll('.fac-row-check').forEach((c) => { c.checked = selAllCb.checked; });
        syncCount();
      });
    }
    const selAllBtn = container.querySelector('#btn-fac-select-all');
    if (selAllBtn) {
      selAllBtn.addEventListener('click', () => {
        container.querySelectorAll('.fac-row-check').forEach((c) => { c.checked = true; });
        syncCount();
      });
    }
    const clearBtn = container.querySelector('#btn-fac-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        container.querySelectorAll('.fac-row-check').forEach((c) => { c.checked = false; });
        syncCount();
      });
    }
    const bulkDelete = container.querySelector('#btn-fac-bulk-delete');
    if (bulkDelete) {
      bulkDelete.addEventListener('click', () => {
        const rows = selectedFacilities();
        if (!rows.length) { UIComponents.showToast('Select at least one facility.', 'warning'); return; }
        this.deleteFacilities(rows, container);
      });
    }
    const bulkExport = container.querySelector('#btn-fac-bulk-export');
    if (bulkExport) {
      bulkExport.addEventListener('click', () => {
        const rows = selectedFacilities();
        if (!rows.length) { UIComponents.showToast('Select at least one facility.', 'warning'); return; }
        const header = ['Facility ID', 'Building', 'Floor', 'Room Name', 'Capacity', 'Status'];
        const data = rows.map((f) => [f.id, f.building, f.floor, f.name, f.capacity, f.status]);
        downloadCsv(`TMS-Facilities-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...data]);
        UIComponents.showToast('Selected facilities exported.', 'success');
      });
    }
  }

  static openFacilityModal(facility, container) {
    const esc = (v) => UIComponents.escapeHtml(v);
    const f = facility || {};
    const isEdit = !!facility;
    const floors = ['Ground Floor', '1st Floor', '2nd Floor', '3rd Floor'];
    const statuses = ['Active', 'Under Maintenance', 'Closed'];

    UIComponents.openModal({
      title: isEdit ? `Edit Facility — ${f.name || ''}` : 'Register New Campus Space / Facility',
      bodyHtml: `
        <form id="form-new-facility">
          <div class="form-group">
            <label class="form-label">Building / Wing Name *</label>
            <input class="form-input" id="fac-building" required value="${esc(f.building || '')}" placeholder="e.g. Ibn Sina Academic Block">
          </div>
          <div class="form-group">
            <label class="form-label">Floor</label>
            <select class="form-select" id="fac-floor">
              ${floors.map((v) => `<option ${f.floor === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Facility / Room Name *</label>
            <input class="form-input" id="fac-name" required value="${esc(f.name || '')}" placeholder="e.g. Grade 10-A Smart Classroom">
          </div>
          <div class="form-group">
            <label class="form-label">Seating Capacity</label>
            <input type="number" class="form-input" id="fac-capacity" required value="${f.capacity != null ? esc(f.capacity) : ''}" placeholder="35">
          </div>
          <div class="form-group">
            <label class="form-label">Operating Status</label>
            <select class="form-select" id="fac-status">
              ${statuses.map((v) => `<option ${(f.status || 'Active') === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}
            </select>
          </div>
        </form>
      `,
      footerHtml: `
        <button class="btn btn-secondary" id="fac-cancel">Cancel</button>
        ${isEdit ? '<button class="btn btn-secondary" id="fac-delete" style="color:#ef4444;"><i data-lucide="trash-2"></i> Delete</button>' : ''}
        <button class="btn btn-primary" id="btn-save-facility"><i data-lucide="save"></i> ${isEdit ? 'Save Changes' : 'Save Facility'}</button>
      `
    });

    document.getElementById('fac-cancel').addEventListener('click', () => UIComponents.closeModal());
    const delBtn = document.getElementById('fac-delete');
    if (delBtn) delBtn.addEventListener('click', () => { UIComponents.closeModal(); this.deleteFacilities([f], container); });

    document.getElementById('btn-save-facility').addEventListener('click', async () => {
      const building = document.getElementById('fac-building').value.trim();
      const floor = document.getElementById('fac-floor').value;
      const name = document.getElementById('fac-name').value.trim();
      const capacity = parseInt(document.getElementById('fac-capacity').value, 10) || 30;
      const status = document.getElementById('fac-status').value;

      if (!name) {
        UIComponents.showToast('Please enter room name.', 'warning');
        return;
      }

      const payload = { building, floor, name, capacity, status };
      const record = isEdit
        ? await dbService.update('facilities', f.id, payload)
        : await dbService.insert('facilities', payload);

      if (record && record._syncError) {
        UIComponents.showToast(`Facility could not be saved: ${record._syncError}`, 'danger');
        return;
      }

      await auditService.log(isEdit ? 'FACILITY_UPDATED' : 'FACILITY_ADDED', 'OPERATIONS', { name, building, capacity }, isEdit ? f.id : record.id);
      UIComponents.closeModal();
      UIComponents.showToast(`Facility ${name} ${isEdit ? 'updated' : 'added'} successfully!`, 'success');
      await InstitutionModule.render(container);
    });

    UIComponents.refreshIcons();
  }

  static async deleteFacilities(rows, container) {
    const label = rows.length === 1 ? `Delete ${rows[0].name}?` : `Delete ${rows.length} facilities?`;
    if (!confirm(`${label}\n\nThis permanently removes the facility record. This cannot be undone.`)) return;
    for (const f of rows) {
      // eslint-disable-next-line no-await-in-loop
      await dbService.delete('facilities', f.id);
      // eslint-disable-next-line no-await-in-loop
      await auditService.log('FACILITY_DELETED', 'OPERATIONS', { facilityId: f.id, name: f.name }, f.id);
    }
    UIComponents.showToast(`${rows.length} facility(ies) deleted.`, 'success');
    await InstitutionModule.render(container);
  }
}

export default InstitutionModule;
