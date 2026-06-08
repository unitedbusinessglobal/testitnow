// ============================================================
// ReportsPage.jsx — Full reports & downloads page
// Formats: Excel (CSV), PDF, Word (DOCX-style HTML), XML
// All generation happens in the browser — no server needed
// ============================================================

import React, { useState, useMemo } from 'react';
import {
  Download, FileSpreadsheet, FileText, FileCode, File,
  CheckCircle, XCircle, Clock, AlertTriangle, Filter,
  ChevronDown, ChevronUp, ArrowLeft, Bug, BarChart2,
  Printer, Eye, Search,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// DOWNLOAD HELPERS
// ─────────────────────────────────────────────────────────────

function triggerDownload(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── CSV / Excel ───────────────────────────────────────────────
function toCSV(rows) {
  return '\uFEFF' + rows.map(r =>
    r.map(c => {
      const s = String(c ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')
  ).join('\r\n');
}

function downloadExcel(tests, results, bugs) {
  // Sheet 1 — Test Cases
  const tcRows = [
    ['TestItNow — Test Cases Report'],
    [`Generated: ${new Date().toLocaleString()}`],
    [],
    ['Test ID','Title','Type','Priority','Status','Description','Preconditions','Test Steps','Expected Result'],
  ];
  Object.entries(tests).forEach(([type, list]) =>
    list.forEach(t => tcRows.push([
      t.id || '', t.name || '', type.toUpperCase(), t.priority || 'Medium',
      t.status || 'Draft', t.description || '', t.preconditions || '',
      t.testSteps || '', t.expectedResult || '',
    ]))
  );
  triggerDownload(toCSV(tcRows), 'TestItNow_TestCases.csv', 'text/csv;charset=utf-8');

  // Sheet 2 — Results (separate file)
  if (results.length) {
    const resRows = [
      ['TestItNow — Test Results Report'],
      [`Generated: ${new Date().toLocaleString()}`],
      [],
      ['Test ID','Test Name','Type','Status','Duration (ms)','Timestamp','Error Message'],
    ];
    results.forEach(r => resRows.push([
      r.id || '', r.name || '', r.type || '',
      (r.status || '').toUpperCase(), r.duration || 0,
      r.timestamp ? new Date(r.timestamp).toLocaleString() : '',
      r.error || '',
    ]));
    setTimeout(() => triggerDownload(toCSV(resRows), 'TestItNow_Results.csv', 'text/csv;charset=utf-8'), 300);
  }

  // Sheet 3 — Bugs
  if (bugs.length) {
    const bugRows = [
      ['TestItNow — Bug Reports'],
      [`Generated: ${new Date().toLocaleString()}`],
      [],
      ['Bug Key','Summary','Severity','Priority','Status','Created At','Description'],
    ];
    bugs.forEach(b => bugRows.push([
      b.jiraKey || '', b.summary || '', b.severity || '', b.priority || '',
      b.status || '', b.createdAt ? new Date(b.createdAt).toLocaleString() : '',
      b.description || '',
    ]));
    setTimeout(() => triggerDownload(toCSV(bugRows), 'TestItNow_Bugs.csv', 'text/csv;charset=utf-8'), 600);
  }
}

// ── PDF (via browser print) ───────────────────────────────────
function downloadPDF(tests, results, bugs, filter) {
  const allTests = Object.entries(tests).flatMap(([type, list]) =>
    list.map(t => ({ ...t, type }))
  ).filter(t => !filter.type || t.type === filter.type)
   .filter(t => !filter.priority || t.priority === filter.priority)
   .filter(t => !filter.status || t.status === filter.status);

  const passRate = results.length
    ? Math.round((results.filter(r => r.status === 'passed').length / results.length) * 100)
    : 0;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>TestItNow Report</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1e293b; padding: 20px; }
  h1 { font-size: 22px; color: #1e3a5f; border-bottom: 3px solid #3b82f6; padding-bottom: 8px; margin-bottom: 16px; }
  h2 { font-size: 15px; color: #1e3a5f; margin: 20px 0 8px; border-left: 4px solid #3b82f6; padding-left: 8px; }
  .meta { display: flex; gap: 20px; margin-bottom: 16px; }
  .meta-box { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 16px; text-align: center; }
  .meta-box .val { font-size: 22px; font-weight: bold; color: #1e3a5f; }
  .meta-box .lbl { font-size: 10px; color: #64748b; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10px; }
  th { background: #1e3a5f; color: white; padding: 6px 8px; text-align: left; font-size: 10px; }
  td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  tr:nth-child(even) td { background: #f8fafc; }
  .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; }
  .badge-critical { background: #fee2e2; color: #dc2626; }
  .badge-high     { background: #ffedd5; color: #ea580c; }
  .badge-medium   { background: #fef9c3; color: #ca8a04; }
  .badge-low      { background: #dcfce7; color: #16a34a; }
  .badge-passed   { background: #dcfce7; color: #16a34a; }
  .badge-failed   { background: #fee2e2; color: #dc2626; }
  .badge-draft    { background: #f1f5f9; color: #475569; }
  .footer { text-align: center; color: #94a3b8; font-size: 9px; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px; }
  @media print { body { padding: 10px; } @page { margin: 1cm; } }
</style>
</head>
<body>
<h1>🧪 TestItNow — Full Test Report</h1>
<p style="color:#64748b;margin-bottom:12px">Generated: ${new Date().toLocaleString()} | Domain: ${filter.domain || 'All'}</p>

<div class="meta">
  <div class="meta-box"><div class="val">${allTests.length}</div><div class="lbl">Total Tests</div></div>
  <div class="meta-box"><div class="val" style="color:#16a34a">${results.filter(r=>r.status==='passed').length}</div><div class="lbl">Passed</div></div>
  <div class="meta-box"><div class="val" style="color:#dc2626">${results.filter(r=>r.status==='failed').length}</div><div class="lbl">Failed</div></div>
  <div class="meta-box"><div class="val" style="color:#2563eb">${passRate}%</div><div class="lbl">Pass Rate</div></div>
  <div class="meta-box"><div class="val" style="color:#7c3aed">${bugs.length}</div><div class="lbl">Bugs</div></div>
</div>

<h2>Test Cases (${allTests.length})</h2>
<table>
  <thead><tr><th>#</th><th>ID</th><th>Title</th><th>Type</th><th>Priority</th><th>Expected Result</th></tr></thead>
  <tbody>
    ${allTests.map((t,i) => `
    <tr>
      <td>${i+1}</td>
      <td style="font-family:monospace;white-space:nowrap">${t.id||''}</td>
      <td>${t.name||''}</td>
      <td style="text-transform:uppercase;font-size:9px">${t.type||''}</td>
      <td><span class="badge badge-${(t.priority||'').toLowerCase()}">${t.priority||''}</span></td>
      <td style="color:#475569">${(t.expectedResult||'').substring(0,80)}${(t.expectedResult||'').length>80?'…':''}</td>
    </tr>`).join('')}
  </tbody>
</table>

${results.length ? `
<h2>Test Results (${results.length})</h2>
<table>
  <thead><tr><th>#</th><th>ID</th><th>Test Name</th><th>Type</th><th>Status</th><th>Duration</th><th>Error</th></tr></thead>
  <tbody>
    ${results.map((r,i) => `
    <tr>
      <td>${i+1}</td>
      <td style="font-family:monospace">${r.id||''}</td>
      <td>${r.name||''}</td>
      <td style="text-transform:uppercase;font-size:9px">${r.type||''}</td>
      <td><span class="badge badge-${r.status||''}">${(r.status||'').toUpperCase()}</span></td>
      <td>${r.duration||0}ms</td>
      <td style="color:#dc2626;font-size:9px">${r.error||''}</td>
    </tr>`).join('')}
  </tbody>
</table>` : ''}

${bugs.length ? `
<h2>Bug Reports (${bugs.length})</h2>
<table>
  <thead><tr><th>#</th><th>Key</th><th>Summary</th><th>Severity</th><th>Priority</th><th>Status</th></tr></thead>
  <tbody>
    ${bugs.map((b,i) => `
    <tr>
      <td>${i+1}</td>
      <td style="font-family:monospace">${b.jiraKey||''}</td>
      <td>${b.summary||''}</td>
      <td><span class="badge badge-${(b.severity||'').toLowerCase()}">${b.severity||''}</span></td>
      <td><span class="badge badge-${(b.priority||'').toLowerCase()}">${b.priority||''}</span></td>
      <td>${b.status||''}</td>
    </tr>`).join('')}
  </tbody>
</table>` : ''}

<div class="footer">TestItNow Professional Testing Framework — ${window.location.origin}</div>
</body>
</html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 500);
}

// ── Word / DOCX-style HTML ────────────────────────────────────
function downloadWord(tests, results, bugs) {
  const allTests = Object.entries(tests).flatMap(([type, list]) =>
    list.map(t => ({ ...t, type }))
  );

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:w="urn:schemas-microsoft-com:office:word"
  xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>TestItNow Test Report</title>
<!--[if gte mso 9]>
<xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml>
<![endif]-->
<style>
  body   { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #1e293b; margin: 2cm; }
  h1     { font-size: 20pt; color: #1e3a5f; border-bottom: 2px solid #3b82f6; padding-bottom: 6pt; }
  h2     { font-size: 14pt; color: #1e3a5f; margin-top: 18pt; border-left: 4px solid #3b82f6; padding-left: 8pt; }
  h3     { font-size: 12pt; color: #334155; margin-top: 12pt; }
  p      { margin: 4pt 0; line-height: 1.5; }
  table  { border-collapse: collapse; width: 100%; margin: 10pt 0; font-size: 9pt; }
  th     { background: #1e3a5f; color: white; padding: 5pt 8pt; text-align: left; border: 1px solid #1e3a5f; }
  td     { padding: 4pt 8pt; border: 1px solid #cbd5e1; vertical-align: top; }
  tr:nth-child(even) td { background: #f8fafc; }
  .meta  { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 10pt; margin: 10pt 0; border-radius: 4pt; }
  .label { font-weight: bold; color: #475569; }
</style>
</head>
<body>
<h1>🧪 TestItNow — Test Report</h1>
<div class="meta">
  <p><span class="label">Generated:</span> ${new Date().toLocaleString()}</p>
  <p><span class="label">Total Test Cases:</span> ${allTests.length}</p>
  <p><span class="label">Total Results:</span> ${results.length} (${results.filter(r=>r.status==='passed').length} passed, ${results.filter(r=>r.status==='failed').length} failed)</p>
  <p><span class="label">Bug Reports:</span> ${bugs.length}</p>
</div>

<h2>1. Test Cases</h2>
${['ui','api','security','performance','database','unit'].map(type => {
  const list = tests[type] || [];
  if (!list.length) return '';
  return `<h3>1.${['ui','api','security','performance','database','unit'].indexOf(type)+1} ${type.toUpperCase()} Tests (${list.length})</h3>
<table>
  <thead><tr><th>ID</th><th>Title</th><th>Priority</th><th>Preconditions</th><th>Test Steps</th><th>Expected Result</th></tr></thead>
  <tbody>
    ${list.map(t => `<tr>
      <td style="font-family:Courier New;white-space:nowrap">${t.id||''}</td>
      <td>${t.name||''}</td>
      <td>${t.priority||''}</td>
      <td>${t.preconditions||''}</td>
      <td>${(t.testSteps||'').replace(/\|/g,'<br>')}</td>
      <td>${t.expectedResult||''}</td>
    </tr>`).join('')}
  </tbody>
</table>`;
}).join('')}

${results.length ? `
<h2>2. Test Execution Results</h2>
<table>
  <thead><tr><th>ID</th><th>Test Name</th><th>Type</th><th>Status</th><th>Duration (ms)</th><th>Timestamp</th><th>Error</th></tr></thead>
  <tbody>
    ${results.map(r => `<tr>
      <td style="font-family:Courier New">${r.id||''}</td>
      <td>${r.name||''}</td>
      <td>${(r.type||'').toUpperCase()}</td>
      <td style="font-weight:bold;color:${r.status==='passed'?'#16a34a':'#dc2626'}">${(r.status||'').toUpperCase()}</td>
      <td>${r.duration||0}</td>
      <td>${r.timestamp ? new Date(r.timestamp).toLocaleString() : ''}</td>
      <td style="color:#dc2626">${r.error||''}</td>
    </tr>`).join('')}
  </tbody>
</table>` : ''}

${bugs.length ? `
<h2>3. Bug Reports</h2>
<table>
  <thead><tr><th>Key</th><th>Summary</th><th>Severity</th><th>Priority</th><th>Status</th><th>Description</th></tr></thead>
  <tbody>
    ${bugs.map(b => `<tr>
      <td style="font-family:Courier New">${b.jiraKey||''}</td>
      <td>${b.summary||''}</td>
      <td>${b.severity||''}</td>
      <td>${b.priority||''}</td>
      <td>${b.status||''}</td>
      <td>${b.description||''}</td>
    </tr>`).join('')}
  </tbody>
</table>` : ''}

</body></html>`;

  triggerDownload(html, 'TestItNow_Report.doc',
    'application/msword');
}

// ── XML ───────────────────────────────────────────────────────
function escapeXml(s) {
  return String(s||'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
    .replace(/'/g,'&apos;');
}

function downloadXML(tests, results, bugs) {
  const allTests = Object.entries(tests).flatMap(([type, list]) =>
    list.map(t => ({ ...t, type }))
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<TestReport generated="${new Date().toISOString()}" tool="TestItNow">

  <Summary>
    <TotalTestCases>${allTests.length}</TotalTestCases>
    <TotalResults>${results.length}</TotalResults>
    <Passed>${results.filter(r=>r.status==='passed').length}</Passed>
    <Failed>${results.filter(r=>r.status==='failed').length}</Failed>
    <PassRate>${results.length ? Math.round((results.filter(r=>r.status==='passed').length/results.length)*100) : 0}%</PassRate>
    <BugCount>${bugs.length}</BugCount>
  </Summary>

  <TestCases count="${allTests.length}">
${allTests.map(t => `    <TestCase id="${escapeXml(t.id)}" type="${escapeXml(t.type)}">
      <Title>${escapeXml(t.name)}</Title>
      <Priority>${escapeXml(t.priority)}</Priority>
      <Status>${escapeXml(t.status||'Draft')}</Status>
      <Description>${escapeXml(t.description)}</Description>
      <Preconditions>${escapeXml(t.preconditions)}</Preconditions>
      <TestSteps>${escapeXml(t.testSteps)}</TestSteps>
      <TestData>${escapeXml(t.testData)}</TestData>
      <ExpectedResult>${escapeXml(t.expectedResult)}</ExpectedResult>
    </TestCase>`).join('\n')}
  </TestCases>

  <TestResults count="${results.length}">
${results.map(r => `    <Result testId="${escapeXml(r.id)}">
      <TestName>${escapeXml(r.name)}</TestName>
      <Type>${escapeXml(r.type)}</Type>
      <Status>${escapeXml(r.status)}</Status>
      <DurationMs>${r.duration||0}</DurationMs>
      <Timestamp>${r.timestamp||''}</Timestamp>
      <IsRetest>${r.isRetest||false}</IsRetest>
      <ErrorMessage>${escapeXml(r.error)}</ErrorMessage>
    </Result>`).join('\n')}
  </TestResults>

  <BugReports count="${bugs.length}">
${bugs.map(b => `    <Bug key="${escapeXml(b.jiraKey)}">
      <Summary>${escapeXml(b.summary)}</Summary>
      <Description>${escapeXml(b.description)}</Description>
      <Severity>${escapeXml(b.severity)}</Severity>
      <Priority>${escapeXml(b.priority)}</Priority>
      <Status>${escapeXml(b.status)}</Status>
      <CreatedAt>${b.createdAt||''}</CreatedAt>
    </Bug>`).join('\n')}
  </BugReports>

</TestReport>`;

  triggerDownload(xml, 'TestItNow_Report.xml', 'application/xml;charset=utf-8');
}

// ─────────────────────────────────────────────────────────────
// MAIN REPORTS PAGE COMPONENT
// ─────────────────────────────────────────────────────────────
export default function ReportsPage({ tests, results, bugs, onBack }) {
  const [activeSection, setActiveSection] = useState('overview');
  const [filter, setFilter]               = useState({ type: '', priority: '', status: '', search: '' });
  const [expandedTest, setExpandedTest]   = useState(null);
  const [expandedResult, setExpandedResult] = useState(null);

  const TYPES = ['ui','api','security','performance','database','unit'];

  const allTests = useMemo(() =>
    Object.entries(tests).flatMap(([type, list]) => list.map(t => ({ ...t, type }))),
    [tests]
  );

  const filteredTests = useMemo(() => allTests.filter(t => {
    if (filter.type     && t.type     !== filter.type)     return false;
    if (filter.priority && t.priority !== filter.priority) return false;
    if (filter.status   && (t.status||'Draft') !== filter.status) return false;
    if (filter.search   && !`${t.name}${t.id}${t.description}`.toLowerCase().includes(filter.search.toLowerCase())) return false;
    return true;
  }), [allTests, filter]);

  const summary = useMemo(() => ({
    total:    results.length,
    passed:   results.filter(r => r.status === 'passed').length,
    failed:   results.filter(r => r.status === 'failed').length,
    passRate: results.length ? Math.round((results.filter(r=>r.status==='passed').length / results.length) * 100) : 0,
    duration: results.reduce((s,r) => s + (r.duration||0), 0),
  }), [results]);

  const priorityCount = useMemo(() => {
    const c = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    allTests.forEach(t => { if (c[t.priority] !== undefined) c[t.priority]++; });
    return c;
  }, [allTests]);

  const typeCount = useMemo(() => {
    const c = {};
    TYPES.forEach(t => { c[t] = (tests[t]||[]).length; });
    return c;
  }, [tests]);

  const priorityColor = p => ({
    Critical: 'bg-red-900/40 text-red-300 border-red-700/40',
    High:     'bg-orange-900/40 text-orange-300 border-orange-700/40',
    Medium:   'bg-yellow-900/40 text-yellow-300 border-yellow-700/40',
    Low:      'bg-green-900/40 text-green-300 border-green-700/40',
  }[p] || 'bg-slate-700 text-slate-300 border-slate-600');

  const statusColor = s => ({
    passed: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/40',
    failed: 'bg-red-900/40 text-red-300 border-red-700/40',
    Draft:  'bg-slate-700/40 text-slate-400 border-slate-600',
  }[s] || 'bg-slate-700/40 text-slate-400 border-slate-600');

  // ── Download buttons config ───────────────────────────────
  const downloadOptions = [
    {
      label: 'Excel / CSV',
      icon:  FileSpreadsheet,
      color: 'bg-emerald-600 hover:bg-emerald-500',
      desc:  '3 sheets: Test Cases, Results, Bugs',
      action: () => downloadExcel(tests, results, bugs),
    },
    {
      label: 'PDF',
      icon:  File,
      color: 'bg-red-600 hover:bg-red-500',
      desc:  'Formatted report — opens print dialog',
      action: () => downloadPDF(tests, results, bugs, filter),
    },
    {
      label: 'Word (.doc)',
      icon:  FileText,
      color: 'bg-blue-600 hover:bg-blue-500',
      desc:  'Full report with tables — opens in Word',
      action: () => downloadWord(tests, results, bugs),
    },
    {
      label: 'XML',
      icon:  FileCode,
      color: 'bg-purple-600 hover:bg-purple-500',
      desc:  'Structured XML for tool integration',
      action: () => downloadXML(tests, results, bugs),
    },
  ];

  const navItems = [
    { id: 'overview',  label: 'Overview',    icon: BarChart2  },
    { id: 'testcases', label: 'Test Cases',   icon: FileText   },
    { id: 'results',   label: 'Results',      icon: CheckCircle },
    { id: 'bugs',      label: 'Bugs',         icon: Bug        },
    { id: 'download',  label: 'Downloads',    icon: Download   },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 font-sans">
      {/* ── Top Bar ── */}
      <div className="bg-slate-800/80 border-b border-slate-700 px-6 py-3 flex items-center justify-between sticky top-0 z-10 backdrop-blur">
        <div className="flex items-center gap-4">
          <button onClick={onBack}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors">
            <ArrowLeft size={16} /> Back
          </button>
          <div className="w-px h-5 bg-slate-600" />
          <h1 className="text-white font-bold text-lg flex items-center gap-2">
            <FileText className="text-blue-400" size={20} />
            Reports & Downloads
          </h1>
        </div>

        {/* Quick download all */}
        <button
          onClick={() => {
            downloadExcel(tests, results, bugs);
            setTimeout(() => downloadXML(tests, results, bugs), 400);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium"
        >
          <Download size={15} /> Download All
        </button>
      </div>

      <div className="flex">
        {/* ── Sidebar Nav ── */}
        <div className="w-48 min-h-screen bg-slate-800/50 border-r border-slate-700 p-3 shrink-0">
          <nav className="space-y-1">
            {navItems.map(item => {
              const Icon = item.icon;
              return (
                <button key={item.id} onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                    activeSection === item.id
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                  }`}>
                  <Icon size={15} />
                  {item.label}
                  {item.id === 'testcases' && allTests.length > 0 && (
                    <span className="ml-auto text-xs bg-slate-600 text-slate-300 px-1.5 py-0.5 rounded-full">
                      {allTests.length}
                    </span>
                  )}
                  {item.id === 'results' && results.length > 0 && (
                    <span className="ml-auto text-xs bg-slate-600 text-slate-300 px-1.5 py-0.5 rounded-full">
                      {results.length}
                    </span>
                  )}
                  {item.id === 'bugs' && bugs.length > 0 && (
                    <span className="ml-auto text-xs bg-red-700 text-red-200 px-1.5 py-0.5 rounded-full">
                      {bugs.length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* ── Main Content ── */}
        <div className="flex-1 p-6 space-y-6 overflow-auto">

          {/* ══ OVERVIEW ══ */}
          {activeSection === 'overview' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-white">Report Overview</h2>

              {/* Stats grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Tests',  value: allTests.length, color: 'text-white'         },
                  { label: 'Passed',       value: summary.passed,  color: 'text-emerald-400'   },
                  { label: 'Failed',       value: summary.failed,  color: 'text-red-400'       },
                  { label: 'Pass Rate',    value: `${summary.passRate}%`, color: 'text-blue-400' },
                  { label: 'Bug Reports',  value: bugs.length,     color: 'text-red-400'       },
                  { label: 'Avg Duration', value: results.length ? `${Math.round(summary.duration/results.length)}ms` : '—', color: 'text-yellow-400' },
                  { label: 'Critical',     value: priorityCount.Critical, color: 'text-red-400' },
                  { label: 'High',         value: priorityCount.High,     color: 'text-orange-400' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 text-center">
                    <div className={`text-2xl font-bold ${color}`}>{value}</div>
                    <div className="text-xs text-slate-400 mt-1">{label}</div>
                  </div>
                ))}
              </div>

              {/* By type */}
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-slate-300 mb-4">Test Cases by Type</h3>
                <div className="space-y-2">
                  {TYPES.map(type => {
                    const count = typeCount[type] || 0;
                    const pct   = allTests.length ? Math.round((count/allTests.length)*100) : 0;
                    return (
                      <div key={type} className="flex items-center gap-3">
                        <span className="text-xs text-slate-400 w-24 uppercase font-mono">{type}</span>
                        <div className="flex-1 bg-slate-700 rounded-full h-2">
                          <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-slate-300 w-12 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Priority breakdown */}
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-slate-300 mb-4">Priority Distribution</h3>
                <div className="grid grid-cols-4 gap-3">
                  {Object.entries(priorityCount).map(([p, c]) => (
                    <div key={p} className={`rounded-xl border p-3 text-center ${priorityColor(p)}`}>
                      <div className="text-xl font-bold">{c}</div>
                      <div className="text-xs mt-1">{p}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══ TEST CASES ══ */}
          {activeSection === 'testcases' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-xl font-bold text-white">
                  Test Cases <span className="text-slate-400 font-normal text-base">({filteredTests.length} of {allTests.length})</span>
                </h2>
                <button onClick={() => downloadExcel(tests, results, bugs)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm">
                  <Download size={14} /> Export CSV
                </button>
              </div>

              {/* Filters */}
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-48">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    value={filter.search}
                    onChange={e => setFilter(p => ({...p, search: e.target.value}))}
                    placeholder="Search tests…"
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                {[
                  { key: 'type',     label: 'Type',     options: ['', ...TYPES] },
                  { key: 'priority', label: 'Priority', options: ['', 'Critical','High','Medium','Low'] },
                ].map(({ key, label, options }) => (
                  <select key={key} value={filter[key]}
                    onChange={e => setFilter(p => ({...p, [key]: e.target.value}))}
                    className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500">
                    {options.map(o => <option key={o} value={o}>{o || `All ${label}s`}</option>)}
                  </select>
                ))}
                {(filter.type||filter.priority||filter.search) && (
                  <button onClick={() => setFilter({ type:'', priority:'', status:'', search:'' })}
                    className="px-3 py-1.5 border border-slate-600 text-slate-400 rounded-lg text-sm hover:bg-slate-700">
                    Clear
                  </button>
                )}
              </div>

              {/* Test case list */}
              <div className="space-y-2">
                {filteredTests.length === 0 ? (
                  <div className="text-center py-16 text-slate-500">
                    <AlertTriangle size={40} className="mx-auto mb-3 text-slate-600" />
                    <p>No test cases found. Try adjusting your filters or analyze a website first.</p>
                  </div>
                ) : (
                  filteredTests.map(test => (
                    <div key={test.id}
                      className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden">
                      {/* Header row */}
                      <div
                        className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-700/40"
                        onClick={() => setExpandedTest(expandedTest === test.id ? null : test.id)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs font-mono text-slate-500 shrink-0">{test.id}</span>
                          <span className="text-sm text-slate-200 font-medium truncate">{test.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${priorityColor(test.priority)}`}>
                            {test.priority}
                          </span>
                          <span className="text-xs px-2 py-0.5 bg-slate-700 text-slate-400 rounded-full uppercase">
                            {test.type}
                          </span>
                          {expandedTest === test.id
                            ? <ChevronUp size={14} className="text-slate-400" />
                            : <ChevronDown size={14} className="text-slate-400" />
                          }
                        </div>
                      </div>

                      {/* Expanded details */}
                      {expandedTest === test.id && (
                        <div className="border-t border-slate-700 p-4 space-y-3 bg-slate-900/30">
                          {[
                            ['Description',    test.description],
                            ['Preconditions',  test.preconditions],
                            ['Test Steps',     test.testSteps],
                            ['Test Data',      test.testData],
                            ['Expected Result',test.expectedResult],
                          ].filter(([,v]) => v).map(([label, value]) => (
                            <div key={label}>
                              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</div>
                              <div className="text-sm text-slate-300 bg-slate-800/60 rounded-lg p-2.5 whitespace-pre-wrap">
                                {String(value).split(' | ').map((step, i) => (
                                  <div key={i} className={i > 0 ? 'mt-1' : ''}>{step}</div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ══ RESULTS ══ */}
          {activeSection === 'results' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-xl font-bold text-white">
                  Test Results <span className="text-slate-400 font-normal text-base">({results.length})</span>
                </h2>
                <button onClick={() => downloadExcel(tests, results, bugs)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm">
                  <Download size={14} /> Export CSV
                </button>
              </div>

              {results.length === 0 ? (
                <div className="text-center py-16 text-slate-500">
                  <Clock size={40} className="mx-auto mb-3 text-slate-600" />
                  <p>No results yet. Run your tests first.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {results.map((r, i) => (
                    <div key={i} className={`border rounded-xl overflow-hidden ${
                      r.status === 'passed'
                        ? 'bg-emerald-900/10 border-emerald-700/30'
                        : 'bg-red-900/10 border-red-700/30'
                    }`}>
                      <div
                        className="flex items-center justify-between p-3 cursor-pointer"
                        onClick={() => setExpandedResult(expandedResult === i ? null : i)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {r.status === 'passed'
                            ? <CheckCircle size={16} className="text-emerald-400 shrink-0" />
                            : <XCircle    size={16} className="text-red-400 shrink-0" />
                          }
                          <span className="text-xs font-mono text-slate-500 shrink-0">{r.id}</span>
                          <span className="text-sm text-slate-200 font-medium truncate">{r.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className="text-xs text-slate-400">{r.duration}ms</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-bold ${statusColor(r.status)}`}>
                            {(r.status||'').toUpperCase()}
                          </span>
                          {r.isRetest && (
                            <span className="text-xs px-2 py-0.5 bg-blue-900/40 text-blue-300 border border-blue-700/40 rounded-full">
                              Retest
                            </span>
                          )}
                          {expandedResult === i
                            ? <ChevronUp size={14} className="text-slate-400" />
                            : <ChevronDown size={14} className="text-slate-400" />
                          }
                        </div>
                      </div>

                      {expandedResult === i && (
                        <div className="border-t border-slate-700/50 p-4 space-y-3 bg-slate-900/30">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                            {[
                              ['Type',      r.type?.toUpperCase()],
                              ['Duration',  `${r.duration}ms`],
                              ['Timestamp', r.timestamp ? new Date(r.timestamp).toLocaleString() : '—'],
                              ['Retest',    r.isRetest ? 'Yes' : 'No'],
                            ].map(([k,v]) => (
                              <div key={k} className="bg-slate-800/60 rounded-lg p-2">
                                <div className="text-slate-500 mb-0.5">{k}</div>
                                <div className="text-slate-200 font-medium">{v}</div>
                              </div>
                            ))}
                          </div>
                          {r.error && (
                            <div>
                              <div className="text-xs font-semibold text-red-400 mb-1">Error</div>
                              <div className="text-sm text-red-300 bg-red-900/20 rounded-lg p-2.5">{r.error}</div>
                            </div>
                          )}
                          {r.screenshot && (
                            <div>
                              <div className="text-xs font-semibold text-slate-400 mb-1">Screenshot</div>
                              <div className="relative group">
                                <img src={r.screenshot} alt="Screenshot"
                                  className="w-full max-w-sm rounded-lg border border-slate-600 cursor-pointer hover:opacity-90"
                                  onClick={() => window.open(r.screenshot, '_blank')}
                                />
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <a href={r.screenshot} download={`${r.name}_screenshot.png`}
                                    className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded shadow">
                                    <Download size={10} /> Save
                                  </a>
                                </div>
                              </div>
                              <p className="text-xs text-slate-500 mt-1">Click to view full size · Hover to download</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══ BUGS ══ */}
          {activeSection === 'bugs' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-white">
                Bug Reports <span className="text-slate-400 font-normal text-base">({bugs.length})</span>
              </h2>
              {bugs.length === 0 ? (
                <div className="text-center py-16 text-slate-500">
                  <Bug size={40} className="mx-auto mb-3 text-slate-600" />
                  <p>No bugs reported yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {bugs.map((bug, i) => (
                    <div key={i} className="bg-red-900/10 border border-red-700/30 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <span className="text-xs font-mono font-bold text-red-400">{bug.jiraKey}</span>
                          <h3 className="text-sm font-semibold text-slate-200 mt-0.5">{bug.summary}</h3>
                        </div>
                        <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border font-medium ${
                          bug.status === 'Open' ? 'bg-red-900/40 text-red-300 border-red-700/40' : 'bg-emerald-900/40 text-emerald-300 border-emerald-700/40'
                        }`}>{bug.status}</span>
                      </div>
                      {bug.description && (
                        <p className="text-xs text-slate-400 mb-3">{bug.description}</p>
                      )}
                      <div className="flex flex-wrap gap-2 text-xs">
                        {[
                          ['Severity', bug.severity, priorityColor(bug.severity)],
                          ['Priority', bug.priority, priorityColor(bug.priority)],
                          ['Created',  bug.createdAt ? new Date(bug.createdAt).toLocaleDateString() : '—', 'bg-slate-700/40 text-slate-400 border-slate-600'],
                        ].map(([k,v,cls]) => (
                          <span key={k} className={`px-2 py-0.5 rounded-full border ${cls}`}>{k}: {v}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══ DOWNLOADS ══ */}
          {activeSection === 'download' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-white">Download Reports</h2>
              <p className="text-slate-400 text-sm">
                Download your complete test suite, results, and bug reports in multiple formats.
                All files are generated instantly in your browser.
              </p>

              {/* Format cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {downloadOptions.map(opt => {
                  const Icon = opt.icon;
                  return (
                    <div key={opt.label}
                      className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 flex items-start gap-4">
                      <div className={`p-3 rounded-xl ${opt.color} shrink-0`}>
                        <Icon size={24} className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white mb-1">{opt.label}</h3>
                        <p className="text-xs text-slate-400 mb-3">{opt.desc}</p>
                        <button onClick={opt.action}
                          className={`flex items-center gap-2 px-4 py-2 ${opt.color} text-white rounded-lg text-sm font-medium w-full justify-center`}>
                          <Download size={14} /> Download {opt.label}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Individual test case downloads */}
              <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5">
                <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                  <Filter size={16} className="text-blue-400" /> Download by Type
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {TYPES.map(type => {
                    const list = tests[type] || [];
                    if (!list.length) return null;
                    return (
                      <button key={type}
                        onClick={() => {
                          const rows = [
                            ['Test ID','Title','Priority','Description','Preconditions','Test Steps','Expected Result'],
                            ...list.map(t => [t.id||'',t.name||'',t.priority||'',t.description||'',t.preconditions||'',t.testSteps||'',t.expectedResult||''])
                          ];
                          triggerDownload(toCSV(rows), `TestItNow_${type.toUpperCase()}_Tests.csv`, 'text/csv;charset=utf-8');
                        }}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm transition-colors"
                      >
                        <Download size={13} className="text-slate-400" />
                        <span className="uppercase font-mono text-xs">{type}</span>
                        <span className="ml-auto text-xs text-slate-400">{list.length}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Screenshots */}
              {results.some(r => r.screenshot) && (
                <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5">
                  <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                    <Eye size={16} className="text-purple-400" /> Screenshots ({results.filter(r=>r.screenshot).length})
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {results.filter(r => r.screenshot).map((r, i) => (
                      <div key={i} className="group relative rounded-lg overflow-hidden border border-slate-600">
                        <img src={r.screenshot} alt={r.name}
                          className="w-full rounded cursor-pointer hover:opacity-80"
                          onClick={() => window.open(r.screenshot, '_blank')}
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                          <span className={`text-xs font-bold ${r.status==='passed'?'text-emerald-400':'text-red-400'}`}>
                            {(r.status||'').toUpperCase()}
                          </span>
                          <a href={r.screenshot}
                            download={`${(r.name||'test').replace(/[^a-z0-9]/gi,'_')}_${i+1}.png`}
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg"
                            onClick={e => e.stopPropagation()}
                          >
                            <Download size={12} /> Download
                          </a>
                        </div>
                        <div className="p-2 bg-slate-800/80">
                          <p className="text-xs text-slate-400 truncate">{r.name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
