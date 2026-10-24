/**
 * THAIBA PUBLIC SCHOOL — Immutable Audit Trail & Activity Logging Service
 */

import { authService } from './auth-service.js';
import { dbService } from './supabase-client.js';

class AuditService {
  constructor() {
    this.collection = 'audit_logs';
  }

  async log(action, category, details = {}, entityRef = null) {
    const user = authService.getCurrentUser() || {
      id: 'system_daemon',
      name: 'System Daemon',
      role: 'system'
    };

    const entry = {
      id: 'AUD-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase(),
      timestamp: new Date().toISOString(),
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      userScope: user.scope || 'school_wide',
      action: action, // e.g., 'STUDENT_ENROLLED', 'ATTENDANCE_CORRECTION', 'FEE_PAYMENT_COLLECTED'
      category: category, // e.g., 'ACADEMIC', 'FINANCE', 'ATTENDANCE', 'AUTH', 'SECURITY'
      entityRef: entityRef, // e.g., 'TMS-STU-1001', 'INV-2024-001'
      details: typeof details === 'string' ? details : JSON.stringify(details),
      ipAddress: null, // Client-side JS cannot determine the true source IP; leave unset.
      clientAgent: navigator.userAgent
    };

    // Immutable append
    const logs = dbService.getLocal(this.collection);
    logs.unshift(entry);
    dbService.setLocal(this.collection, logs);

    // Queue for cloud sync if Supabase is connected.
    // The local copy above is camelCase (for the UI); the database uses
    // snake_case columns, so map explicitly here before inserting.
    const client = dbService.getClient();
    if (client && dbService.isOnline) {
      const payload = {
        id: entry.id,
        timestamp: entry.timestamp,
        user_id: entry.userId,
        user_name: entry.userName,
        user_role: entry.userRole,
        user_scope: entry.userScope,
        action: entry.action,
        category: entry.category,
        entity_ref: entry.entityRef,
        details: entry.details,
        ip_address: entry.ipAddress,
        client_agent: entry.clientAgent
      };
      try {
        const { error } = await client.from(this.collection).insert([payload]);
        if (error) throw error;
      } catch (err) {
        // Enqueue for background retry
        const pending = dbService.getLocal('audit_logs_pending');
        pending.push(entry);
        dbService.setLocal('audit_logs_pending', pending);
      }
    }

    console.log(`🛡️ [TMS AUDIT] ${action} by ${user.name} (${user.role}) - ${entry.id}`);
    return entry;
  }

  async getLogs(filterCategory = null) {
    const logs = dbService.getLocal(this.collection);
    if (!filterCategory || filterCategory === 'all') {
      return logs;
    }
    return logs.filter(l => l.category.toLowerCase() === filterCategory.toLowerCase());
  }
}

export const auditService = new AuditService();
export default auditService;
