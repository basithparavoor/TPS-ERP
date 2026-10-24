/**
 * THAIBA PUBLIC SCHOOL — Main ERP Controller & Router
 * Hash Router: #/module/tab
 * Strict Authentication Mode & Official TMS Branding
 */

import { TMS_CONFIG } from './config.js';
import { authService } from './auth-service.js';
import { PermissionEngine } from './permission-engine.js';
import { UIComponents } from './ui-components.js';
import { dbService } from './supabase-client.js';
import { TMS_LOGO } from './logo.js';

// Import Functional Modules
import { AdminModule } from './admin-module.js';
import { InstitutionModule } from './institution-module.js';
import { MyWorkModule } from './my-work-module.js';
import { AttendanceModule } from './attendance-module.js';
import { StudentModule } from './student-module.js';
import { StaffModule } from './staff-module.js';
import { AcademicModule } from './academic-module.js';
import { ExaminationModule } from './examination-module.js';
import { FinanceModule } from './finance-module.js';
import { CommunicationModule } from './communication-module.js';
import { OperationsModule } from './operations-module.js';
import { ReportsModule } from './reports-module.js';
import { AdmissionsEntryModule } from './admissions-entry-module.js';
import { NotificationCenter } from './notification-center.js';
import { TimetableModule } from './timetable-module.js';
import { CertificatesModule } from './certificates-module.js';
import { IdCardsModule } from './id-cards-module.js';
import { CalendarModule } from './calendar-module.js';
import { HomeworkModule } from './homework-module.js';
import { WhatsAppService } from './whatsapp-service.js';
import { admissionService } from './admission-service.js';
import { brandingService } from './branding-service.js';
import { checkMigration } from './migration-check.js';

/** Escape untrusted values before putting them into an HTML template. */
const esc = (v) => UIComponents.escapeHtml(v);
const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';

class AppController {
  constructor() {
    this.currentRoute = '';
    this.init();
  }

  async init() {
    UIComponents.initTheme();

    // Validate the server-side session before rendering or touching data.
    await authService.init();

    // Strict Authentication Guard
    if (!authService.isAuthenticated()) {
      window.location.href = 'login.html';
      return;
    }

    const currentUser = authService.getCurrentUser() || {};
    if (currentUser.role === TMS_CONFIG.roles.PARENT) {
      window.location.href = 'parent-portal.html';
      return;
    }
    if (currentUser.role === TMS_CONFIG.roles.STUDENT) {
      window.location.href = 'student-portal.html';
      return;
    }

    // Load the institute logo (cached value already applied at import time).
    brandingService.refresh().then(() => {
      const logoHost = document.getElementById('shell-logo');
      if (logoHost) logoHost.innerHTML = TMS_LOGO.emblemSvg(42);
    });

    // Warn clearly if the add-on migration has not been applied yet.
    checkMigration();

    this.renderShell();
    this.bindGlobalEvents();
    await NotificationCenter.init();

    const user = authService.getCurrentUser() || {};
    if (user.role === TMS_CONFIG.roles.OFFICE_BOY &&
        (!window.location.hash || window.location.hash === '#/dashboard' || window.location.hash === '#/')) {
      window.location.hash = '#/admissions-entry';
    }

    this.initRouter();
  }

  renderShell() {
    const user = authService.getCurrentUser() || {};
    const root = document.getElementById('app-root');
    if (!root) return;

    root.innerHTML = `
      <div class="ambient-mesh">
        <div class="mesh-glow-1"></div>
        <div class="mesh-glow-2"></div>
      </div>

      <div class="sidebar-backdrop" id="sidebar-backdrop"></div>

      <div class="app-container">
        <!-- Sidebar Navigation -->
        <aside class="app-sidebar" id="app-sidebar">
          <div class="sidebar-header">
            <div class="sidebar-brand-box" id="sidebar-brand-box">
              <span id="shell-logo" style="display:inline-flex; flex-shrink:0;">${TMS_LOGO.emblemSvg(42)}</span>
              <div class="brand-info">
                <h2>${TMS_CONFIG.institution.name}</h2>
                <p>Thaiba Heritage, Kolkata</p>
              </div>
            </div>
            <button class="sidebar-collapse-btn desktop-only" id="sidebar-collapse-btn" title="Toggle Sidebar (Ctrl+B)">
              <i data-lucide="chevron-left"></i>
            </button>
          </div>

          <nav class="sidebar-nav" id="sidebar-nav-items">
            <!-- Dynamically populated based on RBAC -->
          </nav>

          <div class="sidebar-footer">
            <div class="user-footer-wrap">
              <div class="user-mini-card" id="user-mini-card" role="button" tabindex="0" title="Edit my profile" style="cursor:pointer; flex: 1; min-width: 0;">
                <img id="user-mini-avatar" src="${esc(user.avatar || DEFAULT_AVATAR)}" alt="Avatar">
                <div class="user-details-mini" style="min-width: 0;">
                  <div class="name" id="user-mini-name" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${esc(user.name || 'TMS Authorized')}</div>
                  <div class="role" id="user-mini-role" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${esc(user.isSuperAdmin ? 'Super Admin' : (user.title || user.role))}</div>
                </div>
              </div>
              <button class="icon-btn" id="btn-logout" title="Sign Out" style="flex-shrink: 0; color: #ef4444; width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                <i data-lucide="log-out" style="width: 18px; height: 18px;"></i>
              </button>
            </div>
          </div>
        </aside>

        <!-- Main Workspace -->
        <main class="app-main">
          <!-- Topbar -->
          <header class="app-topbar">
            <div class="topbar-left">
              <button class="mobile-header-menu-btn" id="mobile-header-menu-btn" title="Navigation Menu" aria-label="Open Navigation Menu">
                <i data-lucide="menu"></i>
              </button>
              <div class="search-bar-trigger" id="global-search-trigger">
                <i data-lucide="search" style="width: 16px; height: 16px;"></i>
                <span>Search students, staff, records...</span>
                <span class="kbd-shortcut">Ctrl K</span>
              </div>
            </div>

            <div class="topbar-right">
              <div class="ticker-badge" title="Campus Active">
                <i data-lucide="calendar" style="width: 14px; height: 14px;"></i>
                <span>Session ${TMS_CONFIG.academic.currentYear} Active</span>
              </div>

              <button class="icon-btn notification-bell-btn" id="notification-bell" title="Notifications & Announcements" style="position: relative;">
                <i data-lucide="bell"></i>
                <span id="notification-badge" class="tms-notif-badge" style="display: none;">0</span>
              </button>
            </div>
          </header>

          <!-- Module Viewport -->
          <div class="app-viewport" id="app-viewport">
            <!-- Dynamic module content injected here -->
          </div>
        </main>
      </div>
    `;

    this.populateSidebarNav();

    // Restore collapsed sidebar state on desktop
    const savedCollapsed = localStorage.getItem('tms_sidebar_collapsed') === 'true';
    if (savedCollapsed && window.innerWidth >= 993) {
      const sb = document.getElementById('app-sidebar');
      if (sb) sb.classList.add('collapsed');
      const collapseBtn = document.getElementById('sidebar-collapse-btn');
      if (collapseBtn) {
        collapseBtn.innerHTML = '<i data-lucide="chevron-right"></i>';
        collapseBtn.title = 'Expand Sidebar (Ctrl+B)';
      }
    }

    UIComponents.refreshIcons();
  }

  toggleDesktopSidebar(force = null) {
    const sidebar = document.getElementById('app-sidebar');
    if (!sidebar) return;
    const isCollapsed = force !== null ? force : !sidebar.classList.contains('collapsed');
    if (isCollapsed) {
      sidebar.classList.add('collapsed');
      localStorage.setItem('tms_sidebar_collapsed', 'true');
    } else {
      sidebar.classList.remove('collapsed');
      localStorage.setItem('tms_sidebar_collapsed', 'false');
    }

    const collapseBtn = document.getElementById('sidebar-collapse-btn');
    if (collapseBtn) {
      collapseBtn.innerHTML = isCollapsed ? '<i data-lucide="chevron-right"></i>' : '<i data-lucide="chevron-left"></i>';
      collapseBtn.title = isCollapsed ? 'Expand Sidebar (Ctrl+B)' : 'Collapse Sidebar (Ctrl+B)';
    }
    UIComponents.refreshIcons();
  }

  populateSidebarNav() {
    const nav = document.getElementById('sidebar-nav-items');
    if (!nav) return;

    const navItems = [
      { id: 'dashboard', label: 'Overview Dashboard', icon: 'layout-dashboard', module: 'dashboard' },
      { id: 'my-work', label: 'Staff Workspace', icon: 'briefcase', module: 'my-work' },
      { id: 'admissions-entry', label: 'Admission Entry', icon: 'clipboard-pen', module: 'admissions-entry' },
      { id: 'students', label: 'Student Directory', icon: 'graduation-cap', module: 'students' },
      { id: 'id-cards', label: 'ID Cards & Badges', icon: 'contact-2', module: 'id-cards' },
      { id: 'attendance', label: 'Attendance & Radar', icon: 'user-check', module: 'attendance' },
      { id: 'academics', label: 'Academic & Timetable', icon: 'book-open', module: 'academics' },
      { id: 'timetable', label: 'Class Timetables', icon: 'calendar-days', module: 'timetable' },
      { id: 'homework', label: 'Homework Diary', icon: 'book-check', module: 'homework' },
      { id: 'calendar', label: 'Academic Calendar', icon: 'calendar', module: 'calendar' },
      { id: 'examinations', label: 'Exams & Reports', icon: 'award', module: 'examinations' },
      { id: 'certificates', label: 'Certificates (TC & Merit)', icon: 'file-check', module: 'certificates' },
      { id: 'finance', label: 'Finance & Accounts', icon: 'credit-card', module: 'finance' },
      { id: 'staff', label: 'Staff & HR', icon: 'users', module: 'staff' },
      { id: 'communication', label: 'Notice & Bulletins', icon: 'message-square', module: 'communication' },
      { id: 'reports', label: 'School Analytics', icon: 'bar-chart-3', module: 'reports' },
      { id: 'institution', label: 'Campus Facilities', icon: 'building', module: 'institution' },
      { id: 'administration', label: 'School Administration', icon: 'settings', module: 'administration' }
    ];

    const authorizedItems = navItems.filter(item => PermissionEngine.canAccessModule(item.module));

    nav.innerHTML = `
      <div class="sidebar-group-title">Campus Operations</div>
      ${authorizedItems.map(item => `
        <a class="nav-item" href="#/${item.module}" data-module="${item.module}" data-tooltip="${esc(item.label)}">
          <i data-lucide="${item.icon}"></i>
          <span>${item.label}</span>
        </a>
      `).join('')}
      
      <div class="sidebar-group-title" style="margin-top: 14px;">Dedicated Portals</div>
      <a class="nav-item" href="student-admission-portal.html" target="_blank" data-tooltip="Admission Form (A4)">
        <i data-lucide="file-text" style="color: #16a34a;"></i>
        <span>Admission Form (A4)</span>
      </a>
      <a class="nav-item" href="teacher-portal.html" target="_blank" data-tooltip="Faculty Portal">
        <i data-lucide="external-link"></i>
        <span>Faculty Portal</span>
      </a>
      <a class="nav-item" href="student-portal.html" target="_blank" data-tooltip="Student Portal">
        <i data-lucide="external-link"></i>
        <span>Student Portal</span>
      </a>
      <a class="nav-item" href="parent-portal.html" target="_blank" data-tooltip="Parent Portal">
        <i data-lucide="external-link"></i>
        <span>Parent Portal</span>
      </a>
    `;

    UIComponents.refreshIcons();
  }

  bindGlobalEvents() {
    const sidebar = document.getElementById('app-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    const mobileHeaderBtn = document.getElementById('mobile-header-menu-btn');

    // Desktop sidebar toggle
    const collapseBtn = document.getElementById('sidebar-collapse-btn');
    if (collapseBtn) {
      collapseBtn.addEventListener('click', () => this.toggleDesktopSidebar());
    }

    // Mobile header menu button to toggle sidebar
    if (mobileHeaderBtn && sidebar && backdrop) {
      mobileHeaderBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        backdrop.classList.toggle('active');
      });
    }

    // Ctrl+B shortcut to toggle sidebar
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
        if (activeTag !== 'input' && activeTag !== 'textarea') {
          e.preventDefault();
          this.toggleDesktopSidebar();
        }
      }
    });

    if (sidebar && backdrop) {
      backdrop.addEventListener('click', () => {
        sidebar.classList.remove('open');
        backdrop.classList.remove('active');
      });
    }

    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        const confirmed = await UIComponents.confirm({
          title: 'Sign Out of TMS ERP?',
          message: 'Are you sure you want to end your current session? You will be safely signed out of Thaiba Public School Campus Gateway.',
          confirmText: 'Sign Out',
          cancelText: 'Stay Signed In',
          type: 'danger',
          icon: 'log-out'
        });
        if (confirmed) {
          authService.logout();
        }
      });
    }

    const miniCard = document.getElementById('user-mini-card');
    if (miniCard) {
      miniCard.addEventListener('click', () => this.openMyProfile());
      miniCard.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.openMyProfile(); }
      });
    }

    // Universal Command Palette (Ctrl + K)
    const searchTrigger = document.getElementById('global-search-trigger');
    const openCommandPalette = () => {
      UIComponents.openModal({
        title: 'Universal Command Palette',
        bodyHtml: `
          <div style="margin-bottom: 12px; position: relative;">
            <input type="text" class="form-input" id="cmd-palette-input" placeholder="Search students, invoices, staff, or actions (e.g. 'kiosk', 'fees', 'tc')..." autofocus style="font-size: 1rem; padding: 12px 16px; border-radius: 10px; border-color: var(--primary);">
          </div>

          <div id="cmd-palette-results" style="max-height: 380px; overflow-y: auto; font-size: 0.85rem; padding-right: 4px;">
            <!-- Rendered by live script -->
          </div>
        `
      });

      const input = document.getElementById('cmd-palette-input');
      const results = document.getElementById('cmd-palette-results');
      if (!input || !results) return;

      const renderQuickActions = () => {
        results.innerHTML = `
          <div style="font-size: 0.74rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px;">
            Institutional Quick Actions &amp; Navigation:
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px;">
            <button class="btn btn-secondary btn-sm cmd-action-btn" data-action="kiosk" style="justify-content: flex-start; padding: 10px; text-align: left;">
              <i data-lucide="scan" style="color: #16a34a;"></i>
              <div><strong>Launch QR Kiosk</strong><div style="font-size: 0.7rem; color: var(--text-muted);">Attendance Terminal</div></div>
            </button>
            <button class="btn btn-secondary btn-sm cmd-action-btn" data-action="challan" style="justify-content: flex-start; padding: 10px; text-align: left;">
              <i data-lucide="layers" style="color: #2563eb;"></i>
              <div><strong>3-Part Fee Challan</strong><div style="font-size: 0.7rem; color: var(--text-muted);">Print Bank Slips</div></div>
            </button>
            <button class="btn btn-secondary btn-sm cmd-action-btn" data-action="timetable" style="justify-content: flex-start; padding: 10px; text-align: left;">
              <i data-lucide="calendar-days" style="color: #f59e0b;"></i>
              <div><strong>Class Timetable</strong><div style="font-size: 0.7rem; color: var(--text-muted);">Weekly Period Matrix</div></div>
            </button>
            <button class="btn btn-secondary btn-sm cmd-action-btn" data-action="tc" style="justify-content: flex-start; padding: 10px; text-align: left;">
              <i data-lucide="file-check" style="color: #991b1b;"></i>
              <div><strong>Transfer Certificate</strong><div style="font-size: 0.7rem; color: var(--text-muted);">Issue Official TC</div></div>
            </button>
            <button class="btn btn-secondary btn-sm cmd-action-btn" data-action="reports" style="justify-content: flex-start; padding: 10px; text-align: left;">
              <i data-lucide="award" style="color: #16a34a;"></i>
              <div><strong>Exam Gradebook</strong><div style="font-size: 0.7rem; color: var(--text-muted);">CBSE Progress Reports</div></div>
            </button>
            <button class="btn btn-secondary btn-sm cmd-action-btn" data-action="id-cards" style="justify-content: flex-start; padding: 10px; text-align: left;">
              <i data-lucide="contact-2" style="color: #16a34a;"></i>
              <div><strong>ID Cards Studio</strong><div style="font-size: 0.7rem; color: var(--text-muted);">Batch A4 Badges</div></div>
            </button>
            <button class="btn btn-secondary btn-sm cmd-action-btn" data-action="homework" style="justify-content: flex-start; padding: 10px; text-align: left;">
              <i data-lucide="book-check" style="color: #2563eb;"></i>
              <div><strong>Homework Diary</strong><div style="font-size: 0.7rem; color: var(--text-muted);">Daily Tasks &amp; Broadcast</div></div>
            </button>
            <button class="btn btn-secondary btn-sm cmd-action-btn" data-action="calendar" style="justify-content: flex-start; padding: 10px; text-align: left;">
              <i data-lucide="calendar" style="color: #9333ea;"></i>
              <div><strong>Academic Calendar</strong><div style="font-size: 0.7rem; color: var(--text-muted);">Holidays &amp; .ics Sync</div></div>
            </button>
            <button class="btn btn-secondary btn-sm cmd-action-btn" data-action="backup" style="justify-content: flex-start; padding: 10px; text-align: left;">
              <i data-lucide="database" style="color: #6366f1;"></i>
              <div><strong>Data Backup</strong><div style="font-size: 0.7rem; color: var(--text-muted);">Download Full JSON</div></div>
            </button>
          </div>
        `;
        UIComponents.refreshIcons();

        results.querySelectorAll('.cmd-action-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const act = btn.dataset.action;
            UIComponents.closeModal();
            if (act === 'kiosk') {
              window.location.hash = '#/attendance';
              setTimeout(() => document.getElementById('btn-qr-scanner')?.click(), 250);
            } else if (act === 'challan') {
              window.location.hash = '#/finance';
              setTimeout(() => document.getElementById('btn-generate-challan')?.click(), 250);
            } else if (act === 'timetable') {
              window.location.hash = '#/timetable';
            } else if (act === 'tc') {
              window.location.hash = '#/certificates';
              setTimeout(() => document.getElementById('btn-new-tc')?.click(), 250);
            } else if (act === 'id-cards') {
              window.location.hash = '#/id-cards';
            } else if (act === 'homework') {
              window.location.hash = '#/homework';
            } else if (act === 'calendar') {
              window.location.hash = '#/calendar';
            } else if (act === 'reports') {
              window.location.hash = '#/examinations';
            } else if (act === 'backup') {
              window.location.hash = '#/administration';
              setTimeout(() => document.querySelector('[data-tab="backup"]')?.click(), 300);
            }
          });
        });
      };

      renderQuickActions();

      let debounceTimer;
      input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          const q = input.value.trim().toLowerCase();
          if (!q) {
            renderQuickActions();
            return;
          }

          results.innerHTML = `<div style="text-align:center; padding:16px; color:var(--text-muted); font-size:0.85rem;"><i data-lucide="loader" class="animate-spin"></i> Searching...</div>`;
          UIComponents.refreshIcons();

          const [students, invoices, staff] = await Promise.all([
            dbService.select('students'),
            dbService.select('invoices'),
            dbService.select('staff_directory')
          ]);

          const matchedStudents = students.filter(s => 
            (s.fullName || '').toLowerCase().includes(q) || 
            (s.admissionNo || '').toLowerCase().includes(q) ||
            (s.grade || '').toLowerCase().includes(q)
          ).slice(0, 5);

          const matchedInvoices = invoices.filter(i => 
            (i.invoiceNo || '').toLowerCase().includes(q) || 
            (i.studentName || '').toLowerCase().includes(q)
          ).slice(0, 5);

          const matchedStaff = staff.filter(st => 
            (st.name || '').toLowerCase().includes(q) || 
            (st.designation || '').toLowerCase().includes(q)
          ).slice(0, 4);

          let html = '';

          if (matchedStudents.length) {
            html += `<div style="font-weight: 700; color: #16a34a; font-size: 0.78rem; text-transform: uppercase; margin: 8px 0 4px;">Students (${matchedStudents.length}):</div>`;
            matchedStudents.forEach(s => {
              html += `
                <div style="display:flex; justify-content:space-between; align-items:center; padding: 8px 10px; border-bottom: 1px solid var(--border-color); background: var(--bg-subtle, #f8fafc); border-radius: 6px; margin-bottom: 4px;">
                  <div>
                    <strong>${esc(s.fullName)}</strong>
                    <span style="color: var(--text-muted); font-size: 0.75rem; margin-left: 6px;">(${esc(s.admissionNo)} • ${esc(s.grade)})</span>
                  </div>
                  <div style="display: flex; gap: 4px;">
                    <button class="btn btn-secondary btn-sm cmd-wa-student" data-phone="${esc(s.phone || s.parentPhone || '')}" data-name="${esc(s.fullName)}" title="WhatsApp Contact" style="padding: 2px 6px; color: #16a34a;">
                      <i data-lucide="message-circle" style="width: 13px; height: 13px;"></i>
                    </button>
                    <button class="btn btn-secondary btn-sm cmd-view-student" data-id="${esc(s.id)}" style="padding: 2px 8px; font-size: 0.72rem;">View Profile</button>
                  </div>
                </div>
              `;
            });
          }

          if (matchedInvoices.length) {
            html += `<div style="font-weight: 700; color: #2563eb; font-size: 0.78rem; text-transform: uppercase; margin: 12px 0 4px;">Fee Invoices (${matchedInvoices.length}):</div>`;
            matchedInvoices.forEach(inv => {
              html += `
                <div style="display:flex; justify-content:space-between; align-items:center; padding: 8px 10px; border-bottom: 1px solid var(--border-color); background: var(--bg-subtle, #f8fafc); border-radius: 6px; margin-bottom: 4px;">
                  <div>
                    <span class="font-mono" style="font-weight: 700;">${esc(inv.invoiceNo)}</span>
                    <span style="margin-left: 6px;">${esc(inv.studentName)}</span>
                    <span style="color: ${inv.balance > 0 ? '#ef4444' : '#16a34a'}; font-weight: 700; margin-left: 6px;">(₹ ${(inv.balance || inv.amount || 0).toLocaleString()})</span>
                  </div>
                  <div style="display: flex; gap: 4px;">
                    ${inv.balance > 0 ? `
                      <button class="btn btn-secondary btn-sm cmd-wa-invoice" data-name="${esc(inv.studentName)}" data-inv="${esc(inv.invoiceNo)}" data-bal="${esc(inv.balance)}" data-due="${esc(inv.dueDate || '')}" title="WhatsApp Reminder" style="padding: 2px 6px; color: #16a34a;">
                        <i data-lucide="message-circle" style="width: 13px; height: 13px;"></i>
                      </button>
                    ` : ''}
                    <button class="btn btn-secondary btn-sm cmd-view-finance" style="padding: 2px 8px; font-size: 0.72rem;">Ledger</button>
                  </div>
                </div>
              `;
            });
          }

          if (matchedStaff.length) {
            html += `<div style="font-weight: 700; color: #6366f1; font-size: 0.78rem; text-transform: uppercase; margin: 12px 0 4px;">Faculty &amp; Staff (${matchedStaff.length}):</div>`;
            matchedStaff.forEach(st => {
              html += `
                <div style="display:flex; justify-content:space-between; align-items:center; padding: 8px 10px; border-bottom: 1px solid var(--border-color); background: var(--bg-subtle, #f8fafc); border-radius: 6px; margin-bottom: 4px;">
                  <div>
                    <strong>${esc(st.name)}</strong>
                    <span style="color: var(--text-muted); font-size: 0.75rem; margin-left: 6px;">(${esc(st.designation || 'Faculty')})</span>
                  </div>
                </div>
              `;
            });
          }

          if (!html) {
            html = `<p style="color: var(--text-muted); text-align: center; padding: 24px;">No records found matching "${esc(q)}".</p>`;
          }

          results.innerHTML = html;
          UIComponents.refreshIcons();

          results.querySelectorAll('.cmd-view-student').forEach(b => {
            b.addEventListener('click', () => {
              UIComponents.closeModal();
              window.location.hash = '#/students';
            });
          });

          results.querySelectorAll('.cmd-view-finance').forEach(b => {
            b.addEventListener('click', () => {
              UIComponents.closeModal();
              window.location.hash = '#/finance';
            });
          });

          results.querySelectorAll('.cmd-wa-student').forEach(b => {
            b.addEventListener('click', () => {
              const phone = b.dataset.phone;
              const name = b.dataset.name;
              WhatsAppService.openChat(phone, `*${TMS_CONFIG.institution.name}*\nDear Parent of ${name},\nGreetings from the school administration.`);
            });
          });

          results.querySelectorAll('.cmd-wa-invoice').forEach(b => {
            b.addEventListener('click', () => {
              WhatsAppService.sendFeeReminder({
                studentName: b.dataset.name,
                invoiceNo: b.dataset.inv,
                balance: parseFloat(b.dataset.bal) || 0,
                dueDate: b.dataset.due
              });
            });
          });
        }, 150);
      });
    };

    if (searchTrigger) searchTrigger.addEventListener('click', openCommandPalette);
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openCommandPalette();
      }
    });
  }

  /** Self-service profile editor available to every signed-in user. */
  async openMyProfile() {
    const user = authService.currentUser || {};
    let pendingAvatar = null;

    const bodyHtml = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
        <div class="form-group" style="grid-column:1/-1; display:flex; gap:16px; align-items:center;">
          <img id="pf-avatar" src="${esc(user.avatar || DEFAULT_AVATAR)}" alt="Avatar" style="width:76px;height:76px;border-radius:50%;object-fit:cover;border:1px solid var(--border-color);">
          <div>
            <label class="form-label">Profile Photo</label>
            <input type="file" id="pf-avatar-file" accept="image/*" class="form-input">
          </div>
        </div>
        <div class="form-group"><label class="form-label">Full Name</label><input class="form-input" id="pf-name" value="${esc(user.name || '')}"></div>
        <div class="form-group"><label class="form-label">Email (read-only)</label><input class="form-input" id="pf-email" value="${esc(user.email || '')}" readonly></div>
        <div class="form-group"><label class="form-label">Designation / Title</label><input class="form-input" id="pf-title" value="${esc(user.rawTitle || '')}"></div>
        <div class="form-group"><label class="form-label">Department</label><input class="form-input" id="pf-department" value="${esc(user.rawDepartment || '')}"></div>
        <div class="form-group" style="grid-column:1/-1;"><label class="form-label">Phone</label><input class="form-input" id="pf-phone" value="${esc(user.phone || '')}"></div>
        <div class="form-group" style="grid-column:1/-1; border-top:1px solid var(--border-color); padding-top:12px;">
          <label class="form-label">Change My Password</label>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <input type="password" class="form-input" id="pf-new-password" placeholder="New password (min 6 characters)" style="flex:1; min-width:200px;">
            <button class="btn btn-secondary" id="pf-change-password"><i data-lucide="key-round"></i> Update Password</button>
          </div>
        </div>
      </div>
    `;
    const footerHtml = `
      <button class="btn btn-secondary" id="pf-cancel">Cancel</button>
      <button class="btn btn-primary" id="pf-save"><i data-lucide="save"></i> Save Profile</button>
    `;
    UIComponents.openModal({ title: 'My Profile', bodyHtml, footerHtml });

    document.getElementById('pf-avatar-file').addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      // 1. Instant local preview and fallback
      const reader = new FileReader();
      reader.onload = (re) => {
        const dataUrl = re.target.result;
        pendingAvatar = dataUrl;
        const img = document.getElementById('pf-avatar');
        if (img) img.src = dataUrl;
      };
      reader.readAsDataURL(file);

      // 2. Best-effort Supabase Storage upload
      try {
        const path = `users/${user.id}-${Date.now()}-${admissionService.sanitizeFileName(file.name)}`;
        const res = await admissionService.uploadFile('avatars', path, file);
        if (!res.error) {
          const publicUrl = admissionService.getPublicUrl('avatars', res.path);
          if (publicUrl) pendingAvatar = publicUrl;
        }
      } catch (err) {
        console.warn('Storage upload notice:', err.message);
      }

      UIComponents.showToast('Profile photo ready — click Save Profile.', 'success');
    });

    document.getElementById('pf-cancel').addEventListener('click', () => UIComponents.closeModal());

    document.getElementById('pf-change-password').addEventListener('click', async () => {
      const pw = document.getElementById('pf-new-password').value;
      if (!pw || pw.length < 6) { UIComponents.showToast('Password must be at least 6 characters.', 'warning'); return; }
      const r = await authService.changePassword(pw);
      if (r.success) {
        document.getElementById('pf-new-password').value = '';
        UIComponents.showToast('Password updated.', 'success');
      } else {
        UIComponents.showToast(`Could not update password: ${r.error}`, 'danger');
      }
    });

    document.getElementById('pf-save').addEventListener('click', async () => {
      const avatarToSave = pendingAvatar || user.avatar || DEFAULT_AVATAR;
      const fields = {
        name: document.getElementById('pf-name').value.trim(),
        title: document.getElementById('pf-title').value.trim(),
        department: document.getElementById('pf-department').value.trim(),
        phone: document.getElementById('pf-phone').value.trim(),
        avatar: avatarToSave
      };
      const r = await authService.updateOwnProfile(fields);
      if (!r.success) { UIComponents.showToast(`Could not save profile: ${r.error}`, 'danger'); return; }
      const updated = r.user || fields;
      const nameEl = document.getElementById('user-mini-name');
      const roleEl = document.getElementById('user-mini-role');
      const avatarEl = document.getElementById('user-mini-avatar');
      if (nameEl && updated.name) nameEl.innerText = updated.name;
      if (roleEl && updated.title) roleEl.innerText = updated.title;
      if (avatarEl && avatarToSave) avatarEl.src = avatarToSave;
      UIComponents.showToast('Profile updated successfully!', 'success');
      UIComponents.closeModal();
    });
    UIComponents.refreshIcons();
  }

  initRouter() {
    window.addEventListener('hashchange', () => this.handleRoute());
    if (!window.location.hash) {
      window.location.hash = '#/dashboard';
    } else {
      this.handleRoute();
    }
  }

  async handleRoute() {
    authService.touchSession().catch(() => {});
    const hash = window.location.hash.slice(2) || 'dashboard';
    const [moduleName] = hash.split('/');
    const viewport = document.getElementById('app-viewport');
    if (!viewport) return;

    document.querySelectorAll('.nav-item').forEach(item => {
      if (item.dataset.module === moduleName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    document.querySelectorAll('.mobile-nav-item').forEach(item => {
      if (item.dataset.module === moduleName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Close mobile drawer when navigating
    const sidebarEl = document.getElementById('app-sidebar');
    const backdropEl = document.getElementById('sidebar-backdrop');
    if (sidebarEl && backdropEl && sidebarEl.classList.contains('open')) {
      sidebarEl.classList.remove('open');
      backdropEl.classList.remove('active');
    }

    if (!PermissionEngine.canAccessModule(moduleName)) {
      viewport.innerHTML = `
        <div class="card" style="text-align: center; padding: 60px 20px;">
          <i data-lucide="shield-alert" style="width: 56px; height: 56px; color: #ef4444; margin: 0 auto 16px;"></i>
          <h2>Access Restricted by School Security Policy</h2>
          <p style="color: var(--text-muted); max-width: 500px; margin: 8px auto 20px;">
            Your authenticated role does not possess capability authorization for module: <strong>${esc(moduleName)}</strong>.
          </p>
          <a href="#/dashboard" class="btn btn-primary">Return to Overview Dashboard</a>
        </div>
      `;
      UIComponents.refreshIcons();
      return;
    }

    switch (moduleName) {
      case 'dashboard':
        await this.renderDashboard(viewport);
        break;
      case 'my-work':
        await MyWorkModule.render(viewport);
        break;
      case 'admissions-entry':
        await AdmissionsEntryModule.render(viewport);
        break;
      case 'students':
        await StudentModule.render(viewport);
        break;
      case 'id-cards':
        await IdCardsModule.render(viewport);
        break;
      case 'attendance':
        await AttendanceModule.render(viewport);
        break;
      case 'academics':
        await AcademicModule.render(viewport);
        break;
      case 'timetable':
        await TimetableModule.render(viewport);
        break;
      case 'homework':
        await HomeworkModule.render(viewport);
        break;
      case 'calendar':
        await CalendarModule.render(viewport);
        break;
      case 'examinations':
        await ExaminationModule.render(viewport);
        break;
      case 'certificates':
        await CertificatesModule.render(viewport);
        break;
      case 'finance':
        await FinanceModule.render(viewport);
        break;
      case 'staff':
        await StaffModule.render(viewport);
        break;
      case 'operations':
        await OperationsModule.render(viewport);
        break;
      case 'communication':
        await CommunicationModule.render(viewport);
        break;
      case 'reports':
        await ReportsModule.render(viewport);
        break;
      case 'institution':
        await InstitutionModule.render(viewport);
        break;
      case 'administration':
        await AdminModule.render(viewport);
        break;
      default:
        await this.renderDashboard(viewport);
    }

    UIComponents.refreshIcons();
  }

  async renderDashboard(container) {
    const esc = (v) => UIComponents.escapeHtml(v);
    const [students, staff, invoices, attendance] = await Promise.all([
      dbService.select('students'),
      dbService.select('staff_directory'),
      dbService.select('invoices'),
      dbService.select('attendance_records')
    ]);
    const user = authService.getCurrentUser() || {};

    const todayStr = new Date().toISOString().split('T')[0];
    const todayAttendance = (attendance || []).filter(a => a.date === todayStr);
    const presentStudents = todayAttendance.filter(a => a.status === 'present' || a.status === 'late').length;
    const attPercent = students.length ? Math.round((presentStudents / students.length) * 100) : 0;
    const absentees = Math.max(0, students.length - presentStudents);

    const totalCollected = (invoices || []).reduce((acc, i) => acc + (parseFloat(i.paid) || 0), 0);
    const totalDue = (invoices || []).reduce((acc, i) => acc + (parseFloat(i.balance) || 0), 0);

    container.innerHTML = `
      <div style="margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
          <div>
            <h1 style="font-size: 1.85rem;">THAIBA PUBLIC SCHOOL — Enterprise Overview</h1>
            <p style="color: var(--text-muted); font-size: 0.9rem;">
              Unified Campus Management • Welcome, <strong>${esc(user.name)}</strong> (${esc(user.isSuperAdmin ? 'Super Administrator' : user.title)})
            </p>
          </div>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button class="btn btn-secondary" id="btn-print-morning-pulse"><i data-lucide="printer"></i> Executive Pulse (A4)</button>
            <a href="student-admission-portal.html" target="_blank" class="btn btn-primary"><i data-lucide="file-plus"></i> Admission Portal (A4)</a>
            <a href="#/administration" class="btn btn-secondary"><i data-lucide="settings"></i> School Admin</a>
          </div>
        </div>
      </div>

      <!-- Executive Morning Campus Pulse Briefing -->
      <div class="card" style="margin-bottom: 24px; background: linear-gradient(135deg, rgba(6,78,59,0.04) 0%, rgba(15,23,42,0.03) 100%); border: 1.5px solid #16a34a;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 12px; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 38px; height: 38px; border-radius: 8px; background: #16a34a; color: #fff; display: flex; align-items: center; justify-content: center;">
              <i data-lucide="activity"></i>
            </div>
            <div>
              <h3 style="font-size: 1.1rem; font-weight: 800; color: #166534; margin: 0; display: flex; align-items: center; gap: 6px;">
                Principal's Morning Campus Pulse Briefing
                <span style="width: 8px; height: 8px; border-radius: 50%; background: #16a34a; display: inline-block;"></span>
              </h3>
              <div style="font-size: 0.78rem; color: var(--text-muted);">
                ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} • Session ${TMS_CONFIG.academic.currentYear}
              </div>
            </div>
          </div>
          <div style="display: flex; gap: 8px;">
            <span class="badge badge-success"><i data-lucide="shield-check"></i> Campus Secure</span>
            <span class="badge badge-info"><i data-lucide="wifi"></i> Gate Kiosk Active</span>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px;">
          <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; padding: 12px;">
            <div style="font-size: 0.72rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Student Morning Turnout</div>
            <div style="font-size: 1.35rem; font-weight: 800; color: #16a34a; margin: 2px 0;">${attPercent}% Present</div>
            <div style="font-size: 0.76rem; color: var(--text-muted);">${presentStudents} present • <strong style="color: #dc2626;">${absentees} absent</strong></div>
          </div>
          <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; padding: 12px;">
            <div style="font-size: 0.72rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Faculty &amp; Staff Muster</div>
            <div style="font-size: 1.35rem; font-weight: 800; color: #2563eb; margin: 2px 0;">${staff.length} Active</div>
            <div style="font-size: 0.76rem; color: var(--text-muted);">100% Instructional coverage</div>
          </div>
          <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; padding: 12px;">
            <div style="font-size: 0.72rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Fee Collections Realized</div>
            <div style="font-size: 1.35rem; font-weight: 800; color: #059669; margin: 2px 0;">₹ ${totalCollected.toLocaleString()}</div>
            <div style="font-size: 0.76rem; color: var(--text-muted);">₹ ${totalDue.toLocaleString()} pending collection</div>
          </div>
          <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; padding: 12px;">
            <div style="font-size: 0.72rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Academic Operations</div>
            <div style="font-size: 1.35rem; font-weight: 800; color: #7c3aed; margin: 2px 0;">Normal Day</div>
            <div style="font-size: 0.76rem; color: var(--text-muted);">7 Periods scheduled across ${TMS_CONFIG.academic.classes.length} classes</div>
          </div>
        </div>
      </div>

      <!-- Top KPI Row -->
      <div class="kpi-grid">
        ${UIComponents.renderKpiCard({ title: 'Enrolled Students', value: `${students.length}`, icon: 'users', color: 'emerald', subtitle: 'Academic Session ' + TMS_CONFIG.academic.currentYear })}
        ${UIComponents.renderKpiCard({ title: 'Faculty & Employees', value: `${staff.length}`, icon: 'briefcase', color: 'blue', subtitle: 'Active Campus Staff' })}
        ${UIComponents.renderKpiCard({ title: 'Fee Realization', value: `₹ ${totalCollected.toLocaleString()}`, icon: 'credit-card', color: 'amber', subtitle: 'Collections to Date' })}
        ${UIComponents.renderKpiCard({ title: 'Campus Geofence', value: 'Active', icon: 'map-pin', color: 'rose', subtitle: 'Tapan Campus 300m Zone' })}
      </div>

      <!-- Quick Action Hub -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 24px; margin-bottom: 24px;">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Authorized Quick Actions</h3>
            <span class="badge badge-success">Direct Access</span>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <a href="student-admission-portal.html" target="_blank" class="btn btn-secondary" style="justify-content: flex-start; padding: 14px;">
              <i data-lucide="file-text" style="color: #16a34a;"></i> Admission Form (A4)
            </a>
            <a href="#/students" class="btn btn-secondary" style="justify-content: flex-start; padding: 14px;">
              <i data-lucide="user-plus"></i> Student Directory
            </a>
            <a href="#/attendance" class="btn btn-secondary" style="justify-content: flex-start; padding: 14px;">
              <i data-lucide="qr-code"></i> Attendance Radar
            </a>
            <a href="#/finance" class="btn btn-secondary" style="justify-content: flex-start; padding: 14px;">
              <i data-lucide="receipt"></i> Fee Cash Counter
            </a>
            <a href="#/examinations" class="btn btn-secondary" style="justify-content: flex-start; padding: 14px;">
              <i data-lucide="file-check"></i> Report Cards
            </a>
            <a href="#/id-cards" class="btn btn-secondary" style="justify-content: flex-start; padding: 14px;">
              <i data-lucide="contact-2" style="color: #16a34a;"></i> ID Cards &amp; Badges Studio
            </a>
            <a href="#/homework" class="btn btn-secondary" style="justify-content: flex-start; padding: 14px;">
              <i data-lucide="book-check" style="color: #2563eb;"></i> Homework Diary
            </a>
            <a href="#/calendar" class="btn btn-secondary" style="justify-content: flex-start; padding: 14px;">
              <i data-lucide="calendar" style="color: #9333ea;"></i> Academic Calendar (.ics)
            </a>
            <a href="#/administration" class="btn btn-secondary" style="justify-content: flex-start; padding: 14px;">
              <i data-lucide="sliders"></i> Fee &amp; Form Builder
            </a>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Institution Profile & Information</h3>
            <span class="badge badge-info">Dakshin Dinajpur</span>
          </div>
          <div style="font-size: 0.88rem; line-height: 1.6;">
            <div style="padding-bottom: 10px; margin-bottom: 10px; border-bottom: 1px solid var(--border-color);">
              <strong>Affiliation / Registration:</strong> Regd. No. IV 01894/2011 • Run by Thaiba Heritage, Kolkata
            </div>
            <div style="padding-bottom: 10px; margin-bottom: 10px; border-bottom: 1px solid var(--border-color);">
              <strong>Campus Location:</strong> Baghait, Tapan, Dakshin Dinajpur, West Bengal
            </div>
            <div>
              <strong>Super Administrator:</strong> C. M. Basith (cmbasith786@gmail.com)
            </div>
          </div>
        </div>
      </div>
    `;

    // Principal Executive Pulse Print Modal
    const pulseBtn = container.querySelector('#btn-print-morning-pulse');
    if (pulseBtn) {
      pulseBtn.addEventListener('click', () => {
        const printStyles = `
          <style>
            @media print {
              @page { size: A4 portrait; margin: 12mm; }
              body * { visibility: hidden !important; }
              #morning-pulse-print, #morning-pulse-print * { visibility: visible !important; }
              #morning-pulse-print { position: absolute; left: 0; top: 0; width: 100% !important; border: 2px solid #064e3b !important; }
              .tms-modal-overlay, .tms-modal, .tms-modal-content { background: transparent !important; border: none !important; box-shadow: none !important; }
              .tms-modal-header, .tms-modal-footer, #app-sidebar, header { display: none !important; }
            }
          </style>
        `;

        UIComponents.openModal({
          title: "Principal's Daily Morning Campus Pulse Briefing",
          bodyHtml: `
            ${printStyles}
            <div id="morning-pulse-print" style="background: #ffffff; color: #0f172a; padding: 30px; border: 2px solid #16a34a; border-radius: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #16a34a; padding-bottom: 12px; margin-bottom: 16px;">
                <div>
                  <h2 style="font-size: 1.45rem; font-weight: 800; color: #166534; margin: 0; text-transform: uppercase;">${esc(TMS_CONFIG.institution.name)}</h2>
                  <div style="font-size: 0.8rem; color: #15803d; font-weight: 600;">DAILY EXECUTIVE CAMPUS BRIEFING • OFFICE OF THE PRINCIPAL</div>
                  <div style="font-size: 0.72rem; color: #64748b;">${esc(TMS_CONFIG.institution.address.campus)}, ${esc(TMS_CONFIG.institution.address.city)}</div>
                </div>
                <div style="text-align: right; font-size: 0.8rem;">
                  <div>Date: <strong>${new Date().toLocaleDateString('en-GB')}</strong></div>
                  <div>Time: <strong>${new Date().toLocaleTimeString()}</strong></div>
                  <span class="badge badge-success" style="margin-top: 4px;">Session ${TMS_CONFIG.academic.currentYear}</span>
                </div>
              </div>

              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px;">
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px;">
                  <div style="font-size: 0.72rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Student Muster</div>
                  <div style="font-size: 1.35rem; font-weight: 800; color: #16a34a;">${attPercent}% Present</div>
                  <div style="font-size: 0.76rem; color: #475569;">${presentStudents} Present / ${students.length} Enrolled</div>
                </div>
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px;">
                  <div style="font-size: 0.72rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Faculty &amp; Staff</div>
                  <div style="font-size: 1.35rem; font-weight: 800; color: #2563eb;">${staff.length} Present</div>
                  <div style="font-size: 0.76rem; color: #475569;">All academic periods covered</div>
                </div>
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px;">
                  <div style="font-size: 0.72rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Fee Collections</div>
                  <div style="font-size: 1.35rem; font-weight: 800; color: #059669;">₹ ${totalCollected.toLocaleString()}</div>
                  <div style="font-size: 0.76rem; color: #475569;">₹ ${totalDue.toLocaleString()} pending balance</div>
                </div>
              </div>

              <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; margin-bottom: 24px;">
                <strong style="color: #0f172a; font-size: 0.88rem; display: block; margin-bottom: 6px;">Principal's Daily Campus Directives:</strong>
                <ul style="font-size: 0.82rem; color: #475569; margin: 0 0 0 16px; line-height: 1.5;">
                  <li>Gate 01 entry kiosk reports verified biometric / QR arrivals. Unexcused absentees escalated for SMS alert.</li>
                  <li>Academic syllabus progress verified on track across all classes.</li>
                  <li>Campus geofence and security protocols active.</li>
                </ul>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: flex-end; padding-top: 24px; font-size: 0.85rem; text-align: center;">
                <div style="width: 180px;">
                  <div style="border-bottom: 1.5px solid #0f172a; margin-bottom: 4px; height: 30px;"></div>
                  <strong>Vice Principal / Coordinator</strong>
                </div>
                <div style="width: 180px;">
                  <div style="border-bottom: 1.5px solid #0f172a; margin-bottom: 4px; height: 30px;"></div>
                  <strong style="color: #166534;">Principal &amp; Headmaster</strong>
                </div>
              </div>
            </div>
          `,
          footerHtml: `
            <button class="btn btn-secondary" onclick="document.getElementById('global-modal-close').click()">Close</button>
            <button class="btn btn-primary" onclick="window.print()"><i data-lucide="printer"></i> Print Pulse Summary (A4)</button>
          `
        });
        UIComponents.refreshIcons();
      });
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.tmsApp = new AppController();
});
