/**
 * THAIBA PUBLIC SCHOOL - Apply schema.sql to the Supabase project.
 *
 * This avoids copy/paste corruption of large SQL by sending the file's exact
 * bytes to the Supabase Management API. No secrets are stored in this file;
 * the access token is read from the environment.
 *
 * Usage (PowerShell):
 *   $env:SUPABASE_ACCESS_TOKEN = "sbp_xxx"      # Supabase -> Account -> Access Tokens
 *   $env:SUPABASE_PROJECT_REF  = "bphjbvvapbefiyacfosm"   # optional, defaults below
 *   node apply-schema.js
 *
 * Usage (bash):
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx node apply-schema.js
 *
 * Note: the access token grants full project control - treat it like a password
 * and revoke it in the dashboard when you are done.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const projectRef = process.env.SUPABASE_PROJECT_REF || 'bphjbvvapbefiyacfosm';
const token = process.env.SUPABASE_ACCESS_TOKEN;

if (!token) {
  console.error('ERROR: SUPABASE_ACCESS_TOKEN is not set.');
  console.error('Create one at Supabase -> Account -> Access Tokens, then set the env var.');
  process.exit(1);
}

const schemaPath = path.join(__dirname, 'schema.sql');
const sql = fs.readFileSync(schemaPath, 'utf8');

console.log(`Applying ${path.basename(schemaPath)} (${sql.length} bytes) to project ${projectRef} ...`);

const body = JSON.stringify({ query: sql });

const req = https.request(
  {
    hostname: 'api.supabase.com',
    path: `/v1/projects/${projectRef}/database/query`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  },
  (res) => {
    let data = '';
    res.on('data', (chunk) => (data += chunk));
    res.on('end', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log('SUCCESS: schema applied.');
        if (data) console.log(data);
      } else {
        console.error(`FAILED (HTTP ${res.statusCode}):`);
        console.error(data);
        process.exit(1);
      }
    });
  }
);

req.on('error', (err) => {
  console.error('Request error:', err.message);
  process.exit(1);
});

req.write(body);
req.end();
