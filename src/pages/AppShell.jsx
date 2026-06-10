// ============================================================
// AppShell.jsx — Full post-login app
// AI chatbot-style analyze center + sidebar + right panel
// Includes: test plans, script downloads, screenshots in reports,
//           OAuth for GitHub/GitLab/Azure DevOps
// ============================================================

import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles, Play, Download, FileText, FileSpreadsheet,
  FileCode, Upload, Plus, Trash2, CheckCircle, XCircle,
  Bug, RotateCcw, ChevronDown, ChevronUp, Search,
  BarChart2, LogOut, Crown, Globe, Github, GitBranch,
  Database, Lock, Monitor, Code, TrendingUp, X,
  Layers, FileUp, Cloud, Terminal, Image, Package,
  RefreshCw, Clock, Copy, ExternalLink, AlertTriangle,
  Zap, Settings,
} from 'lucide-react';
import { getAllTestPlans, generateScript } from '../lib/scriptGenerator';

// ── Design tokens ─────────────────────────────────────────────
const C = {
  bg:       '#0a0f1e',
  sidebar:  '#0d1530',
  panel:    '#0f1a35',
  card:     '#111b3a',
  border:   'rgba(0,212,170,0.12)',
  teal:     '#00d4aa',
  tealDim:  'rgba(0,212,170,0.1)',
  blue:     '#3b82f6',
  white:    '#f0f4ff',
  gray:     '#6b7fa3',
  grayLight:'#94a3b8',
};

const TYPES = ['ui','api','security','performance','database','unit'];
const TYPE_COLORS = { ui:'#3b82f6', api:'#00d4aa', security:'#f59e0b', performance:'#a78bfa', database:'#34d399', unit:'#fb7185' };
const TYPE_ICONS  = { ui:Monitor, api:Globe, security:Lock, performance:TrendingUp, database:Database, unit:Code };

// ── Download helper ───────────────────────────────────────────
function dl(content, filename, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href:url, download:filename, style:'display:none' });
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 300);
}

function dlScreenshot(dataUrl, name) {
  if (!dataUrl) return;
  const a = Object.assign(document.createElement('a'), {
    href: dataUrl, download: `${(name||'screenshot').replace(/[^a-z0-9]/gi,'_')}.png`, style:'display:none',
  });
  document.body.appendChild(a); a.click();
  setTimeout(() => document.body.removeChild(a), 300);
}

// ─────────────────────────────────────────────────────────────
// SPINNER
// ─────────────────────────────────────────────────────────────
function Spinner() {
  const [f, setF] = useState(0);
  const frames = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'];
  useEffect(() => {
    const t = setInterval(() => setF(n => (n+1)%frames.length), 80);
    return () => clearInterval(t);
  }, []);
  return <span style={{ color:C.teal, fontSize:14, fontFamily:'monospace' }}>{frames[f]}</span>;
}

// ─────────────────────────────────────────────────────────────
// SIDEBAR
// ─────────────────────────────────────────────────────────────
function Sidebar({ active, setActive, userProfile, userPlan, onLogout, onUpgrade, onReports, totalTests, results }) {
  const nav = [
    { id:'analyze',      icon:Sparkles,    label:'Analyze',      badge:null },
    { id:'tests',        icon:Layers,      label:'Test Cases',   badge:totalTests||null },
    { id:'results',      icon:CheckCircle, label:'Results',      badge:results.length||null },
    { id:'plans',        icon:Package,     label:'Test Plans',   badge:null },
    { id:'create',       icon:Plus,        label:'Create Test',  badge:null },
    { id:'template',     icon:FileUp,      label:'Templates',    badge:null },
    { id:'integrations', icon:Cloud,       label:'Integrations', badge:null },
  ];

  return (
    <aside style={{ width:220, flexShrink:0, background:C.sidebar, borderRight:`1px solid ${C.border}`, display:'flex', flexDirection:'column', height:'100vh', position:'sticky', top:0 }}>
      {/* Logo */}
      <div style={{ padding:'20px 16px 14px', borderBottom:`1px solid ${C.border}` }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:30, height:30, borderRadius:8, background:`linear-gradient(135deg,${C.teal},${C.blue})`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15 }}>⚡</div>
          <span style={{ color:C.white, fontWeight:800, fontSize:16, letterSpacing:'-0.5px' }}>TestIt<span style={{ color:C.teal }}>Now</span></span>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex:1, padding:'10px 8px', overflowY:'auto' }}>
        <div style={{ color:C.gray, fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', padding:'6px 8px 4px' }}>Workspace</div>
        {nav.map(item => {
          const Icon = item.icon;
          const on   = active === item.id;
          return (
            <button key={item.id} onClick={() => setActive(item.id)} style={{
              width:'100%', display:'flex', alignItems:'center', gap:10,
              padding:'8px 10px', borderRadius:8, border:'none', cursor:'pointer',
              background: on ? C.tealDim : 'transparent',
              color: on ? C.teal : C.grayLight,
              fontSize:13, fontWeight: on ? 600 : 400, marginBottom:2,
              borderLeft:`2px solid ${on ? C.teal : 'transparent'}`,
              transition:'all 0.15s',
            }}>
              <Icon size={14}/>
              <span style={{ flex:1, textAlign:'left' }}>{item.label}</span>
              {item.badge ? <span style={{ background: on ? C.teal : 'rgba(255,255,255,0.08)', color: on ? C.bg : C.gray, fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:10 }}>{item.badge}</span> : null}
            </button>
          );
        })}

        <div style={{ marginTop:14 }}>
          <div style={{ color:C.gray, fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', padding:'6px 8px 4px' }}>Reports</div>
          <button onClick={onReports} style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:8, border:'none', cursor:'pointer', background:'transparent', color:C.grayLight, fontSize:13 }}>
            <BarChart2 size={14}/> Reports & Export
          </button>
        </div>
      </nav>

      {/* User */}
      <div style={{ borderTop:`1px solid ${C.border}`, padding:'10px 8px' }}>
        {userPlan === 'free' && (
          <button onClick={onUpgrade} style={{ width:'100%', padding:'8px', borderRadius:8, border:'none', background:`linear-gradient(90deg,rgba(0,212,170,0.15),rgba(59,130,246,0.15))`, color:C.teal, fontSize:12, fontWeight:700, cursor:'pointer', marginBottom:8, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
            <Crown size={13}/> Upgrade to Pro
          </button>
        )}
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 8px' }}>
          <div style={{ width:28, height:28, borderRadius:'50%', background:`linear-gradient(135deg,${C.teal},${C.blue})`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:C.bg, flexShrink:0 }}>
            {(userProfile?.name||'U')[0].toUpperCase()}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ color:C.white, fontSize:12, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{userProfile?.name||'User'}</div>
            <div style={{ color:C.gray, fontSize:10, textTransform:'capitalize' }}>{userPlan} plan</div>
          </div>
          <button onClick={onLogout} style={{ background:'none', border:'none', color:C.gray, cursor:'pointer', padding:4 }} title="Sign out"><LogOut size={13}/></button>
        </div>
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────
// ANALYZE HERO — center stage
// ─────────────────────────────────────────────────────────────
function AnalyzeHero({ onAnalyze, isGenerating, progress, progressMsg, totalTests, setActive, activeTab, setActiveTab, tests, results, summary, isRunning, currentTest, onRun, canRun }) {
  const [url,         setUrl]         = useState('');
  const [srcType,     setSrcType]     = useState('url');
  const [owner,       setOwner]       = useState('');
  const [repo,        setRepo]        = useState('');
  const [branch,      setBranch]      = useState('main');
  const [token,       setToken]       = useState('');
  const [focused,     setFocused]     = useState(false);
  const [oauthStatus, setOauthStatus] = useState(null); // { provider, user }

  const srcTabs = [
    { id:'url',    icon:'🌐', label:'Website' },
    { id:'github', icon:'🐙', label:'GitHub' },
    { id:'gitlab', icon:'🦊', label:'GitLab' },
    { id:'azure',  icon:'☁️', label:'Azure DevOps' },
    { id:'upload', icon:'📁', label:'Upload' },
  ];

  // ── OAuth sign-in handlers ────────────────────────────────
  const handleOAuth = (provider) => {
    const clientIds = {
      github: process.env.REACT_APP_GITHUB_CLIENT_ID || 'YOUR_GITHUB_CLIENT_ID',
      gitlab: process.env.REACT_APP_GITLAB_CLIENT_ID || 'YOUR_GITLAB_CLIENT_ID',
      azure:  process.env.REACT_APP_AZURE_CLIENT_ID  || 'YOUR_AZURE_CLIENT_ID',
    };
    const redirectUri = encodeURIComponent(`${window.location.origin}/oauth/callback`);
    const urls = {
      github: `https://github.com/login/oauth/authorize?client_id=${clientIds.github}&scope=repo,read:user&redirect_uri=${redirectUri}&state=github`,
      gitlab: `https://gitlab.com/oauth/authorize?client_id=${clientIds.gitlab}&redirect_uri=${redirectUri}&response_type=code&scope=read_repository+read_user&state=gitlab`,
      azure:  `https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize?client_id=${clientIds.azure}&response_type=code&redirect_uri=${redirectUri}&scope=vso.work+vso.code&state=azure`,
    };
    // Open OAuth popup
    const popup = window.open(urls[provider], `${provider}_oauth`, 'width=600,height=700,scrollbars=yes');
    // Listen for token back from popup
    const handler = (e) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === 'oauth_success' && e.data.provider === provider) {
        setToken(e.data.token || '');
        setOauthStatus({ provider, user: e.data.user || '' });
        window.removeEventListener('message', handler);
        if (popup) popup.close();
      }
    };
    window.addEventListener('message', handler);
    // Fallback: if no client ID configured, show instructions
    if (clientIds[provider].includes('YOUR_')) {
      setTimeout(() => {
        if (popup) popup.close();
        alert(`To enable ${provider} OAuth:\n1. Create an OAuth app in ${provider} settings\n2. Set REACT_APP_${provider.toUpperCase()}_CLIENT_ID in your Vercel environment variables\n3. Add ${window.location.origin}/oauth/callback as the redirect URI\n\nFor now, paste your Personal Access Token below.`);
      }, 500);
    }
  };

  const handleSubmit = () => {
    if (isGenerating) return;
    if (srcType === 'url') {
      if (!url.trim()) return;
      let u = url.trim();
      if (!u.startsWith('http')) u = 'https://' + u;
      onAnalyze({ type:'url', url:u });
    } else if (['github','gitlab','azure'].includes(srcType)) {
      let o = owner, r = repo;
      if (!o && url.includes('/')) {
        const parts = url.replace(/^https?:\/\/[^/]+\//,'').split('/');
        o = parts[0]; r = parts[1];
      }
      if (!o || !r) return alert('Enter owner and repository name');
      onAnalyze({ type:'repo', provider:srcType === 'azure' ? 'azure' : srcType, repoOwner:o, repoName:r, branch, accessToken:token });
    }
  };

  const hasTests = totalTests > 0;

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', background:C.bg, overflowY:'auto' }}>
      {/* Glow */}
      <div style={{ position:'fixed', top:'20%', left:'50%', transform:'translate(-50%,-50%)', width:700, height:300, borderRadius:'50%', background:'radial-gradient(ellipse, rgba(0,212,170,0.04) 0%, transparent 70%)', pointerEvents:'none', zIndex:0 }}/>

      <div style={{ position:'relative', zIndex:1, padding: hasTests ? '24px 32px 0' : '0 32px', flex:1, display:'flex', flexDirection:'column', justifyContent: hasTests ? 'flex-start' : 'center', alignItems:'center', minHeight: hasTests ? 'auto' : '100vh' }}>

        {!hasTests && (
          <>
            <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(0,212,170,0.08)', border:`1px solid ${C.border}`, borderRadius:20, padding:'5px 14px', marginBottom:24 }}>
              <Sparkles size={12} style={{ color:C.teal }}/>
              <span style={{ color:C.teal, fontSize:12, fontWeight:600, letterSpacing:'0.05em' }}>AI-POWERED TEST GENERATION</span>
            </div>
            <h1 style={{ fontSize:'clamp(28px,4vw,52px)', fontWeight:900, color:C.white, letterSpacing:'-2px', marginBottom:12, lineHeight:1.05, textAlign:'center' }}>
              What would you like to test?
            </h1>
            <p style={{ color:C.gray, fontSize:15, marginBottom:36, textAlign:'center', maxWidth:480 }}>
              Website · GitHub · GitLab · Azure DevOps · Source upload<br/>
              Get 1,000+ test cases in under 60 seconds.
            </p>
          </>
        )}

        {/* Source type pills */}
        <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap', justifyContent:'center' }}>
          {srcTabs.map(s => (
            <button key={s.id} onClick={() => setSrcType(s.id)} style={{
              padding:'6px 14px', borderRadius:20, border:'none', cursor:'pointer',
              background: srcType===s.id ? C.teal : 'rgba(255,255,255,0.06)',
              color: srcType===s.id ? C.bg : C.grayLight,
              fontSize:12, fontWeight: srcType===s.id ? 700 : 400, transition:'all 0.2s',
            }}>{s.icon} {s.label}</button>
          ))}
        </div>

        {/* OAuth connected badge */}
        {oauthStatus && (
          <div style={{ marginBottom:10, display:'inline-flex', alignItems:'center', gap:8, background:'rgba(0,212,170,0.1)', border:`1px solid rgba(0,212,170,0.3)`, borderRadius:20, padding:'5px 14px' }}>
            <CheckCircle size={13} style={{ color:C.teal }}/>
            <span style={{ color:C.teal, fontSize:12, fontWeight:600 }}>Connected to {oauthStatus.provider} {oauthStatus.user ? `as ${oauthStatus.user}` : ''}</span>
            <button onClick={() => { setOauthStatus(null); setToken(''); }} style={{ background:'none', border:'none', color:C.gray, cursor:'pointer', padding:2 }}><X size={11}/></button>
          </div>
        )}

        {/* Main input box */}
        <div style={{ width:'100%', maxWidth:680, background:C.card, border:`1.5px solid ${focused ? C.teal : C.border}`, borderRadius:16, overflow:'hidden', boxShadow: focused ? `0 0 0 3px rgba(0,212,170,0.1)` : 'none', transition:'all 0.2s' }}>

          {/* URL / top row */}
          {srcType !== 'upload' && (
            <div style={{ display:'flex', alignItems:'center', padding:'14px 18px', gap:12 }}>
              <span style={{ fontSize:18 }}>{srcTabs.find(s=>s.id===srcType)?.icon}</span>
              <input value={url} onChange={e=>setUrl(e.target.value)}
                onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
                onKeyDown={e=>e.key==='Enter'&&handleSubmit()}
                placeholder={{
                  url:'https://yourapp.com',
                  github:'https://github.com/owner/repo or just owner/repo',
                  gitlab:'https://gitlab.com/namespace/project or namespace/project',
                  azure: 'https://dev.azure.com/org/project',
                }[srcType]}
                disabled={isGenerating}
                style={{ flex:1, background:'none', border:'none', outline:'none', color:C.white, fontSize:15, fontFamily:'inherit' }}/>
              <button onClick={handleSubmit} disabled={isGenerating} style={{
                background: isGenerating ? 'rgba(0,212,170,0.25)' : `linear-gradient(135deg,${C.teal},${C.blue})`,
                border:'none', color:C.bg, padding:'9px 18px', borderRadius:9,
                fontSize:13, fontWeight:700, cursor: isGenerating ? 'not-allowed' : 'pointer',
                display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap',
              }}>
                {isGenerating ? <><Spinner/> Analyzing…</> : <><Sparkles size={13}/> Analyze</>}
              </button>
            </div>
          )}

          {/* GitHub/GitLab/Azure extra fields */}
          {['github','gitlab','azure'].includes(srcType) && (
            <div style={{ borderTop:`1px solid ${C.border}`, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:0 }}>
              {[
                { ph:`${srcType === 'azure' ? 'Organization' : 'Owner'} / namespace`, val:owner, set:setOwner },
                { ph:`${srcType === 'azure' ? 'Project' : 'Repository'} name`,       val:repo,  set:setRepo  },
                { ph:'Branch (default: main)',                                         val:branch, set:setBranch },
              ].map((f,i) => (
                <input key={i} value={f.val} onChange={e=>f.set(e.target.value)} placeholder={f.ph}
                  style={{ background:'none', border:'none', borderRight: i<2?`1px solid ${C.border}`:'none', outline:'none', color:C.white, fontSize:12, padding:'10px 14px', fontFamily:'inherit' }}/>
              ))}
            </div>
          )}

          {/* OAuth buttons + PAT */}
          {['github','gitlab','azure'].includes(srcType) && (
            <div style={{ borderTop:`1px solid ${C.border}`, padding:'12px 16px', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
              <span style={{ color:C.gray, fontSize:12 }}>Sign in:</span>
              <button onClick={() => handleOAuth(srcType)} style={{
                display:'flex', alignItems:'center', gap:6, padding:'6px 14px', borderRadius:8,
                border:`1px solid ${C.border}`, background:'rgba(255,255,255,0.05)',
                color:C.white, fontSize:12, fontWeight:600, cursor:'pointer', transition:'all 0.2s',
              }}
              onMouseEnter={e=>e.currentTarget.style.borderColor=C.teal}
              onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                {{github:<Github size={13}/>, gitlab:<GitBranch size={13}/>, azure:<Cloud size={13}/>}[srcType]}
                Connect {srcType === 'github' ? 'GitHub' : srcType === 'gitlab' ? 'GitLab' : 'Azure DevOps'}
              </button>
              <span style={{ color:C.gray, fontSize:11 }}>or paste token:</span>
              <input value={token} onChange={e=>setToken(e.target.value)} type="password"
                placeholder={`${srcType === 'github' ? 'ghp_' : srcType === 'gitlab' ? 'glpat-' : ''}Personal Access Token`}
                style={{ flex:1, minWidth:160, background:'rgba(255,255,255,0.05)', border:`1px solid ${C.border}`, borderRadius:7, color:C.white, fontSize:12, padding:'6px 10px', outline:'none', fontFamily:'inherit' }}/>
            </div>
          )}

          {/* Upload */}
          {srcType === 'upload' && (
            <label style={{ display:'block', padding:'32px', textAlign:'center', cursor:'pointer' }}>
              <FileUp size={28} style={{ color:C.gray, marginBottom:8 }}/>
              <p style={{ color:C.grayLight, fontSize:14, marginBottom:4 }}>Click to upload source files</p>
              <p style={{ color:C.gray, fontSize:12 }}>JS · TS · Python · Go · Java · SQL · YAML</p>
              <input type="file" multiple accept=".js,.ts,.jsx,.tsx,.py,.go,.java,.sql,.yaml,.yml,.md" style={{ display:'none' }}
                onChange={e => {
                  const files = Array.from(e.target.files);
                  Promise.all(files.map(f => new Promise(res => {
                    const r = new FileReader();
                    r.onload = ev => res({ filename:f.name, content:ev.target.result, size:f.size });
                    r.readAsText(f);
                  }))).then(results => onAnalyze({ type:'upload', files:results, label:files[0]?.name }));
                }}/>
            </label>
          )}
        </div>

        {/* Progress */}
        {isGenerating && (
          <div style={{ width:'100%', maxWidth:680, marginTop:16, background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:'14px 18px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
              <Spinner/>
              <span style={{ color:C.grayLight, fontSize:13, flex:1 }}>{progressMsg||'Analyzing…'}</span>
              <span style={{ color:C.teal, fontSize:12, fontFamily:'monospace' }}>{progress}%</span>
            </div>
            <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:4, height:4 }}>
              <div style={{ height:'100%', borderRadius:4, background:`linear-gradient(90deg,${C.teal},${C.blue})`, width:`${progress}%`, transition:'width 0.5s ease' }}/>
            </div>
          </div>
        )}

        {/* Quick examples */}
        {!hasTests && !isGenerating && srcType === 'url' && (
          <div style={{ marginTop:20, display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap' }}>
            <span style={{ color:C.gray, fontSize:12 }}>Try:</span>
            {['https://github.com','https://vercel.com','https://stripe.com'].map(ex => (
              <button key={ex} onClick={() => setUrl(ex)} style={{ background:'rgba(255,255,255,0.04)', border:`1px solid ${C.border}`, color:C.grayLight, padding:'4px 12px', borderRadius:20, fontSize:12, cursor:'pointer' }}>{ex}</button>
            ))}
          </div>
        )}

        {/* Stats grid when tests exist */}
        {hasTests && (
          <div style={{ width:'100%', marginTop:20, paddingBottom:32 }}>
            {/* Result summary bar */}
            {results.length > 0 && (
              <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
                {[
                  { label:'Total',   val:summary.total,              color:C.white },
                  { label:'Passed',  val:summary.passed,             color:'#4ade80' },
                  { label:'Failed',  val:summary.failed,             color:'#f87171' },
                  { label:'Rate',    val:`${summary.passRate||0}%`,  color:C.teal },
                  { label:'Time',    val:`${((summary.duration||0)/1000).toFixed(1)}s`, color:C.blue },
                ].map(s => (
                  <div key={s.label} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 18px', textAlign:'center', minWidth:80 }}>
                    <div style={{ color:s.color, fontWeight:800, fontSize:20, fontFamily:'monospace' }}>{s.val}</div>
                    <div style={{ color:C.gray, fontSize:11 }}>{s.label}</div>
                  </div>
                ))}
                {isRunning && currentTest && (
                  <div style={{ flex:1, background:'rgba(59,130,246,0.08)', border:`1px solid rgba(59,130,246,0.3)`, borderRadius:10, padding:'10px 16px', display:'flex', alignItems:'center', gap:10 }}>
                    <Spinner/>
                    <div>
                      <div style={{ color:C.white, fontSize:12, fontWeight:600 }}>{currentTest.name}</div>
                      <div style={{ color:C.gray, fontSize:11 }}>{currentTest.type}</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Type cards */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:8 }}>
              {TYPES.map(type => {
                const count = (tests[type]||[]).length;
                const Icon  = TYPE_ICONS[type];
                return (
                  <button key={type} onClick={() => { setActive('tests'); setActiveTab(type); }} style={{
                    background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:'14px', cursor:'pointer', textAlign:'left', borderTop:`2px solid ${TYPE_COLORS[type]}`, transition:'all 0.15s',
                  }}
                  onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.borderTopColor=TYPE_COLORS[type]; e.currentTarget.style.borderColor=TYPE_COLORS[type]+'44'; }}
                  onMouseLeave={e=>{ e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.borderColor=C.border; e.currentTarget.style.borderTopColor=TYPE_COLORS[type]; }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                      <Icon size={14} style={{ color:TYPE_COLORS[type] }}/>
                      <span style={{ color:TYPE_COLORS[type], fontFamily:'monospace', fontWeight:800, fontSize:20 }}>{count}</span>
                    </div>
                    <div style={{ color:C.white, fontSize:11, fontWeight:600, textTransform:'uppercase' }}>{type}</div>
                  </button>
                );
              })}
            </div>

            {/* Run button */}
            <div style={{ marginTop:16, display:'flex', gap:10 }}>
              <button onClick={onRun} disabled={isRunning||!canRun} style={{
                flex:1, padding:'12px', borderRadius:10, border:'none', cursor: isRunning||!canRun ? 'not-allowed' : 'pointer',
                background: isRunning||!canRun ? 'rgba(255,255,255,0.06)' : `linear-gradient(135deg,${C.teal},${C.blue})`,
                color: isRunning||!canRun ? C.gray : C.bg, fontSize:14, fontWeight:700,
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              }}>
                <Play size={15}/>{isRunning ? 'Running…' : `Run All ${totalTests} Tests`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TEST PLANS PANEL
// ─────────────────────────────────────────────────────────────
function TestPlansPanel({ tests, results }) {
  const [plans,       setPlans]       = useState(() => {
    try { return JSON.parse(localStorage.getItem('testitnow_plans') || '[]'); } catch { return []; }
  });
  const [planName,   setPlanName]   = useState('');
  const [iteration,  setIteration]  = useState('v1.0');
  const [framework,  setFramework]  = useState('playwright');
  const [activePlan, setActivePlan] = useState(null);

  const savePlan = () => {
    if (!planName.trim()) return;
    const totalTests = Object.values(tests).reduce((s,a)=>s+a.length,0);
    const plan = {
      id: Date.now(),
      name: planName.trim(),
      iteration: iteration.trim() || 'v1.0',
      createdAt: new Date().toISOString(),
      totalTests,
      totalResults: results.length,
      passed: results.filter(r=>r.status==='passed').length,
      failed: results.filter(r=>r.status==='failed').length,
      passRate: results.length ? Math.round(results.filter(r=>r.status==='passed').length/results.length*100) : 0,
      framework,
      // Store snapshot of result IDs and statuses
      resultSnapshot: results.map(r=>({ id:r.id, name:r.name, status:r.status, duration:r.duration })),
    };
    const updated = [plan, ...plans].slice(0, 20);
    setPlans(updated);
    try { localStorage.setItem('testitnow_plans', JSON.stringify(updated)); } catch {}
    setActivePlan(plan);
    setPlanName('');
  };

  const downloadPlanScripts = (plan) => {
    const scripts = getAllTestPlans(tests, results, plan.name, plan.iteration);
    const fw = plan.framework || 'playwright';
    dl(scripts[fw], `${plan.name.replace(/[^a-z0-9]/gi,'_')}-${plan.iteration}-${fw}.spec.js`, 'text/javascript');
    setTimeout(() => dl(scripts.config.packageJson, 'package.json', 'application/json'), 300);
    setTimeout(() => dl(scripts.config.envExample, '.env.example', 'text/plain'), 600);
    setTimeout(() => dl(scripts.config.playwright,  'playwright.config.js', 'text/javascript'), 900);
  };

  const downloadAllFrameworks = (plan) => {
    const scripts = getAllTestPlans(tests, results, plan.name, plan.iteration);
    ['playwright','cypress','jest','k6'].forEach((fw, i) => {
      setTimeout(() => {
        dl(scripts[fw], `${fw}/${plan.name.replace(/[^a-z0-9]/gi,'_')}-${plan.iteration}.${fw==='jest'?'test.js':'spec.js'}`, 'text/javascript');
      }, i * 400);
    });
    setTimeout(() => dl(scripts.config.packageJson, 'package.json', 'application/json'), 1800);
    setTimeout(() => dl(scripts.config.envExample, '.env.example', 'text/plain'), 2200);
    setTimeout(() => dl(scripts.config.playwright, 'playwright.config.js', 'text/javascript'), 2600);
  };

  const fws = [
    { id:'playwright', label:'Playwright', color:'#e5534b', desc:'UI + API + Security' },
    { id:'cypress',    label:'Cypress',    color:'#17a974', desc:'E2E browser tests' },
    { id:'jest',       label:'Jest',       color:'#c21325', desc:'API + Unit tests' },
    { id:'k6',         label:'k6',         color:'#7d64ff', desc:'Performance / load' },
  ];

  return (
    <PanelShell title="Test Plans & Iterations">
      {/* New plan form */}
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:'16px', marginBottom:14 }}>
        <div style={{ color:C.white, fontSize:13, fontWeight:700, marginBottom:12 }}>Save Current Test Run as Plan</div>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <input value={planName} onChange={e=>setPlanName(e.target.value)} placeholder="Plan name e.g. Sprint 12 Regression"
            style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, color:C.white, fontSize:13, padding:'8px 12px', outline:'none', fontFamily:'inherit' }}/>
          <div style={{ display:'flex', gap:8 }}>
            <input value={iteration} onChange={e=>setIteration(e.target.value)} placeholder="Iteration e.g. v1.2"
              style={{ flex:1, background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, color:C.white, fontSize:13, padding:'8px 12px', outline:'none', fontFamily:'inherit' }}/>
            <select value={framework} onChange={e=>setFramework(e.target.value)}
              style={{ flex:1, background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, color:C.white, fontSize:13, padding:'8px 10px', outline:'none' }}>
              {fws.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </div>
          <button onClick={savePlan} disabled={!planName.trim()} style={{
            padding:'9px', borderRadius:8, border:'none', cursor: planName ? 'pointer' : 'not-allowed',
            background: planName ? `linear-gradient(135deg,${C.teal},${C.blue})` : 'rgba(255,255,255,0.06)',
            color: planName ? C.bg : C.gray, fontSize:13, fontWeight:700,
          }}>Save Plan & Generate Scripts</button>
        </div>
      </div>

      {/* Framework selector */}
      <div style={{ marginBottom:12 }}>
        <div style={{ color:C.gray, fontSize:11, fontWeight:600, textTransform:'uppercase', marginBottom:8 }}>Script Frameworks</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
          {fws.map(f => (
            <div key={f.id} style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:'10px 12px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:f.color }}/>
                <span style={{ color:C.white, fontSize:12, fontWeight:700 }}>{f.label}</span>
              </div>
              <div style={{ color:C.gray, fontSize:11 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Saved plans */}
      <div style={{ color:C.gray, fontSize:11, fontWeight:600, textTransform:'uppercase', marginBottom:8 }}>Saved Plans ({plans.length})</div>
      <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:'calc(100vh - 500px)', overflowY:'auto' }}>
        {plans.length === 0 && (
          <div style={{ textAlign:'center', padding:'24px', color:C.gray }}>
            <Package size={28} style={{ marginBottom:8, opacity:0.4 }}/>
            <p style={{ fontSize:12 }}>No plans saved yet.</p>
          </div>
        )}
        {plans.map(plan => (
          <div key={plan.id} style={{ background:C.card, border:`1px solid ${activePlan?.id===plan.id ? 'rgba(0,212,170,0.4)' : C.border}`, borderRadius:10, padding:'12px', cursor:'pointer', transition:'border-color 0.15s' }}
            onClick={() => setActivePlan(activePlan?.id===plan.id ? null : plan)}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
              <div>
                <div style={{ color:C.white, fontSize:12, fontWeight:700 }}>{plan.name}</div>
                <div style={{ color:C.gray, fontSize:10 }}>{plan.iteration} · {new Date(plan.createdAt).toLocaleDateString()}</div>
              </div>
              <div style={{ display:'flex', gap:4 }}>
                <span style={{ background:`rgba(${plan.passed===plan.totalResults?'0,212,170':'248,113,113'},0.15)`, color: plan.passed===plan.totalResults ? C.teal : '#f87171', fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:20 }}>
                  {plan.passRate}%
                </span>
              </div>
            </div>
            <div style={{ display:'flex', gap:12, fontSize:11, color:C.gray }}>
              <span>🧪 {plan.totalTests} tests</span>
              <span style={{ color:'#4ade80' }}>✓ {plan.passed}</span>
              <span style={{ color:'#f87171' }}>✗ {plan.failed}</span>
            </div>
            {activePlan?.id === plan.id && (
              <div style={{ marginTop:10, paddingTop:10, borderTop:`1px solid ${C.border}`, display:'flex', flexDirection:'column', gap:6 }}>
                <button onClick={e=>{ e.stopPropagation(); downloadPlanScripts(plan); }} style={{ ...btnStyle(C.teal), justifyContent:'center' }}>
                  <Terminal size={12}/> Download {plan.framework} Scripts
                </button>
                <button onClick={e=>{ e.stopPropagation(); downloadAllFrameworks(plan); }} style={{ ...btnStyle(C.blue), justifyContent:'center' }}>
                  <Package size={12}/> Download All Frameworks (4 files)
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </PanelShell>
  );
}

// ─────────────────────────────────────────────────────────────
// TEST CASES PANEL
// ─────────────────────────────────────────────────────────────
function TestCasesPanel({ tests, activeTab, setActiveTab, onDelete, onRun, isRunning, canRun, totalTests }) {
  const [search,   setSearch]   = useState('');
  const [expanded, setExpanded] = useState(null);
  const [scripts,  setScripts]  = useState(null); // { test, fw, code }

  const allTests = TYPES.flatMap(type => (tests[type]||[]).map(t=>({...t,type})));
  const shown    = (activeTab==='all' ? allTests : (tests[activeTab]||[]).map(t=>({...t,type:activeTab})))
    .filter(t => !search || `${t.name||''}${t.id||''}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <PanelShell title={`Test Cases (${totalTests})`} action={
      <button onClick={onRun} disabled={isRunning||!canRun} style={{ padding:'5px 12px', borderRadius:7, border:'none', cursor:'pointer', background:`linear-gradient(135deg,${C.teal},${C.blue})`, color:C.bg, fontSize:12, fontWeight:700, display:'flex', alignItems:'center', gap:5 }}>
        <Play size={12}/> Run
      </button>
    }>
      {/* Type filter */}
      <div style={{ display:'flex', gap:3, flexWrap:'wrap', marginBottom:10 }}>
        {['all',...TYPES].map(t => (
          <button key={t} onClick={()=>setActiveTab(t)} style={{ padding:'3px 9px', borderRadius:20, border:'none', cursor:'pointer', fontSize:11, background: activeTab===t ? C.teal : 'rgba(255,255,255,0.06)', color: activeTab===t ? C.bg : C.gray, fontWeight: activeTab===t ? 700 : 400 }}>
            {t==='all'?`All (${totalTests})`:`${t} (${(tests[t]||[]).length})`}
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ position:'relative', marginBottom:10 }}>
        <Search size={12} style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:C.gray }}/>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…"
          style={{ width:'100%', background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, color:C.white, fontSize:12, padding:'7px 10px 7px 28px', outline:'none', fontFamily:'inherit', boxSizing:'border-box' }}/>
      </div>

      {/* Script viewer modal */}
      {scripts && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
          <div style={{ background:C.sidebar, border:`1px solid ${C.border}`, borderRadius:16, width:'90%', maxWidth:800, maxHeight:'85vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ color:C.white, fontSize:14, fontWeight:700 }}>{scripts.test.id} — {scripts.fw} script</div>
                <div style={{ color:C.gray, fontSize:11 }}>{scripts.test.name}</div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => navigator.clipboard?.writeText(scripts.code)} style={{ ...btnStyle(C.teal), padding:'5px 12px' }}><Copy size={11}/> Copy</button>
                <button onClick={() => dl(scripts.code, `${(scripts.test.id||'tc').replace(/[^a-z0-9]/gi,'_')}.${scripts.fw==='jest'?'test.js':'spec.js'}`, 'text/javascript')} style={{ ...btnStyle(C.blue), padding:'5px 12px' }}><Download size={11}/> Download</button>
                <button onClick={() => setScripts(null)} style={{ background:'none', border:'none', color:C.gray, cursor:'pointer' }}><X size={16}/></button>
              </div>
            </div>
            <div style={{ display:'flex', gap:0, borderBottom:`1px solid ${C.border}` }}>
              {['playwright','cypress','jest','k6'].map(fw => (
                <button key={fw} onClick={() => setScripts({ ...scripts, fw, code: generateScript(scripts.test, fw) })} style={{
                  flex:1, padding:'8px', border:'none', cursor:'pointer', fontSize:11, fontWeight:600,
                  background: scripts.fw===fw ? C.tealDim : 'transparent',
                  color: scripts.fw===fw ? C.teal : C.gray,
                  borderBottom: scripts.fw===fw ? `2px solid ${C.teal}` : '2px solid transparent',
                }}>{fw}</button>
              ))}
            </div>
            <pre style={{ flex:1, overflow:'auto', padding:'16px', fontSize:11, lineHeight:1.7, color:'#a8d8b9', background:'#0a0f1e', margin:0, fontFamily:'monospace' }}>
              {scripts.code}
            </pre>
          </div>
        </div>
      )}

      {/* Test list */}
      <div style={{ display:'flex', flexDirection:'column', gap:3, maxHeight:'calc(100vh - 320px)', overflowY:'auto' }}>
        {shown.length === 0 ? (
          <div style={{ textAlign:'center', padding:'32px', color:C.gray }}>
            <Layers size={28} style={{ marginBottom:8, opacity:0.4 }}/>
            <p style={{ fontSize:12 }}>No tests match.</p>
          </div>
        ) : shown.map(test => (
          <div key={test.id} style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', padding:'8px 10px', gap:8, cursor:'pointer' }}
              onClick={()=>setExpanded(expanded===test.id?null:test.id)}>
              <div style={{ width:3, height:26, borderRadius:2, background:TYPE_COLORS[test.type], flexShrink:0 }}/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ color:C.white, fontSize:12, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{test.name}</div>
                <div style={{ color:C.gray, fontSize:10 }}>{test.id}</div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                <span style={{ fontSize:10, padding:'2px 5px', borderRadius:4, background: test.priority==='Critical'?'rgba(239,68,68,0.15)':'rgba(255,255,255,0.05)', color: test.priority==='Critical'?'#f87171':C.gray }}>{test.priority}</span>
                <button onClick={e=>{ e.stopPropagation(); setScripts({ test, fw:'playwright', code: generateScript(test,'playwright') }); }}
                  style={{ background:'none', border:'none', color:C.teal, cursor:'pointer', padding:2 }} title="View script"><Terminal size={11}/></button>
                <button onClick={e=>{ e.stopPropagation(); dl(generateScript(test,'playwright'), `${(test.id||'tc').replace(/[^a-z0-9]/gi,'_')}.spec.js`, 'text/javascript'); }}
                  style={{ background:'none', border:'none', color:C.blue, cursor:'pointer', padding:2 }} title="Download script"><Download size={11}/></button>
                <button onClick={e=>{ e.stopPropagation(); onDelete(test.type, test.id); }}
                  style={{ background:'none', border:'none', color:C.gray, cursor:'pointer', padding:2 }}><Trash2 size={11}/></button>
                {expanded===test.id ? <ChevronUp size={12} style={{ color:C.gray }}/> : <ChevronDown size={12} style={{ color:C.gray }}/>}
              </div>
            </div>
            {expanded===test.id && (
              <div style={{ borderTop:`1px solid ${C.border}`, padding:'8px 10px', background:'rgba(0,0,0,0.2)' }}>
                {[['Steps',test.testSteps],['Expected',test.expectedResult],['Preconditions',test.preconditions]]
                  .filter(([,v])=>v).map(([label,value])=>(
                  <div key={label} style={{ marginBottom:7 }}>
                    <div style={{ color:C.gray, fontSize:10, fontWeight:600, textTransform:'uppercase', marginBottom:2 }}>{label}</div>
                    <div style={{ color:C.grayLight, fontSize:11, lineHeight:1.6 }}>
                      {String(value).split(' | ').map((s,i)=><div key={i}>{s}</div>)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </PanelShell>
  );
}

// ─────────────────────────────────────────────────────────────
// RESULTS PANEL — with screenshots embedded in downloads
// ─────────────────────────────────────────────────────────────
function ResultsPanel({ results, onReportBug, onRetest, tests }) {
  const [expanded, setExpanded] = useState(null);
  const [filter,   setFilter]   = useState('all');

  const shown = filter==='all' ? results : results.filter(r=>r.status===filter);
  const passed = results.filter(r=>r.status==='passed').length;
  const failed = results.filter(r=>r.status==='failed').length;

  // Download HTML report with embedded screenshots
  const downloadHTMLReport = () => {
    const allTests = Object.entries(tests||{}).flatMap(([type,list])=>list.map(t=>({...t,type})));
    const resultMap = {};
    results.forEach(r=>{ resultMap[r.id||r.name]=r; });

    const html = `<!DOCTYPE html><html>
<head><meta charset="utf-8"><title>TestItNow Results Report</title>
<style>
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; background:#0a0f1e; color:#f0f4ff; }
.header { background:#0d1530; border-bottom:1px solid rgba(0,212,170,0.15); padding:20px 32px; display:flex; justify-content:space-between; align-items:center; }
.logo { font-size:20px; font-weight:900; color:#f0f4ff; } .logo span { color:#00d4aa; }
.summary { display:flex; gap:16px; }
.stat { text-align:center; background:#111b3a; border:1px solid rgba(0,212,170,0.12); border-radius:10px; padding:12px 20px; }
.stat .val { font-size:24px; font-weight:800; font-family:monospace; }
.stat .lbl { font-size:11px; color:#6b7fa3; margin-top:2px; }
.body { padding:24px 32px; }
.section-title { font-size:18px; font-weight:700; margin-bottom:14px; color:#f0f4ff; }
.result { border-radius:10px; margin-bottom:8px; overflow:hidden; }
.result.passed { background:rgba(74,222,128,0.06); border:1px solid rgba(74,222,128,0.2); }
.result.failed { background:rgba(248,113,113,0.06); border:1px solid rgba(248,113,113,0.2); }
.result-header { display:flex; align-items:center; gap:10; padding:10px 14px; }
.status-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
.passed .status-dot { background:#4ade80; }
.failed .status-dot { background:#f87171; }
.name { font-size:13px; font-weight:500; flex:1; }
.duration { font-size:11px; color:#6b7fa3; font-family:monospace; }
.details { padding:10px 14px 14px; border-top:1px solid rgba(255,255,255,0.06); }
.error { color:#f87171; font-size:12px; background:rgba(248,113,113,0.08); padding:8px 10px; border-radius:6px; margin-bottom:10px; }
.screenshot { max-width:100%; border-radius:8px; border:1px solid rgba(0,212,170,0.15); display:block; }
.ss-caption { font-size:10px; color:#6b7fa3; margin-top:4px; }
.badge { display:inline-block; padding:2px 8px; border-radius:20px; font-size:10px; font-weight:700; }
.badge.passed { background:rgba(74,222,128,0.15); color:#4ade80; }
.badge.failed { background:rgba(248,113,113,0.15); color:#f87171; }
.tc { background:#111b3a; border:1px solid rgba(0,212,170,0.1); border-radius:8px; margin-bottom:6px; padding:10px 14px; }
.tc-header { display:flex; justify-content:space-between; margin-bottom:4px; }
.tc-name { font-size:12px; font-weight:600; }
.tc-id { font-size:10px; color:#6b7fa3; font-family:monospace; }
.tc-meta { display:flex; gap:8px; }
.tc-type { font-size:10px; padding:2px 6px; border-radius:4px; background:rgba(0,212,170,0.1); color:#00d4aa; }
.tc-priority { font-size:10px; padding:2px 6px; border-radius:4px; background:rgba(255,255,255,0.05); color:#94a3b8; }
.tc-steps { font-size:11px; color:#94a3b8; line-height:1.6; margin-top:4px; }
</style></head>
<body>
<div class="header">
  <div class="logo">TestIt<span>Now</span> — Results Report</div>
  <div style="color:#6b7fa3;font-size:12px">Generated: ${new Date().toLocaleString()}</div>
</div>
<div style="padding:20px 32px;border-bottom:1px solid rgba(0,212,170,0.1)">
  <div class="summary">
    ${[['Total Tests', results.length, '#f0f4ff'], ['Passed', passed, '#4ade80'], ['Failed', failed, '#f87171'], ['Pass Rate', `${results.length?Math.round(passed/results.length*100):0}%`, '#00d4aa'], ['Test Cases', allTests.length, '#3b82f6']].map(([l,v,c])=>
      `<div class="stat"><div class="val" style="color:${c}">${v}</div><div class="lbl">${l}</div></div>`
    ).join('')}
  </div>
</div>
<div class="body">
  <div class="section-title">Test Results with Screenshots</div>
  ${results.map((r,i) => `
  <div class="result ${r.status}">
    <div class="result-header">
      <div class="status-dot"></div>
      <div class="name">${r.name||''}</div>
      <span class="badge ${r.status}">${(r.status||'').toUpperCase()}</span>
      <div class="duration">${r.duration||0}ms</div>
    </div>
    ${r.error||r.screenshot ? `<div class="details">
      ${r.error ? `<div class="error">Error: ${r.error}</div>` : ''}
      ${r.screenshot ? `<img src="${r.screenshot}" alt="${r.name||'screenshot'}" class="screenshot"/>
      <div class="ss-caption">Screenshot captured at ${r.timestamp ? new Date(r.timestamp).toLocaleTimeString() : ''}</div>` : ''}
    </div>` : ''}
  </div>`).join('')}

  <div class="section-title" style="margin-top:32px">Test Cases</div>
  ${allTests.map(t => `
  <div class="tc">
    <div class="tc-header">
      <div>
        <div class="tc-name">${t.name||''}</div>
        <div class="tc-id">${t.id||''}</div>
      </div>
      <div class="tc-meta">
        <span class="tc-type">${(t.type||'').toUpperCase()}</span>
        <span class="tc-priority">${t.priority||'Medium'}</span>
      </div>
    </div>
    ${t.testSteps ? `<div class="tc-steps">${String(t.testSteps).split(' | ').map((s,i)=>`${i+1}. ${s}`).join('<br>')}</div>` : ''}
  </div>`).join('')}
</div>
</body></html>`;

    dl(html, `TestItNow_Results_${new Date().toISOString().split('T')[0]}.html`, 'text/html;charset=utf-8');
  };

  return (
    <PanelShell title={`Results (${results.length})`} action={
      <button onClick={downloadHTMLReport} disabled={!results.length} style={{ padding:'5px 10px', borderRadius:7, border:'none', cursor:'pointer', background:`rgba(0,212,170,0.1)`, color:C.teal, fontSize:11, fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
        <Download size={11}/> HTML
      </button>
    }>
      {/* Stats */}
      {results.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginBottom:10 }}>
          {[{ label:'Passed', val:passed, color:'#4ade80' }, { label:'Failed', val:failed, color:'#f87171' }, { label:'Rate', val:`${results.length?Math.round(passed/results.length*100):0}%`, color:C.teal }].map(s=>(
            <div key={s.label} style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:'8px', textAlign:'center' }}>
              <div style={{ color:s.color, fontWeight:800, fontSize:16, fontFamily:'monospace' }}>{s.val}</div>
              <div style={{ color:C.gray, fontSize:10 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter */}
      <div style={{ display:'flex', gap:4, marginBottom:10 }}>
        {['all','passed','failed'].map(f => (
          <button key={f} onClick={()=>setFilter(f)} style={{ flex:1, padding:'5px', borderRadius:7, border:'none', cursor:'pointer', fontSize:11, background: filter===f ? C.teal : 'rgba(255,255,255,0.06)', color: filter===f ? C.bg : C.gray, fontWeight: filter===f ? 700 : 400 }}>
            {f==='all'?`All (${results.length})`:f==='passed'?`✓ ${passed}`:`✗ ${failed}`}
          </button>
        ))}
      </div>

      {/* Results list */}
      <div style={{ display:'flex', flexDirection:'column', gap:4, maxHeight:'calc(100vh - 380px)', overflowY:'auto' }}>
        {shown.length === 0 ? (
          <div style={{ textAlign:'center', padding:'32px', color:C.gray }}><p style={{ fontSize:12 }}>No results yet. Run your tests.</p></div>
        ) : shown.map((r,i) => (
          <div key={i} style={{ background: r.status==='passed'?'rgba(74,222,128,0.05)':'rgba(248,113,113,0.05)', border:`1px solid ${r.status==='passed'?'rgba(74,222,128,0.2)':'rgba(248,113,113,0.2)'}`, borderRadius:8, overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', cursor:'pointer' }}
              onClick={()=>setExpanded(expanded===i?null:i)}>
              {r.status==='passed'
                ? <CheckCircle size={13} style={{ color:'#4ade80', flexShrink:0 }}/>
                : <XCircle    size={13} style={{ color:'#f87171', flexShrink:0 }}/>}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ color:C.white, fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.name}</div>
                <div style={{ color:C.gray, fontSize:10 }}>{r.duration}ms</div>
              </div>
              <div style={{ display:'flex', gap:4 }}>
                {r.screenshot && (
                  <button onClick={e=>{e.stopPropagation(); dlScreenshot(r.screenshot, r.name);}}
                    style={{ background:'none', border:'none', color:C.teal, cursor:'pointer', padding:2 }} title="Download screenshot">
                    <Image size={11}/>
                  </button>
                )}
                {r.status==='failed' && <>
                  <button onClick={e=>{e.stopPropagation(); onReportBug(r);}} style={{ background:'none', border:'none', color:'#f87171', cursor:'pointer', padding:2 }} title="Report bug"><Bug size={11}/></button>
                  <button onClick={e=>{e.stopPropagation(); onRetest(r);}} style={{ background:'none', border:'none', color:C.blue, cursor:'pointer', padding:2 }} title="Retest"><RotateCcw size={11}/></button>
                </>}
              </div>
            </div>
            {expanded===i && (
              <div style={{ borderTop:`1px solid rgba(255,255,255,0.06)`, padding:'8px 10px', background:'rgba(0,0,0,0.2)' }}>
                {r.error && <div style={{ color:'#f87171', fontSize:11, marginBottom:8, background:'rgba(248,113,113,0.1)', padding:'6px 8px', borderRadius:6 }}>{r.error}</div>}
                {r.screenshot && (
                  <div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                      <span style={{ color:C.gray, fontSize:10, fontWeight:600, textTransform:'uppercase' }}>Screenshot</span>
                      <button onClick={()=>dlScreenshot(r.screenshot,r.name)} style={{ ...btnStyle(C.teal), padding:'3px 8px', fontSize:10 }}>
                        <Download size={10}/> Save PNG
                      </button>
                    </div>
                    <img src={r.screenshot} alt={r.name} style={{ width:'100%', borderRadius:6, border:`1px solid ${C.border}`, cursor:'pointer' }}
                      onClick={()=>window.open(r.screenshot,'_blank')}/>
                    <div style={{ color:C.gray, fontSize:10, marginTop:3 }}>Click to open full size</div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </PanelShell>
  );
}

// ─────────────────────────────────────────────────────────────
// CREATE TEST PANEL
// ─────────────────────────────────────────────────────────────
function CreateTestPanel({ onAdd }) {
  const [type, setType]   = useState('ui');
  const [fw,   setFw]     = useState('playwright');
  const [data, setData]   = useState({ id:'', name:'', description:'', priority:'High', preconditions:'', testSteps:'', testData:'', expectedResult:'' });
  const set = (k,v) => setData(p=>({...p,[k]:v}));

  const handle = () => {
    if (!data.name.trim()) return alert('Title is required');
    const id = data.id || `TC-${type.toUpperCase()}-${Date.now()}`;
    onAdd(type, { id, name:data.name, description:data.description, priority:data.priority, preconditions:data.preconditions, testSteps:data.testSteps, testData:data.testData, expectedResult:data.expectedResult });
    setData({ id:'', name:'', description:'', priority:'High', preconditions:'', testSteps:'', testData:'', expectedResult:'' });
  };

  const preview = () => {
    const script = generateScript({ ...data, type }, fw);
    dl(script, `${(data.id||'new_test').replace(/[^a-z0-9]/gi,'_')}.${fw==='jest'?'test.js':'spec.js'}`, 'text/javascript');
  };

  return (
    <PanelShell title="Create Test Case" action={
      <button onClick={handle} style={{ padding:'5px 12px', borderRadius:7, border:'none', cursor:'pointer', background:`linear-gradient(135deg,${C.teal},${C.blue})`, color:C.bg, fontSize:12, fontWeight:700 }}>+ Add</button>
    }>
      <div style={{ display:'flex', flexDirection:'column', gap:9, overflowY:'auto', maxHeight:'calc(100vh - 190px)' }}>
        {/* Type */}
        <div>
          <label style={lbl}>Test Type</label>
          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
            {TYPES.map(t => (
              <button key={t} onClick={()=>setType(t)} style={{ padding:'4px 10px', borderRadius:20, border:'none', cursor:'pointer', fontSize:11, background: type===t?C.teal:'rgba(255,255,255,0.06)', color: type===t?C.bg:C.gray, fontWeight: type===t?700:400 }}>{t}</button>
            ))}
          </div>
        </div>

        {[
          { k:'id',             l:'Test ID (optional)',   ph:'TC-UI-001',                           ta:false },
          { k:'name',           l:'Title *',              ph:'Login with valid credentials',          ta:false },
          { k:'description',    l:'Description',          ph:'Verify the login form works',           ta:true  },
          { k:'preconditions',  l:'Preconditions',        ph:'User on login page | Form visible',     ta:true  },
          { k:'testSteps',      l:'Test Steps',           ph:'1. Enter email | 2. Enter password | 3. Click Login', ta:true },
          { k:'testData',       l:'Test Data',            ph:'Email: test@test.com | Pass: Pass123!', ta:false },
          { k:'expectedResult', l:'Expected Result',      ph:'Login succeeds | Redirect to dashboard', ta:true },
        ].map(f => (
          <div key={f.k}>
            <label style={lbl}>{f.l}</label>
            {f.ta
              ? <textarea value={data[f.k]} onChange={e=>set(f.k,e.target.value)} placeholder={f.ph} rows={2} style={inp}/>
              : <input    value={data[f.k]} onChange={e=>set(f.k,e.target.value)} placeholder={f.ph}         style={inp}/>
            }
          </div>
        ))}

        <div>
          <label style={lbl}>Priority</label>
          <select value={data.priority} onChange={e=>set('priority',e.target.value)} style={inp}>
            {['Critical','High','Medium','Low'].map(p=><option key={p}>{p}</option>)}
          </select>
        </div>

        {/* Script framework + preview */}
        <div>
          <label style={lbl}>Script Framework</label>
          <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:8 }}>
            {['playwright','cypress','jest','k6'].map(f => (
              <button key={f} onClick={()=>setFw(f)} style={{ padding:'3px 9px', borderRadius:20, border:'none', cursor:'pointer', fontSize:11, background: fw===f?C.blue:'rgba(255,255,255,0.06)', color: fw===f?C.white:C.gray }}>{f}</button>
            ))}
          </div>
          <button onClick={preview} disabled={!data.name} style={{ ...btnStyle(C.blue), width:'100%', justifyContent:'center', opacity: data.name?1:0.5 }}>
            <Terminal size={12}/> Download {fw} script
          </button>
        </div>

        <button onClick={handle} style={{ padding:'11px', borderRadius:9, border:'none', cursor:'pointer', background:`linear-gradient(135deg,${C.teal},${C.blue})`, color:C.bg, fontSize:14, fontWeight:700 }}>
          + Add Test Case
        </button>
      </div>
    </PanelShell>
  );
}

// ─────────────────────────────────────────────────────────────
// TEMPLATE PANEL
// ─────────────────────────────────────────────────────────────
function TemplatePanel({ onAdd }) {
  const [imported, setImported] = useState(0);
  const [over,     setOver]     = useState(false);

  const parse = text => {
    try {
      const lines = text.split('\n');
      const heads = lines[0].split(',').map(h=>h.trim().replace(/^"|"$/g,'').toLowerCase());
      const nameI = heads.findIndex(h=>h.includes('title')||h.includes('name'));
      const typeI = heads.findIndex(h=>h==='type');
      const priI  = heads.findIndex(h=>h.includes('priority'));
      const idI   = heads.findIndex(h=>h==='id'||h.includes('test case id')||h.includes('test id'));
      const descI = heads.findIndex(h=>h.includes('desc'));
      const stpsI = heads.findIndex(h=>h.includes('step'));
      const expI  = heads.findIndex(h=>h.includes('expect'));
      let n = 0;
      lines.slice(1).filter(l=>l.trim()).forEach((line,i)=>{
        const v = line.split(',').map(x=>x.trim().replace(/^"|"$/g,''));
        const rawType = (v[typeI]||'').toLowerCase();
        const type = ['ui','api','security','performance','database','unit'].includes(rawType) ? rawType : 'unit';
        onAdd(type, { id:v[idI]||`TC-IMP-${Date.now()}-${i}`, name:v[nameI]||`Imported ${i+1}`, description:v[descI]||'', priority:v[priI]||'Medium', testSteps:v[stpsI]||'', expectedResult:v[expI]||'' });
        n++;
      });
      setImported(p=>p+n);
    } catch(e) { alert('CSV parse error: ' + e.message); }
  };

  const handleFile = f => { const r=new FileReader(); r.onload=e=>parse(e.target.result); r.readAsText(f); };

  const dlTemplate = () => {
    const rows = [
      ['Test Case ID','Title','Description','Type','Priority','Preconditions','Test Steps','Expected Result'],
      ['TC-001','Login valid credentials','Test login form','ui','Critical','Login page open','1. Enter email | 2. Enter password | 3. Click Login','Login succeeds | Redirect to dashboard'],
      ['TC-002','GET /api/health','API health check','api','High','Server running','GET /api/health | Verify 200','Status 200 | {"status":"ok"}'],
      ['TC-003','SQL injection login','Security test','security','Critical','Login form visible',"Enter ' OR '1'='1 | Submit",'Input rejected | No DB error'],
    ];
    dl('\uFEFF'+rows.map(r=>r.map(c=>`"${c}"`).join(',')).join('\r\n'), 'TestItNow_Template.csv', 'text/csv;charset=utf-8');
  };

  const presets = [
    { label:'OWASP Top 10',      count:10, type:'security',    desc:'SQL injection, XSS, CSRF, Auth bypass…' },
    { label:'REST API Baseline', count:12, type:'api',         desc:'CRUD, auth, pagination, validation…' },
    { label:'UI Smoke Tests',    count:10, type:'ui',          desc:'Page load, responsive, forms, nav…' },
    { label:'Core Web Vitals',   count:8,  type:'performance', desc:'LCP, FID, CLS, TTFB benchmarks…' },
  ];

  return (
    <PanelShell title="Templates & Import">
      <div style={{ display:'flex', flexDirection:'column', gap:12, overflowY:'auto', maxHeight:'calc(100vh - 180px)' }}>
        <button onClick={dlTemplate} style={{ ...btnStyle(C.teal), justifyContent:'center', padding:'9px' }}>
          <Download size={13}/> Download CSV Template
        </button>

        {/* Drop zone */}
        <div onDragOver={e=>{e.preventDefault();setOver(true);}} onDragLeave={()=>setOver(false)} onDrop={e=>{e.preventDefault();setOver(false);const f=e.dataTransfer.files[0];if(f)handleFile(f);}}
          style={{ border:`2px dashed ${over?C.teal:C.border}`, borderRadius:12, padding:'28px', textAlign:'center', background:over?'rgba(0,212,170,0.05)':'transparent', transition:'all 0.2s' }}>
          <FileUp size={24} style={{ color:over?C.teal:C.gray, marginBottom:8 }}/>
          <p style={{ color:C.grayLight, fontSize:13, marginBottom:6 }}>Drag & drop CSV</p>
          <label style={{ cursor:'pointer' }}>
            <span style={{ color:C.teal, fontSize:12, fontWeight:600, border:`1px solid ${C.border}`, padding:'5px 14px', borderRadius:7, background:'rgba(0,212,170,0.08)' }}>Browse</span>
            <input type="file" accept=".csv,.txt" style={{ display:'none' }} onChange={e=>{if(e.target.files[0])handleFile(e.target.files[0]);e.target.value='';}}/>
          </label>
        </div>

        {imported > 0 && (
          <div style={{ background:'rgba(0,212,170,0.08)', border:`1px solid rgba(0,212,170,0.25)`, borderRadius:8, padding:'9px 12px', display:'flex', alignItems:'center', gap:8 }}>
            <CheckCircle size={14} style={{ color:C.teal }}/>
            <span style={{ color:C.teal, fontSize:12, fontWeight:600 }}>{imported} test cases imported!</span>
          </div>
        )}

        <div style={{ color:C.gray, fontSize:11, fontWeight:600, textTransform:'uppercase' }}>Quick Presets</div>
        {presets.map(p => (
          <button key={p.label} onClick={()=>{
            Array.from({length:p.count}).forEach((_,i)=>{
              onAdd(p.type,{ id:`PRESET-${p.type.toUpperCase()}-${Date.now()}-${i}`, name:`${p.label} — Test ${i+1}`, description:p.desc, priority:'High', testSteps:'Follow test procedure', expectedResult:'Test passes' });
            });
            setImported(x=>x+p.count);
          }} style={{ width:'100%', background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:'10px 12px', cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center', justifyContent:'space-between', transition:'border-color 0.15s' }}
          onMouseEnter={e=>e.currentTarget.style.borderColor='rgba(0,212,170,0.35)'}
          onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
            <div>
              <div style={{ color:C.white, fontSize:12, fontWeight:600 }}>{p.label}</div>
              <div style={{ color:C.gray, fontSize:11 }}>{p.desc}</div>
            </div>
            <span style={{ color:C.teal, fontSize:11, fontWeight:700, background:'rgba(0,212,170,0.1)', padding:'2px 8px', borderRadius:20 }}>+{p.count}</span>
          </button>
        ))}
      </div>
    </PanelShell>
  );
}

// ─────────────────────────────────────────────────────────────
// INTEGRATIONS PANEL
// ─────────────────────────────────────────────────────────────
function IntegrationsPanel({ onJiraImport, onJiraExport, onImport }) {
  return (
    <PanelShell title="Integrations">
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {[
          { icon:'🔵', name:'Jira', desc:'Import/export test cases & bugs',
            actions:[{ label:'Import from Jira', fn:onJiraImport }, { label:'Export to Jira', fn:onJiraExport }] },
          { icon:'☁️', name:'Azure DevOps', desc:'Sync with Azure Test Plans',
            actions:[{ label:'Import from Azure', fn:onImport }] },
          { icon:'📊', name:'CSV / Excel', desc:'Bulk import from spreadsheet',
            actions:[{ label:'Import CSV', fn:onImport }] },
        ].map(int => (
          <div key={int.name} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:'14px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <span style={{ fontSize:18 }}>{int.icon}</span>
              <div>
                <div style={{ color:C.white, fontSize:13, fontWeight:600 }}>{int.name}</div>
                <div style={{ color:C.gray, fontSize:11 }}>{int.desc}</div>
              </div>
            </div>
            <div style={{ display:'flex', gap:6 }}>
              {int.actions.map(a => (
                <button key={a.label} onClick={a.fn} style={{ ...btnStyle(C.teal), flex:1, justifyContent:'center' }}>{a.label}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </PanelShell>
  );
}

// ─────────────────────────────────────────────────────────────
// SHARED PANEL SHELL
// ─────────────────────────────────────────────────────────────
function PanelShell({ title, children, action }) {
  return (
    <div style={{ width:340, flexShrink:0, background:C.panel, borderLeft:`1px solid ${C.border}`, height:'100vh', display:'flex', flexDirection:'column', position:'sticky', top:0 }}>
      <div style={{ padding:'14px 14px 10px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <h2 style={{ color:C.white, fontSize:13, fontWeight:700 }}>{title}</h2>
        {action}
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'10px 12px' }}>{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLE CONSTANTS
// ─────────────────────────────────────────────────────────────
const btnStyle = (color) => ({
  display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:7,
  border:`1px solid ${color}22`, background:`${color}18`,
  color, fontSize:12, fontWeight:600, cursor:'pointer', transition:'all 0.15s',
});
const lbl = { display:'block', color:C.gray, fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 };
const inp = { width:'100%', background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, color:C.white, fontSize:12, padding:'8px 10px', fontFamily:'inherit', outline:'none', resize:'vertical', boxSizing:'border-box' };

// ─────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────
export default function AppShell({
  userProfile, userPlan, freeRunsLeft, isAuthenticated,
  onLogout, onUpgrade, onReports,
  tests, results, bugs, activeTab, setActiveTab,
  onAdd, onDelete, onRun, onReportBug, onRetest,
  isRunning, currentTest, totalTests, summary, canRun,
  onAnalyze, isGenerating, progress, progressMsg,
  onExport, onJiraImport, onJiraExport, onImport,
  showAds,
}) {
  const [activePanel, setActivePanel] = useState('analyze');

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:C.bg, fontFamily:"-apple-system, BlinkMacSystemFont, 'Inter', sans-serif", color:C.white }}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0;} input::placeholder,textarea::placeholder{color:${C.gray};} ::-webkit-scrollbar{width:4px;height:4px;} ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:3px;}`}</style>

      <Sidebar
        active={activePanel} setActive={setActivePanel}
        userProfile={userProfile} userPlan={userPlan}
        onLogout={onLogout} onUpgrade={onUpgrade} onReports={onReports}
        totalTests={totalTests} results={results}
      />

      <AnalyzeHero
        onAnalyze={onAnalyze} isGenerating={isGenerating} progress={progress} progressMsg={progressMsg}
        totalTests={totalTests} setActive={setActivePanel}
        activeTab={activeTab} setActiveTab={setActiveTab}
        tests={tests} results={results} summary={summary}
        isRunning={isRunning} currentTest={currentTest} onRun={onRun} canRun={canRun}
      />

      {activePanel === 'analyze'      && totalTests > 0 && <ResultsPanel results={results} onReportBug={onReportBug} onRetest={onRetest} tests={tests}/>}
      {activePanel === 'tests'        && <TestCasesPanel tests={tests} activeTab={activeTab} setActiveTab={setActiveTab} onDelete={onDelete} onRun={onRun} isRunning={isRunning} canRun={canRun} totalTests={totalTests}/>}
      {activePanel === 'results'      && <ResultsPanel   results={results} onReportBug={onReportBug} onRetest={onRetest} tests={tests}/>}
      {activePanel === 'plans'        && <TestPlansPanel tests={tests} results={results}/>}
      {activePanel === 'create'       && <CreateTestPanel onAdd={onAdd}/>}
      {activePanel === 'template'     && <TemplatePanel   onAdd={onAdd}/>}
      {activePanel === 'integrations' && <IntegrationsPanel onJiraImport={onJiraImport} onJiraExport={onJiraExport} onImport={onImport}/>}
    </div>
  );
}
