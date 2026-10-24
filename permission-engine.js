/**
 * THAIBA PUBLIC SCHOOL — Role-Based Access Control (RBAC) & Permission Engine
 *
 * Authorisation derives EXCLUSIVELY from the server-verified profile
 * (role + scope) held by authService. No email or client value can elevate
 * privileges here.
 */

import { TMS_CONFIG } from './config.js';
import { authService } from './auth-service.js';

export const CAPABILITIES = {
  // Administration
  MANAGE_SETTINGS: 'manage_settings',
  VIEW_AUDIT_LOGS: 'view_audit_logs',
  MANAGE_USERS: 'manage_users',

  // Admissions
  MANAGE_ADMISSIONS: 'manage_admissions',

  // Facilities
  MANAGE_FACILITIES: 'manage_facilities',

  // Academics
  MANAGE_ACADEMICS: 'manage_academics',
  VIEW_TIMETABLE: 'view_timetable',

  // Attendance
  MARK_CLASS_ATTENDANCE: 'mark_class_attendance',
  PUNCH_STAFF_ATTENDANCE: 'punch_staff_attendance',
  VIEW_ATTENDANCE: 'view_attendance',

  // Students
  MANAGE_STUDENTS: 'manage_students',
  VIEW_STUDENTS: 'view_students',

  // Staff & HR
  MANAGE_STAFF: 'manage_staff',
  VIEW_STAFF: 'view_staff',
  MANAGE_PAYROLL: 'manage_payroll',

  // Exams
  MANAGE_EXAMS: 'manage_exams',
  ENTER_MARKS: 'enter_marks',
  VIEW_RESULTS: 'view_results',

  // Finance
  MANAGE_FINANCE: 'manage_finance',
  COLLECT_FEES: 'collect_fees',
  VIEW_INVOICES: 'view_invoices',

  // Operations & Library
  MANAGE_OPERATIONS: 'manage_operations',
  CIRCULATE_BOOKS: 'circulate_books',

  // Communication
  PUBLISH_NOTICES: 'publish_notices',
  VIEW_NOTICES: 'view_notices',

  // Reports
  VIEW_REPORTS: 'view_reports',

  // Super Admin Exclusive Privileges
  SUPER_ADMIN_CONSOLE: 'super_admin_console',
  VIEW_DEVELOPER_OPTIONS: 'view_developer_options',
  DIAGNOSE_AND_FIX_ERRORS: 'diagnose_and_fix_errors',
  VIEW_USER_SESSIONS: 'view_user_sessions',
  DATABASE_EXPLORER: 'database_explorer',
  MANAGE_SUPER_ADMIN: 'manage_super_admin'
};

export const SUPER_ADMIN_ONLY_CAPABILITIES = [
  CAPABILITIES.SUPER_ADMIN_CONSOLE,
  CAPABILITIES.VIEW_DEVELOPER_OPTIONS,
  CAPABILITIES.DIAGNOSE_AND_FIX_ERRORS,
  CAPABILITIES.VIEW_USER_SESSIONS,
  CAPABILITIES.DATABASE_EXPLORER,
  CAPABILITIES.MANAGE_SUPER_ADMIN
];

const ROLE_CAPABILITY_MATRIX = {
  [TMS_CONFIG.roles.SUPER_ADMIN]: Object.values(CAPABILITIES),

  [TMS_CONFIG.roles.ADMIN]: Object.values(CAPABILITIES).filter(c => !SUPER_ADMIN_ONLY_CAPABILITIES.includes(c)),

  [TMS_CONFIG.roles.PRINCIPAL]: [
    CAPABILITIES.VIEW_AUDIT_LOGS,
    CAPABILITIES.MANAGE_FACILITIES,
    CAPABILITIES.MANAGE_ACADEMICS,
    CAPABILITIES.VIEW_TIMETABLE,
    CAPABILITIES.MARK_CLASS_ATTENDANCE,
    CAPABILITIES.PUNCH_STAFF_ATTENDANCE,
    CAPABILITIES.VIEW_ATTENDANCE,
    CAPABILITIES.MANAGE_STUDENTS,
    CAPABILITIES.VIEW_STUDENTS,
    CAPABILITIES.MANAGE_STAFF,
    CAPABILITIES.VIEW_STAFF,
    CAPABILITIES.MANAGE_EXAMS,
    CAPABILITIES.ENTER_MARKS,
    CAPABILITIES.VIEW_RESULTS,
    CAPABILITIES.VIEW_INVOICES,
    CAPABILITIES.MANAGE_OPERATIONS,
    CAPABILITIES.CIRCULATE_BOOKS,
    CAPABILITIES.PUBLISH_NOTICES,
    CAPABILITIES.VIEW_NOTICES,
    CAPABILITIES.VIEW_REPORTS
  ],

  [TMS_CONFIG.roles.COORDINATOR]: [
    CAPABILITIES.MANAGE_ACADEMICS,
    CAPABILITIES.VIEW_TIMETABLE,
    CAPABILITIES.MARK_CLASS_ATTENDANCE,
    CAPABILITIES.VIEW_ATTENDANCE,
    CAPABILITIES.VIEW_STUDENTS,
    CAPABILITIES.MANAGE_EXAMS,
    CAPABILITIES.ENTER_MARKS,
    CAPABILITIES.VIEW_RESULTS,
    CAPABILITIES.PUBLISH_NOTICES,
    CAPABILITIES.VIEW_NOTICES,
    CAPABILITIES.VIEW_REPORTS
  ],

  [TMS_CONFIG.roles.TEACHER]: [
    CAPABILITIES.VIEW_TIMETABLE,
    CAPABILITIES.MARK_CLASS_ATTENDANCE,
    CAPABILITIES.PUNCH_STAFF_ATTENDANCE,
    CAPABILITIES.VIEW_ATTENDANCE,
    CAPABILITIES.VIEW_STUDENTS,
    CAPABILITIES.ENTER_MARKS,
    CAPABILITIES.VIEW_RESULTS,
    CAPABILITIES.VIEW_NOTICES
  ],

  [TMS_CONFIG.roles.FINANCE]: [
    CAPABILITIES.VIEW_STUDENTS,
    CAPABILITIES.MANAGE_FINANCE,
    CAPABILITIES.COLLECT_FEES,
    CAPABILITIES.VIEW_INVOICES,
    CAPABILITIES.VIEW_REPORTS,
    CAPABILITIES.VIEW_NOTICES
  ],

  [TMS_CONFIG.roles.HR]: [
    CAPABILITIES.MANAGE_STAFF,
    CAPABILITIES.VIEW_STAFF,
    CAPABILITIES.MANAGE_PAYROLL,
    CAPABILITIES.VIEW_ATTENDANCE,
    CAPABILITIES.VIEW_NOTICES
  ],

  [TMS_CONFIG.roles.LIBRARIAN]: [
    CAPABILITIES.MANAGE_OPERATIONS,
    CAPABILITIES.CIRCULATE_BOOKS,
    CAPABILITIES.VIEW_STUDENTS,
    CAPABILITIES.VIEW_NOTICES
  ],

  [TMS_CONFIG.roles.OPERATIONS]: [
    CAPABILITIES.MANAGE_OPERATIONS,
    CAPABILITIES.VIEW_NOTICES
  ],

  [TMS_CONFIG.roles.OFFICE_BOY]: [
    CAPABILITIES.MANAGE_ADMISSIONS,
    CAPABILITIES.VIEW_NOTICES
  ],

  [TMS_CONFIG.roles.STUDENT]: [
    CAPABILITIES.VIEW_TIMETABLE,
    CAPABILITIES.VIEW_ATTENDANCE,
    CAPABILITIES.VIEW_RESULTS,
    CAPABILITIES.VIEW_INVOICES,
    CAPABILITIES.VIEW_NOTICES
  ],

  [TMS_CONFIG.roles.PARENT]: [
    CAPABILITIES.VIEW_TIMETABLE,
    CAPABILITIES.VIEW_ATTENDANCE,
    CAPABILITIES.VIEW_RESULTS,
    CAPABILITIES.VIEW_INVOICES,
    CAPABILITIES.VIEW_NOTICES
  ]
};

// Highest privilege level recognised by the engine.
const PRIVILEGED_MODULE_ROLES = [
  TMS_CONFIG.roles.ADMIN,
  TMS_CONFIG.roles.PRINCIPAL
];

export class PermissionEngine {
  static _user() {
    return authService.getCurrentUser();
  }

  static _isSuperAdmin(user) {
    return !!user && user.isSuperAdmin === true;
  }

  static isSuperAdmin() {
    return this._isSuperAdmin(this._user());
  }

  static can(capability) {
    const user = this._user();
    if (!user || !user.role) return false;

    // Super Admin exclusive capabilities: strictly Super Admin only
    if (SUPER_ADMIN_ONLY_CAPABILITIES.includes(capability)) {
      return this._isSuperAdmin(user);
    }

    if (this._isSuperAdmin(user)) {
      return true;
    }

    if (user.role === TMS_CONFIG.roles.ADMIN) {
      return true;
    }

    const allowed = ROLE_CAPABILITY_MATRIX[user.role] || [];
    return allowed.includes(capability);
  }

  static getScope() {
    const user = this._user();
    if (this._isSuperAdmin(user)) {
      return TMS_CONFIG.scopes.SCHOOL_WIDE;
    }
    return user?.scope || TMS_CONFIG.scopes.OWN_RECORDS;
  }

  static isSchoolWide() {
    return this.getScope() === TMS_CONFIG.scopes.SCHOOL_WIDE;
  }

  static canAccessModule(moduleId) {
    const user = this._user();
    if (!user || !user.role) return false;

    // Unknown / unassigned roles get nothing.
    if (user.role === 'pending') return false;

    if (this._isSuperAdmin(user) || user.role === TMS_CONFIG.roles.ADMIN) {
      return true;
    }

    if (PRIVILEGED_MODULE_ROLES.includes(user.role)) {
      return true; // Principal
    }

    const role = user.role;

    switch (moduleId) {
      case 'dashboard':
        return user.role !== TMS_CONFIG.roles.OFFICE_BOY;
      case 'admissions-entry':
        return [TMS_CONFIG.roles.OFFICE_BOY, TMS_CONFIG.roles.COORDINATOR].includes(role);
      case 'my-work':
        return [TMS_CONFIG.roles.TEACHER, TMS_CONFIG.roles.COORDINATOR, TMS_CONFIG.roles.HR, TMS_CONFIG.roles.FINANCE, TMS_CONFIG.roles.LIBRARIAN].includes(role);
      case 'students':
        return [TMS_CONFIG.roles.COORDINATOR, TMS_CONFIG.roles.TEACHER, TMS_CONFIG.roles.FINANCE, TMS_CONFIG.roles.LIBRARIAN].includes(role);
      case 'staff':
        return [TMS_CONFIG.roles.HR].includes(role);
      case 'academics':
      case 'timetable':
      case 'homework':
        return [TMS_CONFIG.roles.COORDINATOR, TMS_CONFIG.roles.TEACHER, TMS_CONFIG.roles.STUDENT, TMS_CONFIG.roles.PARENT].includes(role);
      case 'id-cards':
        return [TMS_CONFIG.roles.COORDINATOR, TMS_CONFIG.roles.TEACHER, TMS_CONFIG.roles.HR, TMS_CONFIG.roles.FINANCE].includes(role);
      case 'calendar':
        return true;
      case 'attendance':
        return [TMS_CONFIG.roles.TEACHER, TMS_CONFIG.roles.COORDINATOR, TMS_CONFIG.roles.STUDENT, TMS_CONFIG.roles.PARENT].includes(role);
      case 'examinations':
      case 'certificates':
        return [TMS_CONFIG.roles.COORDINATOR, TMS_CONFIG.roles.TEACHER, TMS_CONFIG.roles.STUDENT, TMS_CONFIG.roles.PARENT].includes(role);
      case 'finance':
        return [TMS_CONFIG.roles.FINANCE, TMS_CONFIG.roles.STUDENT, TMS_CONFIG.roles.PARENT].includes(role);
      case 'operations':
        return false;
      case 'communication':
        return true;
      case 'reports':
        return [TMS_CONFIG.roles.COORDINATOR, TMS_CONFIG.roles.FINANCE].includes(role);
      case 'administration':
      case 'institution':
        return [TMS_CONFIG.roles.ADMIN].includes(role);
      default:
        return false;
    }
  }
}

export default PermissionEngine;
