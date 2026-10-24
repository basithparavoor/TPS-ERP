/**
 * THAIBA PUBLIC SCHOOL — Finance, Invoicing & Cash Counter Module
 */

import { TMS_CONFIG } from './config.js';
import { dbService } from './supabase-client.js';
import { UIComponents } from './ui-components.js';
import { auditService } from './audit-service.js';
import { PermissionEngine, CAPABILITIES } from './permission-engine.js';
import { downloadCsv, shareContent } from './export-utils.js';
import { notificationService } from './notification-service.js';
import { TMS_LOGO } from './logo.js';
import { WhatsAppService } from './whatsapp-service.js';
import { QRCodeGenerator } from './qr-generator.js';

export class FinanceModule {
  static async render(container) {
    const [invoices, students] = await Promise.all([
      dbService.select('invoices'),
      dbService.select('students')
    ]);
    this._students = students || [];
    const esc = (v) => UIComponents.escapeHtml(v);
    const canManage = PermissionEngine.can(CAPABILITIES.MANAGE_FINANCE);

    const totalBilled = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const totalCollected = invoices.reduce((sum, inv) => sum + (inv.paid || 0), 0);
    const totalOutstanding = invoices.reduce((sum, inv) => sum + (inv.balance || 0), 0);
    const efficiencyValue = totalBilled > 0 ? `${((totalCollected / totalBilled) * 100).toFixed(1)}%` : '—';

    container.innerHTML = `
      <div style="margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
          <div>
            <h1 style="font-size: 1.8rem;">Fees & Financial Operations</h1>
            <p style="color: var(--text-muted); font-size: 0.9rem;">
              Tuition fee structures, invoicing engine, cash counter receipts, and student ledger for THAIBA PUBLIC SCHOOL.
            </p>
          </div>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button class="btn btn-secondary" id="btn-generate-challan"><i data-lucide="layers"></i> 3-Part Fee Challan</button>
            <button class="btn btn-secondary" id="btn-defaulters-list"><i data-lucide="alert-circle"></i> Defaulters Aging</button>
            <button class="btn btn-primary" id="btn-open-cash-counter"><i data-lucide="credit-card"></i> Fee Collection Counter</button>
          </div>
        </div>
      </div>

      <div class="kpi-grid">
        ${UIComponents.renderKpiCard({ title: 'Total Invoiced (Term 1)', value: `₹ ${totalBilled.toLocaleString()}`, icon: 'file-text', color: 'blue' })}
        ${UIComponents.renderKpiCard({ title: 'Total Collections', value: `₹ ${totalCollected.toLocaleString()}`, icon: 'check-circle-2', color: 'emerald', subtitle: 'Bank & Cash Reconciled' })}
        ${UIComponents.renderKpiCard({ title: 'Outstanding Balance', value: `₹ ${totalOutstanding.toLocaleString()}`, icon: 'clock', color: 'rose', subtitle: 'Pending Collection' })}
        ${UIComponents.renderKpiCard({ title: 'Collection Efficiency', value: efficiencyValue, icon: 'pie-chart', color: 'amber', subtitle: 'Collected vs Invoiced' })}
      </div>

      <!-- Invoices Ledger Card -->
      <div class="card">
        <div class="card-header" style="flex-wrap:wrap; gap:12px;">
          <div>
            <h3 class="card-title">Fee Invoices &amp; Student Accounts</h3>
            <p class="card-desc">Individual ledger accounts, payment modes (UPI, Cash, Bank Transfer), and receipts.</p>
          </div>
          ${canManage ? '<button class="btn btn-primary btn-sm" id="btn-new-invoice"><i data-lucide="plus"></i> New Invoice</button>' : ''}
        </div>

        ${canManage ? `
        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:12px;">
          <button class="btn btn-secondary btn-sm" id="btn-inv-select-all"><i data-lucide="check-square"></i> Select All</button>
          <button class="btn btn-secondary btn-sm" id="btn-inv-clear">Clear</button>
          <button class="btn btn-secondary btn-sm" id="btn-inv-bulk-export"><i data-lucide="download"></i> Export Selected</button>
          <button class="btn btn-secondary btn-sm" id="btn-inv-bulk-remind"><i data-lucide="bell-ring"></i> Send Reminder</button>
          <button class="btn btn-secondary btn-sm" id="btn-inv-bulk-delete" style="color:#ef4444;"><i data-lucide="trash-2"></i> Delete Selected (<span id="inv-selected-count">0</span>)</button>
        </div>` : ''}

        <div class="table-responsive">
          <table class="tms-table" id="invoices-table">
            <thead>
              <tr>
                ${canManage ? '<th style="width:34px;"><input type="checkbox" id="inv-select-all-cb"></th>' : ''}
                <th>Invoice No</th>
                <th>Student Name</th>
                <th>Grade</th>
                <th>Term</th>
                <th>Billed (₹)</th>
                <th>Paid (₹)</th>
                <th>Balance (₹)</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${invoices.length ? invoices.map(inv => `
                <tr>
                  ${canManage ? `<td><input type="checkbox" class="inv-row-check" value="${esc(inv.id)}"></td>` : ''}
                  <td><span class="font-mono" style="font-weight: 600;">${esc(inv.invoiceNo)}</span></td>
                  <td><strong>${esc(inv.studentName)}</strong></td>
                  <td>${esc(inv.grade)}</td>
                  <td>${esc(inv.term)}</td>
                  <td class="font-mono">₹ ${esc((inv.amount || 0).toLocaleString())}</td>
                  <td class="font-mono" style="color: #10b981;">₹ ${esc((inv.paid || 0).toLocaleString())}</td>
                  <td class="font-mono" style="color: ${inv.balance > 0 ? '#ef4444' : 'inherit'}; font-weight: ${inv.balance > 0 ? '700' : 'normal'};">
                    ₹ ${esc((inv.balance || 0).toLocaleString())}
                  </td>
                  <td>
                    ${inv.status === 'Paid' ? `
                      <span class="badge badge-success">Fully Paid</span>
                    ` : inv.status === 'Partial' ? `
                      <span class="badge badge-warning">Partial</span>
                    ` : `
                      <span class="badge badge-danger">Unpaid</span>
                    `}
                  </td>
                  <td>
                    <div style="display: flex; gap: 6px; flex-wrap:wrap;">
                      <button class="btn btn-secondary btn-sm btn-print-receipt" data-inv="${esc(inv.invoiceNo)}" data-name="${esc(inv.studentName)}" data-amt="${esc(inv.paid || inv.amount)}" data-date="${esc(inv.paidDate || inv.dueDate)}" data-mode="${esc(inv.paymentMode || 'Cash')}">
                        <i data-lucide="receipt"></i> Receipt
                      </button>
                      <button class="btn btn-secondary btn-sm btn-print-challan" data-inv="${esc(inv.invoiceNo)}" data-name="${esc(inv.studentName)}" data-grade="${esc(inv.grade || '')}" data-term="${esc(inv.term || 'Term 1')}" data-amt="${esc(inv.amount)}" data-paid="${esc(inv.paid || 0)}" data-bal="${esc(inv.balance || 0)}" data-due="${esc(inv.dueDate || '')}">
                        <i data-lucide="layers"></i> Challan
                      </button>
                      ${inv.balance > 0 ? `
                        <button class="btn btn-primary btn-sm btn-upi-pay" data-id="${esc(inv.id)}" data-inv="${esc(inv.invoiceNo)}" data-name="${esc(inv.studentName)}" data-bal="${esc(inv.balance)}" style="background:#16a34a; border-color:#16a34a;" title="Scan & Pay with GPay/PhonePe/Paytm">
                          <i data-lucide="qr-code"></i> UPI
                        </button>
                        <button class="btn btn-secondary btn-sm btn-pay-balance" data-id="${esc(inv.id)}" data-name="${esc(inv.studentName)}" data-balance="${esc(inv.balance)}">
                          <i data-lucide="check"></i> Pay
                        </button>
                        <button class="btn btn-secondary btn-sm btn-wa-remind" data-inv="${esc(inv.invoiceNo)}" data-name="${esc(inv.studentName)}" data-bal="${esc(inv.balance)}" data-due="${esc(inv.dueDate || '')}" title="Send 1-Click WhatsApp Fee Reminder" style="color:#16a34a;">
                          <i data-lucide="message-circle"></i> WhatsApp
                        </button>
                      ` : ''}
                      ${canManage ? `
                      <button class="btn btn-secondary btn-sm btn-edit-invoice" data-id="${esc(inv.id)}" title="Edit invoice"><i data-lucide="pencil"></i></button>
                      <button class="btn btn-secondary btn-sm btn-del-invoice" data-id="${esc(inv.id)}" title="Delete invoice" style="color:#ef4444;"><i data-lucide="trash-2"></i></button>` : ''}
                    </div>
                  </td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="${canManage ? 10 : 9}" style="text-align: center; color: var(--text-muted); padding: 30px;">No records available yet.</td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    `;

    this._invoices = invoices;
    this.bindEvents(container);
    UIComponents.refreshIcons();
  }

  static bindEvents(container) {
    /* ---- Selection, bulk actions, edit & delete ---- */
    const invoices = this._invoices || [];
    const canManage = PermissionEngine.can(CAPABILITIES.MANAGE_FINANCE);
    const checked = () => Array.from(container.querySelectorAll('.inv-row-check:checked')).map((c) => c.value);
    const syncCount = () => {
      const el = container.querySelector('#inv-selected-count');
      if (el) el.innerText = checked().length;
    };
    const selectedInvoices = () => invoices.filter((i) => checked().includes(i.id));

    container.querySelectorAll('.inv-row-check').forEach((c) => c.addEventListener('change', syncCount));
    const selAllCb = container.querySelector('#inv-select-all-cb');
    if (selAllCb) {
      selAllCb.addEventListener('change', () => {
        container.querySelectorAll('.inv-row-check').forEach((c) => { c.checked = selAllCb.checked; });
        syncCount();
      });
    }
    const selAllBtn = container.querySelector('#btn-inv-select-all');
    if (selAllBtn) {
      selAllBtn.addEventListener('click', () => {
        container.querySelectorAll('.inv-row-check').forEach((c) => { c.checked = true; });
        syncCount();
      });
    }
    const clearBtn = container.querySelector('#btn-inv-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        container.querySelectorAll('.inv-row-check').forEach((c) => { c.checked = false; });
        syncCount();
      });
    }
    const bulkDelete = container.querySelector('#btn-inv-bulk-delete');
    if (bulkDelete) {
      bulkDelete.addEventListener('click', () => {
        const rows = selectedInvoices();
        if (!rows.length) { UIComponents.showToast('Select at least one invoice.', 'warning'); return; }
        this.deleteInvoices(rows, container);
      });
    }
    const bulkExport = container.querySelector('#btn-inv-bulk-export');
    if (bulkExport) {
      bulkExport.addEventListener('click', () => {
        const rows = selectedInvoices();
        if (!rows.length) { UIComponents.showToast('Select at least one invoice.', 'warning'); return; }
        const header = ['Invoice No', 'Student', 'Grade', 'Term', 'Billed', 'Paid', 'Balance', 'Status', 'Due Date'];
        const data = rows.map((i) => [i.invoiceNo, i.studentName, i.grade, i.term, i.amount, i.paid, i.balance, i.status, i.dueDate]);
        downloadCsv(`TMS-Invoices-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...data]);
        UIComponents.showToast('Selected invoices exported.', 'success');
      });
    }
    const bulkRemind = container.querySelector('#btn-inv-bulk-remind');
    if (bulkRemind) {
      bulkRemind.addEventListener('click', async () => {
        const rows = selectedInvoices().filter((i) => Number(i.balance) > 0);
        if (!rows.length) { UIComponents.showToast('Select at least one invoice with an outstanding balance.', 'warning'); return; }
        try {
          await notificationService.create({
            title: 'Fee Payment Reminder',
            message: `A friendly reminder that ${rows.length} fee invoice(s) remain outstanding. Please settle the balance at the school office or via UPI.`,
            audience: 'parents'
          });
          await auditService.log('FEE_REMINDERS_SENT', 'FINANCE', { count: rows.length });
          UIComponents.showToast(`Reminder sent for ${rows.length} invoice(s).`, 'success');
        } catch (e) {
          UIComponents.showToast(`Could not send the reminder: ${e.message}`, 'danger');
        }
      });
    }
    container.querySelectorAll('.btn-edit-invoice').forEach((b) =>
      b.addEventListener('click', () => {
        const inv = invoices.find((x) => x.id === b.dataset.id);
        if (inv) this.openInvoiceModal(inv, container);
      }));
    container.querySelectorAll('.btn-del-invoice').forEach((b) =>
      b.addEventListener('click', () => {
        const inv = invoices.find((x) => x.id === b.dataset.id);
        if (inv) this.deleteInvoices([inv], container);
      }));
    const newInvBtn = container.querySelector('#btn-new-invoice');
    if (newInvBtn) newInvBtn.addEventListener('click', () => this.openInvoiceModal(null, container));

    const counterBtn = container.querySelector('#btn-open-cash-counter');
    if (counterBtn) {
      counterBtn.addEventListener('click', async () => {
        const escOpt = (v) => UIComponents.escapeHtml(v);
        const allInvoices = await dbService.select('invoices');
        const dueInvoices = allInvoices.filter(inv => (inv.balance || 0) > 0);
        const studentOptions = dueInvoices.map(inv => `
          <option value="${escOpt(inv.id)}|${escOpt(inv.studentName)}|${escOpt(inv.balance)}">${escOpt(inv.studentName)} (${escOpt(inv.grade)}) — Due: ₹ ${escOpt((inv.balance || 0).toLocaleString())}</option>
        `).join('');
        UIComponents.openModal({
          title: 'Cash Counter — Collect Student Fee',
          bodyHtml: `
            <form id="form-collect-fee">
              <div class="form-group">
                <label class="form-label">Student Identification</label>
                <select class="form-select" id="fee-student-select">
                  ${studentOptions || `<option value="">No students with outstanding dues</option>`}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Amount Collecting (₹)</label>
                <input type="number" class="form-input font-mono" id="fee-pay-amount" required placeholder="0">
              </div>
              <div class="form-group">
                <label class="form-label">Payment Mode</label>
                <select class="form-select" id="fee-pay-mode">
                  ${TMS_CONFIG.finance.paymentModes.map(m => `<option value="${m}">${m}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Reference / Transaction ID</label>
                <input class="form-input font-mono" id="fee-pay-ref" placeholder="e.g. UPI-9988229 or Cash Receipt #">
              </div>
            </form>
          `,
          footerHtml: `
            <button class="btn btn-secondary" onclick="document.getElementById('global-modal-close').click()">Cancel</button>
            <button class="btn btn-primary" id="btn-confirm-collection">Record Payment & Issue Receipt</button>
          `
        });

        document.getElementById('btn-confirm-collection').addEventListener('click', async () => {
          const selectVal = document.getElementById('fee-student-select').value.split('|');
          const studentName = selectVal[1];
          const amount = parseFloat(document.getElementById('fee-pay-amount').value) || 0;
          const mode = document.getElementById('fee-pay-mode').value;
          const ref = document.getElementById('fee-pay-ref').value || 'CASH-REC-' + Date.now().toString().substr(-6);

          if (!studentName) {
            UIComponents.showToast('No student selected', 'warning');
            return;
          }

          const invoices = await dbService.select('invoices');
          const inv = invoices.find(i => i.studentName === studentName);
          if (inv) {
            const newPaid = (inv.paid || 0) + amount;
            const newBal = Math.max(0, inv.amount - newPaid);
            const newStatus = newBal === 0 ? 'Paid' : 'Partial';

            const res = await dbService.update('invoices', inv.id, {
              paid: newPaid,
              balance: newBal,
              status: newStatus,
              paidDate: new Date().toISOString().split('T')[0],
              paymentMode: mode
            });
            if (res && res._syncError) {
              UIComponents.showToast(`Payment could not be recorded: ${res._syncError}`, 'danger');
              return;
            }
          }

          await auditService.log('FEE_COLLECTION_RECEIVED', 'FINANCE', {
            studentName,
            amountCollected: amount,
            paymentMode: mode,
            transactionRef: ref
          });

          UIComponents.closeModal();
          UIComponents.showToast(`Payment of ₹ ${amount.toLocaleString()} recorded for ${studentName}!`, 'success');
          FinanceModule.render(container);
        });
      });
    }

    // Individual UPI QR pay button
    container.querySelectorAll('.btn-upi-pay').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const inv = (this._invoices || []).find(i => String(i.id) === String(id));
        if (inv) this.openUpiPaymentModal(inv, container);
      });
    });

    // Individual pay button
    container.querySelectorAll('.btn-pay-balance').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const name = e.currentTarget.dataset.name;
        const bal = e.currentTarget.dataset.balance;
        container.querySelector('#btn-open-cash-counter').click();
      });
    });

    // Individual WhatsApp Reminder button
    container.querySelectorAll('.btn-wa-remind').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const inv = e.currentTarget.dataset.inv;
        const name = e.currentTarget.dataset.name;
        const bal = e.currentTarget.dataset.bal;
        const due = e.currentTarget.dataset.due;
        const student = (this._students || []).find(s => s.fullName === name || s.name === name);
        WhatsAppService.sendFeeReminder({
          studentName: name,
          invoiceNo: inv,
          balance: parseFloat(bal) || 0,
          dueDate: due,
          parentPhone: student ? (student.phone || student.parentPhone) : ''
        });
      });
    });

    // Receipt printer
    container.querySelectorAll('.btn-print-receipt').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const inv = e.currentTarget.dataset.inv;
        const name = e.currentTarget.dataset.name;
        const amt = e.currentTarget.dataset.amt;
        const date = e.currentTarget.dataset.date;
        const mode = e.currentTarget.dataset.mode;
        const esc = (v) => UIComponents.escapeHtml(v);

        UIComponents.openModal({
          title: `Fee Receipt — ${inv}`,
          bodyHtml: `
            <div id="printable-receipt" style="background: #fff; color: #0f172a; padding: 24px; border: 2px dashed #0f172a; border-radius: 8px;">
              <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px;">
                <h2 style="font-size: 1.3rem; margin-bottom: 2px;">${esc(TMS_CONFIG.institution.name)}</h2>
                <p style="font-size: 0.8rem; color: #64748b;">OFFICIAL FEE RECEIPT • BURSAR'S OFFICE</p>
                <div style="font-size: 0.85rem; font-weight: 700; margin-top: 6px;">Receipt #${esc(inv)}</div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.85rem; margin-bottom: 16px;">
                <div><strong>Student:</strong> ${esc(name)}</div>
                <div><strong>Date:</strong> ${esc(date)}</div>
                <div><strong>Payment Mode:</strong> ${esc(mode)}</div>
                <div><strong>Academic Year:</strong> ${esc(TMS_CONFIG.academic.currentYear)}</div>
              </div>

              <table class="tms-table" style="font-size: 0.82rem; margin-bottom: 16px;">
                <thead>
                  <tr style="background: #f1f5f9; color: #0f172a;">
                    <th>Particulars</th>
                    <th style="text-align: right;">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Tuition & Laboratory Term Fee</td>
                    <td style="text-align: right;">₹ ${esc(parseFloat(amt).toLocaleString())}</td>
                  </tr>
                  <tr style="font-weight: 700;">
                    <td>Net Amount Received</td>
                    <td style="text-align: right; color: #10b981;">₹ ${esc(parseFloat(amt).toLocaleString())}</td>
                  </tr>
                </tbody>
              </table>

              <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 30px; font-size: 0.78rem;">
                <div>Computer Generated • No Physical Signature Required</div>
                <div style="text-align: center;">
                  ____________________<br>
                  <strong>Accounts Cashier Seal</strong>
                </div>
              </div>
            </div>
          `,
          footerHtml: `
            <button class="btn btn-secondary" onclick="document.getElementById('global-modal-close').click()">Close</button>
            <button class="btn btn-secondary" id="btn-share-fee-receipt"><i data-lucide="share-2"></i> Share Receipt</button>
            <button class="btn btn-primary" onclick="window.print()"><i data-lucide="printer"></i> Print Official Receipt</button>
          `
        });

        const shareReceiptBtn = document.getElementById('btn-share-fee-receipt');
        if (shareReceiptBtn) {
          shareReceiptBtn.addEventListener('click', async () => {
            await shareContent({
              title: `Fee Payment Receipt — ${name}`,
              text: `Official Fee Payment Receipt\nStudent: ${name}\nInvoice No: ${inv}\nAmount Paid: ₹ ${amt}\nPayment Mode: ${mode}\nDate: ${date}\n${TMS_CONFIG.institution.name}, Kolkata`,
              url: window.location.href
            });
            UIComponents.showToast('Receipt shared / copied to clipboard!', 'success');
          });
        }
        UIComponents.refreshIcons();
      });
    });

    // Challan printer per invoice
    container.querySelectorAll('.btn-print-challan').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const inv = e.currentTarget.dataset.inv;
        const name = e.currentTarget.dataset.name;
        const grade = e.currentTarget.dataset.grade;
        const term = e.currentTarget.dataset.term;
        const amt = e.currentTarget.dataset.amt;
        const paid = e.currentTarget.dataset.paid;
        const bal = e.currentTarget.dataset.bal;
        const due = e.currentTarget.dataset.due;

        FinanceModule.open3PartChallanModal({
          invoiceNo: inv,
          studentName: name,
          grade: grade,
          term: term,
          amount: parseFloat(amt) || 0,
          paid: parseFloat(paid) || 0,
          balance: parseFloat(bal) || 0,
          dueDate: due || new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0]
        });
      });
    });

    // Top action: Generate 3-part Challan
    const genChallanBtn = container.querySelector('#btn-generate-challan');
    if (genChallanBtn) {
      genChallanBtn.addEventListener('click', () => {
        FinanceModule.openCustomChallanModal(container);
      });
    }

    // Top action: Defaulters Aging & WhatsApp Recovery
    const defaultersBtn = container.querySelector('#btn-defaulters-list');
    if (defaultersBtn) {
      defaultersBtn.addEventListener('click', async () => {
        const allInvoices = await dbService.select('invoices');
        FinanceModule.openDefaultersAgingModal(allInvoices, this._students || []);
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Defaulters Aging Analysis & 1-Click WhatsApp Recovery              */
  /* ------------------------------------------------------------------ */
  static openDefaultersAgingModal(invoices = [], students = []) {
    const esc = (v) => UIComponents.escapeHtml(v);
    const today = new Date();

    const dueInvoices = invoices.filter(i => (parseFloat(i.balance) || 0) > 0);

    const enriched = dueInvoices.map(inv => {
      const student = students.find(s => 
        (s.id && s.id === inv.studentId) || 
        (s.admissionNo && s.admissionNo === inv.admissionNo) ||
        (s.fullName && s.fullName.toLowerCase() === (inv.studentName || '').toLowerCase())
      ) || {};

      let daysPastDue = 0;
      if (inv.dueDate) {
        const due = new Date(inv.dueDate);
        const diff = Math.floor((today - due) / (1000 * 60 * 60 * 24));
        daysPastDue = Math.max(0, diff);
      }

      let bucket = '0-30';
      if (daysPastDue > 90) bucket = '90+';
      else if (daysPastDue > 60) bucket = '61-90';
      else if (daysPastDue > 30) bucket = '31-60';

      return {
        ...inv,
        student,
        phone: student.guardianPhone || inv.phone || '',
        daysPastDue,
        bucket
      };
    });

    // Sort by largest balance first
    enriched.sort((a, b) => (b.balance || 0) - (a.balance || 0));

    const totalOverdue = enriched.reduce((sum, i) => sum + (parseFloat(i.balance) || 0), 0);
    const b0_30 = enriched.filter(i => i.bucket === '0-30');
    const b31_60 = enriched.filter(i => i.bucket === '31-60');
    const b61_90 = enriched.filter(i => i.bucket === '61-90');
    const b90_plus = enriched.filter(i => i.bucket === '90+');

    const sum0_30 = b0_30.reduce((s, i) => s + (parseFloat(i.balance) || 0), 0);
    const sum31_60 = b31_60.reduce((s, i) => s + (parseFloat(i.balance) || 0), 0);
    const sum61_90 = b61_90.reduce((s, i) => s + (parseFloat(i.balance) || 0), 0);
    const sum90_plus = b90_plus.reduce((s, i) => s + (parseFloat(i.balance) || 0), 0);

    const bodyHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <!-- Header KPI Cards -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-bottom: 20px;">
          <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 12px; text-align: center;">
            <div style="font-size: 0.72rem; text-transform: uppercase; color: #64748b; font-weight: 700;">Total Delinquent</div>
            <div style="font-size: 1.3rem; font-weight: 800; color: #dc2626; margin: 4px 0;">₹ ${totalOverdue.toLocaleString()}</div>
            <div style="font-size: 0.75rem; color: #64748b;">${enriched.length} Defaulters</div>
          </div>
          <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 8px; padding: 12px; text-align: center;">
            <div style="font-size: 0.72rem; text-transform: uppercase; color: #166534; font-weight: 700;">0 — 30 Days</div>
            <div style="font-size: 1.2rem; font-weight: 800; color: #16a34a; margin: 4px 0;">₹ ${sum0_30.toLocaleString()}</div>
            <div style="font-size: 0.75rem; color: #15803d;">${b0_30.length} Students</div>
          </div>
          <div style="background: #fefce8; border: 1.5px solid #fde047; border-radius: 8px; padding: 12px; text-align: center;">
            <div style="font-size: 0.72rem; text-transform: uppercase; color: #854d0e; font-weight: 700;">31 — 60 Days</div>
            <div style="font-size: 1.2rem; font-weight: 800; color: #ca8a04; margin: 4px 0;">₹ ${sum31_60.toLocaleString()}</div>
            <div style="font-size: 0.75rem; color: #a16207;">${b31_60.length} Students</div>
          </div>
          <div style="background: #fff7ed; border: 1.5px solid #fdba74; border-radius: 8px; padding: 12px; text-align: center;">
            <div style="font-size: 0.72rem; text-transform: uppercase; color: #9a3412; font-weight: 700;">61 — 90 Days</div>
            <div style="font-size: 1.2rem; font-weight: 800; color: #ea580c; margin: 4px 0;">₹ ${sum61_90.toLocaleString()}</div>
            <div style="font-size: 0.75rem; color: #c2410c;">${b61_90.length} Students</div>
          </div>
          <div style="background: #fef2f2; border: 1.5px solid #fca5a5; border-radius: 8px; padding: 12px; text-align: center;">
            <div style="font-size: 0.72rem; text-transform: uppercase; color: #991b1b; font-weight: 700;">90+ Days Critical</div>
            <div style="font-size: 1.2rem; font-weight: 800; color: #dc2626; margin: 4px 0;">₹ ${sum90_plus.toLocaleString()}</div>
            <div style="font-size: 0.75rem; color: #b91c1c;">${b90_plus.length} Students</div>
          </div>
        </div>

        <!-- Aging Visual Bar -->
        <div style="margin-bottom: 20px;">
          <div style="font-size: 0.8rem; font-weight: 700; color: #475569; margin-bottom: 6px;">Visual Aging Debt Exposure:</div>
          <div style="display: flex; height: 16px; border-radius: 8px; overflow: hidden; background: #e2e8f0; width: 100%;">
            ${totalOverdue > 0 ? `
              <div style="width: ${(sum0_30 / totalOverdue) * 100}%; background: #16a34a;" title="0-30 Days: ₹ ${sum0_30.toLocaleString()}"></div>
              <div style="width: ${(sum31_60 / totalOverdue) * 100}%; background: #eab308;" title="31-60 Days: ₹ ${sum31_60.toLocaleString()}"></div>
              <div style="width: ${(sum61_90 / totalOverdue) * 100}%; background: #f97316;" title="61-90 Days: ₹ ${sum61_90.toLocaleString()}"></div>
              <div style="width: ${(sum90_plus / totalOverdue) * 100}%; background: #dc2626;" title="90+ Days: ₹ ${sum90_plus.toLocaleString()}"></div>
            ` : `<div style="width: 100%; background: #16a34a;"></div>`}
          </div>
        </div>

        <!-- Defaulters Roster Table -->
        <div class="table-responsive" style="max-height: 380px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
          <table class="tms-table" style="font-size: 0.82rem;">
            <thead>
              <tr style="background: #f8fafc;">
                <th>Student Full Name</th>
                <th>Admission No</th>
                <th>Grade</th>
                <th>Due Date</th>
                <th>Overdue Days</th>
                <th>Outstanding (₹)</th>
                <th style="text-align: right;">1-Click Action</th>
              </tr>
            </thead>
            <tbody>
              ${enriched.length ? enriched.map(i => `
                <tr>
                  <td><strong>${esc(i.studentName)}</strong></td>
                  <td><span class="font-mono">${esc(i.admissionNo || i.student?.admissionNo || '—')}</span></td>
                  <td>${esc(i.grade || i.student?.grade || '—')}</td>
                  <td>${esc(i.dueDate || '—')}</td>
                  <td>
                    <span class="badge ${i.daysPastDue > 90 ? 'badge-danger' : i.daysPastDue > 60 ? 'badge-warning' : 'badge-secondary'}">
                      ${i.daysPastDue} Days
                    </span>
                  </td>
                  <td class="font-mono" style="font-weight: 700; color: #dc2626;">
                    ₹ ${(i.balance || 0).toLocaleString()}
                  </td>
                  <td style="text-align: right;">
                    <button class="btn btn-secondary btn-sm btn-defaulter-wa" data-inv="${esc(i.invoiceNo)}" data-name="${esc(i.studentName)}" data-bal="${esc(i.balance)}" data-due="${esc(i.dueDate || '')}" data-phone="${esc(i.phone)}" style="color: #16a34a; font-weight: 600;">
                      <i data-lucide="message-circle"></i> WhatsApp Notice
                    </button>
                  </td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px;">
                    🎉 All student fee accounts are fully settled! No outstanding balances recorded.
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    `;

    UIComponents.openModal({
      title: 'Defaulters Aging Analysis & Automated WhatsApp Recovery',
      bodyHtml,
      footerHtml: `
        <button class="btn btn-secondary" onclick="document.getElementById('global-modal-close').click()">Close</button>
        <button class="btn btn-secondary" id="btn-export-aging-csv"><i data-lucide="download"></i> Export Defaulters (CSV)</button>
        <button class="btn btn-primary" onclick="window.print()"><i data-lucide="printer"></i> Print Aging Report</button>
      `
    });

    UIComponents.refreshIcons();

    // Export CSV
    const exportCsvBtn = document.getElementById('btn-export-aging-csv');
    if (exportCsvBtn) {
      exportCsvBtn.addEventListener('click', () => {
        const rows = [
          ['Invoice No', 'Student Name', 'Admission No', 'Grade', 'Guardian Phone', 'Due Date', 'Days Overdue', 'Aging Bucket', 'Outstanding Balance']
        ];
        enriched.forEach(i => {
          rows.push([
            i.invoiceNo || '',
            i.studentName || '',
            i.admissionNo || i.student?.admissionNo || '',
            i.grade || i.student?.grade || '',
            i.phone || '',
            i.dueDate || '',
            i.daysPastDue,
            i.bucket,
            i.balance || 0
          ]);
        });
        downloadCsv(`TMS_Defaulters_Aging_${new Date().toISOString().split('T')[0]}`, rows);
        UIComponents.showToast('Defaulters aging report exported to CSV.', 'success');
      });
    }

    // Individual WhatsApp trigger
    document.querySelectorAll('.btn-defaulter-wa').forEach(b => {
      b.addEventListener('click', (e) => {
        const invNo = e.currentTarget.dataset.inv;
        const name = e.currentTarget.dataset.name;
        const bal = parseFloat(e.currentTarget.dataset.bal) || 0;
        const due = e.currentTarget.dataset.due;
        const phone = e.currentTarget.dataset.phone;

        WhatsAppService.sendFeeReminder({
          invoiceNo: invNo,
          studentName: name,
          balance: bal,
          dueDate: due,
          phone: phone
        });
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* 3-Part Fee Challan Generator Engine                                */
  /* ------------------------------------------------------------------ */

  static renderChallanPart(copyName, data) {
    const esc = (v) => UIComponents.escapeHtml(v);
    const emblem = TMS_LOGO.emblemSvg(38);
    const amount = Number(data.amount) || 0;
    const tuition = Math.round(amount * 0.70);
    const development = Math.round(amount * 0.18);
    const labComp = Math.max(0, amount - tuition - development);

    return `
      <div class="challan-copy" style="
        flex: 1;
        min-width: 0;
        padding: 12px 10px;
        background: #ffffff;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #0f172a;
        font-size: 0.72rem;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      ">
        <div>
          <!-- Header -->
          <div style="text-align: center; border-bottom: 1.5px solid #16a34a; padding-bottom: 6px; margin-bottom: 8px;">
            <div style="display: flex; justify-content: center; margin-bottom: 4px;">${emblem}</div>
            <div style="font-size: 0.85rem; font-weight: 800; color: #166534; text-transform: uppercase; line-height: 1.1;">
              ${esc(TMS_CONFIG.institution.name)}
            </div>
            <div style="font-size: 0.66rem; font-weight: 600; color: #15803d;">
              ${esc(TMS_CONFIG.institution.subtitle || 'Run by : Thaiba Heritage, Kolkata')}
            </div>
            <div style="font-size: 0.62rem; color: #64748b;">
              ${esc(TMS_CONFIG.institution.address.campus)}, ${esc(TMS_CONFIG.institution.address.city)}
            </div>
            <div style="margin-top: 5px;">
              <span style="background: #166534; color: #fff; font-size: 0.64rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px;">
                ${esc(copyName)}
              </span>
            </div>
          </div>

          <!-- Bank & Session Details -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 8px; margin-bottom: 8px; font-size: 0.66rem;">
            <div><strong>Bank:</strong> State Bank of India • Kolkata Central</div>
            <div><strong>A/C Name:</strong> Thaiba Public School</div>
            <div><strong>A/C No:</strong> <span class="font-mono" style="font-weight: 700;">38947291039</span> • <strong>IFSC:</strong> SBIN0001234</div>
            <div style="display: flex; justify-content: space-between; margin-top: 4px; border-top: 1px dashed #cbd5e1; padding-top: 3px;">
              <span><strong>Challan:</strong> <span class="font-mono">${esc(data.invoiceNo || 'CHL-2027-001')}</span></span>
              <span><strong>Session:</strong> ${esc(TMS_CONFIG.academic.currentYear)}</span>
            </div>
          </div>

          <!-- Student Meta -->
          <div style="margin-bottom: 8px; font-size: 0.68rem; line-height: 1.4;">
            <div><strong>Student:</strong> ${esc(data.studentName)}</div>
            <div><strong>Admission No:</strong> <span class="font-mono">${esc(data.admissionNo || data.studentId || '—')}</span></div>
            <div style="display: flex; justify-content: space-between;">
              <span><strong>Class:</strong> ${esc(data.grade || '—')}</span>
              <span><strong>Term:</strong> ${esc(data.term || 'Term 1')}</span>
            </div>
            <div><strong>Due Date:</strong> <span style="color: #dc2626; font-weight: 600;">${esc(data.dueDate || '15th of Month')}</span></div>
          </div>

          <!-- Particulars Table -->
          <table style="width: 100%; border-collapse: collapse; font-size: 0.66rem; margin-bottom: 8px; border: 1px solid #cbd5e1;">
            <thead>
              <tr style="background: #f1f5f9; border-bottom: 1px solid #cbd5e1;">
                <th style="padding: 3px 6px; text-align: left; border: 1px solid #cbd5e1;">Particulars</th>
                <th style="padding: 3px 6px; text-align: right; border: 1px solid #cbd5e1;">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding: 3px 6px; border: 1px solid #cbd5e1;">Tuition Fee</td>
                <td style="padding: 3px 6px; text-align: right; border: 1px solid #cbd5e1;" class="font-mono">${tuition.toLocaleString()}</td>
              </tr>
              <tr>
                <td style="padding: 3px 6px; border: 1px solid #cbd5e1;">Campus Dev & Library</td>
                <td style="padding: 3px 6px; text-align: right; border: 1px solid #cbd5e1;" class="font-mono">${development.toLocaleString()}</td>
              </tr>
              <tr>
                <td style="padding: 3px 6px; border: 1px solid #cbd5e1;">Computer & Lab Fee</td>
                <td style="padding: 3px 6px; text-align: right; border: 1px solid #cbd5e1;" class="font-mono">${labComp.toLocaleString()}</td>
              </tr>
              <tr style="background: #ecfdf5; font-weight: 700; border-top: 1.5px solid #16a34a;">
                <td style="padding: 4px 6px; border: 1px solid #cbd5e1; color: #166534;">TOTAL PAYABLE</td>
                <td style="padding: 4px 6px; text-align: right; border: 1px solid #cbd5e1; color: #166534;" class="font-mono">₹ ${amount.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          <!-- Payment Mode & Dynamic UPI -->
          <div style="font-size: 0.62rem; color: #475569; margin-bottom: 8px; line-height: 1.3; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 4px; padding: 4px 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div><strong>Scan &amp; Pay via UPI</strong> (GPay / PhonePe / Paytm):</div>
                <div style="font-size: 0.58rem; color: #166534; font-weight: 700;">UPI ID: thaibaheritage@sbi</div>
                <div style="font-size: 0.58rem; color: #64748b; margin-top: 2px;">Ref / UTR: ___________________</div>
              </div>
              <div style="width: 38px; height: 38px; background: #fff; border: 1px solid #cbd5e1; border-radius: 3px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                <img src="${QRCodeGenerator.getQrUrl(`upi://pay?pa=thaibaheritage@sbi&pn=Thaiba%20Model%20School&am=${amount}&tr=${esc(data.invoiceNo || 'INV')}&cu=INR`, 100)}" alt="UPI QR" style="width: 36px; height: 36px; display: block;">
              </div>
            </div>
          </div>
        </div>

        <!-- Signature Blocks -->
        <div style="display: flex; justify-content: space-between; align-items: flex-end; padding-top: 8px; font-size: 0.62rem; text-align: center;">
          <div style="width: 45%;">
            <div style="border-bottom: 1px solid #475569; margin-bottom: 2px; padding-bottom: 12px;"></div>
            <strong>Depositor Sign</strong>
          </div>
          <div style="width: 45%;">
            <div style="border-bottom: 1px solid #475569; margin-bottom: 2px; padding-bottom: 12px;"></div>
            <strong>Cashier / Bank Seal</strong>
          </div>
        </div>
      </div>
    `;
  }

  static open3PartChallanModal(challanData) {
    const bankCopy = this.renderChallanPart('Bank Copy', challanData);
    const schoolCopy = this.renderChallanPart('School / Accounts Copy', challanData);
    const studentCopy = this.renderChallanPart('Student / Parent Copy', challanData);

    const printStyles = `
      <style>
        @media print {
          @page {
            size: A4 landscape;
            margin: 6mm;
          }
          body * {
            visibility: hidden;
          }
          #print-area-3part-challan, #print-area-3part-challan * {
            visibility: visible;
          }
          #print-area-3part-challan {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }
          .tms-modal-overlay, .tms-modal, .tms-modal-content {
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
            overflow: visible !important;
          }
          .tms-modal-header, .tms-modal-footer, #app-sidebar, header {
            display: none !important;
          }
        }
      </style>
    `;

    const bodyHtml = `
      ${printStyles}
      <div id="print-area-3part-challan" style="
        background: #f8fafc;
        border: 2px solid #cbd5e1;
        border-radius: 8px;
        padding: 8px;
        display: flex;
        gap: 0;
        position: relative;
        overflow-x: auto;
      ">
        ${bankCopy}
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 18px; border-left: 1.5px dashed #94a3b8; border-right: 1.5px dashed #94a3b8; background: #f1f5f9; color: #64748b; font-size: 8px; text-align: center; padding: 4px 0;">
          <span>✂</span>
          <span style="writing-mode: vertical-rl; transform: rotate(180deg); margin: 6px 0; letter-spacing: 2px;">TEAR ALONG LINE</span>
          <span>✂</span>
        </div>
        ${schoolCopy}
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 18px; border-left: 1.5px dashed #94a3b8; border-right: 1.5px dashed #94a3b8; background: #f1f5f9; color: #64748b; font-size: 8px; text-align: center; padding: 4px 0;">
          <span>✂</span>
          <span style="writing-mode: vertical-rl; transform: rotate(180deg); margin: 6px 0; letter-spacing: 2px;">TEAR ALONG LINE</span>
          <span>✂</span>
        </div>
        ${studentCopy}
      </div>
    `;

    UIComponents.openModal({
      title: `3-Part Fee Challan — ${challanData.invoiceNo || challanData.studentName}`,
      bodyHtml,
      footerHtml: `
        <button class="btn btn-secondary" onclick="document.getElementById('global-modal-close').click()">Close</button>
        <button class="btn btn-primary" onclick="window.print()"><i data-lucide="printer"></i> Print 3-Part Challan (A4)</button>
      `
    });

    UIComponents.refreshIcons();
  }

  static async openCustomChallanModal(container) {
    const esc = (v) => UIComponents.escapeHtml(v);
    const students = await dbService.select('students');
    const classes = (TMS_CONFIG.academic && TMS_CONFIG.academic.classes) || [];
    const year = (TMS_CONFIG.academic && TMS_CONFIG.academic.currentYear) || new Date().getFullYear();

    const bodyHtml = `
      <form id="form-custom-challan">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
          <div class="form-group" style="grid-column: span 2;">
            <label class="form-label">Select Student (Or Enter Manually) *</label>
            <select class="form-select" id="challan-student-select">
              <option value="">— Select an enrolled student —</option>
              ${students.map(s => `
                <option value="${esc(s.id)}" data-name="${esc(s.fullName)}" data-adm="${esc(s.admissionNo)}" data-grade="${esc(s.grade)}" data-sec="${esc(s.section || '')}">
                  ${esc(s.fullName)} (${esc(s.admissionNo)} • ${esc(s.grade)})
                </option>
              `).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Student Full Name *</label>
            <input type="text" class="form-input" id="c-student-name" required placeholder="Student Name">
          </div>
          <div class="form-group">
            <label class="form-label">Admission Number</label>
            <input type="text" class="form-input font-mono" id="c-admission-no" placeholder="TMS/2027/001">
          </div>
          <div class="form-group">
            <label class="form-label">Grade / Class</label>
            <select class="form-select" id="c-grade">
              ${classes.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Fee Term / Period</label>
            <select class="form-select" id="c-term">
              ${['Term 1', 'Term 2', 'Term 3', 'Admission Fee', 'Annual Fee', 'Monthly Fee'].map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Total Amount Payable (₹) *</label>
            <input type="number" class="form-input" id="c-amount" required value="4500" min="100">
          </div>
          <div class="form-group">
            <label class="form-label">Due Date</label>
            <input type="date" class="form-input" id="c-due-date" value="${new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0]}">
          </div>
        </div>
      </form>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="document.getElementById('global-modal-close').click()">Cancel</button>
      <button class="btn btn-primary" id="btn-submit-custom-challan"><i data-lucide="printer"></i> Preview &amp; Print 3-Part Challan</button>
    `;

    UIComponents.openModal({
      title: 'Generate Official 3-Part Bank Challan',
      bodyHtml,
      footerHtml
    });

    const modal = document.querySelector('.tms-modal');
    if (!modal) return;

    const selectEl = modal.querySelector('#challan-student-select');
    selectEl.addEventListener('change', () => {
      const opt = selectEl.selectedOptions[0];
      if (opt && opt.dataset.name) {
        modal.querySelector('#c-student-name').value = opt.dataset.name;
        modal.querySelector('#c-admission-no').value = opt.dataset.adm;
        modal.querySelector('#c-grade').value = opt.dataset.grade;
      }
    });

    modal.querySelector('#btn-submit-custom-challan').addEventListener('click', () => {
      const name = modal.querySelector('#c-student-name').value.trim();
      const adm = modal.querySelector('#c-admission-no').value.trim();
      const grade = modal.querySelector('#c-grade').value;
      const term = modal.querySelector('#c-term').value;
      const amount = parseFloat(modal.querySelector('#c-amount').value) || 0;
      const dueDate = modal.querySelector('#c-due-date').value;

      if (!name || !amount) {
        UIComponents.showToast('Please provide Student Name and Amount.', 'warning');
        return;
      }

      const randomSeq = Math.floor(1000 + Math.random() * 9000);
      const invoiceNo = `CHL-${year}-${randomSeq}`;

      FinanceModule.open3PartChallanModal({
        invoiceNo,
        studentName: name,
        admissionNo: adm,
        grade,
        term,
        amount,
        dueDate
      });
    });

    UIComponents.refreshIcons();
  }

  /* ------------------------------------------------------------------ */
  /* Create / Edit / Delete invoices                                     */
  /* ------------------------------------------------------------------ */

  static nextInvoiceNo() {
    const existing = this._invoices || [];
    const year = (TMS_CONFIG.academic && TMS_CONFIG.academic.currentYear) || new Date().getFullYear();
    const maxSeq = existing.reduce((max, i) => {
      const m = String(i.invoiceNo || '').match(/(\d+)\s*$/);
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    return `INV-${year}-${(maxSeq + 1).toString().padStart(4, '0')}`;
  }

  static openInvoiceModal(invoice, container) {
    const esc = (v) => UIComponents.escapeHtml(v);
    const inv = invoice || {};
    const isEdit = !!invoice;
    const classes = (TMS_CONFIG.academic && TMS_CONFIG.academic.classes) || [];
    const terms = ['Term 1', 'Term 2', 'Term 3', 'Annual', 'Monthly', 'Admission'];

    const bodyHtml = `
      <form id="form-invoice">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
          <div class="form-group">
            <label class="form-label">Invoice No</label>
            <input class="form-input font-mono" id="inv-no" value="${esc(inv.invoiceNo || this.nextInvoiceNo())}">
          </div>
          <div class="form-group">
            <label class="form-label">Student Name *</label>
            <input class="form-input" id="inv-name" required value="${esc(inv.studentName || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">Grade / Class</label>
            <select class="form-select" id="inv-grade">
              ${classes.map((c) => `<option ${inv.grade === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Term / Period</label>
            <select class="form-select" id="inv-term">
              ${terms.map((t) => `<option ${inv.term === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Amount Billed (₹) *</label>
            <input type="number" class="form-input" id="inv-amount" required value="${inv.amount != null ? esc(inv.amount) : ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Amount Paid (₹)</label>
            <input type="number" class="form-input" id="inv-paid" value="${inv.paid != null ? esc(inv.paid) : 0}">
          </div>
          <div class="form-group">
            <label class="form-label">Due Date</label>
            <input type="date" class="form-input" id="inv-due" value="${esc((inv.dueDate || '').slice(0, 10))}">
          </div>
          <div class="form-group">
            <label class="form-label">Payment Mode</label>
            <select class="form-select" id="inv-mode">
              ${['', 'Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card'].map((m) => `<option value="${esc(m)}" ${inv.paymentMode === m ? 'selected' : ''}>${m || '—'}</option>`).join('')}
            </select>
          </div>
        </div>
        <p style="font-size:0.74rem; color:var(--text-subtle); margin-top:8px;">The outstanding balance and status are calculated automatically from the billed and paid amounts.</p>
      </form>
    `;
    const footerHtml = `
      <button class="btn btn-secondary" id="inv-cancel">Cancel</button>
      ${isEdit ? '<button class="btn btn-secondary" id="inv-delete" style="color:#ef4444;"><i data-lucide="trash-2"></i> Delete</button>' : ''}
      <button class="btn btn-primary" id="inv-save"><i data-lucide="save"></i> ${isEdit ? 'Save Invoice' : 'Create Invoice'}</button>
    `;
    UIComponents.openModal({ title: isEdit ? `Edit Invoice — ${inv.invoiceNo || ''}` : 'Create Fee Invoice', bodyHtml, footerHtml });

    document.getElementById('inv-cancel').addEventListener('click', () => UIComponents.closeModal());
    const delBtn = document.getElementById('inv-delete');
    if (delBtn) delBtn.addEventListener('click', () => { UIComponents.closeModal(); this.deleteInvoices([inv], container); });

    document.getElementById('inv-save').addEventListener('click', async () => {
      const name = document.getElementById('inv-name').value.trim();
      const amount = parseFloat(document.getElementById('inv-amount').value) || 0;
      const paid = parseFloat(document.getElementById('inv-paid').value) || 0;
      if (!name) { UIComponents.showToast('Student name is required.', 'warning'); return; }
      if (amount <= 0) { UIComponents.showToast('The billed amount must be greater than zero.', 'warning'); return; }
      const balance = Math.max(0, amount - paid);
      const status = paid <= 0 ? 'Unpaid' : (balance <= 0 ? 'Paid' : 'Partial');
      const payload = {
        invoiceNo: document.getElementById('inv-no').value.trim() || this.nextInvoiceNo(),
        studentName: name,
        grade: document.getElementById('inv-grade').value,
        term: document.getElementById('inv-term').value,
        amount,
        paid,
        balance,
        status,
        dueDate: document.getElementById('inv-due').value || null,
        paymentMode: document.getElementById('inv-mode').value || null
      };
      const res = isEdit
        ? await dbService.update('invoices', inv.id, payload)
        : await dbService.insert('invoices', payload);
      if (res && res._syncError) { UIComponents.showToast(`Could not save the invoice: ${res._syncError}`, 'danger'); return; }
      await auditService.log(isEdit ? 'INVOICE_UPDATED' : 'INVOICE_CREATED', 'FINANCE', { invoiceNo: payload.invoiceNo, amount, paid });
      UIComponents.showToast(`Invoice ${payload.invoiceNo} ${isEdit ? 'updated' : 'created'}.`, 'success');
      UIComponents.closeModal();
      await FinanceModule.render(container);
    });
    UIComponents.refreshIcons();
  }

  static openUpiPaymentModal(invoice, container) {
    const esc = (v) => UIComponents.escapeHtml(v);
    const inv = invoice || {};
    const bal = inv.balance != null ? inv.balance : (inv.amount || 0);
    const upiUri = `upi://pay?pa=thaibaheritage@sbi&pn=Thaiba%20Model%20School&am=${bal}&tr=${inv.invoiceNo}&cu=INR&tn=Fee%20Payment%20${inv.invoiceNo}`;

    const bodyHtml = `
      <div style="text-align: center; padding: 10px 0;">
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
          <h3 style="font-size: 1.1rem; color: #166534; margin-bottom: 4px;">Dynamic UPI QR Payment Gateway</h3>
          <p style="font-size: 0.8rem; color: #15803d;">Instant contactless fee clearance with real-time settlement</p>
        </div>

        <div style="display: flex; justify-content: center; margin-bottom: 14px;">
          <div id="upi-modal-qr-target" style="padding: 12px; background: #fff; border: 2px solid #16a34a; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); display: inline-block;"></div>
        </div>

        <div style="display: flex; justify-content: center; gap: 8px; margin-bottom: 14px; flex-wrap: wrap;">
          <span style="background: #f1f5f9; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; color: #334155;">Google Pay</span>
          <span style="background: #f1f5f9; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; color: #5b21b6;">PhonePe</span>
          <span style="background: #f1f5f9; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; color: #0284c7;">Paytm</span>
          <span style="background: #f1f5f9; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; color: #166534;">BHIM UPI</span>
        </div>

        <div style="background: var(--bg-subtle, #f8fafc); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; margin-bottom: 16px; text-align: left; font-size: 0.82rem; line-height: 1.5;">
          <div><strong>Student:</strong> ${esc(inv.studentName)}</div>
          <div><strong>Invoice No:</strong> <span class="font-mono">${esc(inv.invoiceNo)}</span></div>
          <div><strong>Billed Total:</strong> ₹ ${(inv.amount || 0).toLocaleString()}</div>
          <div style="color: #dc2626; font-size: 0.95rem;"><strong>Pending Balance:</strong> ₹ ${bal.toLocaleString()}</div>
          <div style="color: #166534;"><strong>UPI VPA:</strong> <span class="font-mono" style="font-weight: 700;">thaibaheritage@sbi</span></div>
        </div>

        <div style="margin-bottom: 14px;">
          <a href="${upiUri}" class="btn btn-secondary" style="width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none;">
            <i data-lucide="smartphone"></i> Open Directly in Phone UPI App
          </a>
        </div>

        <div style="border-top: 1px dashed var(--border-color); padding-top: 14px; text-align: left;">
          <h4 style="font-size: 0.85rem; margin-bottom: 6px; color: var(--text-color);">Clear Payment via UPI Reference</h4>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label" style="font-size: 0.75rem;">Amount Received (₹) *</label>
              <input type="number" class="form-input" id="upi-paid-amt" value="${bal}">
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size: 0.75rem;">12-Digit UTR / Bank Ref No *</label>
              <input class="form-input font-mono" id="upi-utr-no" placeholder="e.g. 423985172631" maxlength="24">
            </div>
          </div>
        </div>
      </div>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" id="btn-upi-modal-close">Close</button>
      <button class="btn btn-primary" id="btn-upi-verify-save" style="background: #16a34a; border-color: #16a34a;">
        <i data-lucide="check-circle-2"></i> Verify &amp; Record Payment
      </button>
    `;

    UIComponents.openModal({
      title: `UPI Payment — ${inv.invoiceNo}`,
      bodyHtml,
      footerHtml
    });

    // Render the crisp QR Code
    const qrTarget = document.getElementById('upi-modal-qr-target');
    if (qrTarget) {
      QRCodeGenerator.render(qrTarget, upiUri, { width: 160, height: 160 });
    }

    document.getElementById('btn-upi-modal-close').addEventListener('click', () => UIComponents.closeModal());

    document.getElementById('btn-upi-verify-save').addEventListener('click', async () => {
      const utr = document.getElementById('upi-utr-no').value.trim();
      const paidNow = parseFloat(document.getElementById('upi-paid-amt').value) || 0;

      if (!utr) {
        UIComponents.showToast('Please enter the 12-digit UPI UTR / Bank Reference Number.', 'warning');
        return;
      }
      if (paidNow <= 0) {
        UIComponents.showToast('Please enter a valid payment amount.', 'warning');
        return;
      }

      const prevPaid = parseFloat(inv.paid) || 0;
      const newPaid = prevPaid + paidNow;
      const newBalance = Math.max(0, (inv.amount || 0) - newPaid);
      const newStatus = newBalance <= 0 ? 'Paid' : 'Partial';

      const updatePayload = {
        paid: newPaid,
        balance: newBalance,
        status: newStatus,
        paymentMode: 'UPI QR',
        notes: `UPI UTR: ${utr} (${new Date().toLocaleDateString('en-GB')})`
      };

      const res = await dbService.update('invoices', inv.id, updatePayload);
      if (res && res._syncError) {
        UIComponents.showToast(`Error updating invoice: ${res._syncError}`, 'danger');
        return;
      }

      await auditService.log('UPI_FEE_COLLECTION', 'FINANCE', {
        invoiceNo: inv.invoiceNo,
        studentName: inv.studentName,
        paidNow,
        utr,
        newBalance
      });

      UIComponents.showToast(`Payment of ₹ ${paidNow.toLocaleString()} verified via UPI UTR: ${utr}!`, 'success');
      UIComponents.closeModal();
      await FinanceModule.render(container);
    });

    UIComponents.refreshIcons();
  }

  static async deleteInvoices(rows, container) {
    const label = rows.length === 1 ? `Delete invoice ${rows[0].invoiceNo}?` : `Delete ${rows.length} invoices?`;
    if (!confirm(`${label}\n\nThis permanently removes the invoice record. This cannot be undone.`)) return;
    for (const inv of rows) {
      // eslint-disable-next-line no-await-in-loop
      await dbService.delete('invoices', inv.id);
      // eslint-disable-next-line no-await-in-loop
      await auditService.log('INVOICE_DELETED', 'FINANCE', { invoiceNo: inv.invoiceNo, studentName: inv.studentName }, inv.id);
    }
    UIComponents.showToast(`${rows.length} invoice(s) deleted.`, 'success');
    await FinanceModule.render(container);
  }
}

export default FinanceModule;
