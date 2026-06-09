// ============================================================
// App.jsx — Main orchestrator
// Each service import can point to a different deployed origin.
// Update src/config/services.js per environment.
// ============================================================

import React, { useState, useCallback } from 'react';
import {
  Play, Trash2, Download, CheckCircle, XCircle, AlertTriangle,
  Terminal, Database, Globe, Lock, Monitor, Code, TrendingUp,
  FileText, Zap, Sparkles, FileSpreadsheet, Loader, Plus, Upload,
  Bug, RotateCcw, FileUp, Cloud, User, LogOut, Crown, Rocket,
} from 'lucide-react';

// ── Service layer (each independently deployable) ────────────
import { authService }         from './services/authService';
import { testEngineService }   from './services/testEngineService';
import { bugTrackerService }   from './services/bugTrackerService';
import { integrationsService } from './services/integrationsService';
import { reportingService }    from './services/reportingService';

// ── Ad components ─────────────────────────────────────────────
import { GoogleAdUnit, AdSenseScript } from './components/ads/GoogleAdUnit';

// ── Config ────────────────────────────────────────────────────
import { PLANS } from './config/services';

// ── Modals ────────────────────────────────────────────────────
import AuthModal    from './components/modals/AuthModal';
import PaymentModal from './components/modals/PaymentModal';
import AnalyzeModal from './components/modals/AnalyzeModal';
import ReportsPage  from './pages/ReportsPage';
import LandingPage  from './pages/LandingPage';

// ─────────────────────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────────────────────
export default function App() {
  // ── Auth state ───────────────────────────────────────────
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userProfile, setUserProfile]         = useState(null);
  const [userPlan, setUserPlan]               = useState('free');
  const [freeRunsLeft, setFreeRunsLeft]       = useState(PLANS.free.testRunsPerMonth);

  // ── Test state ───────────────────────────────────────────
  const TYPES = ['unit', 'api', 'database', 'performance', 'security', 'ui'];
  const emptyTests = () => Object.fromEntries(TYPES.map(t => [t, []]));
  const [tests, setTests]           = useState(emptyTests);
  const [results, setResults]       = useState([]);
  const [isRunning, setIsRunning]   = useState(false);
  const [currentTest, setCurrentTest] = useState(null);
  const [activeTab, setActiveTab]   = useState('unit');

  // ── Bug state ────────────────────────────────────────────
  const [bugs, setBugs] = useState([]);

  // ── Analysis state ────────────────────────────────────────
  const [isGenerating, setIsGenerating]         = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisMsg, setAnalysisMsg]           = useState('');

  // ── Integration config ────────────────────────────────────
  const [jiraConfig, setJiraConfig] = useState({ url: '', email: '', apiToken: '', projectKey: '' });
  const [azureConfig, setAzureConfig] = useState({ organization: '', project: '', pat: '' });

  // ── UI modals ─────────────────────────────────────────────
  const [modal, setModal] = useState(null); // 'auth' | 'upgrade' | 'analyze' | 'import' | 'jira' | 'bug' | 'payment'
  const [authMode, setAuthMode]               = useState('login');
  const [jiraAction, setJiraAction]           = useState('import');
  const [importSource, setImportSource]       = useState('');
  const [selectedFailedTest, setSelectedFailedTest] = useState(null);
  const [selectedPlan, setSelectedPlan]       = useState(null);

  const showAds = PLANS[userPlan]?.showAds ?? true;

  // ── Page view ────────────────────────────────────────────
  // 'landing' | 'main' | 'reports'
  const [currentView, setCurrentView] = useState(
    isAuthenticated ? 'main' : 'landing'
  );

  // Show landing when logged out, main when logged in
  useEffect(() => {
    if (isAuthenticated && currentView === 'landing') setCurrentView('main');
  }, [isAuthenticated]);

  // ── Helpers ───────────────────────────────────────────────
  const addTest = useCallback((type, testData) => {
    const t = { ...testData, id: testData.id || `${type}-${Date.now()}`, status: 'pending' };
    setTests(prev => ({ ...prev, [type]: [...prev[type], t] }));
  }, []);

  const deleteTest = (type, id) =>
    setTests(prev => ({ ...prev, [type]: prev[type].filter(t => t.id !== id) }));

  const totalTests = Object.values(tests).reduce((s, a) => s + a.length, 0);
  const summary = {
    total:    results.length,
    passed:   results.filter(r => r.status === 'passed').length,
    failed:   results.filter(r => r.status === 'failed').length,
    duration: results.reduce((s, r) => s + r.duration, 0),
  };

  const canRun = () => userPlan !== 'free' || freeRunsLeft > 0;

  const guardedAction = (action) => {
    if (!isAuthenticated) { setModal('auth'); return; }
    if (userPlan === 'free' && freeRunsLeft <= 0) { setModal('upgrade'); return; }
    action();
  };

  // ── AUTH ──────────────────────────────────────────────────
  const handleLogin = async (email, password) => {
    try {
      const { user } = await authService.login(email, password);
      setUserProfile(user);
      setIsAuthenticated(true);
      setUserPlan(user.plan);
      setFreeRunsLeft(user.testsRemaining);
      setModal(null);
    } catch (e) { alert(`❌ ${e.message}`); }
  };

  const handleSignup = async (email, password, phone) => {
    try {
      const { user } = await authService.signup(email, password, phone);
      setUserProfile(user);
      setIsAuthenticated(true);
      setUserPlan('free');
      setFreeRunsLeft(PLANS.free.testRunsPerMonth);
      setModal(null);
    } catch (e) { alert(`❌ ${e.message}`); }
  };

  const handleLogout = async () => {
    await authService.logout();
    setIsAuthenticated(false);
    setUserProfile(null);
    setUserPlan('free');
    setFreeRunsLeft(PLANS.free.testRunsPerMonth);
    setCurrentView('landing');
  };

  const handleUpgradePlan = (planId) => {
    // Open PaymentModal instead of directly upgrading
    setModal('payment');
  };

  const handlePaymentSuccess = async (planId, data) => {
    setUserPlan(planId);
    setFreeRunsLeft(data.testsRemaining || PLANS[planId]?.testRunsPerMonth || 100);
    setUserProfile(p => ({ ...p, plan: planId }));
    setModal(null);
  };

  // ── TEST GENERATION ────────────────────────────────────────
  const handleAnalyze = async (sourceParams) => {
    setIsGenerating(true);
    setAnalysisProgress(0);

    try {
      const { domain, generated, meta, fromCache } = await testEngineService.analyzeAndGenerate(
        sourceParams,
        (pct, msg) => { setAnalysisProgress(pct); setAnalysisMsg(msg); },
      );

      let count = 0;
      Object.entries(generated).forEach(([type, list]) => {
        list.forEach(t => addTest(type, t));
        count += list.length;
      });

      setModal(null);
      setIsGenerating(false);

      const breakdown = meta?.breakdown
        ? Object.entries(meta.breakdown).map(([k,v]) => `${k}: ${v}`).join(' · ')
        : '';

      if (fromCache) {
        alert(`✅ Loaded from cache!\n\n🧪 ${count} test cases restored\n\nTo get fresh results, click "Re-analyze" in the source history.`);
      } else {
        alert(
          `✅ Analysis complete!\n\n` +
          `🌐 ${meta?.isRepo ? 'Repository' : meta?.isUpload ? 'Source files' : `Pages crawled: ${meta?.pagesAnalyzed||1}`}\n` +
          `🧪 Test cases generated: ${count}\n\n` +
          `${breakdown}`
        );
      }
    } catch (e) {
      setIsGenerating(false);
      alert(`❌ ${e.message}`);
    }
  };

  // ── TEST RUN ───────────────────────────────────────────────
  const handleRunTests = async () => {
    if (!canRun()) { setModal('upgrade'); return; }

    setIsRunning(true);
    setResults([]);
    if (userPlan === 'free') setFreeRunsLeft(p => Math.max(0, p - 1));

    const flat = Object.entries(tests).flatMap(([type, list]) => list.map(t => ({ ...t, type })));

    await testEngineService.runTests(flat, result => {
      setCurrentTest(result);
      setResults(prev => [...prev, result]);
    });

    setCurrentTest(null);
    setIsRunning(false);
  };

  // ── RETEST ─────────────────────────────────────────────────
  const handleRetest = async (test) => {
    setIsRunning(true);
    const result = await testEngineService.retestSingle(test);
    setResults(prev => [...prev, result]);
    setIsRunning(false);

    if (!result.status === 'passed') {
      if (window.confirm(`❌ Still failing: ${test.name}. Create Jira bug?`)) {
        setSelectedFailedTest(result);
        setModal('bug');
      }
    }
  };

  // ── BUG REPORT ─────────────────────────────────────────────
  const handleCreateBug = async (bugData) => {
    try {
      const bug = await bugTrackerService.createBug(jiraConfig, bugData);
      setBugs(prev => [...prev, bug]);
      setModal(null);
      setSelectedFailedTest(null);
      alert(`✅ Bug ${bug.jiraKey} created!`);
    } catch (e) { alert(`❌ ${e.message}`); }
  };

  // ── INTEGRATIONS ───────────────────────────────────────────
  const handleJiraImport = async () => {
    try {
      const imported = await integrationsService.importFromJira(jiraConfig);
      imported.forEach(t => addTest(t.type, t));
      setModal(null);
      alert(`✅ Imported ${imported.length} tests from Jira`);
    } catch (e) { alert(`❌ ${e.message}`); }
  };

  const handleJiraExport = async () => {
    try {
      const flat = Object.entries(tests).flatMap(([type, list]) => list.map(t => ({ ...t, type })));
      const exported = await integrationsService.exportToJira(jiraConfig, flat);
      setModal(null);
      alert(`✅ Exported ${exported.length} tests to Jira`);
    } catch (e) { alert(`❌ ${e.message}`); }
  };

  const handleAzureImport = async () => {
    try {
      const imported = await integrationsService.importFromAzure(azureConfig);
      imported.forEach(t => addTest(t.type, t));
      setModal(null);
      alert(`✅ Imported ${imported.length} tests from Azure DevOps`);
    } catch (e) { alert(`❌ ${e.message}`); }
  };

  const handleAzureExport = async () => {
    try {
      const flat = Object.entries(tests).flatMap(([type, list]) => list.map(t => ({ ...t, type })));
      const exported = await integrationsService.exportToAzure(azureConfig, flat);
      alert(`✅ Exported ${exported.length} tests to Azure DevOps`);
    } catch (e) { alert(`❌ ${e.message}`); }
  };

  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = integrationsService.parseCSV(ev.target.result);
        parsed.forEach(t => addTest(t.type, t));
        setModal(null);
        alert(`✅ Imported ${parsed.length} tests from CSV`);
      } catch (err) { alert(`❌ ${err.message}`); }
    };
    reader.readAsText(file);
  };

  // ── EXPORT ─────────────────────────────────────────────────
  const handleExport = () => reportingService.exportToCSV(tests, results);

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <>
      {/* Inject AdSense script once */}
      <AdSenseScript />

      {/* ── LANDING PAGE ── */}
      {currentView === 'landing' && (
        <LandingPage
          onEnterApp={() => {
            if (isAuthenticated) {
              setCurrentView('main');
            } else {
              setAuthMode('signup');
              setModal('auth');
            }
          }}
          onLogin={() => {
            setAuthMode('login');
            setModal('auth');
          }}
        />
      )}

      {/* ── REPORTS PAGE (full screen) ── */}
      {currentView === 'reports' && (
        <ReportsPage
          tests={tests}
          results={results}
          bugs={bugs}
          onBack={() => setCurrentView('main')}
        />
      )}

      {/* ── MAIN APP ── */}
      {currentView === 'main' && (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-6 font-sans">
        <div className="max-w-7xl mx-auto space-y-4">

          {/* ── TOP BANNER AD (free users only) ── */}
          {showAds && <GoogleAdUnit slot="headerBanner" format="horizontal" className="rounded-xl overflow-hidden" />}

          {/* ── FREE PLAN UPGRADE NUDGE ── */}
          {isAuthenticated && userPlan === 'free' && (
            <FreePlanBanner freeRunsLeft={freeRunsLeft} onUpgrade={() => setModal('upgrade')} />
          )}

          {/* ── HEADER ── */}
          <Header
            isAuthenticated={isAuthenticated}
            userProfile={userProfile}
            userPlan={userPlan}
            totalTests={totalTests}
            isRunning={isRunning}
            canRun={canRun()}
            onLogin={() => { setAuthMode('login'); setModal('auth'); }}
            onLogout={handleLogout}
            onUpgrade={() => setModal('upgrade')}
            onAnalyze={() => guardedAction(() => setModal('analyze'))}
            onImport={() => setModal('import')}
            onJiraImport={() => { setJiraAction('import'); setModal('jira'); }}
            onJiraExport={() => { setJiraAction('export'); setModal('jira'); }}
            onExport={handleExport}
            onReports={() => setCurrentView('reports')}
            onRun={() => guardedAction(handleRunTests)}
          />

          {/* ── RESULTS SUMMARY ── */}
          {results.length > 0 && <ResultsSummary summary={summary} />}

          {/* ── RUNNING INDICATOR ── */}
          {isRunning && currentTest && <RunningBadge test={currentTest} />}

          {/* ── MAIN GRID ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Left: test list (2 cols) */}
            <div className="lg:col-span-2 space-y-4">
              <TestPanel
                tests={tests}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                onAdd={addTest}
                onDelete={deleteTest}
                onAnalyze={() => guardedAction(() => setModal('analyze'))}
              />

              {/* In-feed ad between panels */}
              {showAds && (
                <GoogleAdUnit slot="inFeed" format="horizontal" className="rounded-xl overflow-hidden" />
              )}
            </div>

            {/* Right: results + sidebar ads */}
            <div className="space-y-4">
              {showAds && <GoogleAdUnit slot="sidebarTop" format="rectangle" className="mx-auto rounded-xl overflow-hidden" />}

              <ResultsPanel
                results={results}
                isRunning={isRunning}
                onReportBug={r => { setSelectedFailedTest(r); setModal('bug'); }}
                onRetest={handleRetest}
                onDownloadScreenshot={(sc, name) => reportingService.downloadScreenshot(sc, name)}
              />

              {showAds && <GoogleAdUnit slot="sidebarBottom" format="rectangle" className="mx-auto rounded-xl overflow-hidden" />}
            </div>
          </div>

          {/* ── BUGS DASHBOARD ── */}
          {bugs.length > 0 && <BugsDashboard bugs={bugs} />}

        </div>
        </div>
      )}

      {/* ══ MODALS — rendered outside page divs so z-index works ══ */}

      {modal === 'auth' && (
        <Modal onClose={() => setModal(null)}>
          <AuthModal
            mode={authMode}
            onLogin={handleLogin}
            onSignup={handleSignup}
            onToggle={() => setAuthMode(m => m === 'login' ? 'signup' : 'login')}
          />
        </Modal>
      )}

      {modal === 'upgrade' && (
        <Modal onClose={() => setModal(null)} wide>
          <UpgradeModal currentPlan={userPlan} onSelect={() => setModal('payment')} />
        </Modal>
      )}

      {modal === 'payment' && (
        <Modal onClose={() => setModal(null)}>
          <PaymentModal
            currentPlan={userPlan}
            onSuccess={handlePaymentSuccess}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}

      {modal === 'analyze' && (
        <Modal onClose={() => !isGenerating && setModal(null)}>
          <AnalyzeModal
            isGenerating={isGenerating}
            progress={analysisProgress}
            progressMsg={analysisMsg}
            onAnalyze={handleAnalyze}
            onCancel={() => setModal(null)}
            isAuthenticated={isAuthenticated}
          />
        </Modal>
      )}

      {modal === 'import' && (
        <Modal onClose={() => setModal(null)} wide>
          <ImportModal
            importSource={importSource}
            azureConfig={azureConfig}
            onSourceChange={setImportSource}
            onAzureConfigChange={setAzureConfig}
            onCSVUpload={handleCSVUpload}
            onAzureImport={handleAzureImport}
            onAzureExport={handleAzureExport}
            onDownloadTemplate={() => {
              const csv = '\uFEFF' + integrationsService.getCSVTemplate();
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = 'template.csv'; a.click();
            }}
            totalTests={totalTests}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}

      {modal === 'jira' && (
        <Modal onClose={() => setModal(null)}>
          <JiraModal
            action={jiraAction}
            config={jiraConfig}
            onChange={setJiraConfig}
            onImport={handleJiraImport}
            onExport={handleJiraExport}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}

      {modal === 'bug' && selectedFailedTest && (
        <Modal onClose={() => { setModal(null); setSelectedFailedTest(null); }}>
          <BugModal
            test={selectedFailedTest}
            onSubmit={handleCreateBug}
            onCancel={() => { setModal(null); setSelectedFailedTest(null); }}
          />
        </Modal>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// UI COMPONENTS
// ─────────────────────────────────────────────────────────────

function Modal({ children, onClose, wide }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full ${wide ? 'max-w-4xl' : 'max-w-xl'} max-h-[92vh] overflow-y-auto`}>
        <div className="relative p-6">
          <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white text-2xl leading-none">×</button>
          {children}
        </div>
      </div>
    </div>
  );
}

function FreePlanBanner({ freeRunsLeft, onUpgrade }) {
  return (
    <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-xl p-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 text-amber-300">
        <Crown size={20} />
        <span className="text-sm font-medium">Free Plan — <strong>{freeRunsLeft}</strong> test runs remaining this month · Unlimited test case generation</span>
      </div>
      <button onClick={onUpgrade} className="shrink-0 px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 text-sm font-bold rounded-lg">
        Upgrade
      </button>
    </div>
  );
}

function Header({ isAuthenticated, userProfile, userPlan, totalTests, isRunning, canRun, onLogin, onLogout, onUpgrade, onAnalyze, onImport, onJiraImport, onJiraExport, onExport, onReports, onRun }) {
  const Btn = ({ onClick, disabled, color = 'slate', icon: Icon, label, small }) => {
    const colors = {
      slate:  'bg-slate-700 hover:bg-slate-600 text-slate-200',
      blue:   'bg-blue-600 hover:bg-blue-500 text-white',
      indigo: 'bg-indigo-600 hover:bg-indigo-500 text-white',
      green:  'bg-emerald-600 hover:bg-emerald-500 text-white',
      teal:   'bg-teal-600 hover:bg-teal-500 text-white',
      purple: 'bg-purple-600 hover:bg-purple-500 text-white',
      amber:  'bg-amber-500 hover:bg-amber-400 text-slate-900',
    };
    return (
      <button onClick={onClick} disabled={disabled}
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed ${colors[color]}`}>
        {Icon && <Icon size={16} />}
        {label}
      </button>
    );
  };

  return (
    <div className="bg-slate-800/80 backdrop-blur border border-slate-700 rounded-2xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Title */}
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Terminal className="text-blue-400" size={22} />
            Professional Testing Framework
          </h1>
          <p className="text-slate-400 text-xs mt-0.5">Modular · Independently deployable · AdSense-ready</p>
        </div>

        {/* Auth */}
        <div className="flex items-center gap-2 flex-wrap">
          {isAuthenticated ? (
            <>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 rounded-lg">
                <User size={14} className="text-slate-300" />
                <span className="text-sm text-slate-200">{userProfile?.name}</span>
                <span className="text-xs text-slate-400 capitalize">({userPlan})</span>
              </div>
              <Btn onClick={onLogout} icon={LogOut} label="Logout" />
            </>
          ) : (
            <Btn onClick={onLogin} icon={User} label="Login" color="blue" />
          )}
          {(userPlan === 'free' || !isAuthenticated) && (
            <Btn onClick={onUpgrade} icon={Crown} label="Upgrade" color="amber" />
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Btn onClick={onAnalyze} icon={Sparkles} label="Analyze Website" color="purple" />
          <Btn onClick={onImport} icon={FileUp} label="Import" color="teal" />
          <Btn onClick={onJiraImport} icon={Download} label="Jira Import" color="blue" />
          <Btn onClick={onJiraExport} icon={Upload} label="Jira Export" color="indigo" disabled={totalTests === 0} />
          <Btn onClick={onExport} icon={FileSpreadsheet} label="Export CSV" color="green" disabled={totalTests === 0} />
          <Btn onClick={onReports} icon={FileText} label="Reports" color="indigo" disabled={totalTests === 0} />
          <Btn
            onClick={onRun}
            icon={isRunning ? Loader : Play}
            label={isRunning ? 'Running…' : 'Run Tests'}
            color="blue"
            disabled={isRunning || totalTests === 0 || !canRun}
          />
        </div>
      </div>
    </div>
  );
}

function ResultsSummary({ summary }) {
  const items = [
    { label: 'Total', value: summary.total, color: 'text-white' },
    { label: 'Passed', value: summary.passed, color: 'text-emerald-400' },
    { label: 'Failed', value: summary.failed, color: 'text-red-400' },
    { label: 'Duration', value: `${(summary.duration / 1000).toFixed(2)}s`, color: 'text-blue-400' },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map(({ label, value, color }) => (
        <div key={label} className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 text-center">
          <div className="text-xs text-slate-400 mb-1">{label}</div>
          <div className={`text-3xl font-bold ${color}`}>{value}</div>
        </div>
      ))}
    </div>
  );
}

function RunningBadge({ test }) {
  return (
    <div className="bg-blue-900/40 border border-blue-500/40 rounded-xl p-3 flex items-center gap-3">
      <Zap className="text-blue-400 animate-pulse shrink-0" size={20} />
      <div>
        <div className="text-sm font-semibold text-blue-200">Running: {test.name}</div>
        <div className="text-xs text-blue-400">Type: {test.type}</div>
      </div>
    </div>
  );
}

function TestPanel({ tests, activeTab, onTabChange, onAdd, onDelete, onAnalyze }) {
  const TYPES = ['unit', 'api', 'database', 'performance', 'security', 'ui'];
  const icons = { unit: Code, api: Globe, database: Database, performance: TrendingUp, security: Lock, ui: Monitor };

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4">
      {/* Tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {TYPES.map(tab => {
          const Icon = icons[tab];
          const active = activeTab === tab;
          return (
            <button key={tab} onClick={() => onTabChange(tab)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                active ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`}>
              <Icon size={12} />
              {tab.toUpperCase()}
              <span className={`ml-1 px-1.5 py-0.5 rounded text-xs ${active ? 'bg-blue-500' : 'bg-slate-600 text-slate-300'}`}>
                {tests[tab].length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Add form */}
      <AddTestForm type={activeTab} onAdd={(data) => onAdd(activeTab, data)} />

      {/* Test list */}
      <div className="mt-4">
        <div className="text-xs text-slate-400 mb-2 font-medium">Tests ({tests[activeTab].length})</div>
        {tests[activeTab].length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <p className="mb-3 text-sm">No {activeTab} tests yet</p>
            <button onClick={onAnalyze}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm">
              <Sparkles size={14} />
              Auto-Generate
            </button>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {tests[activeTab].map(test => (
              <div key={test.id} className="flex items-center justify-between p-2.5 bg-slate-700/50 rounded-lg border border-slate-600/50 group">
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-slate-200 font-medium truncate">{test.name}</div>
                  <div className="text-xs text-slate-500 font-mono">{test.id}</div>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                    { Critical: 'bg-red-900/60 text-red-300', High: 'bg-orange-900/60 text-orange-300',
                      Medium: 'bg-yellow-900/60 text-yellow-300', Low: 'bg-green-900/60 text-green-300' }[test.priority] || 'bg-slate-600 text-slate-300'
                  }`}>{test.priority}</span>
                  <button onClick={() => onDelete(activeTab, test.id)}
                    className="p-1 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AddTestForm({ type, onAdd }) {
  const [data, setData] = useState({ id: '', name: '', description: '', priority: 'Medium' });
  const set = (k, v) => setData(p => ({ ...p, [k]: v }));

  const submit = () => {
    if (!data.name.trim()) return alert('Title required');
    onAdd({ id: data.id || `TC-${type.toUpperCase()}-${Date.now()}`, name: data.name, description: data.description, priority: data.priority });
    setData({ id: '', name: '', description: '', priority: 'Medium' });
  };

  return (
    <div className="bg-slate-700/40 rounded-xl p-3 space-y-2 border border-slate-600/40">
      <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Add {type} test</div>
      <div className="grid grid-cols-2 gap-2">
        <input placeholder="ID (optional)" value={data.id} onChange={e => set('id', e.target.value)}
          className="col-span-1 px-2.5 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500" />
        <select value={data.priority} onChange={e => set('priority', e.target.value)}
          className="col-span-1 px-2.5 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500">
          {['Critical','High','Medium','Low'].map(p => <option key={p}>{p}</option>)}
        </select>
      </div>
      <input placeholder="* Title" value={data.name} onChange={e => set('name', e.target.value)}
        className="w-full px-2.5 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500" />
      <textarea placeholder="Description (optional)" value={data.description} onChange={e => set('description', e.target.value)} rows={2}
        className="w-full px-2.5 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:border-blue-500" />
      <button onClick={submit}
        className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium">
        <Plus size={14} /> Add Test
      </button>
    </div>
  );
}

function ResultsPanel({ results, isRunning, onReportBug, onRetest, onDownloadScreenshot }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4">
      <h3 className="font-semibold text-slate-200 mb-3 flex items-center gap-2 text-sm">
        <Terminal size={16} /> Results with Screenshots
      </h3>
      {results.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <AlertTriangle size={40} className="mx-auto mb-3 text-slate-600" />
          <p className="text-sm">No results yet — run tests to see output here</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
          {results.map((r, i) => (
            <div key={i} className={`rounded-xl border p-3 ${r.status === 'passed' ? 'bg-emerald-900/20 border-emerald-700/40' : 'bg-red-900/20 border-red-700/40'}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  {r.status === 'passed'
                    ? <CheckCircle size={14} className="text-emerald-400 shrink-0" />
                    : <XCircle size={14} className="text-red-400 shrink-0" />}
                  <span className="text-xs font-medium text-slate-200 line-clamp-1">{r.name}</span>
                </div>
                <span className="text-xs text-slate-400 shrink-0 ml-2">{r.duration}ms</span>
              </div>
              {r.isRetest && <div className="text-xs text-blue-400 mb-1 flex items-center gap-1"><RotateCcw size={10} /> Retest</div>}
              <div className="text-xs text-slate-500 mb-2">{new Date(r.timestamp).toLocaleString()}</div>

              {r.status === 'failed' && (
                <div className="flex gap-2 mb-2">
                  <button onClick={() => onReportBug(r)}
                    className="text-xs px-2 py-1 bg-red-700 hover:bg-red-600 text-white rounded flex items-center gap-1">
                    <Bug size={10} /> Report Bug
                  </button>
                  <button onClick={() => onRetest(r)} disabled={isRunning}
                    className="text-xs px-2 py-1 bg-blue-700 hover:bg-blue-600 text-white rounded flex items-center gap-1 disabled:opacity-40">
                    <RotateCcw size={10} /> Retest
                  </button>
                </div>
              )}

              {r.screenshot && (
                <div className="group relative rounded-lg overflow-hidden border border-slate-600">
                  <img src={r.screenshot} alt={r.name}
                    className="w-full rounded cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => window.open(r.screenshot, '_blank')} />
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onDownloadScreenshot(r.screenshot, r.name)}
                      className="px-2 py-1 bg-blue-600 text-white text-xs rounded flex items-center gap-1">
                      <Download size={10} /> Save
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BugsDashboard({ bugs }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4">
      <h3 className="font-semibold text-slate-200 mb-3 flex items-center gap-2 text-sm">
        <Bug className="text-red-400" size={16} /> Bugs Dashboard ({bugs.length})
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {bugs.map(bug => (
          <div key={bug.id} className="bg-red-900/20 border border-red-700/40 rounded-xl p-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-red-400 font-mono">{bug.jiraKey}</span>
              <span className="text-xs px-2 py-0.5 bg-red-800/60 text-red-300 rounded-full">{bug.status}</span>
            </div>
            <div className="text-sm font-medium text-slate-200 mb-1 line-clamp-1">{bug.summary}</div>
            <div className="text-xs text-slate-400 mb-2 line-clamp-2">{bug.description}</div>
            <div className="flex gap-2 text-xs text-slate-500">
              <span>P: {bug.priority}</span><span>·</span><span>S: {bug.severity}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Modal Contents ────────────────────────────────────────────

// AuthModal is imported from ./components/modals/AuthModal
// (moved to fix cursor-jump bug caused by Field defined inside component)

function UpgradeModal({ currentPlan, onSelect }) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <Rocket className="mx-auto text-purple-400 mb-3" size={48} />
        <h2 className="text-2xl font-bold text-white">Unlock Full Power</h2>
        <p className="text-slate-400 text-sm">Choose a plan that fits your testing needs</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.values(PLANS).map(plan => (
          <div key={plan.id}
            className={`rounded-2xl border p-4 text-center space-y-3 transition-all ${
              plan.id === 'pro' ? 'bg-blue-900/30 border-blue-500' : 'bg-slate-700/40 border-slate-600'
            }`}>
            {plan.id === 'pro' && <div className="text-xs font-bold text-blue-400 uppercase tracking-wider">Most Popular</div>}
            <h3 className="text-lg font-bold text-white">{plan.name}</h3>
            <div className="text-3xl font-bold text-white">${plan.price}<span className="text-sm text-slate-400">/mo</span></div>
            <ul className="text-xs text-slate-400 space-y-1">
              {plan.features.map(f => <li key={f} className="flex items-center gap-1.5"><CheckCircle size={10} className="text-emerald-400 shrink-0" />{f}</li>)}
            </ul>
            {currentPlan !== plan.id && plan.price > 0 && (
              <button onClick={() => onSelect(plan.id)}
                className={`w-full py-2 rounded-lg text-sm font-semibold ${
                  plan.id === 'pro' ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-slate-600 hover:bg-slate-500 text-white'
                }`}>
                Upgrade to {plan.name}
              </button>
            )}
            {currentPlan === plan.id && <div className="text-xs text-emerald-400 font-medium">✓ Current Plan</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function ImportModal({ importSource, azureConfig, onSourceChange, onAzureConfigChange, onCSVUpload, onAzureImport, onAzureExport, onDownloadTemplate, totalTests, onClose }) {
  const srcBtn = (id, icon, label, sub) => (
    <button onClick={() => onSourceChange(id)}
      className={`p-4 rounded-xl border-2 text-center transition-all hover:border-blue-500 ${importSource === id ? 'border-blue-500 bg-blue-900/20' : 'border-slate-600 bg-slate-700/30'}`}>
      <div className="text-3xl mb-2">{icon}</div>
      <div className="text-sm font-semibold text-slate-200">{label}</div>
      <div className="text-xs text-slate-500 mt-0.5">{sub}</div>
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FileUp className="text-teal-400" size={22} />
        <h2 className="text-xl font-bold text-white">Import Test Cases</h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {srcBtn('spreadsheet', '📊', 'Excel / CSV', 'Upload file')}
        {srcBtn('azure', '☁️', 'Azure DevOps', 'Sync plans')}
      </div>

      {importSource === 'spreadsheet' && (
        <div className="space-y-3">
          <div className="bg-blue-900/20 border border-blue-700/30 rounded-xl p-3">
            <p className="text-xs text-slate-300 mb-2">Required columns: <code className="bg-slate-700 px-1.5 py-0.5 rounded text-blue-300">Test Case ID, Title, Description, Type, Priority</code></p>
            <button onClick={onDownloadTemplate} className="text-xs px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white rounded-lg flex items-center gap-1">
              <Download size={12} /> Download Template
            </button>
          </div>
          <label className="block border-2 border-dashed border-slate-600 hover:border-teal-500 rounded-xl p-8 text-center cursor-pointer transition-colors">
            <FileUp className="mx-auto mb-2 text-slate-500" size={40} />
            <p className="text-sm text-slate-400 mb-2">Click to upload CSV / Excel</p>
            <span className="px-3 py-1.5 bg-teal-700 hover:bg-teal-600 text-white text-xs rounded-lg">Choose File</span>
            <input type="file" accept=".csv,.xlsx,.xls" onChange={onCSVUpload} className="hidden" />
          </label>
        </div>
      )}

      {importSource === 'azure' && (
        <div className="space-y-3">
          {[['Organization', 'organization', 'your-org'], ['Project', 'project', 'your-project'], ['Personal Access Token (PAT)', 'pat', '••••••••']].map(([label, key, ph]) => (
            <div key={key}>
              <label className="block text-xs text-slate-400 mb-1">{label} *</label>
              <input type={key === 'pat' ? 'password' : 'text'} placeholder={ph} value={azureConfig[key]}
                onChange={e => onAzureConfigChange({ ...azureConfig, [key]: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500" />
            </div>
          ))}
          <div className="flex gap-2">
            <button onClick={onAzureImport} className="flex-1 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-sm flex items-center justify-center gap-2">
              <Download size={14} /> Import from Azure
            </button>
            <button onClick={onAzureExport} disabled={totalTests === 0} className="flex-1 py-2 bg-indigo-700 hover:bg-indigo-600 text-white rounded-lg text-sm flex items-center justify-center gap-2 disabled:opacity-40">
              <Upload size={14} /> Export to Azure
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function JiraModal({ action, config, onChange, onImport, onExport, onClose }) {
  const fields = [
    ['Jira URL', 'url', 'text', 'https://your-domain.atlassian.net'],
    ['Email', 'email', 'email', 'you@example.com'],
    ['API Token', 'apiToken', 'password', '········'],
    ['Project Key', 'projectKey', 'text', 'PROJ'],
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Database className="text-blue-400" size={22} />
        <h2 className="text-xl font-bold text-white">{action === 'import' ? 'Import from Jira' : 'Export to Jira'}</h2>
      </div>

      {fields.map(([label, key, type, ph]) => (
        <div key={key}>
          <label className="block text-xs text-slate-400 mb-1">{label} *</label>
          <input type={type} placeholder={ph} value={config[key]}
            onChange={e => onChange({ ...config, [key]: e.target.value })}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500" />
        </div>
      ))}

      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 py-2.5 border border-slate-600 text-slate-300 rounded-lg text-sm hover:bg-slate-700">Cancel</button>
        <button onClick={action === 'import' ? onImport : onExport}
          className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold">
          {action === 'import' ? 'Import Tests' : 'Export Tests'}
        </button>
      </div>
    </div>
  );
}

function BugModal({ test, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    testName: test.name, summary: `Bug in: ${test.name}`,
    description: `Test failed at ${new Date(test.timestamp).toLocaleString()}.\n\nError: ${test.error || 'Unknown'}\n\nTest ID: ${test.id}`,
    severity: 'Major', priority: 'High',
    screenshot: test.screenshot,
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Bug className="text-red-400" size={22} />
        <h2 className="text-xl font-bold text-white">Report Bug in Jira</h2>
      </div>

      {[['Bug Summary', 'summary', 'input'], ['Description', 'description', 'textarea']].map(([label, key, tag]) => (
        <div key={key}>
          <label className="block text-xs text-slate-400 mb-1">{label}</label>
          {tag === 'input'
            ? <input value={form[key]} onChange={e => set(key, e.target.value)} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-red-500" />
            : <textarea value={form[key]} onChange={e => set(key, e.target.value)} rows={4} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 resize-none focus:outline-none focus:border-red-500" />}
        </div>
      ))}

      <div className="grid grid-cols-2 gap-3">
        {[['Severity', 'severity', ['Critical','Major','Minor','Trivial']], ['Priority', 'priority', ['Highest','High','Medium','Low']]].map(([label, key, opts]) => (
          <div key={key}>
            <label className="block text-xs text-slate-400 mb-1">{label}</label>
            <select value={form[key]} onChange={e => set(key, e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-red-500">
              {opts.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
        ))}
      </div>

      {form.screenshot && (
        <div>
          <label className="block text-xs text-slate-400 mb-1">Screenshot (auto-attached)</label>
          <img src={form.screenshot} alt="Screenshot" className="w-full rounded-lg border border-slate-600 opacity-80" />
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2.5 border border-slate-600 text-slate-300 rounded-lg text-sm hover:bg-slate-700">Cancel</button>
        <button onClick={() => onSubmit(form)} className="flex-1 py-2.5 bg-red-700 hover:bg-red-600 text-white rounded-lg text-sm font-semibold">Create Bug</button>
      </div>
    </div>
  );
}
