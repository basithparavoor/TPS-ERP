/**
 * THAIBA PUBLIC SCHOOL — Export Utilities
 * CSV download (Excel-safe, UTF-8 BOM) and print-to-PDF via a styled popup.
 */

function csvCell(value) {
  const str = value === null || value === undefined ? '' : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Download rows as a CSV file.
 * @param {string} filename
 * @param {Array<Array<any>>} rows  First row is treated as the header.
 */
export function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  // Prepend BOM so Excel reads UTF-8 correctly.
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Open a print-ready window. The user can then "Save as PDF".
 * @param {string} title
 * @param {string} bodyHtml
 */
export function exportPdf(title, bodyHtml) {
  const win = window.open('', '_blank');
  if (!win) {
    alert('Please allow pop-ups for this site to export the PDF.');
    return;
  }

  // The popup starts as about:blank, so relative URLs would 404 — resolve the
  // stylesheet against the current document's base URL instead.
  let cssHref = '';
  try {
    cssHref = new URL('app.css', document.baseURI).href;
  } catch (e) {
    cssHref = 'app.css';
  }

  win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <link rel="stylesheet" href="${cssHref}">
  <style>
    body { padding: 24px; background: #ffffff; color: #0f172a; font-family: 'Plus Jakarta Sans', 'Segoe UI', sans-serif; }
    .print-actions { display: flex; justify-content: flex-end; margin-bottom: 16px; }
    @media print { .print-actions { display: none !important; } body { padding: 0; } }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; vertical-align: top; font-size: 0.82rem; }
    th { background: #f1f5f9; }
    .doc-title { font-size: 1.3rem; font-weight: 800; margin-bottom: 4px; }
    .doc-sub { color: #64748b; font-size: 0.82rem; margin-bottom: 18px; }
    .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  </style>
</head>
<body>
  <div class="print-actions">
    <button onclick="window.print()" style="padding:10px 18px;border-radius:8px;border:none;background:#16a34a;color:#fff;font-weight:600;cursor:pointer;">Print / Save as PDF</button>
  </div>
  ${bodyHtml}
  <script>setTimeout(function(){ window.print(); }, 500);<\/script>
</body>
</html>`);
  win.document.close();
  win.focus();
}

/**
 * Build a key/value table for a printable document.
 * @param {Array<[string, any]>} pairs
 */
export function kvTable(pairs) {
  return `<table>${pairs
    .map(([k, v]) => `<tr><th style="width:32%">${k}</th><td>${v === null || v === undefined || v === '' ? '&mdash;' : v}</td></tr>`)
    .join('')}</table>`;
}

/**
 * Universal Native Web Share API helper with clipboard fallback
 */
export async function shareContent({ title, text, url }) {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: title || 'Thaiba Public School',
        text: text || '',
        url: url || window.location.href
      });
      return true;
    } catch (err) {
      if (err.name === 'AbortError') return false;
    }
  }
  const sharePayload = `${title ? '*' + title + '*\n' : ''}${text || ''}${url ? '\n' + url : ''}`;
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(sharePayload);
      return true;
    }
  } catch (e) { /* ignore */ }
  return false;
}

export default { downloadCsv, exportPdf, kvTable, shareContent };
