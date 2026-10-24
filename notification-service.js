/**
 * THAIBA PUBLIC SCHOOL — Notification Service
 * Admin-created notices, audience-targeted, with per-user read state.
 *
 * The database enforces visibility (RLS); this service mirrors the same
 * audience rules client-side so cached/offline data is never over-shared.
 */

import { dbService } from './supabase-client.js';
import { authService } from './auth-service.js';

const STAFF_ROLES = [
  'admin', 'principal', 'coordinator', 'teacher',
  'finance', 'hr', 'librarian', 'operations', 'office_boy'
];

class NotificationService {
  matchAudience(notification, user) {
    if (!user) return false;
    const audience = notification.audience || 'all';
    if (audience === 'all') return true;
    if (notification.recipientId && notification.recipientId === user.id) return true;
    if (audience === 'staff') return STAFF_ROLES.includes(user.role);
    if (audience === 'students') return user.role === 'student';
    if (audience === 'parents') return user.role === 'parent';
    if (audience === 'role') return notification.targetRole === user.role;
    return false;
  }

  async list() {
    const user = authService.getCurrentUser();
    const all = await dbService.select('notifications');
    return all
      .filter((n) => this.matchAudience(n, user))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }

  async readIds() {
    const user = authService.getCurrentUser();
    if (!user) return new Set();
    const reads = await dbService.select('notification_reads');
    return new Set(reads.filter((r) => r.userId === user.id).map((r) => r.notificationId));
  }

  async listForUser() {
    const [notifications, readIds] = await Promise.all([this.list(), this.readIds()]);
    return notifications.map((n) => ({ ...n, isRead: readIds.has(n.id) }));
  }

  async unreadCount() {
    const items = await this.listForUser();
    return items.filter((n) => !n.isRead).length;
  }

  async markRead(notificationId) {
    const user = authService.getCurrentUser();
    if (!user || !notificationId) return;

    // `notification_reads` is unique on (notification_id, user_id); re-using the
    // insert would raise a duplicate-key error, so update the existing row when
    // there is one (the common case after a stale cache or a second click).
    const reads = await dbService.select('notification_reads');
    const existing = reads.find((r) => r.notificationId === notificationId && r.userId === user.id);
    if (existing) {
      await dbService.update('notification_reads', existing.id, { readAt: new Date().toISOString() });
      return;
    }

    await dbService.upsert('notification_reads', {
      id: `read-${notificationId}-${user.id}`,
      notificationId,
      userId: user.id,
      readAt: new Date().toISOString()
    });
  }

  async markAllRead(notificationIds = []) {
    for (const id of notificationIds) {
      // eslint-disable-next-line no-await-in-loop
      await this.markRead(id);
    }
  }

  async create({ title, message, audience = 'all', targetRole = null, priority = 'Normal', recipientId = null }) {
    const user = authService.getCurrentUser() || {};
    return dbService.insert('notifications', {
      title,
      message,
      audience,
      targetRole,
      priority,
      recipientId,
      createdBy: user.id || null,
      createdByName: user.name || 'Administration'
    });
  }

  async remove(id) {
    return dbService.delete('notifications', id);
  }
}

export const notificationService = new NotificationService();
export default notificationService;
