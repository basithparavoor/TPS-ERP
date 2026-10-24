# THAIBA PUBLIC SCHOOL — ERP Management & Campus Operations Suite

[![Status](https://img.shields.io/badge/Status-Operational-10b981?style=for-the-badge)](https://thaibaschool.edu.in)
[![Institution](https://img.shields.io/badge/Institution-THAIBA_MODEL_SCHOOL-3b82f6?style=for-the-badge)](https://thaibaschool.edu.in)
[![Database](https://img.shields.io/badge/Backend-Supabase_PostgreSQL-3ecf8e?style=for-the-badge)](https://supabase.com)

**Enterprise School Management & Campus Operations Suite for THAIBA PUBLIC SCHOOL.**

---

## 🏛️ System Architecture

- **Scope:** Single-institution ERP exclusively for THAIBA PUBLIC SCHOOL. No multi-institution switching or cross-campus data leakage.
- **Frontend Stack:** HTML5, Vanilla ES6+ Modular JavaScript, Native Web Components.
- **Design Engine:** THAIBA PUBLIC SCHOOL Enterprise Design Engine (`app.css`) with HSL design tokens, high-contrast dark mode (`.dark`), ambient canvas mesh, and glassmorphism.
- **Icons & Typography:** Lucide Icons, Outfit (headings), Plus Jakarta Sans (body), JetBrains Mono (data/codes).
- **Backend & Cloud:** Supabase Database (PostgreSQL), Supabase Auth, Row-Level Security (RLS) policies.
- **Telemetry & Geofencing:** GPS geofencing with 5-minute automated polling and 3-minute exit grace window, QR code terminal scanning, NFC integration support, and AI facial matching.

---

## 📂 File Manifest & Structure

```text
THAIBA PUBLIC SCHOOL ERP/
├── 🌐 Entry Point Portals
│   ├── index.html                  # Main ERP Workspace & Hash Router (#/module/tab)
│   ├── login.html                  # Universal Authentication Gateway
│   ├── admin.html                  # School Administration & Leadership Suite
│   ├── teacher-portal.html         # Faculty Portal
│   ├── student-portal.html         # Student Learner & Timetable Portal
│   ├── parent-portal.html          # Parent/Guardian Fee & Progress Portal
│   └── student-admission-portal.html # Public Online Admission & A4 Printout Gateway
│
├── ⚙️ Core Configuration & Services
│   ├── config.js                   # Master School Configuration & Supabase Keys
│   ├── supabase-client.js          # Supabase API Client & Resilient Offline Cache
│   ├── auth-service.js             # RBAC Authentication & Session Engine
│   ├── permission-engine.js        # Data Access Scopes & Capability Matrix
│   ├── audit-service.js            # Immutable Append-Only Audit Trail
│   ├── ui-components.js            # Modals, Toasts, Tables & Theme Engine
│   ├── logo.js                     # Official Thaiba Public School SVG Logo Engine
│   └── app.css                     # Premium Styling Tokens & A4 Print Engine
│
├── 🚀 Application Controller
│   └── app.js                      # SPA Router, Shell, & Global Search (Ctrl + K)
│
├── 📦 Functional Modules
│   ├── admin-module.js             # School Governance, Leadership & Credentials
│   ├── institution-module.js       # Campus Facilities, Labs & Seating Capacities
│   ├── my-work-module.js           # Faculty Hub, GPS Punch, Kanban & Payslips
│   ├── attendance-module.js        # Classroom Register (Gold badge for leaves) & QR Scanner
│   ├── student-module.js           # Student SIS, Admissions & Smart ID Cards
│   ├── admissions-entry-module.js  # Office Boy admission data-entry desk
│   ├── admission-service.js        # Form builder, fees, payments, credentials, workflow
│   ├── notification-service.js     # Notifications data access (audience-targeted)
│   ├── notification-center.js      # Shared bell + inbox UI for all portals
│   ├── export-utils.js             # CSV export & print-to-PDF helpers
│   ├── staff-module.js             # HR, Employees, Designations & CTC Contracts
│   ├── academic-module.js          # Classes, Subjects, Timetable Conflict Check
│   ├── examination-module.js       # Exams, Grading (A+ to F), Printable Report Cards
│   ├── finance-module.js           # Fees, Invoicing, Cash Counter & Defaulters
│   ├── communication-module.js     # Circulars, Notices & Urgent Broadcasts
│   ├── operations-module.js        # Library (ISBN), Bus Fleet, Hostel & Assets
│   └── reports-module.js           # Analytics, Pass Rates, Financial Realization
│
└── 🗄️ Database Backend
    ├── schema.sql                  # PostgreSQL Tables with RLS Policies
    └── schema-update-2.sql         # Admission workflow, payments, notifications (add-on)
```

---

## 🎓 Admissions, Payments & Notifications

### Customisable admission form (Admin → Admission Form Builder)
Administrators define the exact application fields: **label, unique key, response
type (text, textarea, number, date, tel, email, select, checkbox, file), section,
options, placeholder, required flag, active flag and display order**. The public
admission form renders itself from this configuration, so no code change is needed
to add or remove a question. `Load & Save Defaults` seeds a sensible starter form.

### Applicant photo &amp; document uploads
The admission form opens with a dedicated **Student Photograph** panel — a
passport-size upload area with an instant preview and a *Remove* button. The
photograph is always available even if an administrator removes it from the form
builder, and it is rendered as an actual image (not a filename) on:

- the printed **Admission Application Form** (top-right photobox),
- the tear-off **Admit Card**, and
- the admin **Applications** list (live thumbnail) and review modal.

Field type **file** adds an upload control (image or PDF) to the admission form.
The built-in defaults include **Student Photograph, Aadhaar/ID Proof, Birth
Certificate and Previous Marksheet / TC**. Files are stored in the private
**`admission-docs`** Supabase Storage bucket and referenced by path inside the
application payload, so nothing sensitive is written into the database row itself.
Admin sees **short-lived signed links** to every attached document in the review
modal.

### Fee items & UPI payment (Admin → Admission Fees / Payment & Session)
- Fee **items** can be ticked by the applicant (or forced as *mandatory*).
- The admin sets the **UPI ID (VPA)**, payee name, payment instructions and a
  **"payment mandatory before submission"** switch.
- When a fee is payable, the applicant sees a live **UPI QR code** for the exact
  amount plus a reference field. When payment is mandatory, submission is blocked
  until a reference is entered.
- Admin can **record manual payments** (Cash / UPI / Cheque / Card / Bank) against
  any application, building a payment ledger.

### Application lifecycle & bulk actions
`Submitted → Under Verification → Approved / Rejected` (with remarks).
Admin can **approve**, **reject** (remarks required), mark **under verification**,
**resend** credentials, and **print/export**.

*Admin → Applications* supports **row check-boxes with a select-all**, and bulk
**Approve / Reject / Delete / Export** of the selected rows, plus a one-click
**Delete Pending** action that removes every Submitted / Under-Verification
application (and its credentials). Bulk multi-delete is also available on the
**Notifications** and **Fee Items** lists. Every list row has a **View as Form**
button that renders the stored data in the same layout as the printed admission
form (with a *Print / Save PDF* action).

### Parent credentials & tracking
On submission the system generates a **username + password**, creates the parent's
login (e-mail `<username>@parents.thaibamodel.school`) and shows the credentials on
screen **and on the printed A4 form**. Parents sign in with their **username** to
track status, view the fee/payment ledger and read notifications. Admin can
**edit, resend or delete** the credentials.

Accounts are created by the **`tms_create_user`** SQL function (in
`schema-update-2.sql`), which writes the auth user, its e-mail identity and the
profile row in one transaction with the password already confirmed. This bypasses
the public `/auth/v1/signup` endpoint entirely, so it is **not affected by the
sign-up e-mail rate limit (HTTP 429)** and does not depend on *Confirm email*.

> **Supabase setting required (only if the migration has not been applied):** turn
> **OFF** *Authentication → Providers → Email → Confirm email* so the legacy
> fallback sign-up path works.
>
> If a login could not be created at submission time (the credentials card shows a
> red note), an administrator can create it later from
> *Admin → Admissions → open application → **Activate Login*** (parents) or
> *Staff & HR → row **Login** → **Activate Login*** (staff).

### Office Boy (data-entry role)
Set a staff member's role to **Office Boy** in *Admin → Users & Roles*. They land on
an **Admission Entry Desk**; applications they submit are recorded as
**"Entered by <staff name>"** and shown on the A4 form.

### Users & profiles
- *Admin → Users & Roles → **Edit Details*** edits a user's **name, title,
  department, phone, class/section assignment, role, scope, active flag and profile
  photo** (avatars are stored in the public `avatars` bucket). Admins can also
  **set a new password** for any account — including the auto-generated parent
  and staff logins — via the `admin_set_password` SQL helper, or **delete a user**
  entirely (their login, profile and access) via `admin_delete_user`.
- Every signed-in user has a **My Profile** editor (sidebar user card or the topbar
  button) to update their own descriptive fields, photo and password. Role and scope
  can never be self-edited (enforced by the `update_own_profile` SQL function).

### Staff registry & issued logins (Staff & HR)
Appointing a staff member in *Staff & HR → **Appoint New Staff*** also **creates a
real login**: the account is added to *Admin → Users & Roles*, a **username and
password** are generated (or supplied by the administrator), shown in a
printable credential slip, and listed under a **Login** button on each row.
Credentials can be **edited, re-issued or deleted** at any time; deleting a staff
member removes the employee record *and* their login. The directory supports
**row selection with bulk actions** — select all, set active/inactive, export
CSV and delete selected.

### Editing, deleting, selecting data everywhere
Every list of real records now supports **per-row Edit and Delete** plus
**checkbox selection with a bulk-action bar** (select all / clear / export /
delete, and module-specific actions such as Send Reminder). This covers
*Applications, Notifications, Fee Items, Admission Form Fields, Users, Staff,
Students, Fee Invoices, Circulars, Campus Facilities and personal Tasks*.

### Institute logo & branding
*Admin → **Branding & Logo*** lets an administrator **upload the official
institute logo** (or paste a public image URL). Once saved it is applied
**everywhere** — the sidebar, sign-in page, every portal, the administration
console and all printed / PDF documents — with a live preview and a one-click
"Restore built-in emblem". The value is stored in the public-read `app_settings`
table and cached locally so it appears instantly on every page.

### Notifications
Admin creates notices in *Admin → Notifications* targeting **Everyone, Staff,
Students, Parents or a specific role**, with a priority. Every portal shows a
**bell with an unread badge** and an inbox. Publishing a *Circular* from the
Communication module broadcasts an in-app notification to its target audience, and
circulars can be re-broadcast, edited or deleted in bulk.

### Exports
Applications can be exported as **CSV** (Excel-safe) and printed/saved as **PDF**
from *Admin → Applications*.

---

## 🔒 Security & Data Scopes

Authorisation is enforced **server-side** by Row-Level Security policies that read
the caller's role and scope from the `profiles` table (`auth.uid()` based). The
client UI mirrors these rules but never *is* the security boundary.

- `school_wide`: Authorized administrative and principal oversight across THAIBA PUBLIC SCHOOL.
- `assigned_class`: Teachers restricted to assigned classes and sections (e.g. Grade 9A).
- `finance_scope`: Authorized bursar and accounts staff.
- `own_records`: Students restricted to their individual academic files and timetable.
- `linked_wards`: Parents restricted strictly to verified linked wards.
- **Plaintext Password Protection:** Staff passwords are never retrievable — administrators
  send a Supabase password-reset link from the login screen.
- **Parent credentials:** auto-generated parent logins are stored in the admin-only
  `parent_credentials` table (RLS: admin/principal read only; public insert) so they can be
  viewed, edited, resent or deleted by administration. The same applies to issued **staff**
  logins, stored in the admin/principal/HR-only `staff_credentials` table; the public
  `login_aliases` table only maps a username to its e-mail (never a password). Store only
  what the school needs and rotate credentials if a table is ever exposed.
- **Gold Badge Leave Protection:** Students on approved leave receive gold badges and cannot be marked absent/present through normal workflows.
- **Least privilege:** New accounts start with the `pending` role (no access) until an
  administrator assigns a role in the `profiles` table. Staff salary fields are never
  exposed to non-HR/administration roles (served via the `staff_directory` view).

---

## 🚀 Running the Project

1. Clone or download the repository:
   ```bash
   git clone https://github.com/basithparavoor/TMS-ERP.git
   ```
2. **Database setup (Supabase):**
   - Open the Supabase SQL Editor and run [`schema.sql`](schema.sql) in full.
   - If the database already exists, run the add-on [`schema-update-2.sql`](schema-update-2.sql)
     for the admission workflow, payments, credentials, notifications, **file-upload
     storage buckets**, the **institute-logo / branding settings** and the profile-editing
     helper functions (safe to re-run).
     > **Symptom of a missing migration:** the browser console shows `404` responses for
     > `notifications`, `notification_reads`, `admission_form_fields`, `admission_fees`,
     > `parent_credentials`, and a `400` about a missing `remarks` column. Re-run
     > `schema-update-2.sql` to clear them.
   - Create user accounts in **Authentication → Users**.
   - Assign each account a `role` and `scope` by updating the `profiles` table
     (*Admin → Users & Roles* in the app).
     The super administrator (`cmbasith786@gmail.com`) is provisioned automatically.
   - Only link parent/guardian accounts via the `guardian_links` table, and student
     accounts via `students.user_id`.
   - Auto-generated parent and staff logins go through the `tms_create_user` SQL
     function created by the migration, so *Confirm email* can stay at its default.
     If you have not applied the migration yet, turn **OFF**
     *Authentication → Providers → Email → Confirm email* so the legacy sign-up
     fallback still works.
   - The migration creates two Storage buckets automatically: **`admission-docs`**
     (private — applicant photos and documents) and **`avatars`** (public — profile
     photos). No manual bucket setup is required.
3. Open [`index.html`](index.html) or [`login.html`](login.html) in any modern browser
   or serve locally:
   ```bash
   node server.js
   ```
   then visit `http://127.0.0.1:3000/`.
4. Sign in with a provisioned institutional account.

---
© 2024 THAIBA PUBLIC SCHOOL. All Rights Reserved.
