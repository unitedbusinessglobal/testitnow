// ============================================================
// LandingPage.jsx — Light-first professional landing page
// Themes: controlled by parent | Enterprise pricing included
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { getTheme, THEMES } from '../lib/theme';

// ── Animated terminal (dark always for contrast) ───────────────
const DEMO_TESTS = [
  { id:'TC-UI-001',  name:'Homepage loads successfully',        status:'pass', ms:234  },
  { id:'TC-UI-002',  name:'Login form — valid credentials',     status:'pass', ms:891  },
  { id:'TC-SEC-001', name:'SQL injection prevention',           status:'pass', ms:156  },
  { id:'TC-API-001', name:'POST /api/auth/login → 200',         status:'pass', ms:312  },
  { id:'TC-UI-003',  name:'Responsive layout — mobile 375px',   status:'pass', ms:445  },
  { id:'TC-SEC-002', name:'XSS in contact form fields',         status:'pass', ms:203  },
  { id:'TC-API-002', name:'GET /api/products — pagination',     status:'pass', ms:567  },
  { id:'TC-UI-004',  name:'Checkout form — card validation',    status:'fail', ms:1023 },
  { id:'TC-PERF-001',name:'Page LCP < 2.5s',                   status:'pass', ms:2340 },
  { id:'TC-DB-001',  name:'Connection pool health check',       status:'pass', ms:48   },
];

function AnimatedTerminal({ T }) {
  const [visible, setVisible] = useState([]);
  const [running, setRunning] = useState(null);
  const [idx,     setIdx]     = useState(0);
  const [done,    setDone]    = useState(false);

  useEffect(() => {
    if (idx >= DEMO_TESTS.length) {
      setRunning(null); setDone(true);
      setTimeout(() => { setVisible([]); setIdx(0); setDone(false); }, 4500);
      return;
    }
    const test = DEMO_TESTS[idx];
    setRunning(test);
    const t = setTimeout(() => {
      setVisible(p => [...p, { ...test, done:true }]);
      setRunning(null);
      setTimeout(() => setIdx(i => i+1), 200);
    }, Math.min(test.ms * 0.3, 600));
    return () => clearTimeout(t);
  }, [idx]);

  const passed = visible.filter(t => t.status === 'pass').length;
  const failed = visible.filter(t => t.status === 'fail').length;

  return (
    <div style={{ background:'#0a0f1e', border:'1px solid rgba(0,212,170,0.15)', borderRadius:16, overflow:'hidden', boxShadow:'0 24px 64px rgba(0,0,0,0.25)', fontFamily:"'SF Mono', 'Fira Code', monospace", fontSize:12 }}>
      <div style={{ background:'#111b3a', padding:'10px 16px', display:'flex', alignItems:'center', gap:8, borderBottom:'1px solid rgba(0,212,170,0.1)' }}>
        <div style={{ display:'flex', gap:6 }}>
          {['#ff5f57','#febc2e','#28c840'].map((c,i)=>(<div key={i} style={{ width:11,height:11,borderRadius:'50%',background:c }}/>))}
        </div>
        <span style={{ flex:1, textAlign:'center', color:'#6b7fa3', fontSize:11 }}>testitnow — test runner</span>
      </div>
      <div style={{ padding:'16px 20px', minHeight:300, maxHeight:340, overflowY:'auto' }}>
        <div style={{ color:'#00d4aa', marginBottom:10, fontSize:12 }}>
          <span style={{ color:'#6b7fa3' }}>$</span> testitnow analyze <span style={{ color:'#60a5fa' }}>https://yourapp.com</span>
        </div>
        <div style={{ color:'#6b7fa3', fontSize:11, marginBottom:10 }}>✦ Crawled 20 pages · Generated 847 tests · Running…</div>
        <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
          {visible.map(t => (
            <div key={t.id} style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ color:t.status==='pass'?'#00d4aa':'#f87171', fontSize:13, fontWeight:'bold' }}>{t.status==='pass'?'✓':'✗'}</span>
              <span style={{ color:'#6b7fa3', minWidth:80, fontSize:10 }}>{t.id}</span>
              <span style={{ color:t.status==='pass'?'#e2e8f0':'#fca5a5', flex:1 }}>{t.name}</span>
              <span style={{ color:'#4a5a7a', fontSize:10 }}>{t.ms}ms</span>
            </div>
          ))}
          {running && (
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <SpinnerChar color="'#00d4aa'"/>
              <span style={{ color:'#6b7fa3', minWidth:80, fontSize:10 }}>{running.id}</span>
              <span style={{ color:'#94a3b8' }}>{running.name}</span>
            </div>
          )}
        </div>
        {done && (
          <div style={{ marginTop:12, padding:'8px 12px', background:'rgba(0,212,170,0.08)', border:'1px solid rgba(0,212,170,0.2)', borderRadius:8, display:'flex', gap:16 }}>
            <span style={{ color:'#00d4aa' }}>✓ {passed} passed</span>
            {failed>0&&<span style={{ color:'#f87171' }}>✗ {failed} failed</span>}
            <span style={{ color:'#6b7fa3' }}>847 total · 2.3s</span>
          </div>
        )}
        {!done && (passed>0||failed>0) && (
          <div style={{ marginTop:8, display:'flex', gap:12 }}>
            {passed>0&&<span style={{ color:'#00d4aa', fontSize:11 }}>✓ {passed} passed</span>}
            {failed>0&&<span style={{ color:'#f87171', fontSize:11 }}>✗ {failed} failed</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function SpinnerChar({ color }) {
  const [f, setF] = useState(0);
  const frames = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'];
  useEffect(() => { const t = setInterval(()=>setF(n=>(n+1)%frames.length),80); return ()=>clearInterval(t); },[]);
  return <span style={{ color:'#00d4aa', fontSize:13 }}>{frames[f]}</span>;
}

// ── Theme picker ──────────────────────────────────────────────
function ThemePicker({ currentTheme, onChange, T }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position:'relative' }}>
      <button onClick={()=>setOpen(p=>!p)} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:8, border:`1px solid ${T.border}`, background:T.bgCard, color:T.textSub, cursor:'pointer', fontSize:13, fontWeight:600, boxShadow:T.shadow }}>
        {THEMES[currentTheme]?.icon} {THEMES[currentTheme]?.name} ▾
      </button>
      {open && (
        <div style={{ position:'absolute', top:'110%', right:0, background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:12, padding:'8px', boxShadow:T.shadowHover, zIndex:200, minWidth:160 }}>
          {Object.entries(THEMES).map(([key, theme]) => (
            <button key={key} onClick={()=>{ onChange(key); setOpen(false); }} style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderRadius:8, border:'none', background: currentTheme===key ? T.accentDim : 'transparent', color: currentTheme===key ? T.accentText : T.textSub, cursor:'pointer', fontSize:13, fontWeight: currentTheme===key?700:400, textAlign:'left' }}>
              <span style={{ fontSize:16 }}>{theme.icon}</span> {theme.name}
              {currentTheme===key && <span style={{ marginLeft:'auto', color:T.accent, fontSize:11 }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Scroll reveal ─────────────────────────────────────────────
function Reveal({ children, delay=0 }) {
  const ref = useRef(null);
  const [vis, setVis] = useState(false);
  useEffect(()=>{
    const obs = new IntersectionObserver(([e])=>{ if(e.isIntersecting) setVis(true); },{ threshold:0.12 });
    if(ref.current) obs.observe(ref.current);
    return ()=>obs.disconnect();
  },[]);
  return (
    <div ref={ref} style={{ transition:`opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`, opacity:vis?1:0, transform:vis?'translateY(0)':'translateY(24px)' }}>
      {children}
    </div>
  );
}

// ── Enterprise Contact Form ───────────────────────────────────
function EnterpriseModal({ T, onClose }) {
  const [form, setForm] = useState({ name:'', email:'', company:'', size:'', message:'', phone:'' });
  const [status, setStatus] = useState(''); // '' | 'sending' | 'sent' | 'error'
  const set = (k,v) => setForm(p=>({...p,[k]:v}));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.company) return;
    setStatus('sending');
    try {
      // Send via EmailJS / FormSubmit (no backend needed)
      const res = await fetch('https://formsubmit.co/ajax/unitedbusinessglobal@gmail.com', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'Accept':'application/json' },
        body: JSON.stringify({
          _subject: `TestItNow Enterprise Enquiry — ${form.company}`,
          name: form.name,
          email: form.email,
          company: form.company,
          companySize: form.size,
          phone: form.phone,
          message: form.message || 'Please contact me about Enterprise pricing.',
          _template: 'table',
        }),
      });
      if (res.ok) { setStatus('sent'); }
      else { setStatus('error'); }
    } catch { setStatus('error'); }
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:24, backdropFilter:'blur(4px)' }} onClick={onClose}>
      <div style={{ background:T.bgCard, borderRadius:20, padding:'32px', maxWidth:520, width:'100%', boxShadow:T.shadowHover, border:`1px solid ${T.border}` }} onClick={e=>e.stopPropagation()}>
        {status === 'sent' ? (
          <div style={{ textAlign:'center', padding:'24px 0' }}>
            <div style={{ fontSize:48, marginBottom:16 }}>✅</div>
            <h2 style={{ color:T.text, fontSize:22, fontWeight:800, marginBottom:8 }}>Message sent!</h2>
            <p style={{ color:T.textSub, marginBottom:24 }}>We'll be in touch at <strong>{form.email}</strong> within 24 hours.</p>
            <button onClick={onClose} style={{ padding:'10px 28px', borderRadius:10, border:'none', background:T.accent, color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer' }}>Close</button>
          </div>
        ) : (
          <>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
              <div>
                <h2 style={{ color:T.text, fontSize:22, fontWeight:900, marginBottom:4 }}>Enterprise Enquiry</h2>
                <p style={{ color:T.textSub, fontSize:14 }}>We'll contact you within 24 hours.</p>
              </div>
              <button onClick={onClose} style={{ background:'none', border:'none', color:T.textMuted, cursor:'pointer', fontSize:20, padding:4 }}>✕</button>
            </div>
            <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {[['name','Full Name *','text','John Smith'],['email','Work Email *','email','john@company.com'],['company','Company *','text','Acme Corp'],['phone','Phone','tel','+1 555 123 4567']].map(([k,l,type,ph])=>(
                  <div key={k}>
                    <label style={{ color:T.textMuted, fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:4 }}>{l}</label>
                    <input type={type} value={form[k]} onChange={e=>set(k,e.target.value)} placeholder={ph} required={k!=='phone'} style={{ width:'100%', padding:'9px 12px', border:`1px solid ${T.border}`, borderRadius:8, background:T.inputBg, color:T.text, fontSize:13, outline:'none', fontFamily:'inherit' }}/>
                  </div>
                ))}
              </div>
              <div>
                <label style={{ color:T.textMuted, fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:4 }}>Team Size</label>
                <select value={form.size} onChange={e=>set('size',e.target.value)} style={{ width:'100%', padding:'9px 12px', border:`1px solid ${T.border}`, borderRadius:8, background:T.inputBg, color:T.text, fontSize:13, outline:'none' }}>
                  <option value="">Select team size</option>
                  {['1–10','11–50','51–200','201–500','500+'].map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ color:T.textMuted, fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:4 }}>Message (optional)</label>
                <textarea value={form.message} onChange={e=>set('message',e.target.value)} placeholder="Tell us about your testing needs, integrations required, or any questions…" rows={3} style={{ width:'100%', padding:'9px 12px', border:`1px solid ${T.border}`, borderRadius:8, background:T.inputBg, color:T.text, fontSize:13, outline:'none', resize:'vertical', fontFamily:'inherit' }}/>
              </div>
              {status === 'error' && <p style={{ color:'#ef4444', fontSize:12 }}>Failed to send. Please email us directly at unitedbusinessglobal@gmail.com</p>}
              <button type="submit" disabled={status==='sending'} style={{ padding:'12px', borderRadius:10, border:'none', background:`linear-gradient(135deg,${T.accent},${T.blue})`, color:'#fff', fontSize:15, fontWeight:700, cursor: status==='sending'?'wait':'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                {status==='sending' ? 'Sending…' : 'Send Enquiry →'}
              </button>
              <p style={{ color:T.textMuted, fontSize:11, textAlign:'center' }}>We'll reply to <strong>{form.email||'your email'}</strong> within 24 hours.</p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// ── Nav ───────────────────────────────────────────────────────
function Nav({ T, theme, setTheme, onLogin, onEnterApp }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(()=>{
    const fn = ()=>setScrolled(window.scrollY>30);
    window.addEventListener('scroll',fn,{passive:true});
    return ()=>window.removeEventListener('scroll',fn);
  },[]);

  return (
    <nav style={{ position:'fixed', top:0, left:0, right:0, zIndex:100, background: scrolled ? T.navBg : 'transparent', backdropFilter: scrolled ? 'blur(20px)' : 'none', borderBottom: scrolled ? `1px solid ${T.border}` : 'none', transition:'all 0.3s', padding:'0 max(24px,calc(50% - 580px))' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', height:64 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:8, background:`linear-gradient(135deg,${T.accent},${T.blue})`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>⚡</div>
          <span style={{ color:T.text, fontWeight:900, fontSize:18, letterSpacing:'-0.5px' }}>TestIt<span style={{ color:T.accent }}>Now</span></span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:28 }}>
          {['Features','How it works','Pricing'].map(l=>(
            <a key={l} href={`#${l.toLowerCase().replace(/\s+/g,'-')}`} style={{ color:T.textSub, fontSize:14, textDecoration:'none', fontWeight:500 }}
              onMouseEnter={e=>e.target.style.color=T.text} onMouseLeave={e=>e.target.style.color=T.textSub}>{l}</a>
          ))}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <ThemePicker currentTheme={theme} onChange={setTheme} T={T}/>
          <button onClick={onLogin} style={{ padding:'7px 16px', borderRadius:8, border:`1px solid ${T.border}`, background:'transparent', color:T.textSub, fontSize:13, fontWeight:600, cursor:'pointer' }}
            onMouseEnter={e=>{ e.currentTarget.style.borderColor=T.accent; e.currentTarget.style.color=T.accent; }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor=T.border; e.currentTarget.style.color=T.textSub; }}>
            Sign in
          </button>
          <button onClick={onEnterApp} style={{ padding:'8px 18px', borderRadius:8, border:'none', background:`linear-gradient(135deg,${T.accent},${T.blue})`, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', boxShadow:`0 4px 16px ${T.accent}40` }}
            onMouseEnter={e=>e.currentTarget.style.transform='scale(1.04)'} onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
            Start free →
          </button>
        </div>
      </div>
    </nav>
  );
}

// ── Hero ──────────────────────────────────────────────────────
function Hero({ T, onEnterApp, onLogin, theme }) {
  const srcTabs = [
    { id:'url',    icon:'🌐', label:'Website URL',    ph:'https://yourapp.com' },
    { id:'github', icon:'🐙', label:'GitHub Repo',    ph:'owner/repo or full URL' },
    { id:'gitlab', icon:'🦊', label:'GitLab Project', ph:'namespace/project' },
    { id:'azure',  icon:'☁️', label:'Azure DevOps',   ph:'org/project' },
    { id:'upload', icon:'📁', label:'Upload Code',    ph:'' },
  ];
  const [srcType, setSrcType] = useState('url');
  const [urlVal,  setUrlVal]  = useState('');

  return (
    <section style={{ minHeight:'100vh', display:'flex', flexDirection:'column', justifyContent:'center', padding:'120px max(24px,calc(50% - 580px)) 80px', position:'relative', overflow:'hidden' }}>
      {/* Subtle gradient orbs */}
      <div style={{ position:'absolute', top:'15%', right:'10%', width:500, height:500, borderRadius:'50%', background:`radial-gradient(circle, ${T.accentDim} 0%, transparent 70%)`, pointerEvents:'none' }}/>
      <div style={{ position:'absolute', bottom:'20%', left:'5%', width:400, height:400, borderRadius:'50%', background:`radial-gradient(circle, ${T.accentDim.replace(T.accent,T.blue)} 0%, transparent 70%)`, pointerEvents:'none' }}/>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:64, alignItems:'center' }}>
        <div>
          <Reveal>
            <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:T.accentDim, border:`1px solid ${T.borderAcc}`, borderRadius:20, padding:'5px 14px', marginBottom:24 }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:T.accent, display:'inline-block' }}/>
              <span style={{ color:T.accentText, fontSize:12, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase' }}>AI-Powered Test Generation</span>
            </div>
          </Reveal>
          <Reveal delay={60}>
            <h1 style={{ fontSize:'clamp(34px,4.5vw,56px)', fontWeight:900, lineHeight:1.08, letterSpacing:'-2px', marginBottom:20, color:T.text }}>
              Test everything.<br/>
              <span style={{ background:`linear-gradient(90deg,${T.accent},${T.blue})`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Miss nothing.</span>
            </h1>
          </Reveal>
          <Reveal delay={120}>
            <p style={{ fontSize:17, lineHeight:1.7, color:T.textSub, marginBottom:32, maxWidth:460 }}>
              Point TestItNow at any website, GitHub repo, or codebase. Get 1,000+ comprehensive test cases — UI, API, security, performance — in under 60 seconds.
            </p>
          </Reveal>

          {/* ── ANALYZE BOX WITH ALL SOURCE OPTIONS ── */}
          <Reveal delay={180}>
            <div style={{ background:T.bgCard, border:`1.5px solid ${T.border}`, borderRadius:16, overflow:'hidden', boxShadow:T.shadow, marginBottom:28 }}>
              {/* Source type tabs */}
              <div style={{ display:'flex', borderBottom:`1px solid ${T.border}`, background:T.bg }}>
                {srcTabs.map(s=>(
                  <button key={s.id} onClick={()=>setSrcType(s.id)} style={{ flex:1, padding:'9px 4px', border:'none', cursor:'pointer', fontSize:11, fontWeight: srcType===s.id?700:400, background: srcType===s.id ? T.bgCard : 'transparent', color: srcType===s.id ? T.accent : T.textMuted, borderBottom: srcType===s.id ? `2px solid ${T.accent}` : '2px solid transparent', transition:'all 0.15s' }}>
                    <span style={{ display:'block', fontSize:14, marginBottom:2 }}>{s.icon}</span>
                    <span style={{ display:'block', fontSize:10, whiteSpace:'nowrap' }}>{s.label}</span>
                  </button>
                ))}
              </div>
              {/* Input area */}
              {srcType !== 'upload' ? (
                <div style={{ display:'flex', alignItems:'center', padding:'12px 16px', gap:10 }}>
                  <input value={urlVal} onChange={e=>setUrlVal(e.target.value)} placeholder={srcTabs.find(s=>s.id===srcType)?.ph} onKeyDown={e=>e.key==='Enter'&&onEnterApp()}
                    style={{ flex:1, border:'none', outline:'none', background:'transparent', color:T.text, fontSize:14, fontFamily:'inherit' }}/>
                  <button onClick={onEnterApp} style={{ padding:'8px 18px', borderRadius:9, border:'none', background:`linear-gradient(135deg,${T.accent},${T.blue})`, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>Analyze →</button>
                </div>
              ) : (
                <div style={{ padding:'20px', textAlign:'center' }}>
                  <button onClick={onEnterApp} style={{ padding:'10px 28px', borderRadius:9, border:`1px dashed ${T.border}`, background:T.accentDim, color:T.accentText, fontSize:13, fontWeight:600, cursor:'pointer' }}>📁 Upload files →</button>
                </div>
              )}
              {/* OAuth options for repo sources */}
              {['github','gitlab','azure'].includes(srcType) && (
                <div style={{ borderTop:`1px solid ${T.border}`, padding:'8px 16px', display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ color:T.textMuted, fontSize:11 }}>Connect:</span>
                  <button onClick={onEnterApp} style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:7, border:`1px solid ${T.border}`, background:T.bg, color:T.textSub, fontSize:11, fontWeight:600, cursor:'pointer' }}>
                    {{github:'🐙 GitHub OAuth',gitlab:'🦊 GitLab OAuth',azure:'☁️ Azure OAuth'}[srcType]}
                  </button>
                  <span style={{ color:T.textMuted, fontSize:11 }}>or paste PAT</span>
                  <input placeholder="Personal Access Token" type="password" style={{ flex:1, border:`1px solid ${T.border}`, borderRadius:7, padding:'5px 10px', background:T.inputBg, color:T.text, fontSize:11, outline:'none' }}/>
                </div>
              )}
            </div>
          </Reveal>

          <Reveal delay={240}>
            <div style={{ display:'flex', gap:24 }}>
              {[{val:'1,000+',label:'Tests per analysis'},{val:'20',label:'Pages crawled'},{val:'6',label:'Test categories'}].map(({val,label})=>(
                <div key={label}>
                  <div style={{ color:T.accent, fontWeight:900, fontSize:22, fontFamily:'monospace' }}>{val}</div>
                  <div style={{ color:T.textMuted, fontSize:12 }}>{label}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>

        {/* Right — dark terminal (always dark for readability) */}
        <Reveal delay={200}>
          <AnimatedTerminal T={T}/>
        </Reveal>
      </div>
    </section>
  );
}

// ── Features ──────────────────────────────────────────────────
function Features({ T }) {
  const features = [
    { icon:'🌐', title:'Website Crawler',    desc:'Crawls all pages, parses every form, button, table, dropdown, modal — even on React SPAs.' },
    { icon:'🐙', title:'GitHub & GitLab',    desc:'Detect stack, extract routes, analyse components, generate tests matched to your tech.' },
    { icon:'☁️', title:'Azure DevOps',       desc:'Connect Azure repos, sync test plans, export results back to Azure Test Plans.' },
    { icon:'📁', title:'Source Upload',      desc:'Upload JS, TS, Python, Go, Java files. Parse code and generate tests without execution.' },
    { icon:'🛡️', title:'Security First',     desc:'SQL injection, XSS, CSRF, clickjacking, JWT tampering — OWASP Top 10 built in.' },
    { icon:'⚡', title:'100+ per page',      desc:'5 responsive breakpoints, 5 browsers, 8 accessibility checks, 8 SEO checks per page.' },
    { icon:'📊', title:'All report formats', desc:'HTML (with screenshots), Excel, PDF, Word, XML. Push to Jira. Screenshots embedded.' },
    { icon:'💾', title:'Smart caching',      desc:'Already analyzed? Load 1,000 tests instantly from cache. Re-analyze only on changes.' },
  ];

  return (
    <section id="features" style={{ padding:'80px max(24px,calc(50% - 580px))', background:T.bg }}>
      <Reveal>
        <div style={{ textAlign:'center', marginBottom:52 }}>
          <div style={{ color:T.accentText, fontSize:12, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:10 }}>Capabilities</div>
          <h2 style={{ fontSize:'clamp(26px,3.5vw,42px)', fontWeight:900, color:T.text, letterSpacing:'-1.5px', marginBottom:12 }}>Everything you need to test with confidence</h2>
          <p style={{ color:T.textSub, fontSize:15, maxWidth:500, margin:'0 auto' }}>From first click to full report — no test writing, no config, no guesswork.</p>
        </div>
      </Reveal>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:14 }}>
        {features.map((f,i)=>(
          <Reveal key={f.title} delay={i*50}>
            <div style={{ background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:14, padding:'24px', boxShadow:T.shadow, transition:'all 0.25s', cursor:'default' }}
              onMouseEnter={e=>{ e.currentTarget.style.boxShadow=T.shadowHover; e.currentTarget.style.borderColor=T.borderAcc; e.currentTarget.style.transform='translateY(-3px)'; }}
              onMouseLeave={e=>{ e.currentTarget.style.boxShadow=T.shadow; e.currentTarget.style.borderColor=T.border; e.currentTarget.style.transform='translateY(0)'; }}>
              <div style={{ fontSize:26, marginBottom:12 }}>{f.icon}</div>
              <h3 style={{ color:T.text, fontWeight:700, fontSize:15, marginBottom:7 }}>{f.title}</h3>
              <p style={{ color:T.textSub, fontSize:13, lineHeight:1.65 }}>{f.desc}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ── How it works ──────────────────────────────────────────────
function HowItWorks({ T }) {
  const [active, setActive] = useState(0);
  const steps = [
    { step:'01', title:'Enter your source', desc:'Website URL, GitHub/GitLab/Azure repo, or upload source code directly.',
      visual: (
        <div style={{ background:'#0a0f1e', borderRadius:12, padding:'20px', border:'1px solid rgba(0,212,170,0.15)', fontFamily:'monospace', fontSize:12 }}>
          <div style={{ display:'flex', gap:6, marginBottom:12 }}>
            {['🌐 Website','🐙 GitHub','🦊 GitLab','☁️ Azure','📁 Upload'].map((t,i)=>(
              <span key={t} style={{ padding:'4px 8px', borderRadius:6, fontSize:10, background: i===0?'#00d4aa':'rgba(255,255,255,0.08)', color: i===0?'#0a0f1e':'#6b7fa3' }}>{t}</span>
            ))}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8, background:'#111b3a', borderRadius:8, padding:'10px 14px' }}>
            <span style={{ color:'#00d4aa' }}>🌐</span>
            <span style={{ color:'#94a3b8', flex:1 }}>https://yourapp.com</span>
            <span style={{ background:'#00d4aa', color:'#0a0f1e', padding:'4px 12px', borderRadius:6, fontSize:11, fontWeight:700 }}>Analyze →</span>
          </div>
        </div>
      )},
    { step:'02', title:'Deep analysis', desc:'Crawl every page, detect tech stack, extract routes, parse all elements.',
      visual: (
        <div style={{ background:'#0a0f1e', borderRadius:12, padding:'18px', border:'1px solid rgba(0,212,170,0.15)', fontFamily:'monospace', fontSize:12 }}>
          {[['Crawling pages','20 found','#00d4aa'],['Detecting stack','React · Node','#60a5fa'],['Parsing forms','8 forms','#00d4aa'],['Finding routes','34 routes','#00d4aa'],['Generating tests','847 cases ✓','#4ade80']].map(([k,v,c])=>(
            <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ color:'#6b7fa3' }}>⟶ {k}</span><span style={{ color:c }}>{v}</span>
            </div>
          ))}
        </div>
      )},
    { step:'03', title:'847 test cases', desc:'UI, API, Security, Performance, Database, Unit — all pre-written with steps.',
      visual: (
        <div style={{ background:'#0a0f1e', borderRadius:12, padding:'14px', border:'1px solid rgba(0,212,170,0.15)', fontFamily:'monospace', fontSize:11 }}>
          {[{id:'TC-UI-001',name:'Login form submission',type:'UI',p:'Critical'},{id:'TC-SEC-001',name:'SQL injection test',type:'Security',p:'Critical'},{id:'TC-API-001',name:'POST /api/auth/login',type:'API',p:'High'},{id:'TC-PERF-001',name:'LCP < 2.5s',type:'Perf',p:'High'}].map(tc=>(
            <div key={tc.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 6px', borderRadius:5, marginBottom:3, background:'rgba(255,255,255,0.03)' }}>
              <span style={{ color:'#6b7fa3', minWidth:70 }}>{tc.id}</span>
              <span style={{ color:'#e2e8f0', flex:1 }}>{tc.name}</span>
              <span style={{ color:'#00d4aa', fontSize:10, background:'rgba(0,212,170,0.1)', padding:'2px 5px', borderRadius:3 }}>{tc.type}</span>
            </div>
          ))}
          <div style={{ color:'#6b7fa3', textAlign:'center', marginTop:6 }}>+ 843 more</div>
        </div>
      )},
    { step:'04', title:'Run & report', desc:'Execute, capture screenshots of the tested site, export in all formats, push to Jira.',
      visual: (
        <div style={{ background:'#0a0f1e', borderRadius:12, padding:'18px', border:'1px solid rgba(0,212,170,0.15)' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
            {[{l:'Passed',v:'821',c:'#4ade80'},{l:'Failed',v:'26',c:'#f87171'},{l:'Pass Rate',v:'97%',c:'#00d4aa'},{l:'Duration',v:'4.2s',c:'#6b7fa3'}].map(s=>(
              <div key={s.l} style={{ background:'rgba(255,255,255,0.04)', borderRadius:7, padding:'10px', textAlign:'center' }}>
                <div style={{ color:s.c, fontSize:18, fontWeight:800 }}>{s.v}</div>
                <div style={{ color:'#6b7fa3', fontSize:10 }}>{s.l}</div>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
            {['📊 Excel','📄 PDF','🌐 HTML','📝 Word','🔗 XML','🐛 Jira'].map(b=>(
              <span key={b} style={{ fontSize:10, padding:'4px 8px', borderRadius:5, background:'rgba(0,212,170,0.1)', color:'#00d4aa', border:'1px solid rgba(0,212,170,0.2)' }}>{b}</span>
            ))}
          </div>
        </div>
      )},
  ];

  useEffect(()=>{
    const t = setInterval(()=>setActive(a=>(a+1)%steps.length),3500);
    return ()=>clearInterval(t);
  },[]);

  return (
    <section id="how-it-works" style={{ padding:'80px max(24px,calc(50% - 580px))', background:T.bgAlt }}>
      <Reveal>
        <div style={{ textAlign:'center', marginBottom:52 }}>
          <div style={{ color:T.accentText, fontSize:12, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:10 }}>How it works</div>
          <h2 style={{ fontSize:'clamp(26px,3.5vw,42px)', fontWeight:900, color:T.text, letterSpacing:'-1.5px' }}>URL to full test suite in 4 steps</h2>
        </div>
      </Reveal>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1.2fr', gap:64, alignItems:'start' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          {steps.map((s,i)=>(
            <Reveal key={s.step} delay={i*70}>
              <div onClick={()=>setActive(i)} style={{ padding:'18px 20px', borderRadius:12, cursor:'pointer', background: active===i ? T.accentDim : 'transparent', border: `1px solid ${active===i ? T.borderAcc : 'transparent'}`, transition:'all 0.25s' }}>
                <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                  <div style={{ width:36, height:36, borderRadius:8, flexShrink:0, background: active===i ? `linear-gradient(135deg,${T.accent},${T.blue})` : T.bgCard, border: active===i ? 'none' : `1px solid ${T.border}`, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'monospace', fontSize:12, fontWeight:800, color: active===i ? '#fff' : T.textMuted, transition:'all 0.25s' }}>{s.step}</div>
                  <div>
                    <div style={{ color: active===i ? T.text : T.textSub, fontWeight:700, fontSize:15, marginBottom:3 }}>{s.title}</div>
                    <div style={{ color:T.textMuted, fontSize:13, lineHeight:1.5 }}>{s.desc}</div>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={100}>
          <div style={{ position:'sticky', top:120 }}>{steps[active].visual}</div>
        </Reveal>
      </div>
    </section>
  );
}

// ── Pricing with Enterprise ────────────────────────────────────
function Pricing({ T, onEnterApp, onEnterprise }) {
  const plans = [
    { name:'Free', price:'$0', period:'/month', highlight:false, badge:null,
      features:['5 test runs/month','Unlimited test generation','1 project','CSV export','Community support'],
      cta:'Start free', ctaAction: onEnterApp },
    { name:'Pro', price:'$29', period:'/month', highlight:true, badge:'Most Popular',
      features:['100 test runs/month','1,000+ tests per analysis','5 projects','All export formats (HTML, PDF, Word, XML)','Jira & Azure DevOps','Screenshot capture','Priority support'],
      cta:'Start Pro trial', ctaAction: onEnterApp },
    { name:'Business', price:'$99', period:'/month', highlight:false, badge:null,
      features:['500 test runs/month','5,000 tests per analysis','20 projects','20 team members','Test plan iterations','Automated scripts (Playwright, Cypress, k6)','Dedicated Slack'],
      cta:'Start Business trial', ctaAction: onEnterApp },
    { name:'Enterprise', price:'Custom', period:'', highlight:false, badge:'Contact us',
      features:['Unlimited everything','Self-hosted option','SSO / SAML','Custom integrations','SLA & uptime guarantee','Dedicated account manager','On-premise deployment','Custom contracts'],
      cta:'Contact Sales', ctaAction: onEnterprise },
  ];

  return (
    <section id="pricing" style={{ padding:'80px max(24px,calc(50% - 580px))', background:T.bg }}>
      <Reveal>
        <div style={{ textAlign:'center', marginBottom:52 }}>
          <div style={{ color:T.accentText, fontSize:12, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:10 }}>Pricing</div>
          <h2 style={{ fontSize:'clamp(26px,3.5vw,42px)', fontWeight:900, color:T.text, letterSpacing:'-1.5px', marginBottom:10 }}>Simple, transparent pricing</h2>
          <p style={{ color:T.textSub, fontSize:15 }}>Start free. Upgrade when you need more. Cancel anytime.</p>
        </div>
      </Reveal>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:14, maxWidth:1100, margin:'0 auto' }}>
        {plans.map((plan,i)=>(
          <Reveal key={plan.name} delay={i*70}>
            <div style={{ background: plan.highlight ? T.accentDim : T.bgCard, border: `1px solid ${plan.highlight ? T.borderAcc : T.border}`, borderRadius:18, padding:'26px', position:'relative', boxShadow: plan.highlight ? `0 8px 32px ${T.accent}25` : T.shadow, height:'100%', display:'flex', flexDirection:'column' }}>
              {plan.badge && (
                <div style={{ position:'absolute', top:-12, left:'50%', transform:'translateX(-50%)', background:`linear-gradient(90deg,${T.accent},${T.blue})`, color:'#fff', fontSize:11, fontWeight:800, padding:'3px 14px', borderRadius:20, whiteSpace:'nowrap' }}>{plan.badge}</div>
              )}
              <div style={{ color:T.textMuted, fontSize:13, fontWeight:600, marginBottom:6 }}>{plan.name}</div>
              <div style={{ marginBottom:18 }}>
                <span style={{ color:T.text, fontSize: plan.price==='Custom'?28:34, fontWeight:900 }}>{plan.price}</span>
                {plan.period && <span style={{ color:T.textMuted, fontSize:14 }}>{plan.period}</span>}
              </div>
              <ul style={{ listStyle:'none', padding:0, marginBottom:20, display:'flex', flexDirection:'column', gap:8, flex:1 }}>
                {plan.features.map(f=>(
                  <li key={f} style={{ display:'flex', alignItems:'flex-start', gap:8, fontSize:13, color:T.textSub, lineHeight:1.4 }}>
                    <span style={{ color:T.accent, marginTop:1 }}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <button onClick={plan.ctaAction} style={{ padding:'11px', borderRadius:10, border: plan.highlight ? 'none' : `1px solid ${T.borderAcc}`, background: plan.highlight ? `linear-gradient(135deg,${T.accent},${T.blue})` : plan.name==='Enterprise' ? `linear-gradient(135deg,${T.blue},${T.accent})` : 'transparent', color: (plan.highlight||plan.name==='Enterprise') ? '#fff' : T.accentText, fontSize:14, fontWeight:700, cursor:'pointer', transition:'all 0.2s' }}
                onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'} onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>
                {plan.cta}
              </button>
              {plan.name==='Enterprise' && (
                <p style={{ color:T.textMuted, fontSize:11, textAlign:'center', marginTop:8 }}>
                  or email us at <a href="mailto:unitedbusinessglobal@gmail.com" style={{ color:T.accentText }}>unitedbusinessglobal@gmail.com</a>
                </p>
              )}
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ── CTA ───────────────────────────────────────────────────────
function CTA({ T, onEnterApp }) {
  return (
    <section style={{ padding:'60px max(24px,calc(50% - 580px)) 100px' }}>
      <Reveal>
        <div style={{ background:`linear-gradient(135deg,${T.accentDim},${T.accentDim.replace(T.accent,T.blue)})`, border:`1px solid ${T.borderAcc}`, borderRadius:24, padding:'56px 48px', textAlign:'center', position:'relative', overflow:'hidden' }}>
          <h2 style={{ fontSize:'clamp(26px,4vw,46px)', fontWeight:900, color:T.text, letterSpacing:'-1.5px', marginBottom:14 }}>
            Ship with confidence.<br/>
            <span style={{ color:T.accent }}>Start testing in 60 seconds.</span>
          </h2>
          <p style={{ color:T.textSub, fontSize:15, marginBottom:32, maxWidth:440, margin:'0 auto 32px' }}>No credit card. No setup. Paste your URL and get 1,000 test cases instantly.</p>
          <button onClick={onEnterApp} style={{ padding:'15px 36px', borderRadius:12, border:'none', background:`linear-gradient(135deg,${T.accent},${T.blue})`, color:'#fff', fontSize:16, fontWeight:800, cursor:'pointer', boxShadow:`0 8px 32px ${T.accent}40` }}
            onMouseEnter={e=>{ e.currentTarget.style.transform='scale(1.04)'; }} onMouseLeave={e=>{ e.currentTarget.style.transform='scale(1)'; }}>
            Analyze your app free →
          </button>
        </div>
      </Reveal>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────
function Footer({ T }) {
  return (
    <footer style={{ padding:'24px max(24px,calc(50% - 580px))', borderTop:`1px solid ${T.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12, background:T.bg }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <div style={{ width:24, height:24, borderRadius:6, background:`linear-gradient(135deg,${T.accent},${T.blue})`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12 }}>⚡</div>
        <span style={{ color:T.textMuted, fontSize:13 }}>TestItNow · United Business Global · © {new Date().getFullYear()}</span>
      </div>
      <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
        {['Privacy','Terms','Contact'].map(l=>(
          <a key={l} href="#" style={{ color:T.textMuted, fontSize:13, textDecoration:'none' }}
            onMouseEnter={e=>e.target.style.color=T.text} onMouseLeave={e=>e.target.style.color=T.textMuted}>{l}</a>
        ))}
        <a href="mailto:unitedbusinessglobal@gmail.com" style={{ color:T.accentText, fontSize:13, textDecoration:'none', fontWeight:600 }}>unitedbusinessglobal@gmail.com</a>
      </div>
    </footer>
  );
}

// ── MAIN EXPORT ───────────────────────────────────────────────
export default function LandingPage({ onEnterApp, onLogin, theme, setTheme }) {
  const [showEnterprise, setShowEnterprise] = useState(false);
  const T = getTheme(theme || 'light');

  return (
    <div style={{ background:T.bg, minHeight:'100vh', color:T.text, fontFamily:"-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif" }}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0} html{scroll-behavior:smooth} ::-webkit-scrollbar{width:5px} ::-webkit-scrollbar-thumb{background:${T.border};border-radius:3px}`}</style>

      {showEnterprise && <EnterpriseModal T={T} onClose={()=>setShowEnterprise(false)}/>}

      <Nav T={T} theme={theme} setTheme={setTheme} onLogin={onLogin} onEnterApp={onEnterApp}/>
      <Hero T={T} onEnterApp={onEnterApp} onLogin={onLogin} theme={theme}/>
      <Features T={T}/>
      <HowItWorks T={T}/>
      <Pricing T={T} onEnterApp={onEnterApp} onEnterprise={()=>setShowEnterprise(true)}/>
      <CTA T={T} onEnterApp={onEnterApp}/>
      <Footer T={T}/>
    </div>
  );
}
