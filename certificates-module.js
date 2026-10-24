/**
 * THAIBA PUBLIC SCHOOL — Institutional Certificates Generator Engine
 * Official Transfer Certificates (TC), Character & Conduct Testimonials, and Academic Merit Awards
 */

import { TMS_CONFIG } from './config.js';
import { dbService } from './supabase-client.js';
import { UIComponents } from './ui-components.js';
import { auditService } from './audit-service.js';
import { TMS_LOGO } from './logo.js';

export class CertificatesModule {
  static async render(container) {
    const esc = (v) => UIComponents.escapeHtml(v);

    const [allStudents, allCerts] = await Promise.all([
      dbService.select('students'),
      dbService.select('certificates')
    ]);

    this._students = allStudents || [];
    this._certificates = allCerts || [];

    container.innerHTML = `
      <div style="margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
          <div>
            <h1 style="font-size: 1.8rem; display: flex; align-items: center; gap: 10px;">
              <span style="color: #16a34a;"><i data-lucide="file-check"></i></span> Official Certificates Engine
            </h1>
            <p style="color: var(--text-muted); font-size: 0.9rem;">
              Generate and print official School Transfer Certificates (TC), Character Certificates, and Academic Merit Awards.
            </p>
          </div>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button class="btn btn-secondary" id="btn-new-character-cert"><i data-lucide="award"></i> Character Certificate</button>
            <button class="btn btn-primary" id="btn-new-tc"><i data-lucide="file-text"></i> Issue Transfer Certificate (TC)</button>
          </div>
        </div>
      </div>

      <div class="kpi-grid">
        ${UIComponents.renderKpiCard({ title: 'Total Certificates Issued', value: `${this._certificates.length}`, icon: 'file-text', color: 'blue' })}
        ${UIComponents.renderKpiCard({ title: 'Transfer Certificates (TC)', value: `${this._certificates.filter(c => c.type === 'transfer').length}`, icon: 'log-out', color: 'rose', subtitle: 'Official Discharges' })}
        ${UIComponents.renderKpiCard({ title: 'Character Testimonials', value: `${this._certificates.filter(c => c.type === 'character').length}`, icon: 'shield-check', color: 'emerald' })}
        ${UIComponents.renderKpiCard({ title: 'Academic Session', value: TMS_CONFIG.academic.currentYear, icon: 'calendar', color: 'amber' })}
      </div>

      <!-- Issued Certificates Ledger Card -->
      <div class="card">
        <div class="card-header" style="flex-wrap: wrap; gap: 10px;">
          <div>
            <h3 class="card-title">Issued Certificates Ledger</h3>
            <p class="card-desc">Permanent institutional record of issued student certificates with verification numbers.</p>
          </div>
        </div>

        <div class="table-responsive">
          <table class="tms-table" id="certs-ledger-table">
            <thead>
              <tr>
                <th>Certificate No</th>
                <th>Type</th>
                <th>Student Name</th>
                <th>Admission No</th>
                <th>Class</th>
                <th>Date of Issue</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${this._certificates.length ? this._certificates.map(c => `
                <tr>
                  <td><span class="font-mono" style="font-weight: 700; color: #166534;">${esc(c.certificateNo || c.id)}</span></td>
                  <td>
                    <span class="badge ${c.type === 'transfer' ? 'badge-danger' : c.type === 'character' ? 'badge-success' : 'badge-info'}">
                      ${c.type === 'transfer' ? 'Transfer Certificate' : c.type === 'character' ? 'Character Certificate' : 'Merit Award'}
                    </span>
                  </td>
                  <td><strong>${esc(c.studentName)}</strong></td>
                  <td><span class="font-mono">${esc(c.admissionNo || '—')}</span></td>
                  <td>${esc(c.grade || '—')}</td>
                  <td>${esc(c.issuedDate || new Date().toISOString().slice(0, 10))}</td>
                  <td>
                    <button class="btn btn-secondary btn-sm btn-print-cert-row" data-id="${esc(c.id)}">
                      <i data-lucide="printer"></i> Print Certificate
                    </button>
                  </td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 36px;">
                    No certificates issued yet. Click "Issue Transfer Certificate" above to generate your first certificate.
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

    // Issue TC Button
    const tcBtn = container.querySelector('#btn-new-tc');
    if (tcBtn) {
      tcBtn.addEventListener('click', () => {
        this.openCertificateFormModal('transfer', container);
      });
    }

    // Issue Character Certificate Button
    const charBtn = container.querySelector('#btn-new-character-cert');
    if (charBtn) {
      charBtn.addEventListener('click', () => {
        this.openCertificateFormModal('character', container);
      });
    }

    // Print row button
    container.querySelectorAll('.btn-print-cert-row').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const cert = this._certificates.find(c => c.id === id);
        if (cert) {
          if (cert.type === 'transfer') {
            this.openTransferCertificatePrintModal(cert);
          } else {
            this.openCharacterCertificatePrintModal(cert);
          }
        }
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Certificate Creation Modal                                         */
  /* ------------------------------------------------------------------ */
  static openCertificateFormModal(type, container) {
    const esc = (v) => UIComponents.escapeHtml(v);
    const isTC = type === 'transfer';
    const title = isTC ? 'Issue School Transfer Certificate (TC)' : 'Issue Character & Conduct Certificate';
    const seq = Math.floor(100 + Math.random() * 900);
    const certNo = isTC ? `TC/${new Date().getFullYear()}/${seq}` : `CC/${new Date().getFullYear()}/${seq}`;

    const bodyHtml = `
      <form id="form-cert-create">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
          <div class="form-group" style="grid-column: 1 / -1;">
            <label class="form-label" style="font-weight: 600;">Select Student *</label>
            <select class="form-select" id="cert-student-select">
              <option value="">— Select an enrolled student —</option>
              ${this._students.map(s => `
                <option value="${esc(s.id)}" data-name="${esc(s.fullName)}" data-adm="${esc(s.admissionNo)}" data-grade="${esc(s.grade)}" data-dob="${esc(s.dob || '')}" data-parent="${esc(s.parentName || s.fatherName || '')}">
                  ${esc(s.fullName)} (${esc(s.admissionNo)} • ${esc(s.grade)})
                </option>
              `).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" style="font-weight: 600;">Certificate Serial No</label>
            <input type="text" class="form-input font-mono" id="cert-no" value="${certNo}" required>
          </div>

          <div class="form-group">
            <label class="form-label" style="font-weight: 600;">Date of Issue</label>
            <input type="date" class="form-input" id="cert-issue-date" value="${new Date().toISOString().slice(0, 10)}" required>
          </div>

          <div class="form-group">
            <label class="form-label" style="font-weight: 600;">Student Full Name *</label>
            <input type="text" class="form-input" id="cert-name" placeholder="Full Name" required>
          </div>

          <div class="form-group">
            <label class="form-label" style="font-weight: 600;">Admission No</label>
            <input type="text" class="form-input font-mono" id="cert-adm" placeholder="e.g. TMS/2027/001">
          </div>

          <div class="form-group">
            <label class="form-label" style="font-weight: 600;">Father's / Guardian's Name</label>
            <input type="text" class="form-input" id="cert-father" placeholder="Father's Name">
          </div>

          <div class="form-group">
            <label class="form-label" style="font-weight: 600;">Mother's Name</label>
            <input type="text" class="form-input" id="cert-mother" placeholder="Mother's Name">
          </div>

          <div class="form-group">
            <label class="form-label" style="font-weight: 600;">Class / Grade</label>
            <select class="form-select" id="cert-grade">
              ${TMS_CONFIG.academic.classes.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" style="font-weight: 600;">General Conduct</label>
            <select class="form-select" id="cert-conduct">
              <option value="Exemplary">Exemplary</option>
              <option value="Very Good" selected>Very Good</option>
              <option value="Good">Good</option>
              <option value="Satisfactory">Satisfactory</option>
            </select>
          </div>

          ${isTC ? `
            <div class="form-group" style="grid-column: 1 / -1;">
              <label class="form-label" style="font-weight: 600;">Reason for Leaving School</label>
              <input type="text" class="form-input" id="cert-reason" value="Parent's request / Relocation" placeholder="Reason for transfer">
            </div>
            <div class="form-group">
              <label class="form-label" style="font-weight: 600;">School Dues Paid Up To</label>
              <input type="text" class="form-input" id="cert-dues" value="Current Term (All dues cleared)">
            </div>
            <div class="form-group">
              <label class="form-label" style="font-weight: 600;">Qualified for Promotion</label>
              <select class="form-select" id="cert-promoted">
                <option value="Yes, Promoted to next higher class" selected>Yes, Promoted to next higher class</option>
                <option value="Studying in current class">Studying in current class</option>
              </select>
            </div>
          ` : `
            <div class="form-group" style="grid-column: 1 / -1;">
              <label class="form-label" style="font-weight: 600;">Special Achievements &amp; Remarks</label>
              <input type="text" class="form-input" id="cert-remarks" value="Active participant in academic activities, disciplined and holds high moral values.">
            </div>
          `}
        </div>
      </form>
    `;

    UIComponents.openModal({
      title,
      bodyHtml,
      footerHtml: `
        <button class="btn btn-secondary" onclick="document.getElementById('global-modal-close').click()">Cancel</button>
        <button class="btn btn-primary" id="btn-save-issue-cert"><i data-lucide="check-circle-2"></i> Issue &amp; Print</button>
      `
    });

    const modal = document.querySelector('.tms-modal');
    if (!modal) return;

    // Student select auto-fill
    const sel = modal.querySelector('#cert-student-select');
    sel.addEventListener('change', () => {
      const opt = sel.selectedOptions[0];
      if (opt && opt.dataset.name) {
        modal.querySelector('#cert-name').value = opt.dataset.name;
        modal.querySelector('#cert-adm').value = opt.dataset.adm;
        modal.querySelector('#cert-grade').value = opt.dataset.grade;
        if (opt.dataset.parent) modal.querySelector('#cert-father').value = opt.dataset.parent;
      }
    });

    // Save and print
    modal.querySelector('#btn-save-issue-cert').addEventListener('click', async () => {
      const certNoVal = modal.querySelector('#cert-no').value.trim();
      const nameVal = modal.querySelector('#cert-name').value.trim();
      const admVal = modal.querySelector('#cert-adm').value.trim();
      const gradeVal = modal.querySelector('#cert-grade').value;
      const fatherVal = modal.querySelector('#cert-father').value.trim();
      const motherVal = modal.querySelector('#cert-mother')?.value.trim() || '';
      const conductVal = modal.querySelector('#cert-conduct').value;
      const issueDate = modal.querySelector('#cert-issue-date').value;

      if (!nameVal || !certNoVal) {
        UIComponents.showToast('Please provide Student Name and Certificate Number.', 'warning');
        return;
      }

      const details = {
        fatherName: fatherVal,
        motherName: motherVal,
        conduct: conductVal,
        reason: modal.querySelector('#cert-reason')?.value || '',
        dues: modal.querySelector('#cert-dues')?.value || '',
        promoted: modal.querySelector('#cert-promoted')?.value || '',
        remarks: modal.querySelector('#cert-remarks')?.value || ''
      };

      const certRecord = {
        id: `cert_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        certificateNo: certNoVal,
        type,
        studentName: nameVal,
        admissionNo: admVal,
        grade: gradeVal,
        details,
        issuedDate: issueDate,
        issuedBy: 'Office of the Principal'
      };

      try {
        await dbService.insert('certificates', certRecord);
        await auditService.log('CERTIFICATE_ISSUED', 'ACADEMICS', { type, certNo: certNoVal, student: nameVal });
        UIComponents.closeModal();
        UIComponents.showToast(`Certificate ${certNoVal} issued successfully!`, 'success');
        this.render(container);

        if (type === 'transfer') {
          this.openTransferCertificatePrintModal(certRecord);
        } else {
          this.openCharacterCertificatePrintModal(certRecord);
        }
      } catch (err) {
        console.error('Error saving certificate:', err);
        UIComponents.showToast('Failed to save certificate record.', 'error');
      }
    });

    UIComponents.refreshIcons();
  }

  /* ------------------------------------------------------------------ */
  /* Transfer Certificate (TC) Print Modal                              */
  /* ------------------------------------------------------------------ */
  static openTransferCertificatePrintModal(cert) {
    const esc = (v) => UIComponents.escapeHtml(v);
    const d = cert.details || {};
    const emblem = TMS_LOGO.emblemSvg(70);

    const bodyHtml = `
      <style>
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm;
          }
          body * {
            visibility: hidden;
          }
          #print-area-tc, #print-area-tc * {
            visibility: visible;
          }
          #print-area-tc {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            padding: 10mm !important;
            border: 3px double #166534 !important;
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

      <div id="print-area-tc" style="background: #fff; color: #0f172a; padding: 32px 36px; border: 3px double #166534; border-radius: 8px; font-family: 'Times New Roman', Times, serif; position: relative;">
        <!-- Institutional Header -->
        <div style="text-align: center; border-bottom: 2px solid #166534; padding-bottom: 12px; margin-bottom: 20px;">
          <div style="display: flex; justify-content: center; margin-bottom: 6px;">${emblem}</div>
          <h1 style="font-size: 1.6rem; font-weight: 800; color: #166534; text-transform: uppercase; margin: 0; letter-spacing: 0.5px;">
            ${esc(TMS_CONFIG.institution.name)}
          </h1>
          <p style="font-size: 0.9rem; font-weight: 700; color: #15803d; margin: 2px 0;">
            ${esc(TMS_CONFIG.institution.subtitle || 'Run by : Thaiba Heritage, Kolkata')}
          </p>
          <div style="font-size: 0.78rem; color: #475569;">
            ${esc(TMS_CONFIG.institution.address.campus)}, ${esc(TMS_CONFIG.institution.address.city)} • Phone: ${esc(TMS_CONFIG.institution.contact.phone)}
          </div>
          <div style="display: inline-block; border-bottom: 2px solid #166534; font-size: 1.15rem; font-weight: 800; color: #166534; text-transform: uppercase; margin-top: 12px; padding-bottom: 2px; letter-spacing: 1px;">
            TRANSFER CERTIFICATE
          </div>
        </div>

        <!-- Certificate Meta -->
        <div style="display: flex; justify-content: space-between; font-size: 0.88rem; margin-bottom: 20px; font-weight: 600;">
          <div>Certificate No: <span class="font-mono" style="color: #166534; font-weight: 800;">${esc(cert.certificateNo)}</span></div>
          <div>Admission No: <span class="font-mono">${esc(cert.admissionNo || '—')}</span></div>
          <div>Date: <strong>${esc(cert.issuedDate)}</strong></div>
        </div>

        <!-- Serialized Fields List -->
        <table style="width: 100%; border-collapse: collapse; font-size: 0.88rem; line-height: 1.8;">
          <tbody>
            <tr><td style="width: 40px;">1.</td><td style="width: 280px;">Name of the Pupil:</td><td><strong style="text-transform: uppercase;">${esc(cert.studentName)}</strong></td></tr>
            <tr><td>2.</td><td>Father's / Guardian's Name:</td><td><strong>${esc(d.fatherName || '—')}</strong></td></tr>
            <tr><td>3.</td><td>Mother's Name:</td><td><strong>${esc(d.motherName || '—')}</strong></td></tr>
            <tr><td>4.</td><td>Nationality:</td><td><strong>Indian</strong></td></tr>
            <tr><td>5.</td><td>Class in which the pupil last studied:</td><td><strong>${esc(cert.grade)}</strong></td></tr>
            <tr><td>6.</td><td>School / Board Examination last taken:</td><td><strong>Passed Class Assessment (${TMS_CONFIG.academic.currentYear})</strong></td></tr>
            <tr><td>7.</td><td>Qualified for promotion to higher class:</td><td><strong>${esc(d.promoted || 'Yes, Promoted')}</strong></td></tr>
            <tr><td>8.</td><td>Month up to which school dues paid:</td><td><strong>${esc(d.dues || 'Cleared up to date')}</strong></td></tr>
            <tr><td>9.</td><td>General Conduct & Character:</td><td><strong>${esc(d.conduct || 'Exemplary')}</strong></td></tr>
            <tr><td>10.</td><td>Date of Application for Certificate:</td><td><strong>${esc(cert.issuedDate)}</strong></td></tr>
            <tr><td>11.</td><td>Reason for leaving the institution:</td><td><strong>${esc(d.reason || "Parent's Request / Relocation")}</strong></td></tr>
          </tbody>
        </table>

        <!-- Signatures & Seal -->
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 50px; font-size: 0.82rem; text-align: center;">
          <div style="width: 160px;">
            <div style="border-bottom: 1.5px solid #0f172a; margin-bottom: 4px; padding-bottom: 24px;"></div>
            <strong>Class Teacher</strong>
          </div>
          <div style="width: 160px;">
            <div style="border-bottom: 1.5px solid #0f172a; margin-bottom: 4px; padding-bottom: 24px;"></div>
            <strong>Checked By (Office Clerk)</strong>
          </div>
          <div style="width: 180px;">
            <div style="border: 2px dashed #16a34a; border-radius: 50%; width: 56px; height: 56px; margin: 0 auto 6px; display: flex; align-items: center; justify-content: center; font-size: 8px; font-weight: 800; color: #166534; text-transform: uppercase;">
              OFFICIAL<br>TMS SEAL
            </div>
            <strong>Principal (With Seal)</strong>
          </div>
        </div>
      </div>
    `;

    UIComponents.openModal({
      title: `Official Transfer Certificate — ${cert.studentName}`,
      bodyHtml,
      footerHtml: `
        <button class="btn btn-secondary" onclick="document.getElementById('global-modal-close').click()">Close</button>
        <button class="btn btn-primary" onclick="window.print()"><i data-lucide="printer"></i> Print Official TC (A4)</button>
      `
    });

    UIComponents.refreshIcons();
  }

  /* ------------------------------------------------------------------ */
  /* Character Certificate Print Modal                                  */
  /* ------------------------------------------------------------------ */
  static openCharacterCertificatePrintModal(cert) {
    const esc = (v) => UIComponents.escapeHtml(v);
    const d = cert.details || {};
    const emblem = TMS_LOGO.emblemSvg(70);

    const bodyHtml = `
      <style>
        @media print {
          @page {
            size: A4 landscape;
            margin: 12mm;
          }
          body * {
            visibility: hidden;
          }
          #print-area-char-cert, #print-area-char-cert * {
            visibility: visible;
          }
          #print-area-char-cert {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            padding: 15mm !important;
            border: 4px double #166534 !important;
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

      <div id="print-area-char-cert" style="background: #ffffff; color: #0f172a; padding: 40px 48px; border: 4px double #166534; border-radius: 12px; font-family: 'Georgia', serif; text-align: center; position: relative;">
        <div style="display: flex; justify-content: center; margin-bottom: 8px;">${emblem}</div>
        <h1 style="font-size: 1.7rem; font-weight: 800; color: #166534; text-transform: uppercase; margin: 0; letter-spacing: 0.5px;">
          ${esc(TMS_CONFIG.institution.name)}
        </h1>
        <p style="font-size: 0.95rem; font-weight: 700; color: #15803d; margin: 2px 0;">
          ${esc(TMS_CONFIG.institution.subtitle || 'Run by : Thaiba Heritage, Kolkata')}
        </p>
        <div style="font-size: 0.78rem; color: #64748b; margin-bottom: 24px;">
          ${esc(TMS_CONFIG.institution.address.campus)}, ${esc(TMS_CONFIG.institution.address.city)}
        </div>

        <div style="border-top: 1.5px solid #166534; border-bottom: 1.5px solid #166534; display: inline-block; padding: 4px 24px; font-size: 1.25rem; font-weight: 800; color: #166534; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 30px;">
          CHARACTER &amp; CONDUCT CERTIFICATE
        </div>

        <div style="font-size: 1.05rem; line-height: 2; text-align: justify; margin: 0 auto 36px; max-width: 680px;">
          This is to certify that <strong>${esc(cert.studentName)}</strong>, Son/Daughter of <strong>${esc(d.fatherName || '—')}</strong>, 
          Admission Number <span class="font-mono"><strong>${esc(cert.admissionNo || '—')}</strong></span>, has been a bonafide student of 
          <strong>${esc(TMS_CONFIG.institution.name)}</strong> in Class <strong>${esc(cert.grade)}</strong> during the academic session 
          <strong>${esc(TMS_CONFIG.academic.currentYear)}</strong>.
          <br><br>
          To the best of my knowledge and school records, he/she bears an <strong>${esc(d.conduct || 'Exemplary')}</strong> moral character and pleasing conduct. He/she has actively participated in campus academic and co-curricular programs.
          <br><br>
          We wish him/her all success and prosperity in future academic pursuits.
        </div>

        <div style="display: flex; justify-content: space-between; align-items: flex-end; padding-top: 30px; font-size: 0.88rem;">
          <div style="text-align: left;">
            <div>Date of Issue: <strong>${esc(cert.issuedDate)}</strong></div>
            <div>Ref No: <span class="font-mono">${esc(cert.certificateNo)}</span></div>
          </div>
          <div style="text-align: center;">
            <div style="border: 2px dashed #166534; border-radius: 50%; width: 60px; height: 60px; margin: 0 auto 6px; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 800; color: #166534; text-transform: uppercase;">
              OFFICIAL<br>TMS SEAL
            </div>
            <strong>Headmaster / Principal</strong>
          </div>
        </div>
      </div>
    `;

    UIComponents.openModal({
      title: `Character Certificate — ${cert.studentName}`,
      bodyHtml,
      footerHtml: `
        <button class="btn btn-secondary" onclick="document.getElementById('global-modal-close').click()">Close</button>
        <button class="btn btn-primary" onclick="window.print()"><i data-lucide="printer"></i> Print Official Certificate (A4)</button>
      `
    });

    UIComponents.refreshIcons();
  }
}

export default CertificatesModule;
