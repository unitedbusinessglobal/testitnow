// ============================================================
// ReportsPage.jsx — Full reports with all formats working
// Fixed: steps column, HTML report, screenshots, all downloads
// ============================================================
import React, { useState, useMemo, useRef } from 'react';
import { getTheme } from '../lib/theme';
import {
  Download, FileSpreadsheet, FileText, FileCode, File,
  CheckCircle, XCircle, Clock, AlertTriangle, Filter,
  ChevronDown, ChevronUp, ArrowLeft, Bug, BarChart2,
  Eye, Search, Upload, Settings, X, Plus, Image,
  Printer, RefreshCw,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// CORE DOWNLOAD HELPER — reliable cross-browser
// ─────────────────────────────────────────────────────────────
function dl(content, filename, mime = 'text/plain;charset=utf-8') {
  try {
    const blob = new Blob([content], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 400);
  } catch(e) { console.error('Download failed:', e); alert('Download failed: ' + e.message); }
}

function dlScreenshot(dataUrl, name) {
  if (!dataUrl) return;
  const a = document.createElement('a');
  a.href     = dataUrl;
  a.download = (name||'screenshot').replace(/[^a-z0-9]/gi,'_') + '.png';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => document.body.removeChild(a), 400);
}

// ─────────────────────────────────────────────────────────────
// CSV BUILDER
// ─────────────────────────────────────────────────────────────
function toCSV(rows) {
  return '\uFEFF' + rows.map(row =>
    row.map(cell => {
      const s = String(cell ?? '').replace(/\r?\n/g,' ');
      return (s.includes(',') || s.includes('"') || s.includes('\n'))
        ? `"${s.replace(/"/g,'""')}"` : s;
    }).join(',')
  ).join('\r\n');
}

// ─────────────────────────────────────────────────────────────
// ALL COLUMNS DEFINITION (with steps as separate column)
// ─────────────────────────────────────────────────────────────
const TC_COLS = [
  { key:'id',             label:'Test ID' },
  { key:'name',           label:'Title' },
  { key:'type',           label:'Type' },
  { key:'priority',       label:'Priority' },
  { key:'status',         label:'Status' },
  { key:'description',    label:'Description' },
  { key:'preconditions',  label:'Preconditions' },
  { key:'testSteps',      label:'Test Steps' },        // ← separate column
  { key:'testData',       label:'Test Data' },
  { key:'expectedResult', label:'Expected Result' },
  { key:'url',            label:'URL' },
];

const RES_COLS = [
  { key:'id',        label:'Test ID' },
  { key:'name',      label:'Test Name' },
  { key:'type',      label:'Type' },
  { key:'status',    label:'Status' },
  { key:'duration',  label:'Duration (ms)' },
  { key:'timestamp', label:'Timestamp' },
  { key:'error',     label:'Error Message' },
  { key:'isRetest',  label:'Is Retest' },
];

const TYPES = ['ui','api','security','performance','database','unit'];
const TYPE_COLORS = { ui:'#3b82f6', api:'#00d4aa', security:'#f59e0b', performance:'#a78bfa', database:'#34d399', unit:'#fb7185' };

// ─────────────────────────────────────────────────────────────
// GET VALUE FROM TEST OBJECT
// ─────────────────────────────────────────────────────────────
function getTestVal(t, key) {
  if (key === 'type')      return (t.type||'').toUpperCase();
  if (key === 'status')    return t.status || 'Draft';
  if (key === 'testSteps') {
    // Always show steps clearly — split by pipe
    const raw = t.testSteps || t.test_steps || '';
    return String(raw).split(' | ').filter(Boolean).join('\n');
  }
  return t[key] ?? '';
}

function getResVal(r, key) {
  if (key === 'status')    return (r.status||'').toUpperCase();
  if (key === 'timestamp') return r.timestamp ? new Date(r.timestamp).toLocaleString() : '';
  if (key === 'isRetest')  return r.isRetest ? 'Yes' : 'No';
  return r[key] ?? '';
}

// ─────────────────────────────────────────────────────────────
// DOWNLOAD FUNCTIONS
// ─────────────────────────────────────────────────────────────

// ── CSV / Excel ───────────────────────────────────────────────
function downloadCSV_TC(tests, selectedCols, filter) {
  const allTests = Object.entries(tests).flatMap(([type,list]) => list.map(t=>({...t,type})));
  const filtered = applyFilter(allTests, filter);
  const cols     = selectedCols.length ? selectedCols : TC_COLS.map(c=>c.key);
  const colDefs  = TC_COLS.filter(c => cols.includes(c.key));

  const rows = [
    ['TestItNow — Test Cases Report'],
    ['Generated: ' + new Date().toLocaleString()],
    ['Total: ' + filtered.length],
    [],
    colDefs.map(c=>c.label),
    ...filtered.map(t => colDefs.map(c => getTestVal(t, c.key))),
  ];
  dl(toCSV(rows), 'TestItNow_TestCases.csv', 'text/csv;charset=utf-8');
}

function downloadCSV_Results(results, selectedCols, filter) {
  if (!results.length) { alert('No results to export.'); return; }
  const filtered = applyResFilter(results, filter);
  const cols     = selectedCols.length ? selectedCols : RES_COLS.map(c=>c.key);
  const colDefs  = RES_COLS.filter(c => cols.includes(c.key));

  const rows = [
    ['TestItNow — Test Results Report'],
    ['Generated: ' + new Date().toLocaleString()],
    [],
    colDefs.map(c=>c.label),
    ...filtered.map(r => colDefs.map(c => getResVal(r, c.key))),
  ];
  dl(toCSV(rows), 'TestItNow_Results.csv', 'text/csv;charset=utf-8');
}

function downloadCSV_Bugs(bugs) {
  if (!bugs.length) { alert('No bugs to export.'); return; }
  const rows = [
    ['TestItNow — Bug Reports'],
    ['Generated: ' + new Date().toLocaleString()],
    [],
    ['Bug Key','Summary','Severity','Priority','Status','Created At','Description'],
    ...bugs.map(b => [b.jiraKey||'', b.summary||'', b.severity||'', b.priority||'', b.status||'', b.createdAt ? new Date(b.createdAt).toLocaleString() : '', b.description||'']),
  ];
  dl(toCSV(rows), 'TestItNow_Bugs.csv', 'text/csv;charset=utf-8');
}

// ── PDF (print dialog) ────────────────────────────────────────
function downloadPDF(tests, results, bugs, selectedCols, filter) {
  const allTests = applyFilter(Object.entries(tests).flatMap(([type,list])=>list.map(t=>({...t,type}))), filter);
  const cols     = selectedCols.length ? selectedCols : ['id','name','type','priority','testSteps','expectedResult'];
  const colDefs  = TC_COLS.filter(c => cols.includes(c.key));
  const passed   = results.filter(r=>r.status==='passed').length;
  const passRate = results.length ? Math.round(passed/results.length*100) : 0;

  const pColor = p => ({ Critical:'#dc2626', High:'#ea580c', Medium:'#ca8a04', Low:'#16a34a' }[p] || '#475569');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>TestItNow Report</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;font-size:10px;color:#1e293b;padding:16px}
h1{font-size:18px;color:#1e3a5f;border-bottom:3px solid #3b82f6;padding-bottom:6px;margin-bottom:12px}
h2{font-size:13px;color:#1e3a5f;margin:16px 0 6px;border-left:4px solid #3b82f6;padding-left:6px}
.sum{display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap}
.sc{background:#f1f5f9;border:1px solid #cbd5e1;border-radius:5px;padding:8px 14px;text-align:center}
.sc .v{font-size:18px;font-weight:bold;color:#1e3a5f}.sc .l{font-size:9px;color:#64748b;text-transform:uppercase}
table{width:100%;border-collapse:collapse;margin-bottom:12px;font-size:9px;page-break-inside:auto}
th{background:#1e3a5f;color:#fff;padding:4px 6px;text-align:left;font-size:9px}
td{padding:3px 6px;border-bottom:1px solid #e2e8f0;vertical-align:top;max-width:160px;word-break:break-word;white-space:pre-wrap}
tr:nth-child(even) td{background:#f8fafc}
.b{display:inline-block;padding:1px 5px;border-radius:3px;font-size:8px;font-weight:bold}
@media print{@page{margin:0.8cm}tr{page-break-inside:avoid}}
</style></head><body>
<h1>🧪 TestItNow Report</h1>
<p style="color:#64748b;margin-bottom:10px">Generated: ${new Date().toLocaleString()}</p>
<div class="sum">
${[['Total Tests',allTests.length,'#1e3a5f'],['Passed',passed,'#16a34a'],['Failed',results.filter(r=>r.status==='failed').length,'#dc2626'],['Pass Rate',passRate+'%','#2563eb'],['Bugs',bugs.length,'#7c3aed']]
  .map(([l,v,c])=>`<div class="sc"><div class="v" style="color:${c}">${v}</div><div class="l">${l}</div></div>`).join('')}
</div>
<h2>Test Cases (${allTests.length}) — includes Test Steps</h2>
<table><thead><tr>${colDefs.map(c=>`<th>${c.label}</th>`).join('')}</tr></thead>
<tbody>${allTests.map(t=>`<tr>${colDefs.map(c=>{
  const v = getTestVal(t, c.key);
  if (c.key==='priority') return `<td><span class="b" style="background:${pColor(v)}22;color:${pColor(v)}">${v}</span></td>`;
  return `<td>${String(v).substring(0,200)}</td>`;
}).join('')}</tr>`).join('')}</tbody></table>
${results.length ? `<h2>Results (${results.length})</h2>
<table><thead><tr><th>ID</th><th>Name</th><th>Status</th><th>Duration</th><th>Error</th></tr></thead>
<tbody>${results.map(r=>`<tr><td style="font-family:monospace">${r.id||''}</td><td>${(r.name||'').substring(0,50)}</td>
<td style="color:${r.status==='passed'?'#16a34a':'#dc2626'};font-weight:bold">${(r.status||'').toUpperCase()}</td>
<td>${r.duration||0}ms</td><td style="color:#dc2626">${(r.error||'').substring(0,60)}</td></tr>`).join('')}</tbody></table>`:''}
${bugs.length ? `<h2>Bugs (${bugs.length})</h2>
<table><thead><tr><th>Key</th><th>Summary</th><th>Severity</th><th>Status</th></tr></thead>
<tbody>${bugs.map(b=>`<tr><td>${b.jiraKey||''}</td><td>${b.summary||''}</td><td>${b.severity||''}</td><td>${b.status||''}</td></tr>`).join('')}</tbody></table>`:''}
</body></html>`;

  const win = window.open('', '_blank', 'width=1100,height=750,scrollbars=yes');
  if (!win) { alert('Allow popups to open the PDF preview'); return; }
  win.document.open(); win.document.write(html); win.document.close();
  win.focus(); setTimeout(() => win.print(), 600);
}

// ── HTML Report with embedded screenshots ─────────────────────
function downloadHTML(tests, results, bugs, selectedCols, filter) {
  const allTests = applyFilter(Object.entries(tests).flatMap(([type,list])=>list.map(t=>({...t,type}))), filter);
  const passed   = results.filter(r=>r.status==='passed').length;
  const passRate = results.length ? Math.round(passed/results.length*100) : 0;
  const cols     = selectedCols.length ? selectedCols : ['id','name','type','priority','testSteps','expectedResult'];
  const colDefs  = TC_COLS.filter(c => cols.includes(c.key));

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>TestItNow — Full Report</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;background:#0a0f1e;color:#f0f4ff;line-height:1.5}
.header{background:#0d1530;border-bottom:1px solid rgba(0,212,170,0.15);padding:16px 28px;display:flex;justify-content:space-between;align-items:center}
.logo{font-size:18px;font-weight:900}.logo span{color:#00d4aa}
.gen{color:#6b7fa3;font-size:12px}
.summary{display:flex;gap:12px;padding:20px 28px;flex-wrap:wrap;border-bottom:1px solid rgba(0,212,170,0.1)}
.stat{background:#111b3a;border:1px solid rgba(0,212,170,0.12);border-radius:10px;padding:12px 20px;text-align:center;min-width:90px}
.stat .v{font-size:22px;font-weight:800;font-family:monospace}
.stat .l{font-size:11px;color:#6b7fa3;margin-top:2px}
.body{padding:20px 28px}
.section{margin-bottom:32px}
.section-title{font-size:16px;font-weight:700;margin-bottom:12px;color:#f0f4ff;display:flex;align-items:center;gap:8px}
.section-title::after{content:'';flex:1;height:1px;background:rgba(0,212,170,0.15);margin-left:8px}
table{width:100%;border-collapse:collapse;font-size:12px;overflow:auto;display:block}
thead tr th{background:#111b3a;color:#94a3b8;padding:8px 10px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap;border-bottom:1px solid rgba(0,212,170,0.12)}
tbody tr td{padding:7px 10px;border-bottom:1px solid rgba(255,255,255,0.04);vertical-align:top;font-size:12px;color:#d1d9f0;max-width:260px;word-break:break-word}
tbody tr:hover td{background:rgba(255,255,255,0.03)}
.steps-cell{font-family:monospace;font-size:11px;line-height:1.8;white-space:pre-wrap}
.badge{display:inline-block;padding:2px 7px;border-radius:20px;font-size:10px;font-weight:700}
.badge.Critical{background:rgba(239,68,68,0.15);color:#f87171}
.badge.High{background:rgba(249,115,22,0.15);color:#fb923c}
.badge.Medium{background:rgba(234,179,8,0.15);color:#fbbf24}
.badge.Low{background:rgba(74,222,128,0.15);color:#4ade80}
.badge.passed{background:rgba(74,222,128,0.15);color:#4ade80}
.badge.failed{background:rgba(248,113,113,0.15);color:#f87171}
.badge.PASSED{background:rgba(74,222,128,0.15);color:#4ade80}
.badge.FAILED{background:rgba(248,113,113,0.15);color:#f87171}
.result-row{border-radius:8px;margin-bottom:8px;overflow:hidden}
.result-row.passed{background:rgba(74,222,128,0.04);border:1px solid rgba(74,222,128,0.2)}
.result-row.failed{background:rgba(248,113,113,0.04);border:1px solid rgba(248,113,113,0.2)}
.result-header{display:flex;align-items:center;gap:10px;padding:10px 14px}
.result-name{flex:1;font-size:13px;font-weight:500}
.result-meta{font-size:11px;color:#6b7fa3;font-family:monospace}
.result-detail{padding:10px 14px 14px;border-top:1px solid rgba(255,255,255,0.05)}
.error-box{background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.25);border-radius:6px;padding:8px 10px;color:#f87171;font-size:12px;margin-bottom:10px}
.screenshot-wrap{position:relative;display:inline-block}
.screenshot{max-width:100%;border-radius:8px;border:1px solid rgba(0,212,170,0.15);display:block}
.ss-label{font-size:10px;color:#6b7fa3;margin-top:4px}
.type-badge{font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(0,212,170,0.1);color:#00d4aa;font-family:monospace}
</style>
</head>
<body>
<div class="header">
  <div class="logo">TestIt<span>Now</span> — Full Test Report</div>
  <div class="gen">Generated: ${new Date().toLocaleString()}</div>
</div>

<div class="summary">
  ${[['Total Tests',allTests.length,'#f0f4ff'],['Passed',passed,'#4ade80'],['Failed',results.filter(r=>r.status==='failed').length,'#f87171'],['Pass Rate',passRate+'%','#00d4aa'],['Duration',results.length?Math.round(results.reduce((s,r)=>s+(r.duration||0),0)/1000)+'s':'—','#3b82f6'],['Bugs',bugs.length,'#a78bfa']].map(([l,v,c])=>
    `<div class="stat"><div class="v" style="color:${c}">${v}</div><div class="l">${l}</div></div>`
  ).join('')}
</div>

<div class="body">

<!-- TEST RESULTS WITH SCREENSHOTS -->
${results.length ? `
<div class="section">
  <div class="section-title">🧪 Test Results with Screenshots (${results.length})</div>
  ${results.map((r,i) => `
  <div class="result-row ${r.status||''}">
    <div class="result-header">
      <span>${r.status==='passed'?'✅':'❌'}</span>
      <span class="result-name">${r.name||''}</span>
      <span class="badge ${r.status||''}">${(r.status||'').toUpperCase()}</span>
      <span class="result-meta">${r.duration||0}ms</span>
      ${r.isRetest ? '<span class="badge" style="background:rgba(59,130,246,0.15);color:#60a5fa">RETEST</span>' : ''}
    </div>
    ${r.error || r.screenshot ? `<div class="result-detail">
      ${r.error ? `<div class="error-box">⚠ ${r.error}</div>` : ''}
      ${r.screenshot ? `<div class="screenshot-wrap">
        <img src="${r.screenshot}" alt="Screenshot for ${r.name||''}" class="screenshot" loading="lazy"/>
        <div class="ss-label">📸 Screenshot captured at ${r.timestamp ? new Date(r.timestamp).toLocaleTimeString() : 'runtime'} — Click to view full size</div>
      </div>` : ''}
    </div>` : ''}
  </div>`).join('')}
</div>` : ''}

<!-- TEST CASES TABLE WITH STEPS AS SEPARATE COLUMN -->
<div class="section">
  <div class="section-title">📋 Test Cases (${allTests.length}) — with detailed steps</div>
  <table>
    <thead><tr>${colDefs.map(c=>`<th>${c.label}</th>`).join('')}</tr></thead>
    <tbody>
      ${allTests.map(t=>`<tr>
        ${colDefs.map(c=>{
          const v = getTestVal(t, c.key);
          if (c.key==='priority') return `<td><span class="badge ${v}">${v}</span></td>`;
          if (c.key==='status')   return `<td><span class="badge ${v}">${v}</span></td>`;
          if (c.key==='type')     return `<td><span class="type-badge">${v}</span></td>`;
          if (c.key==='testSteps')return `<td class="steps-cell">${String(v).replace(/\n/g,'<br>')}</td>`;
          return `<td>${String(v).substring(0,250)}</td>`;
        }).join('')}
      </tr>`).join('')}
    </tbody>
  </table>
</div>

<!-- BUGS -->
${bugs.length ? `
<div class="section">
  <div class="section-title">🐛 Bug Reports (${bugs.length})</div>
  <table>
    <thead><tr><th>Key</th><th>Summary</th><th>Severity</th><th>Priority</th><th>Status</th><th>Created</th><th>Description</th></tr></thead>
    <tbody>
      ${bugs.map(b=>`<tr>
        <td style="font-family:monospace;color:#00d4aa">${b.jiraKey||''}</td>
        <td>${b.summary||''}</td>
        <td><span class="badge ${b.severity||''}">${b.severity||''}</span></td>
        <td><span class="badge ${b.priority||''}">${b.priority||''}</span></td>
        <td>${b.status||''}</td>
        <td style="white-space:nowrap">${b.createdAt?new Date(b.createdAt).toLocaleDateString():''}</td>
        <td>${b.description||''}</td>
      </tr>`).join('')}
    </tbody>
  </table>
</div>` : ''}

</div>
</body>
</html>`;

  dl(html, `TestItNow_Report_${new Date().toISOString().split('T')[0]}.html`, 'text/html;charset=utf-8');
}

// ── Word (.doc) ───────────────────────────────────────────────
function downloadWord(tests, results, bugs, selectedCols) {
  const allTests = Object.entries(tests).flatMap(([type,list])=>list.map(t=>({...t,type})));
  const cols     = selectedCols.length ? selectedCols : ['id','name','type','priority','testSteps','expectedResult'];
  const colDefs  = TC_COLS.filter(c => cols.includes(c.key));

  const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
<head><meta charset='utf-8'><title>TestItNow Report</title>
<style>
body{font-family:Calibri,Arial;font-size:11pt;margin:2cm}
h1{font-size:18pt;color:#1e3a5f;border-bottom:2pt solid #3b82f6;padding-bottom:4pt}
h2{font-size:13pt;color:#1e3a5f;margin-top:14pt;border-left:4pt solid #3b82f6;padding-left:6pt}
h3{font-size:11pt;color:#334155;margin-top:10pt}
table{border-collapse:collapse;width:100%;font-size:9pt;margin:6pt 0}
th{background:#1e3a5f;color:#fff;padding:4pt 6pt;text-align:left;border:1pt solid #1e3a5f}
td{padding:3pt 6pt;border:1pt solid #cbd5e1;vertical-align:top;word-break:break-word}
tr:nth-child(even) td{background:#f8fafc}
.steps{font-family:'Courier New';font-size:8pt;white-space:pre-wrap}
.meta{background:#f1f5f9;border:1pt solid #cbd5e1;padding:8pt;margin:6pt 0}
</style></head><body>
<h1>🧪 TestItNow — Test Report</h1>
<div class="meta">
<p><b>Generated:</b> ${new Date().toLocaleString()}</p>
<p><b>Test Cases:</b> ${allTests.length}</p>
<p><b>Results:</b> ${results.length} (${results.filter(r=>r.status==='passed').length} passed / ${results.filter(r=>r.status==='failed').length} failed)</p>
<p><b>Bugs:</b> ${bugs.length}</p>
</div>

<h2>1. Test Cases — with Test Steps column</h2>
${TYPES.map(type => {
  const list = tests[type]||[];
  if (!list.length) return '';
  const idx = TYPES.indexOf(type)+1;
  return `<h3>1.${idx} ${type.toUpperCase()} (${list.length})</h3>
<table><thead><tr>${colDefs.map(c=>`<th>${c.label}</th>`).join('')}</tr></thead>
<tbody>${list.map(t=>`<tr>${colDefs.map(c=>{
  const v = getTestVal({...t,type}, c.key);
  if (c.key==='testSteps') return `<td class="steps">${String(v)}</td>`;
  return `<td>${String(v).substring(0,300)}</td>`;
}).join('')}</tr>`).join('')}</tbody></table>`;
}).join('')}

${results.length ? `<h2>2. Test Results</h2>
<table><thead><tr><th>ID</th><th>Name</th><th>Type</th><th>Status</th><th>Duration</th><th>Timestamp</th><th>Error</th></tr></thead>
<tbody>${results.map(r=>`<tr>
<td style="font-family:Courier New">${r.id||''}</td>
<td>${r.name||''}</td>
<td>${(r.type||'').toUpperCase()}</td>
<td style="font-weight:bold;color:${r.status==='passed'?'#16a34a':'#dc2626'}">${(r.status||'').toUpperCase()}</td>
<td>${r.duration||0}ms</td>
<td>${r.timestamp?new Date(r.timestamp).toLocaleString():''}</td>
<td style="color:#dc2626">${r.error||''}</td>
</tr>`).join('')}</tbody></table>`:''}

${bugs.length ? `<h2>3. Bug Reports</h2>
<table><thead><tr><th>Key</th><th>Summary</th><th>Severity</th><th>Priority</th><th>Status</th></tr></thead>
<tbody>${bugs.map(b=>`<tr><td>${b.jiraKey||''}</td><td>${b.summary||''}</td><td>${b.severity||''}</td><td>${b.priority||''}</td><td>${b.status||''}</td></tr>`).join('')}</tbody></table>`:''}
</body></html>`;

  dl(html, 'TestItNow_Report.doc', 'application/msword;charset=utf-8');
}

// ── XML ───────────────────────────────────────────────────────
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;'); }

function downloadXML(tests, results, bugs) {
  const allTests = Object.entries(tests).flatMap(([type,list])=>list.map(t=>({...t,type})));
  const passed   = results.filter(r=>r.status==='passed').length;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<TestReport generated="${new Date().toISOString()}" tool="TestItNow">
  <Summary>
    <TotalTestCases>${allTests.length}</TotalTestCases>
    <TotalResults>${results.length}</TotalResults>
    <Passed>${passed}</Passed>
    <Failed>${results.filter(r=>r.status==='failed').length}</Failed>
    <PassRate>${results.length?Math.round(passed/results.length*100):0}%</PassRate>
    <BugCount>${bugs.length}</BugCount>
  </Summary>
  <TestCases count="${allTests.length}">
${allTests.map(t=>`    <TestCase id="${esc(t.id)}" type="${esc(t.type)}">
      <Title>${esc(t.name)}</Title>
      <Priority>${esc(t.priority)}</Priority>
      <Status>${esc(t.status||'Draft')}</Status>
      <Description>${esc(t.description)}</Description>
      <Preconditions>${esc(t.preconditions)}</Preconditions>
      <TestSteps>${esc((t.testSteps||'').split(' | ').map((s,i)=>`${i+1}. ${s}`).join('\n'))}</TestSteps>
      <TestData>${esc(t.testData)}</TestData>
      <ExpectedResult>${esc(t.expectedResult)}</ExpectedResult>
      <URL>${esc(t.url)}</URL>
    </TestCase>`).join('\n')}
  </TestCases>
  <TestResults count="${results.length}">
${results.map(r=>`    <Result testId="${esc(r.id)}">
      <TestName>${esc(r.name)}</TestName>
      <Type>${esc(r.type)}</Type>
      <Status>${esc(r.status)}</Status>
      <DurationMs>${r.duration||0}</DurationMs>
      <Timestamp>${r.timestamp||''}</Timestamp>
      <ErrorMessage>${esc(r.error)}</ErrorMessage>
      <HasScreenshot>${!!r.screenshot}</HasScreenshot>
    </Result>`).join('\n')}
  </TestResults>
  <BugReports count="${bugs.length}">
${bugs.map(b=>`    <Bug key="${esc(b.jiraKey)}">
      <Summary>${esc(b.summary)}</Summary>
      <Severity>${esc(b.severity)}</Severity>
      <Priority>${esc(b.priority)}</Priority>
      <Status>${esc(b.status)}</Status>
      <CreatedAt>${b.createdAt||''}</CreatedAt>
    </Bug>`).join('\n')}
  </BugReports>
</TestReport>`;

  dl(xml, 'TestItNow_Report.xml', 'application/xml;charset=utf-8');
}

// ── Helpers ───────────────────────────────────────────────────
function applyFilter(tests, filter) {
  return tests.filter(t => {
    if (filter.type     && t.type     !== filter.type)     return false;
    if (filter.priority && t.priority !== filter.priority) return false;
    if (filter.search   && !`${t.name||''}${t.id||''}`.toLowerCase().includes((filter.search||'').toLowerCase())) return false;
    return true;
  });
}
function applyResFilter(results, filter) {
  return results.filter(r => {
    if (filter.resultStatus && r.status !== filter.resultStatus) return false;
    if (filter.search && !`${r.name||''}${r.id||''}`.toLowerCase().includes((filter.search||'').toLowerCase())) return false;
    return true;
  });
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function ReportsPage({ tests, results, bugs, onBack, theme = 'light' }) {
  const T = getTheme(theme);
  const [section,       setSection]       = useState('overview');
  const [filter,        setFilter]        = useState({ type:'', priority:'', resultStatus:'', search:'' });
  const [selectedTCols, setSelectedTCols] = useState(TC_COLS.map(c=>c.key));
  const [selectedRCols, setSelectedRCols] = useState(RES_COLS.map(c=>c.key));
  const [showColPicker, setShowColPicker] = useState(false);
  const [expandedTC,    setExpandedTC]    = useState(null);
  const [expandedRes,   setExpandedRes]   = useState(null);
  const [templateTxt,   setTemplateTxt]   = useState('');
  const [templateName,  setTemplateName]  = useState('');
  const fileRef = useRef(null);

  const allTests = useMemo(() =>
    Object.entries(tests).flatMap(([type,list])=>list.map(t=>({...t,type}))), [tests]);

  const filteredTests = useMemo(() => applyFilter(allTests, filter), [allTests, filter]);
  const filteredRes   = useMemo(() => applyResFilter(results, filter), [results, filter]);

  const summary = useMemo(() => ({
    total:    results.length,
    passed:   results.filter(r=>r.status==='passed').length,
    failed:   results.filter(r=>r.status==='failed').length,
    passRate: results.length ? Math.round(results.filter(r=>r.status==='passed').length/results.length*100) : 0,
    duration: results.reduce((s,r)=>s+(r.duration||0),0),
  }), [results]);

  const pColor = p => ({ Critical:'bg-red-900/40 text-red-300 border-red-700/40', High:'bg-orange-900/40 text-orange-300 border-orange-700/40', Medium:'bg-yellow-900/40 text-yellow-300 border-yellow-700/40', Low:'bg-green-900/40 text-green-300 border-green-700/40' }[p] || 'bg-slate-700/40 text-slate-400 border-slate-600');

  const handleTemplate = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { setTemplateTxt(ev.target.result); setTemplateName(file.name); };
    reader.readAsText(file);
    e.target.value = '';
  };

  const dlWithTemplate = () => {
    if (!templateTxt) return;
    try {
      const lines = templateTxt.split('\n');
      const heads = lines[0].split(',').map(h=>h.trim().replace(/^"|"$/g,'').toLowerCase());
      const rows  = [heads.join(',')];
      const ALL_TC = TC_COLS.map(c=>c.key);
      allTests.forEach((t,i) => {
        rows.push(heads.map(h => {
          const key = TC_COLS.find(c=>c.label.toLowerCase()===h||c.key.toLowerCase()===h)?.key;
          return key ? String(getTestVal(t,key)).replace(/\n/g,' ') : '';
        }).map(v => v.includes(',') ? `"${v}"` : v).join(','));
      });
      dl('\uFEFF'+rows.join('\r\n'), 'TestItNow_Template_Export.csv', 'text/csv;charset=utf-8');
    } catch(e) { alert('Template error: ' + e.message); }
  };

  const navItems = [
    { id:'overview',  label:'Overview',   icon:BarChart2 },
    { id:'testcases', label:'Test Cases',  icon:FileText,   badge:allTests.length },
    { id:'results',   label:'Results',     icon:CheckCircle,badge:results.length },
    { id:'bugs',      label:'Bugs',        icon:Bug,        badge:bugs.length },
    { id:'downloads', label:'Downloads',   icon:Download },
    { id:'templates', label:'Templates',   icon:Upload },
  ];

  const dlAll = () => {
    downloadCSV_TC(tests, selectedTCols, filter);
    setTimeout(() => downloadCSV_Results(results, selectedRCols, filter), 350);
    setTimeout(() => downloadCSV_Bugs(bugs), 700);
    setTimeout(() => downloadXML(tests, results, bugs), 1050);
  };

  return (
    <div className="min-h-screen font-sans" style={{ background:T.bg, color:T.text, display:'flex', flexDirection:'column' }}>
      {/* Top bar */}
      <div style={{ background:T.sidebar, borderBottom:'1px solid rgba(0,212,170,0.12)', padding:'10px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:50 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', color:T.textMuted, cursor:'pointer', fontSize:13 }}>
            <ArrowLeft size={15}/> Back
          </button>
          <div style={{ width:1, height:20, background:'rgba(255,255,255,0.1)' }}/>
          <span style={{ color:T.text, fontWeight:700, fontSize:15, display:'flex', alignItems:'center', gap:6 }}>
            <FileText size={16} style={{ color:T.accent }}/> Reports & Downloads
          </span>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => downloadHTML(tests, results, bugs, selectedTCols, filter)}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:8, border:'1px solid rgba(0,212,170,0.3)', background:T.accentDim, color:T.accent, cursor:'pointer', fontSize:12, fontWeight:600 }}>
            <Eye size={13}/> HTML Report
          </button>
          <button onClick={dlAll}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:8, border:'none', background:`linear-gradient(135deg,${T.accent},${T.blue})`, color:'#0a0f1e', cursor:'pointer', fontSize:12, fontWeight:700 }}>
            <Download size={13}/> Download All
          </button>
        </div>
      </div>

      <div style={{ display:'flex', flex:1 }}>
        {/* Sidebar */}
        <div style={{ width:180, background:T.sidebar, borderRight:'1px solid rgba(0,212,170,0.12)', padding:'10px 8px', flexShrink:0 }}>
          {navItems.map(item => {
            const Icon = item.icon;
            const on   = section === item.id;
            return (
              <button key={item.id} onClick={()=>setSection(item.id)} style={{
                width:'100%', display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:8, border:'none', cursor:'pointer', marginBottom:2, fontSize:13, fontWeight: on?600:400,
                background: on ? T.accentDim : 'transparent',
                color: on ? T.accent : T.textSub,
                borderLeft: `2px solid ${on ? T.accent : 'transparent'}`,
              }}>
                <Icon size={14}/>
                <span style={{ flex:1, textAlign:'left' }}>{item.label}</span>
                {item.badge > 0 && <span style={{ fontSize:10, fontWeight:700, padding:'1px 5px', borderRadius:10, background: on ? T.accent : T.border, color: on ? '#fff' : T.textMuted }}>{item.badge}</span>}
              </button>
            );
          })}
        </div>

        {/* Main content */}
        <div style={{ flex:1, padding:'20px 24px', overflowY:'auto', background:T.bg }}>

          {/* ══ OVERVIEW ══ */}
          {section === 'overview' && (
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
              <h2 style={{ fontSize:18, fontWeight:800, color:T.text }}>Overview</h2>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))', gap:10 }}>
                {[
                  { label:'Total Tests', val:allTests.length,  color:T.text },
                  { label:'Passed',      val:summary.passed,   color:'#4ade80' },
                  { label:'Failed',      val:summary.failed,   color:'#f87171' },
                  { label:'Pass Rate',   val:`${summary.passRate}%`, color:T.accent },
                  { label:'Bugs',        val:bugs.length,      color:'#f87171' },
                  { label:'Critical',    val:allTests.filter(t=>t.priority==='Critical').length, color:'#f87171' },
                ].map(s => (
                  <div key={s.label} style={{ background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:10, padding:'12px', textAlign:'center' }}>
                    <div style={{ color:s.color, fontWeight:800, fontSize:22, fontFamily:'monospace' }}>{s.val}</div>
                    <div style={{ color:T.textMuted, fontSize:11, marginTop:3 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:12, padding:'16px' }}>
                <h3 style={{ fontSize:13, fontWeight:600, color:T.textSub, marginBottom:12 }}>By Type</h3>
                {TYPES.map(type => {
                  const cnt = (tests[type]||[]).length;
                  const pct = allTests.length ? Math.round(cnt/allTests.length*100) : 0;
                  return (
                    <div key={type} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                      <span style={{ color:T.textMuted, fontSize:11, fontFamily:'monospace', textTransform:'uppercase', width:80 }}>{type}</span>
                      <div style={{ flex:1, background:T.bgHover, borderRadius:4, height:6 }}>
                        <div style={{ height:'100%', borderRadius:4, background:TYPE_COLORS[type], width:`${pct}%` }}/>
                      </div>
                      <span style={{ color:T.textSub, fontSize:11, width:30, textAlign:'right' }}>{cnt}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ══ TEST CASES ══ */}
          {section === 'testcases' && (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
                <h2 style={{ fontSize:18, fontWeight:800, color:T.text }}>Test Cases <span style={{ color:T.textMuted, fontWeight:400, fontSize:14 }}>({filteredTests.length}/{allTests.length})</span></h2>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={()=>setShowColPicker(showColPicker==='tc'?false:'tc')}
                    style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:7, border:`1px solid ${T.border}`, background:T.bgHover, color:T.textSub, cursor:'pointer', fontSize:12 }}>
                    <Settings size={12}/> Columns ({selectedTCols.length})
                  </button>
                  <button onClick={()=>downloadCSV_TC(tests,selectedTCols,filter)}
                    style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:7, border:'none', background:'#16a34a22', color:'#4ade80', cursor:'pointer', fontSize:12, fontWeight:600 }}>
                    <FileSpreadsheet size={12}/> Export CSV
                  </button>
                </div>
              </div>

              {/* Column picker */}
              {showColPicker === 'tc' && (
                <div style={{ background:T.bgCard, border:'1px solid rgba(0,212,170,0.2)', borderRadius:12, padding:'14px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                    <span style={{ color:T.text, fontSize:13, fontWeight:600 }}>Choose columns (Test Steps included by default)</span>
                    <div style={{ display:'flex', gap:6 }}>
                      <button onClick={()=>setSelectedTCols(TC_COLS.map(c=>c.key))} style={{ fontSize:11, padding:'3px 10px', borderRadius:6, border:'none', background:'rgba(59,130,246,0.2)', color:'#60a5fa', cursor:'pointer' }}>All</button>
                      <button onClick={()=>setSelectedTCols(['id','name','type','priority','testSteps','expectedResult'])} style={{ fontSize:11, padding:'3px 10px', borderRadius:6, border:'none', background:T.bgHover, color:T.textSub, cursor:'pointer' }}>Default</button>
                      <button onClick={()=>setShowColPicker(false)} style={{ background:'none', border:'none', color:T.textMuted, cursor:'pointer' }}><X size={13}/></button>
                    </div>
                  </div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                    {TC_COLS.map(col => (
                      <button key={col.key} onClick={()=>setSelectedTCols(prev=>prev.includes(col.key)?prev.filter(k=>k!==col.key):[...prev,col.key])}
                        style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:20, border:`1px solid ${selectedTCols.includes(col.key)?'rgba(0,212,170,0.5)':'rgba(255,255,255,0.1)'}`, background: selectedTCols.includes(col.key)?'rgba(0,212,170,0.12)':'transparent', color: selectedTCols.includes(col.key)?'#00d4aa':'#6b7fa3', fontSize:12, cursor:'pointer' }}>
                        {selectedTCols.includes(col.key) && <CheckCircle size={10}/>} {col.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Filters */}
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:10, padding:'10px 12px' }}>
                <div style={{ position:'relative', flex:1, minWidth:160 }}>
                  <Search size={12} style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:T.textMuted }}/>
                  <input value={filter.search} onChange={e=>setFilter(p=>({...p,search:e.target.value}))} placeholder="Search tests…"
                    style={{ width:'100%', paddingLeft:28, paddingRight:8, paddingTop:6, paddingBottom:6, background:T.bgHover, border:`1px solid ${T.border}`, borderRadius:7, color:T.text, fontSize:12, outline:'none', fontFamily:'inherit' }}/>
                </div>
                {[{k:'type',opts:['','ui','api','security','performance','database','unit'],l:'All Types'},{k:'priority',opts:['','Critical','High','Medium','Low'],l:'All Priorities'}].map(({k,opts,l})=>(
                  <select key={k} value={filter[k]} onChange={e=>setFilter(p=>({...p,[k]:e.target.value}))}
                    style={{ padding:'6px 10px', background:T.bgHover, border:`1px solid ${T.border}`, borderRadius:7, color:T.text, fontSize:12, outline:'none' }}>
                    {opts.map(o=><option key={o} value={o} style={{ background:T.bgCard }}>{o||l}</option>)}
                  </select>
                ))}
                {(filter.type||filter.priority||filter.search) && (
                  <button onClick={()=>setFilter({type:'',priority:'',resultStatus:'',search:''})} style={{ display:'flex', alignItems:'center', gap:4, padding:'6px 10px', border:`1px solid ${T.border}`, borderRadius:7, background:'transparent', color:T.textMuted, cursor:'pointer', fontSize:12 }}>
                    <X size={11}/> Clear
                  </button>
                )}
              </div>

              {/* Test list */}
              {filteredTests.length === 0 ? (
                <div style={{ textAlign:'center', padding:'48px', color:T.textMuted }}><AlertTriangle size={32} style={{ margin:'0 auto 10px', display:'block', opacity:0.4 }}/><p style={{ fontSize:13 }}>No tests match your filters.</p></div>
              ) : filteredTests.map(test => (
                <div key={test.id} style={{ background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:10, overflow:'hidden' }}>
                  <div style={{ display:'flex', alignItems:'center', padding:'9px 12px', gap:10, cursor:'pointer' }} onClick={()=>setExpandedTC(expandedTC===test.id?null:test.id)}>
                    <div style={{ width:3, height:24, borderRadius:2, background:TYPE_COLORS[test.type]||'#6b7fa3', flexShrink:0 }}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ color:T.text, fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{test.name}</div>
                      <div style={{ color:T.textMuted, fontSize:10 }}>{test.id}</div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                      <span style={{ fontSize:10, padding:'2px 7px', borderRadius:20, border:'1px solid', ...(() => {
                        const m = { Critical:'rgba(239,68,68,0.15) #f87171 rgba(239,68,68,0.3)', High:'rgba(249,115,22,0.15) #fb923c rgba(249,115,22,0.3)', Medium:'rgba(234,179,8,0.15) #fbbf24 rgba(234,179,8,0.3)', Low:'rgba(74,222,128,0.15) #4ade80 rgba(74,222,128,0.3)' }[test.priority]||'rgba(255,255,255,0.06) #6b7fa3 rgba(255,255,255,0.1)';
                        const [bg,col,border] = m.split(' '); return { background:bg, color:col, borderColor:border };
                      })() }}>{test.priority}</span>
                      <span style={{ fontSize:10, padding:'2px 6px', borderRadius:4, background:T.bgHover, color:T.textSub }}>{test.type}</span>
                      <button onClick={e=>{e.stopPropagation(); const rows=[TC_COLS.map(c=>c.label),TC_COLS.map(c=>getTestVal(test,c.key))]; dl(toCSV(rows),`TC_${(test.id||'tc').replace(/[^a-z0-9]/gi,'_')}.csv`,'text/csv;charset=utf-8');}} style={{ background:'none', border:'none', color:T.accent, cursor:'pointer', padding:3 }} title="Download this test"><Download size={12}/></button>
                      {expandedTC===test.id?<ChevronUp size={13} style={{ color:T.textMuted }}/>:<ChevronDown size={13} style={{ color:T.textMuted }}/>}
                    </div>
                  </div>
                  {expandedTC === test.id && (
                    <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', padding:'12px', background:T.bgHover }}>
                      {[['Description',test.description],['Preconditions',test.preconditions],['Test Steps',test.testSteps],['Test Data',test.testData],['Expected Result',test.expectedResult]]
                        .filter(([,v])=>v).map(([label,value])=>(
                          <div key={label} style={{ marginBottom:10 }}>
                            <div style={{ color:T.textMuted, fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>{label}</div>
                            <div style={{ color:T.text, fontSize:12, background:T.bgHover, borderRadius:7, padding:'8px 10px', lineHeight:1.7 }}>
                              {label === 'Test Steps'
                                ? String(value).split(' | ').map((s,i)=><div key={i}>{i+1}. {s}</div>)
                                : String(value)
                              }
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ══ RESULTS ══ */}
          {section === 'results' && (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
                <h2 style={{ fontSize:18, fontWeight:800, color:T.text }}>Results <span style={{ color:T.textMuted, fontWeight:400, fontSize:14 }}>({filteredRes.length}/{results.length})</span></h2>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={()=>downloadHTML(tests,results,bugs,selectedTCols,filter)} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:7, border:'1px solid rgba(0,212,170,0.3)', background:T.accentDim, color:T.accent, cursor:'pointer', fontSize:12, fontWeight:600 }}>
                    <Eye size={12}/> HTML with Screenshots
                  </button>
                  <button onClick={()=>downloadCSV_Results(results,selectedRCols,filter)} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:7, border:'none', background:'#16a34a22', color:'#4ade80', cursor:'pointer', fontSize:12, fontWeight:600 }}>
                    <FileSpreadsheet size={12}/> Export CSV
                  </button>
                </div>
              </div>

              {/* Stats */}
              {results.length > 0 && (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                  {[{l:'Passed',v:summary.passed,c:'#4ade80'},{l:'Failed',v:summary.failed,c:'#f87171'},{l:'Pass Rate',v:`${summary.passRate}%`,c:'#00d4aa'}].map(s=>(
                    <div key={s.l} style={{ background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:8, padding:'10px', textAlign:'center' }}>
                      <div style={{ color:s.c, fontWeight:800, fontSize:20, fontFamily:'monospace' }}>{s.v}</div>
                      <div style={{ color:T.textMuted, fontSize:11 }}>{s.l}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Status filter */}
              <div style={{ display:'flex', gap:6 }}>
                {['all','passed','failed'].map(f=>(
                  <button key={f} onClick={()=>setFilter(p=>({...p,resultStatus:f==='all'?'':f}))}
                    style={{ padding:'5px 14px', borderRadius:7, border:'none', cursor:'pointer', fontSize:12, fontWeight:600, background: (filter.resultStatus===f||(!filter.resultStatus&&f==='all')) ? '#00d4aa' : 'rgba(255,255,255,0.06)', color: (filter.resultStatus===f||(!filter.resultStatus&&f==='all')) ? '#0a0f1e' : '#6b7fa3' }}>
                    {f==='all'?`All (${results.length})`:f==='passed'?`✓ ${summary.passed}`:`✗ ${summary.failed}`}
                  </button>
                ))}
              </div>

              {/* Results list */}
              {results.length===0 ? (
                <div style={{ textAlign:'center', padding:'48px', color:T.textMuted }}><Clock size={32} style={{ margin:'0 auto 10px', display:'block', opacity:0.4 }}/><p style={{ fontSize:13 }}>Run your tests to see results here.</p></div>
              ) : filteredRes.map((r,i)=>(
                <div key={i} style={{ background: r.status==='passed'?'rgba(74,222,128,0.07)':'rgba(248,113,113,0.07)', border:`1px solid ${r.status==='passed'?'rgba(74,222,128,0.2)':'rgba(248,113,113,0.2)'}`, borderRadius:10, overflow:'hidden' }}>
                  <div style={{ display:'flex', alignItems:'center', padding:'9px 12px', gap:10, cursor:'pointer' }} onClick={()=>setExpandedRes(expandedRes===i?null:i)}>
                    {r.status==='passed' ? <CheckCircle size={14} style={{ color:'#4ade80', flexShrink:0 }}/> : <XCircle size={14} style={{ color:'#f87171', flexShrink:0 }}/>}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ color:T.text, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.name}</div>
                      <div style={{ color:T.textMuted, fontSize:10 }}>{r.duration}ms {r.isRetest&&'· Retest'}</div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      {r.screenshot && <button onClick={e=>{e.stopPropagation();dlScreenshot(r.screenshot,r.name);}} style={{ background:'none', border:'none', color:T.accent, cursor:'pointer', padding:3 }} title="Download screenshot"><Image size={12}/></button>}
                      <button onClick={e=>{e.stopPropagation(); const rows=[RES_COLS.map(c=>c.label),RES_COLS.map(c=>getResVal(r,c.key))]; dl(toCSV(rows),`Result_${i+1}.csv`,'text/csv;charset=utf-8');}} style={{ background:'none', border:'none', color:T.textMuted, cursor:'pointer', padding:3 }} title="Download this result"><Download size={12}/></button>
                      {expandedRes===i?<ChevronUp size={13} style={{ color:T.textMuted }}/>:<ChevronDown size={13} style={{ color:T.textMuted }}/>}
                    </div>
                  </div>
                  {expandedRes===i && (
                    <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', padding:'10px 12px', background:T.bgHover }}>
                      {r.error && <div style={{ color:'#f87171', fontSize:12, background:'rgba(248,113,113,0.1)', borderRadius:7, padding:'7px 10px', marginBottom:10 }}>{r.error}</div>}
                      {r.screenshot && (
                        <div>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                            <span style={{ color:T.textMuted, fontSize:11, fontWeight:600, textTransform:'uppercase' }}>📸 Screenshot</span>
                            <button onClick={()=>dlScreenshot(r.screenshot,r.name)} style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:6, border:'1px solid rgba(0,212,170,0.3)', background:T.accentDim, color:T.accent, cursor:'pointer', fontSize:11 }}>
                              <Download size={10}/> Save PNG
                            </button>
                          </div>
                          <img src={r.screenshot} alt={r.name} style={{ width:'100%', maxWidth:'100%', borderRadius:8, border:'1px solid rgba(0,212,170,0.15)', cursor:'pointer', display:'block' }} onClick={()=>window.open(r.screenshot,'_blank')}/>
                          <p style={{ color:T.textMuted, fontSize:10, marginTop:4 }}>Click to open full size</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ══ BUGS ══ */}
          {section === 'bugs' && (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <h2 style={{ fontSize:18, fontWeight:800, color:T.text }}>Bug Reports ({bugs.length})</h2>
                <button onClick={()=>downloadCSV_Bugs(bugs)} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:7, border:'none', background:'#16a34a22', color:'#4ade80', cursor:'pointer', fontSize:12, fontWeight:600 }}>
                  <FileSpreadsheet size={12}/> Export CSV
                </button>
              </div>
              {bugs.length===0 ? (
                <div style={{ textAlign:'center', padding:'48px', color:T.textMuted }}><Bug size={32} style={{ margin:'0 auto 10px', display:'block', opacity:0.4 }}/><p style={{ fontSize:13 }}>No bugs reported.</p></div>
              ) : bugs.map((bug,i)=>(
                <div key={i} style={{ background:'rgba(248,113,113,0.05)', border:'1px solid rgba(248,113,113,0.2)', borderRadius:10, padding:'14px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                    <div>
                      <span style={{ color:'#f87171', fontFamily:'monospace', fontWeight:700, fontSize:12 }}>{bug.jiraKey}</span>
                      <div style={{ color:T.text, fontSize:13, fontWeight:600, marginTop:2 }}>{bug.summary}</div>
                    </div>
                    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                      <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background: bug.status==='Open'?'rgba(248,113,113,0.15)':'rgba(74,222,128,0.15)', color: bug.status==='Open'?'#f87171':'#4ade80' }}>{bug.status}</span>
                      <button onClick={()=>{ const rows=[['Key','Summary','Severity','Priority','Status','Description'],[bug.jiraKey||'',bug.summary||'',bug.severity||'',bug.priority||'',bug.status||'',bug.description||'']]; dl(toCSV(rows),`Bug_${(bug.jiraKey||'bug').replace(/[^a-z0-9]/gi,'_')}.csv`,'text/csv;charset=utf-8'); }} style={{ background:'none', border:'none', color:T.textMuted, cursor:'pointer', padding:3 }}><Download size={12}/></button>
                    </div>
                  </div>
                  {bug.description && <p style={{ color:T.textSub, fontSize:12, marginBottom:8 }}>{bug.description}</p>}
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap', fontSize:11 }}>
                    {[['Severity',bug.severity],['Priority',bug.priority],['Created',bug.createdAt?new Date(bug.createdAt).toLocaleDateString():'—']].map(([k,v])=>(
                      <span key={k} style={{ padding:'2px 8px', borderRadius:20, border:`1px solid ${T.border}`, color:T.textSub }}>{k}: {v}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ══ DOWNLOADS ══ */}
          {section === 'downloads' && (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <h2 style={{ fontSize:18, fontWeight:800, color:T.text }}>Download Reports</h2>

              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:12 }}>
                {[
                  { label:'HTML Report (with Screenshots)', icon:Eye, color:T.accent, bg:'rgba(0,212,170,0.1)', desc:'Self-contained HTML — screenshots embedded, steps column included', action:()=>downloadHTML(tests,results,bugs,selectedTCols,filter) },
                  { label:'Excel / CSV (3 files)', icon:FileSpreadsheet, color:'#4ade80', bg:'rgba(74,222,128,0.1)', desc:`Test Cases, Results, Bugs — with steps column`, action:dlAll },
                  { label:'PDF (via Print)', icon:Printer, color:'#f87171', bg:'rgba(248,113,113,0.1)', desc:'Formatted print-ready report — save as PDF', action:()=>downloadPDF(tests,results,bugs,selectedTCols,filter) },
                  { label:'Word (.doc)', icon:FileText, color:'#60a5fa', bg:'rgba(96,165,250,0.1)', desc:'Full report — opens in Word/Google Docs — steps column included', action:()=>downloadWord(tests,results,bugs,selectedTCols) },
                  { label:'XML', icon:FileCode, color:'#a78bfa', bg:'rgba(167,139,250,0.1)', desc:'Structured XML for TestRail, Xray, Zephyr import', action:()=>downloadXML(tests,results,bugs) },
                  { label:'Test Cases CSV', icon:FileSpreadsheet, color:'#4ade80', bg:'rgba(74,222,128,0.08)', desc:`${allTests.length} test cases with all steps`, action:()=>downloadCSV_TC(tests,selectedTCols,filter) },
                  { label:'Results CSV', icon:FileSpreadsheet, color:'#fbbf24', bg:'rgba(251,191,36,0.08)', desc:`${results.length} test results with durations`, action:()=>downloadCSV_Results(results,selectedRCols,filter) },
                  { label:'Bugs CSV', icon:Bug, color:'#f87171', bg:'rgba(248,113,113,0.08)', desc:`${bugs.length} bug reports`, action:()=>downloadCSV_Bugs(bugs) },
                ].map(opt => {
                  const Icon = opt.icon;
                  return (
                    <div key={opt.label} style={{ background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:14, padding:'18px', display:'flex', gap:14, alignItems:'flex-start' }}>
                      <div style={{ width:40, height:40, borderRadius:10, background:opt.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <Icon size={20} style={{ color:opt.color }}/>
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ color:T.text, fontWeight:700, fontSize:13, marginBottom:4 }}>{opt.label}</div>
                        <div style={{ color:T.textMuted, fontSize:11, marginBottom:10 }}>{opt.desc}</div>
                        <button onClick={opt.action} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:8, border:'none', background:opt.bg, color:opt.color, cursor:'pointer', fontSize:12, fontWeight:700, width:'100%', justifyContent:'center' }}>
                          <Download size={12}/> Download
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Per-type CSV */}
              <div style={{ background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:14, padding:'18px' }}>
                <h3 style={{ color:T.text, fontSize:14, fontWeight:700, marginBottom:12 }}>Download by Test Type</h3>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:8 }}>
                  {TYPES.map(type => {
                    const list = tests[type]||[];
                    if (!list.length) return null;
                    return (
                      <button key={type} onClick={()=>{
                        const rows = [
                          ['Test ID','Title','Priority','Preconditions','Test Steps','Expected Result'],
                          ...list.map(t=>[t.id||'',t.name||'',t.priority||'',(t.preconditions||''),(t.testSteps||'').split(' | ').map((s,i)=>`${i+1}. ${s}`).join('\n'),t.expectedResult||''])
                        ];
                        dl(toCSV(rows), `TestItNow_${type.toUpperCase()}.csv`, 'text/csv;charset=utf-8');
                      }} style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 12px', borderRadius:9, border:`1px solid ${T.border}`, background:T.bgHover, color:T.textSub, cursor:'pointer', fontSize:12, transition:'all 0.15s' }}
                      onMouseEnter={e=>{ e.currentTarget.style.borderColor=TYPE_COLORS[type]+'55'; e.currentTarget.style.color=TYPE_COLORS[type]; }}
                      onMouseLeave={e=>{ e.currentTarget.style.borderColor='rgba(255,255,255,0.08)'; e.currentTarget.style.color='#94a3b8'; }}>
                        <Download size={12}/> <span style={{ textTransform:'uppercase', fontWeight:600 }}>{type}</span>
                        <span style={{ marginLeft:'auto', fontFamily:'monospace', fontWeight:700 }}>{list.length}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Screenshots gallery */}
              {results.some(r=>r.screenshot) && (
                <div style={{ background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:14, padding:'18px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                    <h3 style={{ color:T.text, fontSize:14, fontWeight:700 }}>Screenshots ({results.filter(r=>r.screenshot).length})</h3>
                    <button onClick={()=>results.filter(r=>r.screenshot).forEach((r,i)=>setTimeout(()=>dlScreenshot(r.screenshot,r.name),i*300))}
                      style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:7, border:'1px solid rgba(0,212,170,0.3)', background:T.accentDim, color:T.accent, cursor:'pointer', fontSize:12, fontWeight:600 }}>
                      <Download size={12}/> Download All PNGs
                    </button>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:10 }}>
                    {results.filter(r=>r.screenshot).map((r,i)=>(
                      <div key={i} style={{ position:'relative', borderRadius:8, overflow:'hidden', border:`1px solid ${T.border}` }}
                        onMouseEnter={e=>e.currentTarget.querySelector('.ss-overlay').style.opacity='1'}
                        onMouseLeave={e=>e.currentTarget.querySelector('.ss-overlay').style.opacity='0'}>
                        <img src={r.screenshot} alt={r.name} style={{ width:'100%', display:'block', cursor:'pointer' }} onClick={()=>window.open(r.screenshot,'_blank')}/>
                        <div className="ss-overlay" style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.6)', opacity:0, transition:'opacity 0.2s', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8 }}>
                          <span style={{ color: r.status==='passed'?'#4ade80':'#f87171', fontSize:12, fontWeight:700 }}>{(r.status||'').toUpperCase()}</span>
                          <button onClick={e=>{e.stopPropagation();dlScreenshot(r.screenshot,r.name);}} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 14px', borderRadius:7, border:'none', background:T.accent, color:'#0a0f1e', cursor:'pointer', fontSize:12, fontWeight:700 }}>
                            <Download size={11}/> PNG
                          </button>
                        </div>
                        <div style={{ padding:'6px 8px', background:T.sidebar }}>
                          <p style={{ color:T.textSub, fontSize:11, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ TEMPLATES ══ */}
          {section === 'templates' && (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <h2 style={{ fontSize:18, fontWeight:800, color:T.text }}>Templates</h2>

              {/* Upload */}
              <div style={{ background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:14, padding:'18px' }}>
                <h3 style={{ color:T.text, fontSize:14, fontWeight:700, marginBottom:8 }}>Upload Your Template</h3>
                <p style={{ color:T.textMuted, fontSize:12, marginBottom:14 }}>Upload a CSV with your column names — we'll map our data to your format and export.</p>
                <label style={{ display:'block', border:'2px dashed rgba(0,212,170,0.2)', borderRadius:12, padding:'28px', textAlign:'center', cursor:'pointer', marginBottom:12, transition:'border-color 0.2s' }}
                  onMouseEnter={e=>e.target.style.borderColor='rgba(0,212,170,0.5)'}
                  onMouseLeave={e=>e.target.style.borderColor='rgba(0,212,170,0.2)'}>
                  <Upload size={28} style={{ color:T.textMuted, display:'block', margin:'0 auto 8px' }}/>
                  <p style={{ color:T.textSub, fontSize:13 }}>Click to upload CSV template</p>
                  <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleTemplate} style={{ display:'none' }}/>
                </label>
                {templateName && (
                  <div style={{ background:T.accentDim, border:'1px solid rgba(0,212,170,0.25)', borderRadius:9, padding:'10px 14px', marginBottom:10, display:'flex', alignItems:'center', gap:10 }}>
                    <CheckCircle size={15} style={{ color:T.accent }}/>
                    <span style={{ color:T.accent, fontSize:12, fontWeight:600 }}>Template ready: {templateName}</span>
                    <button onClick={dlWithTemplate} style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6, padding:'5px 12px', borderRadius:7, border:'none', background:T.accent, color:'#0a0f1e', cursor:'pointer', fontSize:12, fontWeight:700 }}>
                      <Download size={11}/> Export
                    </button>
                  </div>
                )}
              </div>

              {/* Download templates */}
              <div style={{ background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:14, padding:'18px' }}>
                <h3 style={{ color:T.text, fontSize:14, fontWeight:700, marginBottom:12 }}>Download Template Files</h3>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  {[
                    { label:'Test Cases Template', desc:'ID, Title, Type, Priority, Steps, Expected', fn:()=>dl('\uFEFF'+toCSV([['Test Case ID','Title','Description','Type','Priority','Preconditions','Test Steps','Test Data','Expected Result','URL'],['TC-001','Login with valid credentials','Test login','ui','Critical','Login page open','1. Enter email | 2. Enter password | 3. Click Login','Email: test@test.com','Login succeeds | Redirect to dashboard','https://app.com/login']]), 'TestCases_Template.csv','text/csv;charset=utf-8') },
                    { label:'Results Template', desc:'ID, Name, Status, Duration, Error', fn:()=>dl('\uFEFF'+toCSV([['Test ID','Test Name','Type','Status','Duration (ms)','Timestamp','Error Message'],['TC-001','Login valid','ui','passed','1234','2024-06-15 10:30','']]), 'Results_Template.csv','text/csv;charset=utf-8') },
                    { label:'Bug Report Template', desc:'Key, Summary, Severity, Priority, Steps', fn:()=>dl('\uFEFF'+toCSV([['Bug Key','Summary','Severity','Priority','Status','Description'],['BUG-001','Login button broken on mobile','Major','High','Open','Login button unresponsive on iOS Safari']]), 'BugReport_Template.csv','text/csv;charset=utf-8') },
                    { label:'Import Template', desc:'Use to import existing test cases', fn:()=>dl('\uFEFF'+toCSV([['Test Case ID','Title','Description','Type','Priority','Test Steps','Expected Result'],['TC-001','Sample Test','Description','api','High','1. Do step 1 | 2. Do step 2','Result expected']]), 'Import_Template.csv','text/csv;charset=utf-8') },
                  ].map(t=>(
                    <div key={t.label} style={{ background:T.bgHover, border:`1px solid ${T.border}`, borderRadius:10, padding:'14px' }}>
                      <div style={{ color:T.text, fontSize:13, fontWeight:600, marginBottom:4 }}>{t.label}</div>
                      <div style={{ color:T.textMuted, fontSize:11, marginBottom:10 }}>{t.desc}</div>
                      <button onClick={t.fn} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:7, border:`1px solid ${T.border}`, background:T.bgHover, color:T.textSub, cursor:'pointer', fontSize:12, width:'100%', justifyContent:'center' }}>
                        <Download size={11}/> Download
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
