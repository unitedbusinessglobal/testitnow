// ============================================================
// AppShell.jsx — Main app after login
// Layout: Left sidebar nav + Center AI-style analyze hero +
//         Right panel for actions (add test, template, results)
// ============================================================

import React, { useState, useRef, useCallback } from 'react';
import {
  Sparkles, Play, Download, FileText, FileSpreadsheet,
  FileCode, Upload, Plus, Trash2, CheckCircle, XCircle,
  Bug, RotateCcw, ChevronDown, ChevronUp, Search,
  BarChart2, Settings, LogOut, Crown, User, Globe,
  Github, GitBranch, Database, Lock, Monitor, Code,
  TrendingUp, Zap, AlertTriangle, X, ChevronRight,
  Layers, Terminal, FileUp, Cloud, LayoutDashboard,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────
const C = {
  bg:       '#0a0f1e',
  sidebar:  '#0d1530',
  panel:    '#0f1a35',
  card:     '#111b3a',
  border:   'rgba(0,212,170,0.12)',
  teal:     '#00d4aa',
  tealDim:  'rgba(0,212,170,0.12)',
  blue:     '#3b82f6',
  white:    '#f0f4ff',
  gray:     '#6b7fa3',
  grayLight:'#94a3b8',
};

const TYPES = ['ui','api','security','performance','database','unit'];
const TYPE_ICONS = { ui:Monitor, api:Globe, security:Lock, performance:TrendingUp, database:Database, unit:Code };

// ─────────────────────────────────────────────────────────────
// SIDEBAR
// ─────────────────────────────────────────────────────────────
function Sidebar({ activePanel, onPanel, userProfile, userPlan, onLogout, onUpgrade, onReports, totalTests, results }) {
  const navItems = [
    { id:'analyze',  icon:Sparkles,       label:'Analyze',    badge: null },
    { id:'tests',    icon:Layers,         label:'Test Cases', badge: totalTests > 0 ? totalTests : null },
    { id:'results',  icon:CheckCircle,    label:'Results',    badge: results.length > 0 ? results.length : null },
    { id:'create',   icon:Plus,           label:'Create Test', badge: null },
    { id:'template', icon:FileUp,         label:'Templates',  badge: null },
    { id:'integrations', icon:Cloud,      label:'Integrations', badge: null },
  ];

  return (
    <aside style={{
      width: 220, flexShrink: 0, background: C.sidebar,
      borderRight: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column',
      height: '100vh', position: 'sticky', top: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 16px 16px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: `linear-gradient(135deg, ${C.teal}, ${C.blue})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
          }}>⚡</div>
          <span style={{ color: C.white, fontWeight: 800, fontSize: 16, letterSpacing: '-0.5px' }}>
            TestIt<span style={{ color: C.teal }}>Now</span>
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
        <div style={{ marginBottom: 4 }}>
          <div style={{ color: C.gray, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '6px 8px 4px' }}>
            Workspace
          </div>
          {navItems.map(item => {
            const Icon = item.icon;
            const active = activePanel === item.id;
            return (
              <button key={item.id} onClick={() => onPanel(item.id)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: active ? C.tealDim : 'transparent',
                color: active ? C.teal : C.grayLight,
                fontSize: 13, fontWeight: active ? 600 : 400,
                marginBottom: 2, transition: 'all 0.15s',
                borderLeft: `2px solid ${active ? C.teal : 'transparent'}`,
              }}>
                <Icon size={15} />
                <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
                {item.badge && (
                  <span style={{
                    background: active ? C.teal : 'rgba(255,255,255,0.08)',
                    color: active ? C.bg : C.gray,
                    fontSize: 10, fontWeight: 700,
                    padding: '1px 6px', borderRadius: 10,
                  }}>{item.badge}</span>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ color: C.gray, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '6px 8px 4px' }}>
            Reports
          </div>
          <button onClick={onReports} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'transparent', color: C.grayLight, fontSize: 13, marginBottom: 2,
            transition: 'all 0.15s',
          }}>
            <BarChart2 size={15} />
            <span>Reports & Export</span>
          </button>
        </div>
      </nav>

      {/* User footer */}
      <div style={{ borderTop: `1px solid ${C.border}`, padding: '12px 8px' }}>
        {userPlan === 'free' && (
          <button onClick={onUpgrade} style={{
            width: '100%', padding: '8px', borderRadius: 8, border: 'none',
            background: `linear-gradient(90deg, rgba(0,212,170,0.15), rgba(59,130,246,0.15))`,
            color: C.teal, fontSize: 12, fontWeight: 700, cursor: 'pointer', marginBottom: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <Crown size={13} /> Upgrade to Pro
          </button>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px' }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: `linear-gradient(135deg, ${C.teal}, ${C.blue})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: C.bg, flexShrink: 0,
          }}>
            {(userProfile?.name || 'U')[0].toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: C.white, fontSize: 12, fontWeight: 600, truncate: true, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {userProfile?.name || 'User'}
            </div>
            <div style={{ color: C.gray, fontSize: 10, textTransform: 'capitalize' }}>{userPlan} plan</div>
          </div>
          <button onClick={onLogout} style={{ background: 'none', border: 'none', color: C.gray, cursor: 'pointer', padding: 4 }}
            title="Logout">
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────
// AI ANALYZE HERO — center stage
// ─────────────────────────────────────────────────────────────
function AnalyzeHero({ onAnalyze, isGenerating, progress, progressMsg, totalTests }) {
  const [inputVal, setInputVal] = useState('');
  const [sourceType, setSourceType] = useState('url');
  const [repoOwner, setRepoOwner] = useState('');
  const [repoName, setRepoName] = useState('');
  const [branch, setBranch] = useState('main');
  const [token, setToken] = useState('');
  const [focused, setFocused] = useState(false);

  const sourceTypes = [
    { id:'url',    icon:'🌐', label:'Website URL' },
    { id:'github', icon:'🐙', label:'GitHub' },
    { id:'gitlab', icon:'🦊', label:'GitLab' },
    { id:'upload', icon:'📁', label:'Upload Code' },
  ];

  const placeholders = {
    url:    'https://yourapp.com — paste any website URL',
    github: 'Enter owner/repo or full GitHub URL',
    gitlab: 'Enter namespace/project or full GitLab URL',
    upload: 'Upload your source files using the button below',
  };

  const handleSubmit = () => {
    if (isGenerating) return;
    if (sourceType === 'url') {
      if (!inputVal.trim()) return;
      let url = inputVal.trim();
      if (!url.startsWith('http')) url = 'https://' + url;
      onAnalyze({ type: 'url', url });
    } else if (sourceType === 'github' || sourceType === 'gitlab') {
      let owner = repoOwner, repo = repoName;
      // parse "owner/repo" from input
      if (!owner && inputVal.includes('/')) {
        [owner, repo] = inputVal.trim().replace(/^https?:\/\/(github|gitlab)\.com\//, '').split('/');
      }
      if (!owner || !repo) return alert('Enter owner and repository name');
      onAnalyze({ type: 'repo', provider: sourceType, repoOwner: owner, repoName: repo, branch, accessToken: token });
    }
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter') handleSubmit(); };

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '40px 32px', minHeight: '100vh',
      background: C.bg,
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', top: '25%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 600, height: 300, borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(0,212,170,0.05) 0%, transparent 70%)',
        pointerEvents: 'none',
      }}/>

      {totalTests === 0 ? (
        // ── EMPTY STATE — big analyze prompt ──────────────────
        <div style={{ width: '100%', maxWidth: 680, textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(0,212,170,0.08)', border: `1px solid ${C.border}`,
            borderRadius: 20, padding: '5px 14px', marginBottom: 24,
          }}>
            <Sparkles size={12} style={{ color: C.teal }} />
            <span style={{ color: C.teal, fontSize: 12, fontWeight: 600, letterSpacing: '0.05em' }}>
              AI-POWERED TEST GENERATION
            </span>
          </div>

          <h1 style={{
            fontSize: 'clamp(28px,4vw,48px)', fontWeight: 900,
            color: C.white, letterSpacing: '-2px', marginBottom: 12, lineHeight: 1.1,
          }}>
            What would you like to test?
          </h1>
          <p style={{ color: C.gray, fontSize: 15, marginBottom: 40, lineHeight: 1.6 }}>
            Enter a website, GitHub repo, or upload your code.<br/>
            Get 1,000+ comprehensive test cases in seconds.
          </p>

          {/* Source type selector */}
          <div style={{
            display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16,
          }}>
            {sourceTypes.map(s => (
              <button key={s.id} onClick={() => setSourceType(s.id)} style={{
                padding: '7px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
                background: sourceType === s.id ? C.teal : 'rgba(255,255,255,0.05)',
                color: sourceType === s.id ? C.bg : C.grayLight,
                fontSize: 13, fontWeight: sourceType === s.id ? 700 : 400,
                transition: 'all 0.2s',
              }}>
                {s.icon} {s.label}
              </button>
            ))}
          </div>

          {/* Main input */}
          <div style={{
            background: C.card, border: `1.5px solid ${focused ? C.teal : C.border}`,
            borderRadius: 16, overflow: 'hidden',
            boxShadow: focused ? `0 0 0 3px rgba(0,212,170,0.12)` : 'none',
            transition: 'all 0.2s',
          }}>
            {(sourceType === 'url' || sourceType === 'github' || sourceType === 'gitlab') && (
              <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', gap: 12 }}>
                <span style={{ fontSize: 20 }}>
                  {sourceTypes.find(s => s.id === sourceType)?.icon}
                </span>
                <input
                  value={inputVal}
                  onChange={e => setInputVal(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  onKeyDown={handleKeyDown}
                  placeholder={placeholders[sourceType]}
                  disabled={isGenerating}
                  style={{
                    flex: 1, background: 'none', border: 'none', outline: 'none',
                    color: C.white, fontSize: 16, fontFamily: 'inherit',
                    '::placeholder': { color: C.gray },
                  }}
                />
                <button onClick={handleSubmit} disabled={isGenerating} style={{
                  background: isGenerating ? 'rgba(0,212,170,0.3)' : `linear-gradient(135deg, ${C.teal}, ${C.blue})`,
                  border: 'none', color: C.bg, padding: '10px 20px', borderRadius: 10,
                  fontSize: 14, fontWeight: 700, cursor: isGenerating ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                }}>
                  {isGenerating ? (
                    <><SpinnerInline /> Analyzing…</>
                  ) : (
                    <><Sparkles size={14} /> Analyze</>
                  )}
                </button>
              </div>
            )}

            {/* GitHub/GitLab extra fields */}
            {(sourceType === 'github' || sourceType === 'gitlab') && (
              <div style={{
                borderTop: `1px solid ${C.border}`,
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                gap: 0,
              }}>
                {[
                  { ph: 'Owner / namespace', val: repoOwner, set: setRepoOwner },
                  { ph: 'Repository name', val: repoName, set: setRepoName },
                  { ph: 'Branch (default: main)', val: branch, set: setBranch },
                ].map((f, i) => (
                  <input key={i} value={f.val} onChange={e => f.set(e.target.value)}
                    placeholder={f.ph} disabled={isGenerating}
                    style={{
                      background: 'none', border: 'none',
                      borderRight: i < 2 ? `1px solid ${C.border}` : 'none',
                      outline: 'none', color: C.white, fontSize: 13,
                      padding: '12px 16px', fontFamily: 'inherit',
                    }}/>
                ))}
              </div>
            )}

            {/* Upload */}
            {sourceType === 'upload' && (
              <label style={{ display: 'block', padding: '32px', textAlign: 'center', cursor: 'pointer' }}>
                <FileUp size={32} style={{ color: C.gray, marginBottom: 8 }} />
                <p style={{ color: C.grayLight, fontSize: 14 }}>Click to upload source files</p>
                <p style={{ color: C.gray, fontSize: 12, marginTop: 4 }}>JS, TS, Python, Go, Java, SQL, YAML…</p>
                <input type="file" multiple accept=".js,.ts,.jsx,.tsx,.py,.go,.java,.sql,.yaml,.yml,.md"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const files = Array.from(e.target.files);
                    const readers = files.map(f => new Promise(res => {
                      const r = new FileReader();
                      r.onload = ev => res({ filename: f.name, content: ev.target.result, size: f.size });
                      r.readAsText(f);
                    }));
                    Promise.all(readers).then(results => {
                      onAnalyze({ type: 'upload', files: results, label: files[0]?.name });
                    });
                  }}
                />
              </label>
            )}
          </div>

          {/* Progress */}
          {isGenerating && (
            <div style={{ marginTop: 20, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <SpinnerInline />
                <span style={{ color: C.grayLight, fontSize: 14 }}>{progressMsg || 'Analyzing…'}</span>
                <span style={{ color: C.teal, marginLeft: 'auto', fontSize: 13, fontFamily: 'monospace' }}>{progress}%</span>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 4, height: 4, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 4,
                  background: `linear-gradient(90deg, ${C.teal}, ${C.blue})`,
                  width: `${progress}%`, transition: 'width 0.5s ease',
                }}/>
              </div>
            </div>
          )}

          {/* Quick examples */}
          {!isGenerating && sourceType === 'url' && (
            <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <span style={{ color: C.gray, fontSize: 13 }}>Try:</span>
              {['https://github.com','https://vercel.com','your own URL'].map(ex => (
                <button key={ex} onClick={() => setInputVal(ex === 'your own URL' ? '' : ex)} style={{
                  background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
                  color: C.grayLight, padding: '4px 12px', borderRadius: 20,
                  fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  {ex}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        // ── HAS TESTS — compact header + stats ───────────────
        <div style={{ width: '100%', maxWidth: 680 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10,
              background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 16px' }}>
              <Sparkles size={14} style={{ color: C.teal }} />
              <input
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Analyze another URL or repo…"
                disabled={isGenerating}
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: C.white, fontSize: 14, fontFamily: 'inherit' }}
              />
            </div>
            <button onClick={handleSubmit} disabled={isGenerating} style={{
              background: `linear-gradient(135deg, ${C.teal}, ${C.blue})`,
              border: 'none', color: C.bg, padding: '11px 20px', borderRadius: 10,
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {isGenerating ? <SpinnerInline /> : <Sparkles size={13} />}
              {isGenerating ? 'Analyzing…' : 'Analyze'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SpinnerInline() {
  const [f, setF] = useState(0);
  const frames = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'];
  React.useEffect(() => {
    const t = setInterval(() => setF(n => (n+1) % frames.length), 80);
    return () => clearInterval(t);
  }, []);
  return <span style={{ color: C.teal, fontSize: 14 }}>{frames[f]}</span>;
}

// ─────────────────────────────────────────────────────────────
// RIGHT PANEL — context-sensitive
// ─────────────────────────────────────────────────────────────
function RightPanel({
  activePanel, tests, results, bugs, activeTab, setActiveTab,
  onAdd, onDelete, onRun, onReportBug, onRetest, onExport,
  onJiraImport, onJiraExport, onImport, isRunning, currentTest,
  totalTests, summary, canRun, showAds, freeRunsLeft,
}) {
  const TYPES = ['ui','api','security','performance','database','unit'];
  const TYPE_COLORS = { ui:'#3b82f6', api:'#00d4aa', security:'#f59e0b', performance:'#a78bfa', database:'#34d399', unit:'#fb7185' };
  const [expandedResult, setExpandedResult] = useState(null);
  const [expandedTest, setExpandedTest] = useState(null);

  if (activePanel === 'analyze') {
    // Right panel shows quick stats when we have tests
    if (totalTests === 0) return null;
    return (
      <RightPanelShell title="Test Suite">
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          {TYPES.map(type => (
            <div key={type} style={{
              background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px',
              borderTop: `2px solid ${TYPE_COLORS[type]}`,
            }}>
              <div style={{ color: TYPE_COLORS[type], fontFamily: 'monospace', fontSize: 18, fontWeight: 800 }}>
                {(tests[type]||[]).length}
              </div>
              <div style={{ color: C.gray, fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>{type}</div>
            </div>
          ))}
        </div>

        <button onClick={onRun} disabled={isRunning || !canRun} style={{
          width: '100%', padding: '12px', borderRadius: 10, border: 'none',
          background: isRunning || !canRun ? 'rgba(255,255,255,0.06)' : `linear-gradient(135deg, ${C.teal}, ${C.blue})`,
          color: isRunning || !canRun ? C.gray : C.bg,
          fontSize: 14, fontWeight: 700, cursor: isRunning || !canRun ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8,
        }}>
          <Play size={14} />
          {isRunning ? 'Running…' : `Run All ${totalTests} Tests`}
        </button>

        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onExport} style={miniBtn}>
            <FileSpreadsheet size={12} /> Export CSV
          </button>
          <button onClick={onJiraExport} style={miniBtn}>
            <Upload size={12} /> Jira
          </button>
        </div>

        {isRunning && currentTest && (
          <div style={{ marginTop: 12, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SpinnerInline />
              <div>
                <div style={{ color: C.white, fontSize: 12, fontWeight: 600 }}>{currentTest.name}</div>
                <div style={{ color: C.gray, fontSize: 11 }}>{currentTest.type}</div>
              </div>
            </div>
          </div>
        )}
      </RightPanelShell>
    );
  }

  if (activePanel === 'tests') {
    const allTests = TYPES.flatMap(type => (tests[type]||[]).map(t => ({...t, type})));
    return (
      <RightPanelShell title={`Test Cases (${totalTests})`} action={
        <button onClick={onRun} disabled={isRunning || !canRun} style={{
          padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
          background: `linear-gradient(135deg, ${C.teal}, ${C.blue})`,
          color: C.bg, fontSize: 12, fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <Play size={12}/> Run
        </button>
      }>
        {/* Type filter tabs */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
          {['all', ...TYPES].map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{
              padding: '4px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11,
              background: activeTab === t ? C.teal : 'rgba(255,255,255,0.06)',
              color: activeTab === t ? C.bg : C.gray, fontWeight: activeTab === t ? 700 : 400,
            }}>
              {t === 'all' ? `All (${totalTests})` : `${t} (${(tests[t]||[]).length})`}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }}>
          {(activeTab === 'all' ? allTests : (tests[activeTab]||[]).map(t=>({...t,type:activeTab}))).map(test => (
            <div key={test.id} style={{
              background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '8px 10px', gap: 8, cursor: 'pointer' }}
                onClick={() => setExpandedTest(expandedTest === test.id ? null : test.id)}>
                <div style={{ width: 3, height: 28, borderRadius: 2, background: TYPE_COLORS[test.type], flexShrink: 0 }}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: C.white, fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{test.name}</div>
                  <div style={{ color: C.gray, fontSize: 10 }}>{test.id}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4,
                    background: test.priority === 'Critical' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)',
                    color: test.priority === 'Critical' ? '#f87171' : C.gray }}>
                    {test.priority}
                  </span>
                  <button onClick={e => { e.stopPropagation(); onDelete(test.type, test.id); }}
                    style={{ background: 'none', border: 'none', color: C.gray, cursor: 'pointer', padding: 2 }}>
                    <Trash2 size={11}/>
                  </button>
                </div>
              </div>
              {expandedTest === test.id && (
                <div style={{ borderTop: `1px solid ${C.border}`, padding: '8px 10px', background: 'rgba(0,0,0,0.2)' }}>
                  {[['Steps', test.testSteps], ['Expected', test.expectedResult], ['Preconditions', test.preconditions]]
                    .filter(([,v]) => v).map(([label, value]) => (
                    <div key={label} style={{ marginBottom: 8 }}>
                      <div style={{ color: C.gray, fontSize: 10, textTransform: 'uppercase', fontWeight: 600, marginBottom: 3 }}>{label}</div>
                      <div style={{ color: C.grayLight, fontSize: 11, lineHeight: 1.6 }}>
                        {String(value).split(' | ').map((s,i) => <div key={i}>{s}</div>)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {totalTests === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: C.gray }}>
              <Layers size={32} style={{ marginBottom: 10, opacity: 0.4 }}/>
              <p style={{ fontSize: 13 }}>No test cases yet.</p>
              <p style={{ fontSize: 12, marginTop: 4 }}>Analyze a website to generate tests.</p>
            </div>
          )}
        </div>
      </RightPanelShell>
    );
  }

  if (activePanel === 'results') {
    return (
      <RightPanelShell title="Test Results">
        {results.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
            {[
              { label:'Passed', val:summary.passed, color:'#4ade80' },
              { label:'Failed', val:summary.failed, color:'#f87171' },
              { label:'Rate',   val:`${summary.passRate||0}%`, color:C.teal },
            ].map(s => (
              <div key={s.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px', textAlign: 'center' }}>
                <div style={{ color: s.color, fontWeight: 800, fontSize: 18, fontFamily: 'monospace' }}>{s.val}</div>
                <div style={{ color: C.gray, fontSize: 10 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
          {results.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: C.gray }}>
              <CheckCircle size={32} style={{ marginBottom: 10, opacity: 0.3 }}/>
              <p style={{ fontSize: 13 }}>No results yet. Run your tests.</p>
            </div>
          ) : results.map((r, i) => (
            <div key={i} style={{
              background: r.status === 'passed' ? 'rgba(74,222,128,0.06)' : 'rgba(248,113,113,0.06)',
              border: `1px solid ${r.status === 'passed' ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`,
              borderRadius: 8, overflow: 'hidden',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', cursor: 'pointer' }}
                onClick={() => setExpandedResult(expandedResult === i ? null : i)}>
                {r.status === 'passed'
                  ? <CheckCircle size={13} style={{ color:'#4ade80', flexShrink:0 }}/>
                  : <XCircle size={13} style={{ color:'#f87171', flexShrink:0 }}/>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: C.white, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                  <div style={{ color: C.gray, fontSize: 10 }}>{r.duration}ms</div>
                </div>
                {r.status === 'failed' && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={e => { e.stopPropagation(); onReportBug(r); }}
                      style={{ ...iconBtn, color:'#f87171' }} title="Report Bug">
                      <Bug size={11}/>
                    </button>
                    <button onClick={e => { e.stopPropagation(); onRetest(r); }}
                      style={{ ...iconBtn, color:C.blue }} title="Retest">
                      <RotateCcw size={11}/>
                    </button>
                  </div>
                )}
              </div>
              {expandedResult === i && r.screenshot && (
                <div style={{ padding: '0 10px 10px' }}>
                  <img src={r.screenshot} alt={r.name} style={{ width:'100%', borderRadius:6, border:`1px solid ${C.border}`, cursor:'pointer' }}
                    onClick={() => window.open(r.screenshot,'_blank')}/>
                  {r.error && <div style={{ color:'#f87171', fontSize:11, marginTop:6 }}>{r.error}</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      </RightPanelShell>
    );
  }

  if (activePanel === 'create') {
    return <CreateTestPanel onAdd={onAdd} />;
  }

  if (activePanel === 'template') {
    return <TemplatePanel onAdd={onAdd} />;
  }

  if (activePanel === 'integrations') {
    return <IntegrationsPanel onJiraImport={onJiraImport} onJiraExport={onJiraExport} onImport={onImport} />;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
// CREATE TEST PANEL
// ─────────────────────────────────────────────────────────────
function CreateTestPanel({ onAdd }) {
  const [type, setType] = useState('ui');
  const [data, setData] = useState({ id:'', name:'', description:'', priority:'High', preconditions:'', testSteps:'', testData:'', expectedResult:'' });
  const set = (k, v) => setData(p => ({...p, [k]:v}));

  const handle = () => {
    if (!data.name.trim()) return alert('Title is required');
    onAdd(type, { id: data.id || `TC-${type.toUpperCase()}-${Date.now()}`, name:data.name, description:data.description, priority:data.priority, preconditions:data.preconditions, testSteps:data.testSteps, testData:data.testData, expectedResult:data.expectedResult });
    setData({ id:'', name:'', description:'', priority:'High', preconditions:'', testSteps:'', testData:'', expectedResult:'' });
  };

  return (
    <RightPanelShell title="Create Test Case" action={
      <button onClick={handle} style={{ padding:'6px 14px', borderRadius:7, border:'none', cursor:'pointer', background:`linear-gradient(135deg,${C.teal},${C.blue})`, color:C.bg, fontSize:12, fontWeight:700 }}>
        + Add Test
      </button>
    }>
      <div style={{ display:'flex', flexDirection:'column', gap:10, overflowY:'auto', maxHeight:'calc(100vh - 200px)' }}>
        {/* Type */}
        <div>
          <label style={lbl}>Test Type</label>
          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
            {TYPES.map(t => (
              <button key={t} onClick={() => setType(t)} style={{
                padding:'5px 12px', borderRadius:20, border:'none', cursor:'pointer', fontSize:11,
                background: type===t ? C.teal : 'rgba(255,255,255,0.06)',
                color: type===t ? C.bg : C.gray, fontWeight: type===t ? 700 : 400,
              }}>{t.toUpperCase()}</button>
            ))}
          </div>
        </div>

        {[
          { key:'id',             label:'Test ID (optional)',       ph:'TC-UI-001', type:'text' },
          { key:'name',           label:'Title *',                  ph:'Login with valid credentials', type:'text' },
          { key:'description',    label:'Description',              ph:'Verify the login form works…', type:'textarea' },
          { key:'preconditions',  label:'Preconditions',            ph:'User is on login page | Form is visible', type:'textarea' },
          { key:'testSteps',      label:'Test Steps',               ph:'1. Enter email | 2. Enter password | 3. Click Login', type:'textarea' },
          { key:'testData',       label:'Test Data',                ph:'Email: test@test.com | Password: Pass123!', type:'text' },
          { key:'expectedResult', label:'Expected Result',          ph:'Login succeeds | Redirect to dashboard', type:'textarea' },
        ].map(f => (
          <div key={f.key}>
            <label style={lbl}>{f.label}</label>
            {f.type === 'textarea' ? (
              <textarea value={data[f.key]} onChange={e => set(f.key, e.target.value)} placeholder={f.ph} rows={3}
                style={inputStyle}/>
            ) : (
              <input value={data[f.key]} onChange={e => set(f.key, e.target.value)} placeholder={f.ph}
                style={inputStyle}/>
            )}
          </div>
        ))}

        <div>
          <label style={lbl}>Priority</label>
          <select value={data.priority} onChange={e => set('priority', e.target.value)} style={inputStyle}>
            {['Critical','High','Medium','Low'].map(p => <option key={p}>{p}</option>)}
          </select>
        </div>

        <button onClick={handle} style={{
          padding:'12px', borderRadius:10, border:'none', cursor:'pointer',
          background:`linear-gradient(135deg,${C.teal},${C.blue})`,
          color:C.bg, fontSize:14, fontWeight:700, marginTop:4,
        }}>
          + Add Test Case
        </button>
      </div>
    </RightPanelShell>
  );
}

// ─────────────────────────────────────────────────────────────
// TEMPLATE PANEL
// ─────────────────────────────────────────────────────────────
function TemplatePanel({ onAdd }) {
  const [dragOver, setDragOver] = useState(false);
  const [imported, setImported] = useState(0);

  const parseAndImport = (text) => {
    try {
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g,'').toLowerCase());
      const nameI = headers.findIndex(h => h.includes('title') || h.includes('name'));
      const typeI = headers.findIndex(h => h.includes('type'));
      const priI  = headers.findIndex(h => h.includes('priority'));
      const idI   = headers.findIndex(h => h === 'id' || h.includes('test case id') || h.includes('test id'));
      const descI = headers.findIndex(h => h.includes('description'));
      const stepsI = headers.findIndex(h => h.includes('steps'));
      const expI  = headers.findIndex(h => h.includes('expected'));

      const VALID = ['ui','api','security','performance','database','unit'];
      let count = 0;
      lines.slice(1).filter(l => l.trim()).forEach((line, i) => {
        const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g,''));
        const rawType = (vals[typeI]||'').toLowerCase();
        const type = VALID.includes(rawType) ? rawType : 'unit';
        onAdd(type, {
          id: vals[idI] || `TC-IMPORT-${Date.now()}-${i}`,
          name: vals[nameI] || `Imported Test ${i+1}`,
          description: vals[descI] || '',
          priority: vals[priI] || 'Medium',
          testSteps: vals[stepsI] || '',
          expectedResult: vals[expI] || '',
        });
        count++;
      });
      setImported(count);
    } catch(e) { alert('Could not parse CSV: ' + e.message); }
  };

  const handleFile = (file) => {
    const reader = new FileReader();
    reader.onload = e => parseAndImport(e.target.result);
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const rows = [
      ['Test Case ID','Title','Description','Type','Priority','Preconditions','Test Steps','Expected Result'],
      ['TC-001','Login with valid credentials','Test login form','ui','Critical','Login page open','1. Enter email | 2. Enter password | 3. Click Login','Login succeeds | Redirect to dashboard'],
      ['TC-002','GET /api/health → 200','API health check','api','High','Server running','Send GET /api/health | Check status 200','Status 200 | {"status":"ok"}'],
      ['TC-003','SQL injection in login','Security test','security','Critical','Login form visible',"Enter ' OR '1'='1 | Submit",'Input rejected | No DB error'],
    ];
    const csv = '\uFEFF' + rows.map(r => r.map(c => `"${c}"`).join(',')).join('\r\n');
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], {type:'text/csv'})),
      download: 'TestItNow_Template.csv',
    });
    a.click();
  };

  return (
    <RightPanelShell title="Import Templates">
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {/* Download template */}
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:'14px' }}>
          <div style={{ color:C.white, fontSize:13, fontWeight:600, marginBottom:6 }}>📥 Download Template</div>
          <p style={{ color:C.gray, fontSize:12, marginBottom:10 }}>Download our CSV template, fill it in, then upload below.</p>
          <button onClick={downloadTemplate} style={{ ...miniBtn, width:'100%', justifyContent:'center', padding:'9px' }}>
            <Download size={13}/> Download CSV Template
          </button>
        </div>

        {/* Upload area */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if(f) handleFile(f); }}
          style={{
            border: `2px dashed ${dragOver ? C.teal : C.border}`,
            borderRadius:12, padding:'32px 20px', textAlign:'center',
            background: dragOver ? 'rgba(0,212,170,0.05)' : 'transparent',
            transition:'all 0.2s', cursor:'pointer',
          }}>
          <FileUp size={28} style={{ color:dragOver?C.teal:C.gray, marginBottom:8 }}/>
          <p style={{ color:C.grayLight, fontSize:13, marginBottom:4 }}>Drag & drop CSV file here</p>
          <p style={{ color:C.gray, fontSize:12, marginBottom:12 }}>or</p>
          <label style={{ cursor:'pointer' }}>
            <span style={{
              padding:'8px 20px', borderRadius:8,
              background:`rgba(0,212,170,0.1)`, border:`1px solid ${C.border}`,
              color:C.teal, fontSize:13, fontWeight:600,
            }}>Browse files</span>
            <input type="file" accept=".csv,.txt" style={{ display:'none' }}
              onChange={e => { if(e.target.files[0]) handleFile(e.target.files[0]); e.target.value=''; }}/>
          </label>
        </div>

        {imported > 0 && (
          <div style={{ background:'rgba(0,212,170,0.08)', border:`1px solid rgba(0,212,170,0.25)`, borderRadius:8, padding:'10px 14px', display:'flex', alignItems:'center', gap:8 }}>
            <CheckCircle size={15} style={{ color:C.teal }}/>
            <span style={{ color:C.teal, fontSize:13, fontWeight:600 }}>{imported} test cases imported successfully!</span>
          </div>
        )}

        {/* Quick presets */}
        <div>
          <div style={{ color:C.gray, fontSize:11, textTransform:'uppercase', fontWeight:700, marginBottom:8 }}>Quick Presets</div>
          {[
            { label:'OWASP Security Suite', desc:'20 security tests covering OWASP Top 10', type:'security', count:20 },
            { label:'REST API Baseline', desc:'Basic CRUD tests for REST APIs', type:'api', count:15 },
            { label:'UI Smoke Tests', desc:'Essential UI checks for any web app', type:'ui', count:12 },
            { label:'Performance Benchmarks', desc:'Core Web Vitals and load tests', type:'performance', count:10 },
          ].map(preset => (
            <button key={preset.label} onClick={() => {
              for(let i=0;i<Math.min(preset.count,5);i++) {
                onAdd(preset.type, {
                  id:`PRESET-${preset.type.toUpperCase()}-${Date.now()}-${i}`,
                  name:`${preset.label} — Test ${i+1}`,
                  description:preset.desc, priority:'High',
                });
              }
              setImported(p => p + preset.count);
            }} style={{
              width:'100%', background:C.card, border:`1px solid ${C.border}`, borderRadius:8,
              padding:'10px 12px', marginBottom:6, cursor:'pointer', textAlign:'left',
              display:'flex', alignItems:'center', justifyContent:'space-between',
              transition:'border-color 0.15s',
            }}
            onMouseEnter={e=>e.currentTarget.style.borderColor='rgba(0,212,170,0.35)'}
            onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
              <div>
                <div style={{ color:C.white, fontSize:12, fontWeight:600 }}>{preset.label}</div>
                <div style={{ color:C.gray, fontSize:11 }}>{preset.desc}</div>
              </div>
              <span style={{ color:C.teal, fontSize:11, fontWeight:700, background:'rgba(0,212,170,0.1)', padding:'3px 8px', borderRadius:20 }}>
                +{preset.count}
              </span>
            </button>
          ))}
        </div>
      </div>
    </RightPanelShell>
  );
}

// ─────────────────────────────────────────────────────────────
// INTEGRATIONS PANEL
// ─────────────────────────────────────────────────────────────
function IntegrationsPanel({ onJiraImport, onJiraExport, onImport }) {
  return (
    <RightPanelShell title="Integrations">
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {[
          { icon:'🔵', name:'Jira', desc:'Import/export test cases', actions:[
            { label:'Import from Jira', fn: onJiraImport },
            { label:'Export to Jira',   fn: onJiraExport },
          ]},
          { icon:'☁️', name:'Azure DevOps', desc:'Sync with Azure Test Plans', actions:[
            { label:'Import from Azure', fn: onImport },
          ]},
          { icon:'📊', name:'Excel / CSV', desc:'Bulk import from spreadsheet', actions:[
            { label:'Import CSV', fn: onImport },
          ]},
        ].map(int => (
          <div key={int.name} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:'14px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <span style={{ fontSize:20 }}>{int.icon}</span>
              <div>
                <div style={{ color:C.white, fontSize:13, fontWeight:600 }}>{int.name}</div>
                <div style={{ color:C.gray, fontSize:11 }}>{int.desc}</div>
              </div>
            </div>
            <div style={{ display:'flex', gap:6 }}>
              {int.actions.map(a => (
                <button key={a.label} onClick={a.fn} style={{ ...miniBtn, flex:1, justifyContent:'center' }}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </RightPanelShell>
  );
}

// ─────────────────────────────────────────────────────────────
// SHARED SHELL
// ─────────────────────────────────────────────────────────────
function RightPanelShell({ title, children, action }) {
  return (
    <div style={{
      width: 340, flexShrink: 0,
      background: C.panel, borderLeft: `1px solid ${C.border}`,
      height: '100vh', display: 'flex', flexDirection: 'column',
      position: 'sticky', top: 0,
    }}>
      <div style={{ padding:'16px 16px 12px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <h2 style={{ color:C.white, fontSize:14, fontWeight:700 }}>{title}</h2>
        {action}
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'12px 14px' }}>
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLE CONSTANTS
// ─────────────────────────────────────────────────────────────
const miniBtn = {
  display:'flex', alignItems:'center', gap:6,
  padding:'7px 12px', borderRadius:7, border:`1px solid ${C.border}`,
  background:'rgba(255,255,255,0.04)', color:C.grayLight,
  fontSize:12, fontWeight:500, cursor:'pointer',
};

const iconBtn = {
  background:'none', border:'none', cursor:'pointer', padding:4,
};

const lbl = {
  display:'block', color:C.gray, fontSize:11,
  fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:5,
};

const inputStyle = {
  width:'100%', background:C.card, border:`1px solid ${C.border}`, borderRadius:8,
  color:C.white, fontSize:13, padding:'9px 12px', fontFamily:'inherit',
  outline:'none', resize:'vertical',
};

// ─────────────────────────────────────────────────────────────
// MAIN APP SHELL EXPORT
// ─────────────────────────────────────────────────────────────
export default function AppShell({
  // Auth
  userProfile, userPlan, freeRunsLeft, isAuthenticated,
  onLogout, onUpgrade, onReports,
  // Tests
  tests, results, bugs, activeTab, setActiveTab,
  onAdd, onDelete, onRun, onReportBug, onRetest,
  isRunning, currentTest, totalTests, summary, canRun,
  // Analysis
  onAnalyze, isGenerating, progress, progressMsg,
  // Integrations
  onExport, onJiraImport, onJiraExport, onImport,
  // Ads
  showAds,
}) {
  const [activePanel, setActivePanel] = useState('analyze');

  return (
    <div style={{
      display:'flex', minHeight:'100vh', background:C.bg,
      fontFamily:"-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
      color:C.white,
    }}>
      <style>{`
        * { box-sizing: border-box; margin:0; padding:0; }
        input::placeholder, textarea::placeholder { color: ${C.gray}; }
        input, textarea, select { box-sizing: border-box; }
        ::-webkit-scrollbar { width:5px; height:5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius:3px; }
        button:hover { opacity:0.88; }
      `}</style>

      {/* Left sidebar */}
      <Sidebar
        activePanel={activePanel}
        onPanel={setActivePanel}
        userProfile={userProfile}
        userPlan={userPlan}
        onLogout={onLogout}
        onUpgrade={onUpgrade}
        onReports={onReports}
        totalTests={totalTests}
        results={results}
      />

      {/* Center — AI analyze hero */}
      <main style={{ flex:1, position:'relative', overflowY:'auto' }}>
        <AnalyzeHero
          onAnalyze={onAnalyze}
          isGenerating={isGenerating}
          progress={progress}
          progressMsg={progressMsg}
          totalTests={totalTests}
        />

        {/* Test stats grid below hero when tests exist */}
        {totalTests > 0 && (
          <div style={{ padding:'0 32px 40px' }}>
            {/* Summary bar */}
            {results.length > 0 && (
              <div style={{
                display:'flex', gap:12, marginBottom:20, flexWrap:'wrap',
              }}>
                {[
                  { label:'Total', val:summary.total, color:C.white },
                  { label:'Passed', val:summary.passed, color:'#4ade80' },
                  { label:'Failed', val:summary.failed, color:'#f87171' },
                  { label:'Pass Rate', val:`${summary.passRate||0}%`, color:C.teal },
                  { label:'Duration', val:`${(summary.duration/1000).toFixed(1)}s`, color:C.blue },
                ].map(s => (
                  <div key={s.label} style={{
                    background:C.card, border:`1px solid ${C.border}`,
                    borderRadius:10, padding:'12px 20px', minWidth:100, textAlign:'center',
                  }}>
                    <div style={{ color:s.color, fontWeight:800, fontSize:22, fontFamily:'monospace' }}>{s.val}</div>
                    <div style={{ color:C.gray, fontSize:11, marginTop:2 }}>{s.label}</div>
                  </div>
                ))}

                {isRunning && currentTest && (
                  <div style={{
                    flex:1, background:'rgba(59,130,246,0.08)', border:`1px solid rgba(59,130,246,0.3)`,
                    borderRadius:10, padding:'12px 16px', display:'flex', alignItems:'center', gap:10,
                  }}>
                    <SpinnerInline />
                    <div>
                      <div style={{ color:C.white, fontSize:13, fontWeight:600 }}>{currentTest.name}</div>
                      <div style={{ color:C.gray, fontSize:11 }}>{currentTest.type}</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Type breakdown */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:10 }}>
              {TYPES.map(type => {
                const count = (tests[type]||[]).length;
                const TYPE_COLORS = { ui:'#3b82f6', api:'#00d4aa', security:'#f59e0b', performance:'#a78bfa', database:'#34d399', unit:'#fb7185' };
                const Icon = TYPE_ICONS[type];
                return (
                  <button key={type} onClick={() => { setActivePanel('tests'); setActiveTab(type); }} style={{
                    background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:'14px 16px',
                    cursor:'pointer', textAlign:'left', borderTop:`2px solid ${TYPE_COLORS[type]}`,
                    transition:'all 0.15s',
                  }}
                  onMouseEnter={e=>{ e.currentTarget.style.borderColor=TYPE_COLORS[type]; e.currentTarget.style.transform='translateY(-2px)'; }}
                  onMouseLeave={e=>{ e.currentTarget.style.borderColor=C.border; e.currentTarget.style.borderTopColor=TYPE_COLORS[type]; e.currentTarget.style.transform='translateY(0)'; }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                      <Icon size={15} style={{ color:TYPE_COLORS[type] }}/>
                      <span style={{ color:TYPE_COLORS[type], fontFamily:'monospace', fontWeight:800, fontSize:20 }}>{count}</span>
                    </div>
                    <div style={{ color:C.white, fontSize:12, fontWeight:600, textTransform:'uppercase' }}>{type}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Right panel */}
      <RightPanel
        activePanel={activePanel}
        tests={tests}
        results={results}
        bugs={bugs}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onAdd={onAdd}
        onDelete={onDelete}
        onRun={onRun}
        onReportBug={onReportBug}
        onRetest={onRetest}
        onExport={onExport}
        onJiraImport={onJiraImport}
        onJiraExport={onJiraExport}
        onImport={onImport}
        isRunning={isRunning}
        currentTest={currentTest}
        totalTests={totalTests}
        summary={summary}
        canRun={canRun}
        showAds={showAds}
        freeRunsLeft={freeRunsLeft}
      />
    </div>
  );
}
