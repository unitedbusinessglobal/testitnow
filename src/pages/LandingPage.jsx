// ============================================================
// LandingPage.jsx — Professional landing page for TestItNow
// Theme: Deep navy + electric teal + clean typography
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';

// ─────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────
const T = {
  navy:     '#0a0f1e',
  navyMid:  '#0d1530',
  navyLight:'#111b3a',
  teal:     '#00d4aa',
  tealDim:  '#00b893',
  blue:     '#3b82f6',
  blueDim:  '#2563eb',
  white:    '#ffffff',
  gray:     '#8b9cb8',
  grayDim:  '#4a5a7a',
  border:   'rgba(0,212,170,0.12)',
  glow:     'rgba(0,212,170,0.15)',
};

// ─────────────────────────────────────────────────────────────
// ANIMATED TERMINAL — the signature element
// ─────────────────────────────────────────────────────────────
const DEMO_TESTS = [
  { id:'TC-UI-001',  name:'Homepage loads successfully',         status:'pass', ms:234  },
  { id:'TC-UI-002',  name:'Login form — valid credentials',      status:'pass', ms:891  },
  { id:'TC-SEC-001', name:'SQL injection prevention',            status:'pass', ms:156  },
  { id:'TC-API-001', name:'POST /api/auth/login → 200',          status:'pass', ms:312  },
  { id:'TC-UI-003',  name:'Responsive layout — mobile 375px',    status:'pass', ms:445  },
  { id:'TC-SEC-002', name:'XSS in contact form fields',          status:'pass', ms:203  },
  { id:'TC-API-002', name:'GET /api/products — pagination',      status:'pass', ms:567  },
  { id:'TC-UI-004',  name:'Checkout form — card validation',     status:'fail', ms:1023 },
  { id:'TC-PERF-001','name':'Page LCP < 2.5s',                   status:'pass', ms:2340 },
  { id:'TC-UI-005',  name:'Password reset flow — end to end',    status:'pass', ms:788  },
  { id:'TC-DB-001',  name:'Connection pool health check',        status:'pass', ms:48   },
  { id:'TC-SEC-003', name:'CSRF token verification',             status:'pass', ms:189  },
];

function AnimatedTerminal() {
  const [visibleTests, setVisibleTests] = useState([]);
  const [running,      setRunning]      = useState(null);
  const [idx,          setIdx]          = useState(0);
  const [completed,    setCompleted]    = useState(false);

  useEffect(() => {
    if (idx >= DEMO_TESTS.length) {
      setRunning(null);
      setCompleted(true);
      setTimeout(() => {
        setVisibleTests([]);
        setIdx(0);
        setCompleted(false);
      }, 4000);
      return;
    }

    const test = DEMO_TESTS[idx];
    setRunning(test);

    const timer = setTimeout(() => {
      setVisibleTests(prev => [...prev, { ...test, done: true }]);
      setRunning(null);
      setTimeout(() => setIdx(i => i + 1), 180);
    }, Math.min(test.ms * 0.35, 600));

    return () => clearTimeout(timer);
  }, [idx]);

  const passed = visibleTests.filter(t => t.status === 'pass').length;
  const failed = visibleTests.filter(t => t.status === 'fail').length;

  return (
    <div style={{
      background: T.navy,
      border: `1px solid ${T.border}`,
      borderRadius: 16,
      fontFamily: "'SF Mono', 'Fira Code', monospace",
      fontSize: 12,
      overflow: 'hidden',
      boxShadow: `0 0 60px rgba(0,212,170,0.08), 0 32px 64px rgba(0,0,0,0.4)`,
    }}>
      {/* Window chrome */}
      <div style={{ background: T.navyLight, padding: '10px 16px', display:'flex', alignItems:'center', gap:8, borderBottom:`1px solid ${T.border}` }}>
        <div style={{ display:'flex', gap:6 }}>
          {['#ff5f57','#febc2e','#28c840'].map((c,i) => (
            <div key={i} style={{ width:11, height:11, borderRadius:'50%', background:c, opacity:0.9 }}/>
          ))}
        </div>
        <div style={{ flex:1, textAlign:'center', color:T.gray, fontSize:11 }}>
          testitnow — test runner
        </div>
      </div>

      {/* Terminal body */}
      <div style={{ padding: '16px 20px', minHeight: 320, maxHeight: 360, overflowY:'auto' }}>
        {/* Prompt */}
        <div style={{ color:T.teal, marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ color:T.gray }}>$</span>
          <span>testitnow analyze</span>
          <span style={{ color:'#60a5fa' }}>https://yourapp.com</span>
          <span style={{ color:T.gray }}>--pages 20</span>
        </div>

        <div style={{ color:T.gray, marginBottom:12, fontSize:11 }}>
          ✦ Crawled 20 pages · Detected: React, Node.js, PostgreSQL<br/>
          ✦ Generated 847 test cases · Running suite…
        </div>

        {/* Tests */}
        <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
          {visibleTests.map((test, i) => (
            <div key={test.id} style={{ display:'flex', alignItems:'center', gap:10, opacity: 1, animation:'fadeIn 0.2s ease' }}>
              <span style={{ color: test.status==='pass' ? T.teal : '#f87171', fontSize:13, fontWeight:'bold' }}>
                {test.status==='pass' ? '✓' : '✗'}
              </span>
              <span style={{ color:T.gray, minWidth:90, fontSize:10 }}>{test.id}</span>
              <span style={{ color: test.status==='pass' ? '#e2e8f0' : '#fca5a5', flex:1 }}>{test.name}</span>
              <span style={{ color:T.grayDim, fontSize:10 }}>{test.ms}ms</span>
            </div>
          ))}

          {running && (
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <Spinner />
              <span style={{ color:T.gray, minWidth:90, fontSize:10 }}>{running.id}</span>
              <span style={{ color:'#94a3b8' }}>{running.name}</span>
              <span style={{ color:T.grayDim, fontSize:10 }}>running…</span>
            </div>
          )}
        </div>

        {/* Summary */}
        {completed && (
          <div style={{
            marginTop:16, padding:'10px 14px',
            background:`rgba(0,212,170,0.08)`,
            border:`1px solid ${T.border}`,
            borderRadius:8,
            display:'flex', gap:20,
          }}>
            <span style={{ color:T.teal }}>✓ {passed} passed</span>
            {failed > 0 && <span style={{ color:'#f87171' }}>✗ {failed} failed</span>}
            <span style={{ color:T.gray }}>847 total · 2.3s</span>
            <span style={{ color:T.teal, marginLeft:'auto' }}>→ Report generated</span>
          </div>
        )}

        {!completed && (
          <div style={{ marginTop:12, display:'flex', gap:16 }}>
            {passed > 0 && <span style={{ color:T.teal, fontSize:11 }}>✓ {passed} passed</span>}
            {failed > 0 && <span style={{ color:'#f87171', fontSize:11 }}>✗ {failed} failed</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  const [frame, setFrame] = useState(0);
  const frames = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'];
  useEffect(() => {
    const t = setInterval(() => setFrame(f => (f+1) % frames.length), 80);
    return () => clearInterval(t);
  }, []);
  return <span style={{ color:T.teal, fontSize:13 }}>{frames[frame]}</span>;
}

// ─────────────────────────────────────────────────────────────
// INTERACTIVE DEMO STEPS
// ─────────────────────────────────────────────────────────────
const DEMO_STEPS = [
  {
    step: '01', title: 'Enter your source',
    desc: 'Paste a website URL, connect a GitHub/GitLab repository, or upload your source code directly.',
    visual: (
      <div style={{ padding:'20px 24px', background:T.navyLight, borderRadius:12, border:`1px solid ${T.border}`, fontFamily:'monospace', fontSize:13 }}>
        <div style={{ display:'flex', gap:8, marginBottom:12 }}>
          {['Website URL','GitHub','GitLab','Upload'].map((t,i) => (
            <span key={t} style={{
              padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:600,
              background: i===0 ? T.teal : 'transparent',
              color: i===0 ? T.navy : T.gray,
              border: i===0 ? 'none' : `1px solid ${T.border}`,
            }}>{t}</span>
          ))}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, background:T.navy, borderRadius:8, padding:'10px 14px', border:`1px solid ${T.border}` }}>
          <span style={{ color:T.teal }}>🌐</span>
          <span style={{ color:'#94a3b8', flex:1 }}>https://yourapp.com</span>
          <span style={{ background:T.teal, color:T.navy, padding:'4px 12px', borderRadius:6, fontSize:11, fontWeight:700 }}>Analyze →</span>
        </div>
      </div>
    ),
  },
  {
    step: '02', title: 'We crawl and understand',
    desc: 'Our engine fetches every page, parses every element — forms, buttons, tables, APIs — and detects your tech stack.',
    visual: (
      <div style={{ padding:'20px 24px', background:T.navyLight, borderRadius:12, border:`1px solid ${T.border}`, fontSize:12, fontFamily:'monospace' }}>
        {[
          ['Crawling pages',       '20 pages',    T.teal],
          ['Parsing forms',        '8 forms found', T.teal],
          ['Detecting stack',      'React · Node · Postgres', T.blue],
          ['Extracting routes',    '34 routes', T.teal],
          ['Scanning security',    '15 surfaces', '#f59e0b'],
          ['Generating tests',     '847 cases', T.teal],
        ].map(([label, val, color]) => (
          <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:`1px solid rgba(255,255,255,0.04)` }}>
            <span style={{ color:T.gray }}>⟶ {label}</span>
            <span style={{ color }}>{val}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    step: '03', title: '847 test cases, instantly',
    desc: 'Every page gets 100+ tests: UI, API, security, performance, database, and unit — all pre-written with steps and expected results.',
    visual: (
      <div style={{ padding:'16px', background:T.navyLight, borderRadius:12, border:`1px solid ${T.border}`, fontSize:11 }}>
        {[
          { id:'TC-UI-001', name:'Login form — valid submission', type:'UI', priority:'Critical', color:'#ef4444' },
          { id:'TC-SEC-001', name:'SQL injection — login fields', type:'Security', priority:'Critical', color:'#ef4444' },
          { id:'TC-API-001', name:'POST /api/auth/login → 200', type:'API', priority:'High', color:'#f97316' },
          { id:'TC-PERF-001', name:'Homepage LCP < 2.5s', type:'Perf', priority:'High', color:'#f97316' },
          { id:'TC-DB-001', name:'Users table — connection pool', type:'DB', priority:'High', color:'#f97316' },
        ].map(tc => (
          <div key={tc.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 8px', borderRadius:6, marginBottom:3, background:`rgba(255,255,255,0.03)` }}>
            <span style={{ color:T.gray, minWidth:76 }}>{tc.id}</span>
            <span style={{ color:'#e2e8f0', flex:1 }}>{tc.name}</span>
            <span style={{ color:T.teal, fontSize:10, background:`rgba(0,212,170,0.1)`, padding:'2px 6px', borderRadius:4 }}>{tc.type}</span>
            <span style={{ color:tc.color, fontSize:10, background:`rgba(255,255,255,0.05)`, padding:'2px 6px', borderRadius:4 }}>{tc.priority}</span>
          </div>
        ))}
        <div style={{ color:T.gray, marginTop:8, textAlign:'center' }}>+ 842 more test cases</div>
      </div>
    ),
  },
  {
    step: '04', title: 'Run and report',
    desc: 'Execute all tests, capture screenshots, report bugs to Jira, and download reports in Excel, PDF, Word, or XML.',
    visual: (
      <div style={{ padding:'20px 24px', background:T.navyLight, borderRadius:12, border:`1px solid ${T.border}` }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
          {[
            { label:'Passed', val:'821', color:T.teal },
            { label:'Failed', val:'26', color:'#f87171' },
            { label:'Pass rate', val:'97%', color:T.blue },
            { label:'Duration', val:'4.2s', color:T.gray },
          ].map(s => (
            <div key={s.label} style={{ background:`rgba(255,255,255,0.04)`, borderRadius:8, padding:'12px', textAlign:'center' }}>
              <div style={{ color:s.color, fontSize:20, fontWeight:800, fontFamily:'monospace' }}>{s.val}</div>
              <div style={{ color:T.gray, fontSize:11, marginTop:2 }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {['📊 Excel','📄 PDF','📝 Word','🔗 XML','🐛 Jira'].map(btn => (
            <span key={btn} style={{ fontSize:11, padding:'5px 10px', borderRadius:6, background:`rgba(0,212,170,0.1)`, border:`1px solid ${T.border}`, color:T.teal, cursor:'pointer' }}>
              {btn}
            </span>
          ))}
        </div>
      </div>
    ),
  },
];

// ─────────────────────────────────────────────────────────────
// SCROLL REVEAL HOOK
// ─────────────────────────────────────────────────────────────
function useReveal() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold:0.15 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

function Reveal({ children, delay=0, style={} }) {
  const [ref, visible] = useReveal();
  return (
    <div ref={ref} style={{
      transition:`opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(28px)',
      ...style,
    }}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// NAV
// ─────────────────────────────────────────────────────────────
function Nav({ onEnterApp, onLogin }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', fn, { passive:true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <nav style={{
      position:'fixed', top:0, left:0, right:0, zIndex:100,
      background: scrolled ? 'rgba(10,15,30,0.95)' : 'transparent',
      backdropFilter: scrolled ? 'blur(20px)' : 'none',
      borderBottom: scrolled ? `1px solid ${T.border}` : 'none',
      transition:'all 0.3s ease',
      padding:'0 max(24px, calc(50% - 580px))',
    }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', height:64 }}>
        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{
            width:32, height:32, borderRadius:8,
            background:`linear-gradient(135deg, ${T.teal}, ${T.blue})`,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:16,
          }}>⚡</div>
          <span style={{ color:T.white, fontWeight:800, fontSize:18, letterSpacing:'-0.5px' }}>
            TestIt<span style={{ color:T.teal }}>Now</span>
          </span>
        </div>

        {/* Links */}
        <div style={{ display:'flex', alignItems:'center', gap:32 }}>
          {['Features','How it works','Pricing'].map(l => (
            <a key={l} href={`#${l.toLowerCase().replace(/\s+/g,'-')}`}
              style={{ color:T.gray, fontSize:14, textDecoration:'none', transition:'color 0.2s' }}
              onMouseEnter={e=>e.target.style.color=T.white}
              onMouseLeave={e=>e.target.style.color=T.gray}>
              {l}
            </a>
          ))}
        </div>

        {/* CTAs */}
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button onClick={onLogin} style={{
            background:'transparent', border:`1px solid ${T.border}`,
            color:T.gray, padding:'8px 18px', borderRadius:8, fontSize:14,
            cursor:'pointer', transition:'all 0.2s',
          }}
          onMouseEnter={e=>{e.target.style.borderColor=T.teal;e.target.style.color=T.teal;}}
          onMouseLeave={e=>{e.target.style.borderColor=T.border;e.target.style.color=T.gray;}}>
            Sign in
          </button>
          <button onClick={onEnterApp} style={{
            background:`linear-gradient(135deg, ${T.teal}, ${T.blue})`,
            border:'none', color:T.navy, padding:'8px 20px', borderRadius:8,
            fontSize:14, fontWeight:700, cursor:'pointer',
            boxShadow:`0 0 20px rgba(0,212,170,0.3)`,
            transition:'all 0.2s',
          }}
          onMouseEnter={e=>e.target.style.transform='scale(1.04)'}
          onMouseLeave={e=>e.target.style.transform='scale(1)'}>
            Start free →
          </button>
        </div>
      </div>
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────
// SECTIONS
// ─────────────────────────────────────────────────────────────

function HeroSection({ onEnterApp, onLogin }) {
  return (
    <section style={{
      minHeight:'100vh',
      display:'flex', flexDirection:'column', justifyContent:'center',
      padding:'120px max(24px, calc(50% - 580px)) 80px',
      position:'relative', overflow:'hidden',
    }}>
      {/* Background gradient orbs */}
      <div style={{
        position:'absolute', top:'20%', left:'15%',
        width:500, height:500, borderRadius:'50%',
        background:`radial-gradient(circle, rgba(0,212,170,0.06) 0%, transparent 70%)`,
        pointerEvents:'none',
      }}/>
      <div style={{
        position:'absolute', top:'40%', right:'10%',
        width:400, height:400, borderRadius:'50%',
        background:`radial-gradient(circle, rgba(59,130,246,0.07) 0%, transparent 70%)`,
        pointerEvents:'none',
      }}/>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:64, alignItems:'center' }}>
        {/* Left — copy */}
        <div>
          <Reveal>
            <div style={{
              display:'inline-flex', alignItems:'center', gap:8,
              background:`rgba(0,212,170,0.08)`, border:`1px solid ${T.border}`,
              borderRadius:20, padding:'5px 14px', marginBottom:28,
            }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:T.teal, display:'inline-block' }}/>
              <span style={{ color:T.teal, fontSize:12, fontWeight:600, letterSpacing:'0.05em' }}>
                AI-POWERED TEST GENERATION
              </span>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <h1 style={{
              fontSize:'clamp(36px, 4.5vw, 58px)',
              fontWeight:900, lineHeight:1.08,
              letterSpacing:'-2px', marginBottom:24,
              color:T.white,
            }}>
              Test everything.<br/>
              <span style={{
                background:`linear-gradient(90deg, ${T.teal}, ${T.blue})`,
                WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
              }}>Miss nothing.</span>
            </h1>
          </Reveal>

          <Reveal delay={160}>
            <p style={{
              fontSize:17, lineHeight:1.7, color:T.gray,
              marginBottom:36, maxWidth:480,
            }}>
              Point TestItNow at any website, GitHub repo, or codebase.
              Get 1,000+ comprehensive test cases — UI, API, security, performance —
              in under 60 seconds. No setup. No configuration.
            </p>
          </Reveal>

          <Reveal delay={240}>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:40 }}>
              <button onClick={onEnterApp} style={{
                background:`linear-gradient(135deg, ${T.teal}, ${T.blue})`,
                border:'none', color:T.navy, padding:'14px 28px', borderRadius:10,
                fontSize:15, fontWeight:800, cursor:'pointer',
                boxShadow:`0 0 30px rgba(0,212,170,0.35)`,
                transition:'all 0.25s',
              }}
              onMouseEnter={e=>{ e.target.style.transform='translateY(-2px)'; e.target.style.boxShadow=`0 8px 40px rgba(0,212,170,0.45)`; }}
              onMouseLeave={e=>{ e.target.style.transform='translateY(0)'; e.target.style.boxShadow=`0 0 30px rgba(0,212,170,0.35)`; }}>
                Analyze your app free →
              </button>
              <button onClick={()=>document.getElementById('how-it-works')?.scrollIntoView({behavior:'smooth'})}
                style={{
                  background:'transparent', border:`1px solid ${T.border}`,
                  color:T.gray, padding:'14px 24px', borderRadius:10,
                  fontSize:15, fontWeight:600, cursor:'pointer', transition:'all 0.25s',
                }}
                onMouseEnter={e=>{ e.target.style.borderColor=T.teal; e.target.style.color=T.teal; }}
                onMouseLeave={e=>{ e.target.style.borderColor=T.border; e.target.style.color=T.gray; }}>
                See how it works
              </button>
            </div>
          </Reveal>

          <Reveal delay={320}>
            <div style={{ display:'flex', gap:24, flexWrap:'wrap' }}>
              {[
                { val:'1,000+', label:'Tests per analysis' },
                { val:'20+', label:'Pages crawled' },
                { val:'6', label:'Test categories' },
              ].map(({ val, label }) => (
                <div key={label}>
                  <div style={{ color:T.teal, fontWeight:800, fontSize:22, fontFamily:'monospace' }}>{val}</div>
                  <div style={{ color:T.gray, fontSize:12, marginTop:2 }}>{label}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>

        {/* Right — animated terminal */}
        <Reveal delay={200}>
          <AnimatedTerminal />
        </Reveal>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const features = [
    {
      icon:'🌐', title:'Website Crawler',
      desc:'Crawls all pages, parses every button, form, table, dropdown, modal, and link — even on React SPAs via JS bundle analysis.',
    },
    {
      icon:'🐙', title:'GitHub & GitLab',
      desc:'Connect any repo. We detect your stack, extract routes, analyse components, and generate tests matched to your exact tech.',
    },
    {
      icon:'📁', title:'Source Upload',
      desc:'Upload JS, TS, Python, Go, Java files directly. We parse your code and generate tests without executing it.',
    },
    {
      icon:'🛡️', title:'Security First',
      desc:'Every form gets SQL injection and XSS tests. Every API endpoint gets auth bypass tests. OWASP Top 10 coverage built in.',
    },
    {
      icon:'⚡', title:'100+ tests per page',
      desc:'5 responsive breakpoints, 5 browsers, 8 accessibility checks, 8 SEO checks, performance metrics, and element-level tests.',
    },
    {
      icon:'📊', title:'Reports everywhere',
      desc:'Download as Excel, PDF, Word, or XML. Push to Jira or Azure DevOps. Screenshots captured automatically for every failure.',
    },
    {
      icon:'💾', title:'Smart caching',
      desc:"Already analyzed this app? Load 1,000 test cases instantly from cache. Re-analyze only when you've made changes.",
    },
    {
      icon:'🔒', title:'Auth-aware testing',
      desc:'Provide credentials once. We test protected pages, auth flows, session persistence, and role-based access control.',
    },
  ];

  return (
    <section id="features" style={{ padding:'100px max(24px, calc(50% - 580px))' }}>
      <Reveal>
        <div style={{ textAlign:'center', marginBottom:64 }}>
          <div style={{ color:T.teal, fontSize:12, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:12 }}>
            CAPABILITIES
          </div>
          <h2 style={{ fontSize:'clamp(28px,3.5vw,44px)', fontWeight:900, color:T.white, letterSpacing:'-1.5px', marginBottom:16 }}>
            Everything you need to test confidently
          </h2>
          <p style={{ color:T.gray, fontSize:16, maxWidth:520, margin:'0 auto' }}>
            From first click to full report — no test writing, no configuration, no guesswork.
          </p>
        </div>
      </Reveal>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))', gap:16 }}>
        {features.map((f, i) => (
          <Reveal key={f.title} delay={i * 60}>
            <div style={{
              background:T.navyLight,
              border:`1px solid ${T.border}`,
              borderRadius:14, padding:'28px 24px',
              transition:'all 0.3s ease',
              cursor:'default',
            }}
            onMouseEnter={e=>{ e.currentTarget.style.borderColor=`rgba(0,212,170,0.35)`; e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow=`0 12px 40px rgba(0,0,0,0.3)`; }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor=T.border; e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none'; }}>
              <div style={{ fontSize:28, marginBottom:14 }}>{f.icon}</div>
              <h3 style={{ color:T.white, fontWeight:700, fontSize:15, marginBottom:8 }}>{f.title}</h3>
              <p style={{ color:T.gray, fontSize:13, lineHeight:1.65 }}>{f.desc}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setActiveStep(s => (s+1) % DEMO_STEPS.length), 3500);
    return () => clearInterval(t);
  }, []);

  return (
    <section id="how-it-works" style={{ padding:'100px max(24px, calc(50% - 580px))', background:`linear-gradient(180deg, transparent, rgba(0,212,170,0.03), transparent)` }}>
      <Reveal>
        <div style={{ textAlign:'center', marginBottom:64 }}>
          <div style={{ color:T.teal, fontSize:12, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:12 }}>
            HOW IT WORKS
          </div>
          <h2 style={{ fontSize:'clamp(28px,3.5vw,44px)', fontWeight:900, color:T.white, letterSpacing:'-1.5px' }}>
            From URL to full test suite in 4 steps
          </h2>
        </div>
      </Reveal>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1.2fr', gap:64, alignItems:'start' }}>
        {/* Steps */}
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          {DEMO_STEPS.map((step, i) => (
            <Reveal key={step.step} delay={i*80}>
              <div onClick={()=>setActiveStep(i)} style={{
                padding:'20px 24px', borderRadius:12, cursor:'pointer',
                background: activeStep===i ? `rgba(0,212,170,0.07)` : 'transparent',
                border: `1px solid ${activeStep===i ? 'rgba(0,212,170,0.3)' : 'transparent'}`,
                transition:'all 0.3s ease',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                  <div style={{
                    width:36, height:36, borderRadius:8, flexShrink:0,
                    background: activeStep===i ? `linear-gradient(135deg,${T.teal},${T.blue})` : T.navyLight,
                    border: activeStep===i ? 'none' : `1px solid ${T.border}`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontFamily:'monospace', fontSize:12, fontWeight:800,
                    color: activeStep===i ? T.navy : T.gray,
                    transition:'all 0.3s',
                  }}>
                    {step.step}
                  </div>
                  <div>
                    <div style={{ color: activeStep===i ? T.white : T.gray, fontWeight:700, fontSize:15, marginBottom:4, transition:'color 0.3s' }}>
                      {step.title}
                    </div>
                    <div style={{ color:T.grayDim, fontSize:13, lineHeight:1.6 }}>{step.desc}</div>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Visual panel */}
        <Reveal delay={100}>
          <div style={{ position:'sticky', top:120 }}>
            <div style={{ transition:'all 0.4s ease' }}>
              {DEMO_STEPS[activeStep].visual}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function TestTypesSection() {
  const types = [
    { label:'UI Tests',          count:'60+', color:T.teal,      desc:'Page load, responsive, browser, accessibility, navigation, forms, buttons, dropdowns, tables, modals' },
    { label:'API Tests',         count:'90+', color:T.blue,      desc:'All endpoints, auth bypass, invalid payloads, status codes, response schemas, rate limiting' },
    { label:'Security Tests',    count:'20+', color:'#f59e0b',   desc:'XSS, SQL injection, CSRF, clickjacking, open redirect, path traversal, JWT tampering' },
    { label:'Performance Tests', count:'20+', color:'#a78bfa',   desc:'LCP, FID, CLS, TTFB, concurrent users (10/50/100/500), bundle size, caching headers' },
    { label:'Database Tests',    count:'20+', color:'#34d399',   desc:'CRUD operations, indexes, transactions, constraints, connection pool, concurrent writes' },
    { label:'Unit Tests',        count:'30+', color:'#fb7185',   desc:'Email/URL validation, password hashing, JWT, sanitization, pagination, error handling' },
  ];

  return (
    <section style={{ padding:'80px max(24px, calc(50% - 580px))' }}>
      <Reveal>
        <div style={{ textAlign:'center', marginBottom:48 }}>
          <h2 style={{ fontSize:'clamp(24px,3vw,38px)', fontWeight:900, color:T.white, letterSpacing:'-1px', marginBottom:12 }}>
            6 test categories. 240+ test cases. One analysis.
          </h2>
          <p style={{ color:T.gray, fontSize:15 }}>Generated fresh for your app — not generic templates.</p>
        </div>
      </Reveal>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12 }}>
        {types.map((t, i) => (
          <Reveal key={t.label} delay={i*70}>
            <div style={{
              background:T.navyLight, border:`1px solid ${T.border}`,
              borderRadius:12, padding:'20px 20px 16px',
              borderTop:`2px solid ${t.color}`,
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                <span style={{ color:T.white, fontWeight:700, fontSize:14 }}>{t.label}</span>
                <span style={{ color:t.color, fontFamily:'monospace', fontWeight:800, fontSize:16 }}>{t.count}</span>
              </div>
              <p style={{ color:T.grayDim, fontSize:12, lineHeight:1.6 }}>{t.desc}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function PricingSection({ onEnterApp }) {
  const plans = [
    {
      name:'Free', price:'$0', period:'/month',
      features:['5 test runs/month','Unlimited test generation','1 project','CSV export','Community support'],
      cta:'Start free', highlight:false,
    },
    {
      name:'Pro', price:'$29', period:'/month',
      features:['100 test runs/month','500+ tests per analysis','5 projects','All export formats','Jira & Azure DevOps','Priority support'],
      cta:'Start Pro trial', highlight:true,
    },
    {
      name:'Business', price:'$99', period:'/month',
      features:['500 test runs/month','5,000 tests per analysis','20 projects','20 team members','SSO support','Dedicated Slack'],
      cta:'Start Business trial', highlight:false,
    },
  ];

  return (
    <section id="pricing" style={{ padding:'100px max(24px, calc(50% - 580px))' }}>
      <Reveal>
        <div style={{ textAlign:'center', marginBottom:56 }}>
          <div style={{ color:T.teal, fontSize:12, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:12 }}>PRICING</div>
          <h2 style={{ fontSize:'clamp(28px,3.5vw,44px)', fontWeight:900, color:T.white, letterSpacing:'-1.5px', marginBottom:12 }}>
            Simple, transparent pricing
          </h2>
          <p style={{ color:T.gray, fontSize:15 }}>Start free. Upgrade when you need more. Cancel anytime.</p>
        </div>
      </Reveal>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, maxWidth:900, margin:'0 auto' }}>
        {plans.map((plan, i) => (
          <Reveal key={plan.name} delay={i*80}>
            <div style={{
              background: plan.highlight ? `linear-gradient(180deg, rgba(0,212,170,0.08), rgba(59,130,246,0.05))` : T.navyLight,
              border: `1px solid ${plan.highlight ? 'rgba(0,212,170,0.4)' : T.border}`,
              borderRadius:16, padding:'28px 24px',
              position:'relative',
              boxShadow: plan.highlight ? `0 0 40px rgba(0,212,170,0.12)` : 'none',
            }}>
              {plan.highlight && (
                <div style={{
                  position:'absolute', top:-12, left:'50%', transform:'translateX(-50%)',
                  background:`linear-gradient(90deg,${T.teal},${T.blue})`,
                  color:T.navy, fontSize:11, fontWeight:800, padding:'3px 14px', borderRadius:20,
                }}>MOST POPULAR</div>
              )}
              <div style={{ color:T.gray, fontSize:13, fontWeight:600, marginBottom:6 }}>{plan.name}</div>
              <div style={{ marginBottom:20 }}>
                <span style={{ color:T.white, fontSize:36, fontWeight:900 }}>{plan.price}</span>
                <span style={{ color:T.gray, fontSize:14 }}>{plan.period}</span>
              </div>
              <ul style={{ listStyle:'none', padding:0, marginBottom:24, display:'flex', flexDirection:'column', gap:9 }}>
                {plan.features.map(f => (
                  <li key={f} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:T.gray }}>
                    <span style={{ color:T.teal, fontSize:14 }}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <button onClick={onEnterApp} style={{
                width:'100%', padding:'11px', borderRadius:8, fontSize:14, fontWeight:700,
                cursor:'pointer', border:'none', transition:'all 0.2s',
                background: plan.highlight ? `linear-gradient(135deg,${T.teal},${T.blue})` : 'transparent',
                color: plan.highlight ? T.navy : T.teal,
                border: plan.highlight ? 'none' : `1px solid rgba(0,212,170,0.4)`,
              }}
              onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'}
              onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>
                {plan.cta}
              </button>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function CTASection({ onEnterApp }) {
  return (
    <section style={{ padding:'80px max(24px, calc(50% - 580px)) 120px' }}>
      <Reveal>
        <div style={{
          background:`linear-gradient(135deg, rgba(0,212,170,0.08), rgba(59,130,246,0.06))`,
          border:`1px solid rgba(0,212,170,0.2)`,
          borderRadius:24, padding:'64px 48px',
          textAlign:'center', position:'relative', overflow:'hidden',
        }}>
          <div style={{
            position:'absolute', top:'-30%', right:'-10%',
            width:400, height:400, borderRadius:'50%',
            background:`radial-gradient(circle, rgba(0,212,170,0.08) 0%, transparent 70%)`,
            pointerEvents:'none',
          }}/>
          <h2 style={{ fontSize:'clamp(28px,4vw,48px)', fontWeight:900, color:T.white, letterSpacing:'-1.5px', marginBottom:16 }}>
            Ship with confidence.<br/>
            <span style={{ color:T.teal }}>Start testing in 60 seconds.</span>
          </h2>
          <p style={{ color:T.gray, fontSize:16, marginBottom:36, maxWidth:480, margin:'0 auto 36px' }}>
            No credit card. No setup. Paste your URL and get 1,000 test cases instantly.
          </p>
          <button onClick={onEnterApp} style={{
            background:`linear-gradient(135deg,${T.teal},${T.blue})`,
            border:'none', color:T.navy, padding:'16px 36px',
            borderRadius:12, fontSize:16, fontWeight:800,
            cursor:'pointer', boxShadow:`0 0 40px rgba(0,212,170,0.4)`,
            transition:'all 0.25s',
          }}
          onMouseEnter={e=>{ e.target.style.transform='scale(1.04)'; e.target.style.boxShadow=`0 8px 50px rgba(0,212,170,0.5)`; }}
          onMouseLeave={e=>{ e.target.style.transform='scale(1)'; e.target.style.boxShadow=`0 0 40px rgba(0,212,170,0.4)`; }}>
            Analyze your app free →
          </button>
        </div>
      </Reveal>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{
      padding:'32px max(24px, calc(50% - 580px))',
      borderTop:`1px solid ${T.border}`,
      display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:16,
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <div style={{ width:24, height:24, borderRadius:6, background:`linear-gradient(135deg,${T.teal},${T.blue})`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12 }}>⚡</div>
        <span style={{ color:T.gray, fontSize:13 }}>TestItNow · © {new Date().getFullYear()}</span>
      </div>
      <div style={{ display:'flex', gap:24 }}>
        {['Privacy','Terms','Contact'].map(l => (
          <a key={l} href="#" style={{ color:T.grayDim, fontSize:13, textDecoration:'none' }}
            onMouseEnter={e=>e.target.style.color=T.gray}
            onMouseLeave={e=>e.target.style.color=T.grayDim}>{l}</a>
        ))}
      </div>
    </footer>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN LANDING PAGE
// ─────────────────────────────────────────────────────────────
export default function LandingPage({ onEnterApp, onLogin }) {
  return (
    <div style={{ background:T.navy, minHeight:'100vh', color:T.white, fontFamily:"-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${T.navy}; }
        ::-webkit-scrollbar-thumb { background: ${T.grayDim}; border-radius: 3px; }
        @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        @media (max-width: 900px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .steps-grid { grid-template-columns: 1fr !important; }
          .types-grid { grid-template-columns: 1fr 1fr !important; }
          .pricing-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <Nav onEnterApp={onEnterApp} onLogin={onLogin}/>
      <HeroSection onEnterApp={onEnterApp} onLogin={onLogin}/>
      <FeaturesSection/>
      <HowItWorksSection/>
      <TestTypesSection/>
      <PricingSection onEnterApp={onEnterApp}/>
      <CTASection onEnterApp={onEnterApp}/>
      <Footer/>
    </div>
  );
}
