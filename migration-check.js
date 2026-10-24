/**
 * THAIBA PUBLIC SCHOOL — Database migration self-check
 *
 * The ERP relies on add-on objects created by `schema.sql` (sections 15-31) /
 * `schema-update-2.sql`. If that migration has not been applied to the connected
 * Supabase project, every request to those tables returns HTTP 404 and requests
 * that use a newer column return HTTP 400.
 *
 * This helper probes for the tables *and* the columns and shows one clear,
 * dismissible banner explaining exactly what to do, instead of a wall of
 * console 404s / 400s.
 */

import { dbService } from './supabase-client.js';

/** Tables created by the add-on migration. */
const REQUIRED_TABLES = [
  'admission_form_fields',
  'admission_fees',
  'admission_settings',
  'notifications',
  'notification_reads',
  'parent_credentials',
  'staff_credentials',
  'login_aliases',
  'app_settings'
];

/** Columns added by the add-on migration to pre-existing tables. */
const REQUIRED_COLUMNS = [
  ['admissions_applications', 'remarks'],
  ['admissions_applications', 'payload'],
  ['admissions_applications', 'payment_status'],
  ['admissions_applications', 'parent_user_id'],
  ['admissions_applications', 'payments'],
  ['profiles', 'avatar'],
  ['notifications', 'target_role']
];

let shown = false;

function banner(missingTables, missingColumns) {
  if (shown) return;
  if (document.getElementById('tms-migration-banner')) return;
  shown = true;

  const el = document.createElement('div');
  el.id = 'tms-migration-banner';
  el.setAttribute('role', 'alert');
  el.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:99999',
    'background:#7f1d1d', 'color:#fff', 'padding:12px 16px',
    'font-family:system-ui,Segoe UI,sans-serif', 'font-size:13px',
    'line-height:1.5', 'box-shadow:0 4px 14px rgba(0,0,0,.35)'
  ].join(';');

  const details = [];
  if (missingTables.length) details.push(`Missing tables: ${missingTables.join(', ')}`);
  if (missingColumns.length) details.push(`Missing columns: ${missingColumns.join(', ')}`);

  el.innerHTML = `
    <div style="display:flex;gap:12px;align-items:flex-start;max-width:1100px;margin:0 auto;">
      <div style="flex:1;">
        <strong style="font-size:14px;">Database setup incomplete — the ERP migration has not been applied.</strong><br>
        Open your Supabase project &rarr; <strong>SQL Editor</strong>, paste the full contents of
        <code style="background:rgba(255,255,255,.15);padding:1px 5px;border-radius:4px;">schema.sql</code>
        and click <strong>Run</strong>, then reload this page.
        <span style="opacity:.85;">(Running <code>schema-update-2.sql</code> afterwards as well is safe and does the same thing.)</span><br>
        <span style="opacity:.85;">${details.join(' &nbsp;|&nbsp; ')}</span>
      </div>
      <button type="button" aria-label="Dismiss"
        style="flex-shrink:0;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.4);color:#fff;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:12px;">
        Dismiss
      </button>
    </div>
  `;
  el.querySelector('button').addEventListener('click', () => el.remove());
  document.body.appendChild(el);
}

const isMissingObject = (error) => {
  const code = (error && error.code) || '';
  const msg = (error && error.message) || '';
  return code === '42P01' || code === '42703' || code === 'PGRST205' || code === 'PGRST204'
    || /does not exist|schema cache|not find the table|not find the '/i.test(msg);
};

/**
 * Probe for the add-on tables and columns.
 * Returns `{ tables, columns }` of what is missing. Never throws: an
 * unreachable/offline database reports nothing.
 */
export async function checkMigration() {
  const client = dbService.getClient ? dbService.getClient() : null;
  if (!client) return { tables: [], columns: [] };

  const missingTables = [];
  const missingColumns = [];

  await Promise.all(REQUIRED_TABLES.map(async (table) => {
    try {
      const { error } = await client.from(table).select('id').limit(1);
      if (error && isMissingObject(error)) missingTables.push(table);
    } catch (e) {
      /* Network/permission error — not a missing-table signal. */
    }
  }));

  await Promise.all(REQUIRED_COLUMNS.map(async ([table, column]) => {
    try {
      const { error } = await client.from(table).select(column).limit(1);
      // A row-level-security denial still proves the column exists.
      if (error && isMissingObject(error) && /column|'/.test(error.message || 'column')) {
        missingColumns.push(`${table}.${column}`);
      }
    } catch (e) {
      /* ignore */
    }
  }));

  if (missingTables.length || missingColumns.length) {
    banner(missingTables.sort(), missingColumns.sort());
  }
  return { tables: missingTables.sort(), columns: missingColumns.sort() };
}

export default checkMigration;
