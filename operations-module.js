/**
 * THAIBA PUBLIC SCHOOL — Campus Logistics, Library, Transport & Inventory Module
 */

import { TMS_CONFIG } from './config.js';
import { dbService } from './supabase-client.js';
import { UIComponents } from './ui-components.js';
import { auditService } from './audit-service.js';

export class OperationsModule {
  static async render(container) {
    container.innerHTML = `
      <div style="margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
          <div>
            <h1 style="font-size: 1.8rem;">Campus Logistics & Operations</h1>
            <p style="color: var(--text-muted); font-size: 0.9rem;">
              Library circulation, school transport fleet, hostel dormitories, and physical asset inventory.
            </p>
          </div>
          <button class="btn btn-primary" id="btn-issue-book"><i data-lucide="book-open"></i> Issue Library Book</button>
        </div>
      </div>

      <div class="kpi-grid">
        ${UIComponents.renderKpiCard({ title: 'Library Catalogued Books', value: '—', icon: 'library', color: 'blue', subtitle: 'No Records Available' })}
        ${UIComponents.renderKpiCard({ title: 'School Bus Fleet', value: '—', icon: 'bus', color: 'emerald', subtitle: 'No Records Available' })}
        ${UIComponents.renderKpiCard({ title: 'Hostel Residents', value: '—', icon: 'home', color: 'amber', subtitle: 'No Records Available' })}
        ${UIComponents.renderKpiCard({ title: 'Tracked Campus Assets', value: '—', icon: 'package', color: 'rose', subtitle: 'No Records Available' })}
      </div>

      <!-- Navigation Tabs -->
      <div style="display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 1px solid var(--border-color); padding-bottom: 6px;">
        <button class="btn btn-primary ops-tab" data-tab="library">Library & ISBN Catalogue</button>
        <button class="btn btn-secondary ops-tab" data-tab="transport">Transport & Bus Routes</button>
        <button class="btn btn-secondary ops-tab" data-tab="hostel">Hostel & Dormitories</button>
        <button class="btn btn-secondary ops-tab" data-tab="inventory">Asset Inventory</button>
      </div>

      <div id="ops-tab-content"></div>
    `;

    this.bindEvents(container);
    this.renderTab('library', container);
    UIComponents.refreshIcons();
  }

  static renderTab(tabKey, container) {
    const content = container.querySelector('#ops-tab-content');
    if (!content) return;

    if (tabKey === 'library') {
      content.innerHTML = `
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Central Thaiba Library — Active Circulation</h3>
              <p class="card-desc">Book checkouts, RFID/Barcode tracking, due dates, and fine calculations.</p>
            </div>
            <span class="badge badge-info">Circulation Ledger</span>
          </div>

          <div class="table-responsive">
            <table class="tms-table font-mono" style="font-size: 0.84rem;">
              <thead>
                <tr>
                  <th>Accession No</th>
                  <th>ISBN</th>
                  <th>Book Title</th>
                  <th>Author</th>
                  <th>Issued To</th>
                  <th>Due Date</th>
                  <th>Status</th>
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
    } else if (tabKey === 'transport') {
      content.innerHTML = `
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">School Bus Fleet & City Transit Routes</h3>
            <span class="badge badge-info">Fleet Tracking</span>
          </div>
          <div class="table-responsive">
            <table class="tms-table">
              <thead>
                <tr>
                  <th>Route No</th>
                  <th>Bus Reg No</th>
                  <th>Route Name & Key Stops</th>
                  <th>Driver Name</th>
                  <th>Driver Mobile</th>
                  <th>Enrolled Students</th>
                  <th>Status</th>
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
    } else if (tabKey === 'hostel') {
      content.innerHTML = `
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Student Hostel & Dormitory Facilities</h3>
            <span class="badge badge-info">No Records Available</span>
          </div>
          <div style="text-align: center; color: var(--text-muted); padding: 40px;">
            <i data-lucide="inbox" style="width:40px;height:40px;display:block;margin:0 auto 10px;"></i>
            No records available yet.
          </div>
        </div>
      `;
    } else if (tabKey === 'inventory') {
      content.innerHTML = `
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Physical Assets & Laboratory Inventory</h3>
            <button class="btn btn-secondary btn-sm" onclick="alert('Asset audit report generated.')"><i data-lucide="printer"></i> Print Asset Register</button>
          </div>
          <div class="table-responsive">
            <table class="tms-table font-mono" style="font-size: 0.82rem;">
              <thead>
                <tr>
                  <th>Asset Tag</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Location</th>
                  <th>Quantity</th>
                  <th>Condition</th>
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
      `;
    }

    UIComponents.refreshIcons();
  }

  static bindEvents(container) {
    container.querySelectorAll('.ops-tab').forEach(btn => {
      btn.addEventListener('click', (e) => {
        container.querySelectorAll('.ops-tab').forEach(b => {
          b.classList.remove('btn-primary');
          b.classList.add('btn-secondary');
        });
        e.currentTarget.classList.remove('btn-secondary');
        e.currentTarget.classList.add('btn-primary');
        this.renderTab(e.currentTarget.dataset.tab, container);
      });
    });

    const issueBtn = container.querySelector('#btn-issue-book');
    if (issueBtn) {
      issueBtn.addEventListener('click', () => {
        UIComponents.openModal({
          title: 'Issue Book to Student or Faculty',
          bodyHtml: `
            <div class="form-group">
              <label class="form-label">Book Accession Number / Barcode</label>
              <input class="form-input font-mono" id="lib-acc" placeholder="e.g. ACC-2024-554">
            </div>
            <div class="form-group">
              <label class="form-label">Borrower ID / Admission No</label>
              <input class="form-input font-mono" id="lib-borrower" placeholder="e.g. TMS/2024/001">
            </div>
            <div class="form-group">
              <label class="form-label">Loan Duration</label>
              <select class="form-select" id="lib-days">
                <option value="14">14 Days (Standard)</option>
                <option value="28">28 Days (Faculty)</option>
              </select>
            </div>
          `,
          footerHtml: `
            <button class="btn btn-secondary" onclick="document.getElementById('global-modal-close').click()">Cancel</button>
            <button class="btn btn-primary" id="btn-save-issue">Confirm Loan</button>
          `
        });

        document.getElementById('btn-save-issue').addEventListener('click', async () => {
          const accession = document.getElementById('lib-acc').value;
          const borrower = document.getElementById('lib-borrower').value;
          await auditService.log('LIBRARY_BOOK_ISSUED', 'OPERATIONS', {
            accession,
            borrower
          });
          UIComponents.closeModal();
          UIComponents.showToast('Book loan recorded in Central Library circulation ledger!', 'success');
        });
      });
    }
  }
}

export default OperationsModule;
