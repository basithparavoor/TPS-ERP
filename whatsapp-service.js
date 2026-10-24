/**
 * THAIBA PUBLIC SCHOOL — WhatsApp Parent Dispatch Engine
 * Creates instant, pre-composed WhatsApp links to notify parents on mobile and desktop web
 * Works out-of-the-box without requiring paid API subscriptions
 */

import { TMS_CONFIG } from './config.js';

export class WhatsAppService {
  /**
   * Normalize an Indian or international phone number
   * e.g. '8653382851', '+91 86533 82851' -> '918653382851'
   */
  static cleanPhone(phone) {
    if (!phone) return '';
    let digits = String(phone).replace(/\D/g, '');
    if (digits.length === 10) {
      digits = '91' + digits;
    }
    return digits;
  }

  /**
   * Open WhatsApp with text pre-filled
   */
  static openChat(phone, message) {
    const clean = this.cleanPhone(phone);
    const encoded = encodeURIComponent(message);
    const url = clean 
      ? `https://api.whatsapp.com/send?phone=${clean}&text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  /**
   * 1-Click WhatsApp Fee Reminder
   */
  static sendFeeReminder(inv) {
    const schoolName = TMS_CONFIG.institution.name;
    const student = inv.studentName || 'Student';
    const invoiceNo = inv.invoiceNo || 'INV';
    const amount = (inv.balance || inv.amount || 0).toLocaleString('en-IN');
    const due = inv.dueDate || 'Immediate';
    const year = TMS_CONFIG.academic.currentYear;

    const message = 
`*${schoolName} • Fee Notice*
━━━━━━━━━━━━━━━━━━━━━━
Dear Parent,
This is a gentle reminder regarding the school fee invoice for your ward:

• *Student:* ${student}
• *Invoice No:* ${invoiceNo}
• *Outstanding Balance:* ₹ ${amount}
• *Due Date:* ${due}
• *Session:* ${year}

*Instant UPI QR / App Payment:*
• UPI ID: \`thaibaheritage@sbi\`
• Pay directly in GPay / PhonePe / Paytm:
https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi%3A%2F%2Fpay%3Fpa%3Dthaibaheritage%40sbi%26pn%3DThaiba%2520Model%2520School%26am%3D${encodeURIComponent(inv.balance || inv.amount || 0)}%26tr%3D${encodeURIComponent(invoiceNo)}%26cu%3DINR

*Bank Account Details for Online Transfer:*
• Bank: State Bank of India
• A/C Name: THAIBA PUBLIC SCHOOL
• A/C No: 38947291039
• IFSC: SBIN0001234
• Branch: Kolkata Central

Kindly clear the pending dues by the due date to ensure uninterrupted academic services. If already paid, please ignore this notice.

_Bursar Office, ${schoolName}_`;

    this.openChat(inv.phone || inv.parentPhone, message);
  }

  /**
   * 1-Click WhatsApp Academic Early Warning & Remedial Notice
   */
  static sendRemedialAcademicAlert(student, reasons = []) {
    const schoolName = TMS_CONFIG.institution.name;
    const studentName = student.fullName || student.name || 'Student';
    const grade = student.grade || '';
    const reasonsText = reasons.length ? reasons.map(r => `• ${r}`).join('\n') : '• Academic score requires attention';

    const message = 
`*${schoolName} • Academic Progress Notice*
━━━━━━━━━━━━━━━━━━━━━━
Dear Parent / Guardian,

This is a supportive update from the Academic Coordinator regarding *${studentName}* (Class: ${grade}):

*Areas Requiring Attention:*
${reasonsText}

We would like to invite you for a brief conference with our faculty to establish a personalized remedial learning plan for your ward.

Please contact the academic office or reply to this message to coordinate suitable timings.

_Academic Coordinator & Principal Office_
_${schoolName}_`;

    this.openChat(student.phone || student.parentPhone || student.guardianPhone, message);
  }

  /**
   * 1-Click WhatsApp Homework Broadcast
   */
  static sendHomeworkBroadcast(grade, section, subject, title, desc, dueDate, parentPhone) {
    const schoolName = TMS_CONFIG.institution.name;
    const message = 
`*${schoolName} • Daily Homework Diary*
━━━━━━━━━━━━━━━━━━━━━━
*Class:* ${grade} (${section || 'A'})
*Subject:* ${subject}
*Topic / Task:* ${title}
*Due Date:* ${dueDate || 'Tomorrow'}

*Details:*
${desc || 'Complete exercises assigned in textbook.'}

Kindly ensure your ward completes the homework before school hours.

_Faculty Desk, ${schoolName}_`;

    this.openChat(parentPhone, message);
  }

  /**
   * 1-Click WhatsApp Daily Absence Alert
   */
  static sendAbsenceAlert(student, date) {
    const schoolName = TMS_CONFIG.institution.name;
    const studentName = student.fullName || student.studentName || 'Student';
    const grade = student.grade || '';
    const dateStr = date || new Date().toLocaleDateString('en-GB');

    const message = 
`*${schoolName} • Attendance Alert*
━━━━━━━━━━━━━━━━━━━━━━
Dear Parent / Guardian,

Please be informed that your ward *${studentName}* (Class: ${grade}) has been marked *ABSENT* from school today (${dateStr}).

If this is an excused absence, kindly submit a leave note or medical certificate through the Parent Portal or to the Class Teacher.

For any queries, please contact the campus front desk at ${TMS_CONFIG.institution.contact.phone}.

_Attendance & Discipline Office, ${schoolName}_`;

    this.openChat(student.phone || student.parentPhone || student.guardianPhone, message);
  }

  /**
   * 1-Click WhatsApp Progress Report & Merit Announcement
   */
  static sendReportCardNotification(student, assess) {
    const schoolName = TMS_CONFIG.institution.name;
    const name = student.fullName || 'Student';
    const term = assess.term || 'Term Examination';
    const score = assess.totalScored || 0;
    const max = assess.totalMax || 700;
    const pct = assess.percentage || 0;
    const grade = assess.overallGrade || 'A';

    const message = 
`*${schoolName} • Academic Result Announcement*
━━━━━━━━━━━━━━━━━━━━━━
Dear Parent,
The official examination results for *${term}* have been published!

• *Student Name:* ${name}
• *Class:* ${student.grade || ''}
• *Total Scored:* ${score} / ${max} (${pct}%)
• *Overall Cumulative Grade:* *${grade}*
• *Session:* ${TMS_CONFIG.academic.currentYear}

You can log in to the Parent Portal to view and download the official signed Progress Report Card.

Congratulations to the student on their academic progress!

_Academic Coordinator, ${schoolName}_`;

    this.openChat(student.phone || student.parentPhone, message);
  }
}

export default WhatsAppService;
