// ============================================================
// AnalyzeModal.jsx — Source selection + analysis modal
// Source types: URL | GitHub | GitLab | Source Upload
// Features: history, cached results, new source flag
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import {
  Globe, Github, GitBranch, Upload, Clock, RefreshCw,
  CheckCircle, Loader, ChevronDown, ChevronUp, Trash2,
  Star, AlertCircle, Eye, Plus, X, Lock,
} from 'lucide-react';
import { SERVICES } from '../../config/services';
import { tokenStore } from '../../services/authService';

const API = `${SERVICES.auth.BASE_URL}/api/v1`;

// ── Input field ───────────────────────────────────────────────
function Field({ label, type='text', value, onChange, placeholder, hint, icon: Icon }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
      <div className="relative">
        {Icon && <Icon size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"/>}
        <input
          type={type}
          value={value}
          onChange={e=>onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full ${Icon?'pl-8':'px-3'} pr-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500`}
        />
      </div>
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

// ── Source history item ───────────────────────────────────────
function SourceItem({ source, onReuse, onRefresh, onDelete, isLoading }) {
  const icons = { url: Globe, github: Github, gitlab: GitBranch, upload: Upload };
  const Icon  = icons[source.source_type] || Globe;

  const sourceColors = {
    url:    'text-blue-400',
    github: 'text-slate-300',
    gitlab: 'text-orange-400',
    upload: 'text-teal-400',
  };

  return (
    <div className="bg-slate-700/50 border border-slate-600/50 rounded-xl p-3 hover:border-slate-500 transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <Icon size={16} className={`${sourceColors[source.source_type]} shrink-0 mt-0.5`}/>
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-200 truncate">{source.label}</div>
            {source.url && (
              <div className="text-xs text-slate-500 truncate">{source.url}</div>
            )}
            {source.repo_owner && (
              <div className="text-xs text-slate-500">{source.repo_owner}/{source.repo_name} @ {source.branch}</div>
            )}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {source.cached_test_count > 0 && (
                <span className="text-xs px-1.5 py-0.5 bg-emerald-900/40 text-emerald-400 border border-emerald-700/40 rounded-full">
                  {source.cached_test_count} tests cached
                </span>
              )}
              {source.analysis_count > 0 && (
                <span className="text-xs text-slate-500">
                  Analyzed {source.analysis_count}× 
                  {source.last_analyzed_at && ` · ${new Date(source.last_analyzed_at).toLocaleDateString()}`}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {source.cached_test_count > 0 && (
            <button onClick={()=>onReuse(source)} title="Load cached results"
              className="p-1.5 text-emerald-400 hover:bg-emerald-900/30 rounded-lg transition-colors" disabled={isLoading}>
              <Eye size={14}/>
            </button>
          )}
          <button onClick={()=>onRefresh(source)} title="Re-analyze (fresh)"
            className="p-1.5 text-blue-400 hover:bg-blue-900/30 rounded-lg transition-colors" disabled={isLoading}>
            <RefreshCw size={14}/>
          </button>
          <button onClick={()=>onDelete(source.source_id)} title="Remove from history"
            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors">
            <Trash2 size={14}/>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main AnalyzeModal ─────────────────────────────────────────
export default function AnalyzeModal({
  isGenerating, progress, progressMsg,
  onAnalyze, onCancel, isAuthenticated,
}) {
  const [activeTab,   setActiveTab]   = useState('url');
  const [sources,     setSources]     = useState([]);
  const [loadingHist, setLoadingHist] = useState(false);
  const [showHistory, setShowHistory] = useState(true);

  // URL tab
  const [url,          setUrl]          = useState('');
  const [needsAuth,    setNeedsAuth]    = useState(false);
  const [authUser,     setAuthUser]     = useState('');
  const [authPass,     setAuthPass]     = useState('');

  // GitHub/GitLab tab
  const [provider,    setProvider]    = useState('github');
  const [repoOwner,   setRepoOwner]   = useState('');
  const [repoName,    setRepoName]    = useState('');
  const [repoBranch,  setRepoBranch]  = useState('main');
  const [repoToken,   setRepoToken]   = useState('');

  // Upload tab
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploadLabel,   setUploadLabel]   = useState('');
  const fileRef = useRef(null);

  // Load history
  useEffect(() => {
    if (!isAuthenticated) return;
    setLoadingHist(true);
    fetch(`${API}/sources`, { headers: { Authorization: `Bearer ${tokenStore.get()}` }})
      .then(r => r.ok ? r.json() : {sources:[]})
      .then(d => setSources(d.sources || []))
      .catch(() => {})
      .finally(() => setLoadingHist(false));
  }, [isAuthenticated]);

  const deleteSrc = async (id) => {
    setSources(prev => prev.filter(s => s.source_id !== id));
    await fetch(`${API}/sources?id=${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenStore.get()}` },
    }).catch(()=>{});
  };

  const reuseCache = async (source) => {
    const res = await fetch(`${API}/sources?action=cached&sourceId=${source.source_id}`, {
      headers: { Authorization: `Bearer ${tokenStore.get()}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    onAnalyze({ type:'cached', source, generated: data.generated, meta: {
      totalGenerated: data.totalCached, domain: source.label, pagesAnalyzed: 1,
      pagesTitles: [source.label], breakdown: Object.fromEntries(
        Object.entries(data.generated).map(([k,v])=>[k,v.length])
      ),
    }});
  };

  const handleSubmit = async () => {
    if (activeTab === 'url') {
      if (!url.trim()) return alert('Please enter a URL');
      try { new URL(url); } catch { return alert('Please enter a valid URL (starting with https://)'); }
      onAnalyze({ type:'url', url, authCredentials: needsAuth ? {username:authUser, password:authPass} : null });

    } else if (activeTab === 'github' || activeTab === 'gitlab') {
      if (!repoOwner || !repoName) return alert('Please enter owner and repository name');
      onAnalyze({ type:'repo', provider:activeTab, repoOwner, repoName, branch:repoBranch, accessToken:repoToken });

    } else if (activeTab === 'upload') {
      if (!uploadedFiles.length) return alert('Please upload at least one file');
      onAnalyze({ type:'upload', files:uploadedFiles, label:uploadLabel || 'Uploaded Source' });
    }
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    const readers = files.map(file => new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = ev => resolve({ filename: file.name, content: ev.target.result, size: file.size });
      reader.readAsText(file);
    }));
    Promise.all(readers).then(results => {
      setUploadedFiles(prev => [...prev, ...results]);
      if (!uploadLabel) setUploadLabel(files[0].name.replace(/\.[^.]+$/, ''));
    });
    e.target.value = '';
  };

  const tabs = [
    { id:'url',    icon:Globe,      label:'Website URL' },
    { id:'github', icon:Github,     label:'GitHub' },
    { id:'gitlab', icon:GitBranch,  label:'GitLab' },
    { id:'upload', icon:Upload,     label:'Upload Code' },
  ];

  const submitLabel = {
    url:    'Analyze Website',
    github: 'Analyze Repository',
    gitlab: 'Analyze Repository',
    upload: 'Analyze Source Code',
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="p-2 bg-purple-600/20 border border-purple-500/30 rounded-lg">
          <RefreshCw size={18} className="text-purple-400"/>
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Analyze Source</h2>
          <p className="text-xs text-slate-400">Website, GitHub repo, GitLab, or upload code</p>
        </div>
      </div>

      {/* Progress */}
      {isGenerating && (
        <div className="bg-slate-700/50 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Loader className="animate-spin text-purple-400 shrink-0" size={16}/>
            <span>{progressMsg || 'Analyzing…'}</span>
          </div>
          <div className="w-full bg-slate-600 rounded-full h-2">
            <div className="bg-gradient-to-r from-purple-600 to-pink-500 h-2 rounded-full transition-all duration-500"
              style={{width:`${progress}%`}}/>
          </div>
          <p className="text-xs text-slate-500 text-right">{progress}%</p>
        </div>
      )}

      {/* Source type tabs */}
      <div className="flex gap-1 bg-slate-700/40 rounded-xl p-1">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
              disabled={isGenerating}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab===tab.id
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}>
              <Icon size={13}/> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="space-y-3">

        {/* ── URL TAB ── */}
        {activeTab==='url' && (
          <div className="space-y-3">
            <Field
              label="Website URL"
              value={url}
              onChange={setUrl}
              placeholder="https://example.com"
              icon={Globe}
              hint="We'll crawl all pages and generate comprehensive test cases"
            />

            {/* Auth toggle */}
            <div className="bg-slate-700/40 rounded-xl p-3 border border-slate-600/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock size={13} className="text-slate-400"/>
                  <span className="text-sm text-slate-300">Requires authentication?</span>
                </div>
                <button onClick={()=>setNeedsAuth(p=>!p)} disabled={isGenerating}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    needsAuth ? 'bg-blue-600 text-white' : 'bg-slate-600 text-slate-300'
                  }`}>
                  {needsAuth ? 'Yes' : 'No'}
                </button>
              </div>
              {needsAuth && (
                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-600">
                  <Field label="Username / Email" value={authUser} onChange={setAuthUser} placeholder="admin@example.com"/>
                  <Field label="Password" type="password" value={authPass} onChange={setAuthPass} placeholder="••••••••"/>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── GITHUB TAB ── */}
        {activeTab==='github' && (
          <div className="space-y-3">
            <div className="bg-slate-700/30 border border-slate-600/40 rounded-xl p-3 text-xs text-slate-400">
              <Github size={13} className="inline mr-1.5 text-slate-300"/>
              We'll fetch the repository file tree, detect your tech stack, extract routes, and generate comprehensive tests for every component, API, and feature.
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Owner / Username" value={repoOwner} onChange={setRepoOwner} placeholder="facebook"/>
              <Field label="Repository Name" value={repoName} onChange={setRepoName} placeholder="react"/>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Branch" value={repoBranch} onChange={setRepoBranch} placeholder="main"/>
              <Field label="Access Token (optional)" type="password" value={repoToken} onChange={setRepoToken}
                placeholder="ghp_xxxxxxxxxxxx"
                hint="Required for private repos"/>
            </div>
            <div className="bg-blue-900/20 border border-blue-700/30 rounded-xl p-3 text-xs text-slate-400">
              <p className="font-semibold text-blue-300 mb-1">What we detect:</p>
              <p>Tech stack (React, Next.js, Express, Python…) · File structure · Routes · Components · Test files · DB migrations · Docker config</p>
            </div>
          </div>
        )}

        {/* ── GITLAB TAB ── */}
        {activeTab==='gitlab' && (
          <div className="space-y-3">
            <div className="bg-slate-700/30 border border-slate-600/40 rounded-xl p-3 text-xs text-slate-400">
              <GitBranch size={13} className="inline mr-1.5 text-orange-400"/>
              Same analysis as GitHub — works with GitLab CE, GitLab.com, and self-hosted instances.
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Namespace / Group" value={repoOwner} onChange={setRepoOwner} placeholder="mygroup"/>
              <Field label="Project Name" value={repoName} onChange={setRepoName} placeholder="my-project"/>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Branch" value={repoBranch} onChange={setRepoBranch} placeholder="main"/>
              <Field label="Personal Access Token" type="password" value={repoToken} onChange={setRepoToken}
                placeholder="glpat-xxxxxxxxxxxx"
                hint="Settings → Access Tokens → Create token with read_api scope"/>
            </div>
          </div>
        )}

        {/* ── UPLOAD TAB ── */}
        {activeTab==='upload' && (
          <div className="space-y-3">
            <Field label="Project Label" value={uploadLabel} onChange={setUploadLabel} placeholder="My Application v2.0"/>

            <label className="block border-2 border-dashed border-slate-600 hover:border-purple-500 rounded-xl p-6 text-center cursor-pointer transition-colors">
              <Upload size={32} className="mx-auto mb-2 text-slate-500"/>
              <p className="text-sm text-slate-400 mb-1">Click to upload source files</p>
              <p className="text-xs text-slate-500">JS, TS, JSX, TSX, PY, GO, JAVA, PHP, RB, JSON, YAML, Dockerfile</p>
              <p className="text-xs text-slate-500 mt-1">Multiple files supported</p>
              <input ref={fileRef} type="file" multiple
                accept=".js,.ts,.jsx,.tsx,.py,.go,.java,.php,.rb,.json,.yaml,.yml,.md,.html,.css,.dockerfile,.txt"
                onChange={handleFileUpload} className="hidden"/>
            </label>

            {uploadedFiles.length > 0 && (
              <div className="bg-slate-700/40 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300">{uploadedFiles.length} file(s) ready</span>
                  <button onClick={()=>setUploadedFiles([])} className="text-xs text-red-400 hover:text-red-300">Clear all</button>
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {uploadedFiles.map((f,i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 truncate">{f.filename}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">{(f.size/1024).toFixed(1)}KB</span>
                        <button onClick={()=>setUploadedFiles(prev=>prev.filter((_,j)=>j!==i))}
                          className="text-slate-500 hover:text-red-400"><X size={11}/></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-slate-700/30 border border-slate-600/40 rounded-xl p-3 text-xs text-slate-400">
              We analyse your code's structure, imports, exports, function names, API endpoints, component definitions, database models, and generate relevant test cases without executing your code.
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button onClick={onCancel} disabled={isGenerating}
          className="flex-1 py-2.5 border border-slate-600 text-slate-300 rounded-xl text-sm hover:bg-slate-700 disabled:opacity-50">
          Cancel
        </button>
        <button onClick={handleSubmit} disabled={isGenerating}
          className="flex-1 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
          {isGenerating ? 'Analyzing…' : submitLabel[activeTab] || 'Analyze'}
        </button>
      </div>

      {/* History section */}
      {isAuthenticated && (
        <div className="border-t border-slate-700 pt-4">
          <button onClick={()=>setShowHistory(p=>!p)}
            className="flex items-center justify-between w-full text-sm font-semibold text-slate-300 hover:text-white mb-3">
            <span className="flex items-center gap-2">
              <Clock size={14} className="text-slate-400"/>
              Previously Analyzed ({sources.length})
            </span>
            {showHistory ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
          </button>

          {showHistory && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {loadingHist && (
                <div className="text-center py-4">
                  <Loader className="animate-spin mx-auto text-slate-500" size={16}/>
                </div>
              )}
              {!loadingHist && sources.length === 0 && (
                <div className="text-center py-4 text-xs text-slate-500">
                  No sources analyzed yet. Run your first analysis above.
                </div>
              )}
              {sources.map(source => (
                <SourceItem
                  key={source.source_id}
                  source={source}
                  onReuse={reuseCache}
                  onRefresh={src => {
                    if (src.source_type === 'url') {
                      setActiveTab('url');
                      setUrl(src.url || '');
                    } else if (['github','gitlab'].includes(src.source_type)) {
                      setActiveTab(src.source_type);
                      setRepoOwner(src.repo_owner || '');
                      setRepoName(src.repo_name || '');
                      setRepoBranch(src.branch || 'main');
                    }
                  }}
                  onDelete={deleteSrc}
                  isLoading={isGenerating}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
