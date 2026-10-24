/**
 * THAIBA PUBLIC SCHOOL — Business Intelligence & Comprehensive Reporting Module
 */

import { TMS_CONFIG } from './config.js';
import { dbService } from './supabase-client.js';
import { UIComponents } from './ui-components.js';

export class ReportsModule {
  static async render(container) {
    const students = await dbService.select('students');
    const staff = await dbService.select('staff_directory');
    const invoices = await dbService.select('invoices');

    const totalBilled = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const totalCollected = invoices.reduce((sum, inv) => sum + (inv.paid || 0), 0);
    const totalOutstanding = invoices.reduce((sum, inv) => sum + (inv.balance || 0), 0);
    const ratioValue = staff.length ? `${Math.round(students.length / staff.length)} : 1` : '—';
    const clearanceValue = totalBilled > 0 ? `${((totalCollected / totalBilled) * 100).toFixed(1)}%` : '—';
    const financeRows = invoices.length ? `
      <tr style="font-weight: 700; background: rgba(59,130,246,0.06);">
        <td>All Invoiced Fees</td>
        <td>${totalBilled.toLocaleString()}</td>
        <td>${totalCollected.toLocaleString()}</td>
        <td style="color: #ef4444;">${totalOutstanding.toLocaleString()}</td>
      </tr>
    ` : `
      <tr>
        <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 30px;">No records available yet.</td>
      </tr>
    `;

    container.innerHTML = `
      <div style="margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
          <div>
            <h1 style="font-size: 1.8rem;">School Intelligence & Analytics</h1>
            <p style="color: var(--text-muted); font-size: 0.9rem;">
              Executive reporting exclusively for THAIBA PUBLIC SCHOOL across attendance, academics, finances, and operations.
            </p>
          </div>
          <div style="display: flex; gap: 10px;">
            <button class="btn btn-secondary" id="btn-export-reports-csv"><i data-lucide="file-spreadsheet"></i> Export CSV Summary</button>
            <button class="btn btn-primary" onclick="window.print()"><i data-lucide="printer"></i> Print Executive Brief</button>
          </div>
        </div>
      </div>

      <div class="kpi-grid">
        ${UIComponents.renderKpiCard({ title: 'Student-Teacher Ratio', value: ratioValue, icon: 'users', color: 'emerald', subtitle: 'Based on Enrolled Records' })}
        ${UIComponents.renderKpiCard({ title: 'Term 1 Fee Clearance', value: clearanceValue, icon: 'credit-card', color: 'blue', subtitle: 'From Recorded Invoices' })}
        ${UIComponents.renderKpiCard({ title: 'Average Monthly Attendance', value: '—', icon: 'award', color: 'amber', subtitle: 'No Attendance Records Yet' })}
        ${UIComponents.renderKpiCard({ title: 'Academic Distinction Rate', value: '—', icon: 'graduation-cap', color: 'rose', subtitle: 'No Results Published Yet' })}
      </div>

      <!-- Analytic Report Sections -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(450px, 1fr)); gap: 24px;">
        <!-- Academic & Attendance Analytics -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Class-Wise Attendance & Academic Scorecard</h3>
            <span class="badge badge-info">${TMS_CONFIG.academic.currentYear}</span>
          </div>
          <div class="table-responsive">
            <table class="tms-table font-mono" style="font-size: 0.84rem;">
              <thead>
                <tr>
                  <th>Class Division</th>
                  <th>Strength</th>
                  <th>Attendance %</th>
                  <th>Pass Rate</th>
                  <th>Remedial Cases</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 30px;">No records available yet.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Financial Collection Breakdown -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Financial Health & Revenue Trends</h3>
            <span class="badge badge-success">Audit Verified</span>
          </div>
          <div class="table-responsive">
            <table class="tms-table font-mono" style="font-size: 0.84rem;">
              <thead>
                <tr>
                  <th>Fee Category</th>
                  <th>Expected (₹)</th>
                  <th>Realized (₹)</th>
                  <th>Outstanding (₹)</th>
                </tr>
              </thead>
              <tbody>
                ${financeRows}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    this.bindEvents(container);
    UIComponents.refreshIcons();
  }

  static bindEvents(container) {
    const csvBtn = container.querySelector('#btn-export-reports-csv');
    if (csvBtn) {
      csvBtn.addEventListener('click', async () => {
        const invoices = await dbService.select('invoices');
        const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const header = 'InvoiceNo,StudentName,Grade,Term,Billed,Paid,Balance\n';
        const body = invoices.map(inv => [
          inv.invoiceNo, inv.studentName, inv.grade, inv.term,
          inv.amount || 0, inv.paid || 0, inv.balance || 0
        ].map(esc).join(',')).join('\n');
        const csvContent = "data:text/csv;charset=utf-8," + header + body;
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `TMS_Executive_Report_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        UIComponents.showToast('Executive report exported to CSV successfully!', 'success');
      });
    }
  }
}

export default ReportsModule;
