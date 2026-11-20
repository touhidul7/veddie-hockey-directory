import React, { useState, useEffect } from 'react';
import {
  Shield, CheckCircle2, AlertCircle, RefreshCw, Upload,
  Users, Building, FileSpreadsheet, Play, Check, X, Eye, EyeOff,
  Lock, LogOut, KeyRound, User, ArrowRight, Loader2
} from 'lucide-react';

export default function AdminDashboardPage({ navigate }) {
  const [adminToken, setAdminToken] = useState(''); // In-memory CSRF token only.
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  useEffect(() => {
    localStorage.removeItem('plaionn_admin_token');
    localStorage.removeItem('plaionn_admin_user');
    fetch('/api/admin/session', { credentials: 'same-origin' }).then(async res => {
      if (!res.ok) return;
      const data = await res.json();
      setAdminToken(data.csrfToken); setCurrentUser(data.user); setIsAuthenticated(true);
    }).catch(() => {});
  }, []);

  // Login form state
  const [loginUsername, setLoginUsername] = useState('admin');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState(null);

  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'requests', 'teams', 'import', 'tests'
  const [overview, setOverview] = useState(null);
  const [requests, setRequests] = useState([]);
  const [pendingTeams, setPendingTeams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  // Import state
  const [csvText, setCsvText] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const [importBatches, setImportBatches] = useState([]);
  const [approvedImportRows, setApprovedImportRows] = useState([]);
  const [committing, setCommitting] = useState(false);
  const [editingImport, setEditingImport] = useState(null);
  async function reviewRow(row, action) {
    const usesForm = ['correct','classify_programme','resolve_hold'].includes(action);
    const reason = usesForm ? editingImport.reason : window.prompt(action === 'hold' ? 'What evidence or reconciliation is needed before this row can be imported?' : 'Why should this staged row be rejected?');
    if (!reason) return;
    try {
      const res = await apiFetch(`/api/admin/imports/${importPreview.batchId}/rows/${row.id}/review`, {
        method:'POST',body:JSON.stringify({...(usesForm ? editingImport : {}),action,version:row.reviewVersion,reason})
      });
      const data=await res.json();
      if(!res.ok)throw new Error(data.error);
      setImportPreview(data);setApprovedImportRows([]);setEditingImport(null);
      setActionMessage({correct:'Correction saved in staging. Review it again before committing.',reject:'Row rejected; public records unchanged.',hold:'Editorial hold saved. This row cannot be imported.',classify_programme:'Programme classification recorded. Publication remains on hold; import can only create a private draft.',resolve_hold:'Scope review saved. Import hold released; publication remains blocked.'}[action]);
    } catch(error){setActionMessage(error.message);}
  }

  // Test suite state
  const [testResults, setTestResults] = useState(null);
  const [runningTests, setRunningTests] = useState(false);

  useEffect(() => {
    if (isAuthenticated && adminToken) {
      loadTabData(activeTab);
    }
  }, [activeTab, isAuthenticated, adminToken]);

  async function apiFetch(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'x-csrf-token': adminToken,
      ...(options.headers || {})
    };
    const response = await fetch(endpoint, { ...options, headers, credentials: 'same-origin' });
    if (response.status === 401) { setAdminToken(''); setCurrentUser(null); setIsAuthenticated(false); }
    return response;
  }

  async function handleLogin(e) {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginUsername,
          password: loginPassword
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed.');
      }

      setAdminToken(data.csrfToken);
      setCurrentUser(data.user);
      setIsAuthenticated(true);
      setLoginPassword('');
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleLogout() {
    try {
      const response = await apiFetch('/api/admin/logout', {method:'POST'});
      if (!response.ok && response.status !== 401) throw new Error('Sign out failed. Please try again.');
    } catch (error) { setActionMessage(error.message); return; }
    localStorage.removeItem('plaionn_admin_token');
    localStorage.removeItem('plaionn_admin_user');
    setAdminToken('');
    setCurrentUser(null);
    setIsAuthenticated(false);
    setOverview(null);
    setRequests([]);
    setPendingTeams([]);
    setImportPreview(null);
    setTestResults(null);
  }

  async function loadTabData(tab) {
    setLoading(true);
    setActionMessage(null);
    try {
      if (tab === 'overview') {
        const res = await apiFetch('/api/admin/overview');
        if (res.status === 401) {
          handleLogout();
          return;
        }
        const data = await res.json();
        setOverview(data);
      } else if (tab === 'requests') {
        const res = await apiFetch('/api/admin/requests');
        if (res.status === 401) {
          handleLogout();
          return;
        }
        const data = await res.json();
        setRequests(data.data || []);
      } else if (tab === 'import') {
        const res = await apiFetch('/api/admin/imports');
        if (res.status === 401) { handleLogout(); return; }
        if (!res.ok) throw new Error('Could not load saved import batches.');
        setImportBatches((await res.json()).data || []);
      } else if (tab === 'teams') {
        const res = await apiFetch('/api/admin/teams/pending');
        if (res.status === 401) {
          handleLogout();
          return;
        }
        const data = await res.json();
        setPendingTeams(data.data || []);
      }
    } catch (err) {
      console.error('Admin API error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestDecision(id, decision) {
    const request = requests.find(item => item.id === id);
    let evidenceReviewed = false;
    let notes = `Processed via Admin Portal as ${decision}`;
    if (decision === 'approved' && request?.request_type === 'claim') {
      notes = window.prompt('Record how you verified this requester is authorized to represent the programme (at least 10 characters).');
      if (!notes || notes.trim().length < 10) return;
      evidenceReviewed = window.confirm('Have you reviewed evidence of the requester’s authority? This does not verify all programme facts or grant account access.');
      if (!evidenceReviewed) return;
    }
    try {
      const res = await apiFetch(`/api/admin/requests/${id}/decision`, {
        method: 'POST',
        body: JSON.stringify({ decision, admin_notes: notes, evidence_reviewed: evidenceReviewed })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setActionMessage(`Request ${id} marked ${decision}`);
      loadTabData('requests');
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  async function handleTeamApproval(interestId, teamName, city, division, homeLeague) {
    try {
      const res = await apiFetch(`/api/admin/teams/${interestId}/decision`, {
        method: 'POST',
        body: JSON.stringify({
          decision: 'approved',
          approved_name: teamName,
          approved_city: city,
          approved_division: division,
          home_league_name: homeLeague
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setActionMessage(`Team "${teamName}" approved into public directory!`);
      loadTabData('teams');
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  async function handlePreviewImport() {
    if (!csvText.trim()) {
      alert('Please paste CSV data or load sample rows.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch('/api/admin/imports/preview', {
        method: 'POST',
        body: JSON.stringify({
          filename: 'upload.csv',
          sourceName: 'Admin CSV Upload',
          csv: csvText
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setImportPreview(data);
      setApprovedImportRows([]);
    } catch (err) {
      alert('Import preview failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCommitImport() {
    if (!importPreview) return;
    setCommitting(true);
    try {
      const rowIds = approvedImportRows;
      const res = await apiFetch(`/api/admin/imports/${importPreview.batchId}/commit`, {
        method: 'POST',
        body: JSON.stringify({ approvedRowIds: rowIds, rowVersions: Object.fromEntries(importPreview.stagedRows.map(row => [row.id, row.reviewVersion])) })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setActionMessage(`Import committed: ${data.createdCount} created, ${data.updatedCount} updated, ${data.skippedCount} skipped.`);
      const refreshed = await apiFetch('/api/admin/imports/' + importPreview.batchId);
      if (refreshed.ok) setImportPreview(await refreshed.json());
      setApprovedImportRows([]);
      setCsvText('');
    } catch (err) {
      alert('Commit failed: ' + err.message);
    } finally {
      setCommitting(false);
    }
  }

  function loadSampleCsv() {
    const sample = `League,Area,Category,Source,Attached research notes
H.E.T.I. Adults,Toronto,Adult ice applicant – unverified,https://www.toronto.ca/ice-alloc.pdf,unresolved applicant from ice allocation PDF
Sports Village Hockey League,Vaughan,Arena-run adult ice,https://www.sportsvillage.ca,Direct arena league
New East York Rec League,Toronto,Independent ice,https://example.com/eastyork,Newly formed 2026 rec division`;
    setCsvText(sample);
  }

  async function handleRunAcceptanceTests() {
    setRunningTests(true);
    try {
      const res = await apiFetch('/api/admin-tests/run');
      const data = await res.json();
      setTestResults(data);
    } catch (err) {
      alert('Test runner error: ' + err.message);
    } finally {
      setRunningTests(false);
    }
  }

  // ==========================================
  // VIEW 1: DEDICATED LOGIN SCREEN (If not authenticated)
  // ==========================================
  if (!isAuthenticated) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4 py-12">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 sm:p-8 space-y-6 relative overflow-hidden">
          {/* Top subtle blue accent */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500"></div>

          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-[#12202B] text-white flex items-center justify-center text-2xl mx-auto shadow-md">
              🏒
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              RinkCircuit Operations Console
            </h1>
            <p className="text-xs text-slate-600">
              Restricted access for league convenors, editors, and platform administrators.
            </p>
          </div>

          {loginError && (
            <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-3 rounded-xl flex items-center gap-2 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-600" />
                <span>Admin Username or Email</span>
              </label>
              <input
                type="text"
                required
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="admin"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 focus:bg-white text-slate-900 transition-colors"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-slate-600" />
                <span>Security Key / Password</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter security key"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 focus:bg-white text-slate-900 pr-10 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-600 hover:text-slate-600 p-0.5"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loginLoading}
                className="w-full bg-[#1463DF] hover:bg-blue-700 text-white font-semibold py-3 rounded-xl shadow transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loginLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Sign In to Operations Console</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Credentials are configured per environment; no default password. */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-[11px] text-slate-600 space-y-1">
            <div className="font-semibold text-slate-800 flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-blue-600" />
              <span>Administrator access</span>
            </div>
            <div className="font-mono text-[10px] text-slate-600 pl-4">
              Use the administrator credentials configured for this environment. There is no default password.
            </div>
          </div>

          <div className="text-[10px] text-slate-600 text-center leading-relaxed">
            Admin sessions expire after eight hours. Sign out when finished on a shared device.
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: AUTHENTICATED ADMIN OPERATIONS DASHBOARD
  // ==========================================
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Admin Title Bar with Logout & Session Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold">
            <Shield className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              RinkCircuit Editorial & Operations Console
            </h1>
            <p className="text-xs text-slate-600">Moderation, Freshness Alerts, Import Staging & Acceptance Suite</p>
          </div>
        </div>

        {/* User Badge & Sign Out Button */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span>{currentUser?.name || 'Administrator'}</span>
            <span className="text-slate-600">({currentUser?.role || 'Super Admin'})</span>
          </div>

          <button
            onClick={() => loadTabData(activeTab)}
            className="p-2 text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100"
            title="Refresh current view"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleLogout}
            className="px-3.5 py-1.5 rounded-xl border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="End admin session"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-2.5 rounded-xl flex items-center justify-between">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="font-bold">✕</button>
        </div>
      )}

      {/* Admin Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2 text-xs">
        {[
          { id: 'overview', label: 'Overview & Freshness', icon: Shield },
          { id: 'requests', label: 'Listing Requests & Claims', icon: Building },
          { id: 'teams', label: 'Captain Submissions', icon: Users },
          { id: 'import', label: 'Spreadsheet Staging Tool', icon: FileSpreadsheet },
          { id: 'tests', label: 'Database Diagnostics', icon: Play }
        ].map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl font-semibold flex items-center gap-1.5 transition-colors ${
                active
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Overview & Freshness */}
      {activeTab === 'overview' && overview && (
        <div className="space-y-6">
          {/* Counters Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-slate-600 text-[11px] block">Published Leagues</span>
              <span className="text-2xl font-extrabold text-slate-900">{overview.counts.totalLeagues}</span>
              <span className="text-[10px] text-slate-600 block">({overview.counts.draftLeagues} unverified applicants in draft)</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-slate-600 text-[11px] block">Freshness Alerts (&gt;90d)</span>
              <span className={`text-2xl font-extrabold ${overview.counts.staleLeaguesCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {overview.counts.staleLeaguesCount}
              </span>
              <span className="text-[10px] text-slate-600 block">Require seasonal re-check</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-slate-600 text-[11px] block">Pending Moderation</span>
              <span className="text-2xl font-extrabold text-blue-600">{overview.counts.pendingRequests}</span>
              <span className="text-[10px] text-slate-600 block">Claims & corrections</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-slate-600 text-[11px] block">Verified vs Tentative Leads</span>
              <span className="text-2xl font-extrabold text-slate-900">
                {overview.counts.verifiedLeads} <span className="text-xs font-normal text-slate-600">/ {overview.counts.totalLeads}</span>
              </span>
              <span className="text-[10px] text-emerald-600 font-semibold block">{overview.counts.verifiedLeads} Email Confirmed</span>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-4 text-sm space-y-2"><h3 className="font-bold">Measurement definitions</h3><p>{overview.counts.excludedVerifiedLeads||0} verified contacts excluded from demand because they have no non-rejected interest.</p><p>Source coverage: {overview.sourceCoverage?.with_evidence||0} of {overview.sourceCoverage?.published||0} published programmes have evidence records (not a guarantee every field is verified).</p><p>{overview.counts.rawSubmissions||0} accepted interest requests since counters were enabled (includes retries).</p><p>Verified demand groups count distinct email-verified leads and exclude rejected interests. Outbound clicks are referrals, not registrations.</p><ul>{overview.analytics?.map(metric=><li key={metric.event_name}>{metric.event_name.replaceAll('_',' ')}: {metric.count}</li>)}</ul></div>
          {/* Stale Listings Table */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Listing Freshness Watchlist (Older than 90 Days)
                </h3>
                <p className="text-xs text-slate-600">
                  Acceptance Section 3 requirement: League facts must be reviewed within 90 days before a new playing season.
                </p>
              </div>
              <span className="text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full">
                {overview.staleLeagues.length} Stale Listings
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="pb-2">League Name</th>
                    <th className="pb-2">Municipality</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Last Checked</th>
                    <th className="pb-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {overview.staleLeagues.slice(0, 10).map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50">
                      <td className="py-2.5 font-bold text-slate-800">{l.name}</td>
                      <td className="py-2.5 text-slate-600">{l.municipality}</td>
                      <td className="py-2.5">
                        <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-semibold">
                          {l.verification_status}
                        </span>
                      </td>
                      <td className="py-2.5 text-slate-600 font-mono text-[11px]">{l.last_checked_at?.slice(0, 10) || 'Never'}</td>
                      <td className="py-2.5 text-right">
                        <button
                          onClick={() => navigate(`/leagues/${l.slug}`)}
                          className="text-blue-600 hover:underline font-semibold"
                        >
                          View Listing →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Listing Requests & Claims */}
      {activeTab === 'requests' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-slate-900">Listing Moderation Queue</h3>
              <p className="text-xs text-slate-600">Review claims, corrections, and new addition submissions with evidence verification.</p>
            </div>
            <span className="text-xs font-semibold text-slate-600">Total: {requests.length}</span>
          </div>

          {requests.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-600">Queue is currently empty.</div>
          ) : (
            <div className="space-y-4">
              {requests.map((r) => (
                <div key={r.id} className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-1 ${
                        r.request_type === 'claim' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {r.request_type}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900">
                        Target Listing: {r.current_programme_name || r.suggested_name || 'New Addition'}
                      </h4>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                      r.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                      r.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {r.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-600">
                    <div>Requester: <strong>{r.requester_name}</strong> ({r.requester_role})</div>
                    <div>Email: <strong className="font-mono">{r.requester_email}</strong></div>
                    <div>Date: <span>{new Date(r.created_at).toLocaleDateString()}</span></div>
                  </div>

                  {r.evidence_url && (
                    <div className="text-[11px] bg-white p-2 rounded border border-slate-200">
                      <span className="text-slate-600 font-semibold mr-1">Evidence URL:</span>
                      <a href={r.evidence_url} target="_blank" rel="noreferrer" className="text-blue-600 underline font-mono break-all">
                        {r.evidence_url}
                      </a>
                    </div>
                  )}

                  {r.message && (
                    <div className="text-slate-700 bg-white p-2.5 rounded border border-slate-200 text-[11px] leading-relaxed">
                      "{r.message}"
                    </div>
                  )}

                  {r.status === 'pending' && (
                    <div className="pt-2 flex justify-end gap-2">
                      <button
                        onClick={() => handleRequestDecision(r.id, 'rejected')}
                        className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 font-semibold text-xs"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleRequestDecision(r.id, 'approved')}
                        className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
                      >
                        Approve Review
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Captain Submissions */}
      {activeTab === 'teams' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-slate-900">Captain Submissions & Team Approvals</h3>
              <p className="text-xs text-slate-600">
                Acceptance A15: Approving a team publishes only approved fields (name, city, division, home league). Captain contacts remain strictly private.
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-600">Pending: {pendingTeams.length}</span>
          </div>

          {pendingTeams.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-600">No captain submissions awaiting moderation.</div>
          ) : (
            <div className="space-y-4">
              {pendingTeams.map((team) => (
                <div key={team.id} className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{team.team_name}</h4>
                      <p className="text-slate-600 text-[11px]">{team.city}, ON • {team.division || 'Recreational'}</p>
                    </div>

                    <span className="text-[11px] bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded">
                      Captain Email: {team.verification_status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600">
                    <div>Captain: <strong>{team.captain_name}</strong> (<span className="font-mono">{team.captain_email}</span>)</div>
                    <div>Home League: <strong>{team.home_league_or_independent || 'Not confirmed'}</strong></div>
                    <div>Publication consent: <strong>{team.publication_consent ? 'Granted' : 'Not granted — cannot publish'}</strong></div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button className="px-4 py-1.5 text-red-700" onClick={async () => {
                      try {
                        const response = await apiFetch(`/api/admin/teams/${team.id}/decision`, {method:'POST',body:JSON.stringify({decision:'rejected'})});
                        const data = await response.json();
                        if (!response.ok) throw new Error(data.error);
                        loadTabData('teams');
                      } catch (error) { alert(error.message); }
                    }}>Reject</button>
                    <button
                      disabled={!team.publication_consent || team.verification_status !== 'verified'}
                      onClick={() => handleTeamApproval(team.id, team.team_name, team.city, team.division, team.home_league_or_independent)}
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-xs"
                    >
                      Approve & Publish Team Profile
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Spreadsheet Staging Importer */}
      {activeTab === 'import' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">Research Workbook / CSV Staging Importer</h3>
            <p className="text-xs text-slate-600 leading-relaxed mt-1">
              Follows Section 4 workflow: Upload → Validate Headers → Staged Preview → Duplicate & Applicant Detection → Transactional Commit.
              Raw CRM fields are quarantined and never published.
            </p>
          </div>

          {/* Paste CSV or load sample */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <label className="font-semibold text-slate-700">Paste CSV or load sample test rows:</label>
              <button
                type="button"
                onClick={loadSampleCsv}
                className="text-blue-600 hover:underline font-semibold"
              >
                Load Sample Test Case Rows
              </button>
            </div>
            <textarea
              rows={4}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="League,Area,Category,Source,Attached research notes..."
              className="w-full text-xs font-mono p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={handlePreviewImport}
                disabled={loading}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  'Parse & Generate Staging Preview'
                )}
              </button>
            </div>
          </div>

          {importBatches.length > 0 && (
            <div className="space-y-2">
              <label htmlFor="saved-import" className="block text-sm font-semibold">Review a saved import</label>
              <select id="saved-import" defaultValue="" className="w-full border rounded-lg p-2 text-sm" onChange={async (event) => {
                if (!event.target.value) return;
                const res = await apiFetch('/api/admin/imports/' + event.target.value);
                if (!res.ok) { setActionMessage('Could not load this import.'); return; }
                setImportPreview(await res.json());
                setApprovedImportRows([]);
              }}>
                <option value="">Select a batch</option>
                {importBatches.map(batch => <option key={batch.id} value={batch.id}>{batch.filename} - {batch.total_rows} rows ({batch.status})</option>)}
              </select>
            </div>
          )}
          {/* Staged Preview */}
          {importPreview && (
            <div className="pt-4 border-t border-slate-200 space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">
                    Staged Import Batch: {importPreview.batchId}
                  </h4>
                  <div className="flex gap-3 text-xs text-slate-600 mt-1">
                    <span>Total Rows: <strong>{importPreview.summary.total}</strong></span>
                    <span className="text-amber-600 font-semibold">Applicant Leads: {importPreview.summary.applicantLeads}</span>
                    <span className="text-blue-600 font-semibold">Existing Duplicates: {importPreview.summary.duplicateCandidates}</span>
                  </div>
                </div>

                <button
                  onClick={handleCommitImport}
                  disabled={committing || approvedImportRows.length === 0}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow"
                >
                  {committing ? 'Committing...' : 'Commit Selected Rows as Shown'}
                </button>
              </div>

              <div className="space-y-3">
                {importPreview.stagedRows.map((row) => (
                  <div key={row.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                        <input type="checkbox" checked={approvedImportRows.includes(row.id)}
                          disabled={!row.selectable}
                          onChange={event => setApprovedImportRows(current => event.target.checked ? [...current, row.id] : current.filter(id => id !== row.id))} />
                        {row.candidateName || 'Unnamed Row'}
                      </label>
                      <div className="flex gap-1.5">
                        {row.flags.map((f) => (
                          <span key={f} className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full uppercase">
                            {f.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-slate-600 text-[11px]">
                      Area: <strong>{row.candidateArea}</strong> | Category: <strong>{row.candidateCategory}</strong>
                    </div>
                    <p>Status: <strong>{row.status}</strong> · Planned action: <strong>{row.plannedAction?.replaceAll('_', ' ')}</strong></p>
                    {row.status === 'pending_review' && <div className="flex gap-3">
                      <button type="button" className="text-blue-700 underline" onClick={()=>setEditingImport({id:row.id,name:row.candidateName,area:row.candidateArea,category:row.candidateCategory,source:row.sources.join(' '),reason:''})}>Correct staged fields</button>
                      <button type="button" className="text-red-700 underline" onClick={()=>reviewRow(row,'reject')}>Reject row</button>
                      {!row.flags.includes('editorial_hold') && <button type="button" className="text-amber-800 underline" onClick={()=>reviewRow(row,'hold')}>Hold for evidence</button>}
                      {row.flags.includes('editorial_hold') && <button type="button" className="text-blue-700 underline" onClick={()=>setEditingImport({id:row.id,mode:'resolve_hold',evidenceUrl:'',evidenceReviewed:false,programmeScope:'',reason:''})}>Resolve editorial hold</button>}
                      {row.flags.includes('applicant_lead') && <button type="button" className="text-blue-700 underline" onClick={()=>setEditingImport({id:row.id,mode:'classify_programme',evidenceUrl:'',evidenceReviewed:false,reason:''})}>Review applicant classification</button>}
                    </div>}
                    {row.flags.includes('editorial_hold') && <p className="text-amber-800">Import blocked pending evidence or programme reconciliation. Field corrections do not release this hold.</p>}
                    {row.flags.includes('publication_hold') && <p className="text-amber-800">Programme identity reviewed. Publication still requires separate editorial approval.</p>}
                    {row.editorialResolution && <div className="rounded border p-2 bg-white"><strong>Reviewed programme scope</strong><p>{row.editorialResolution.scope}</p><a className="text-blue-700 underline" href={row.editorialResolution.evidenceUrl} target="_blank" rel="noopener noreferrer">Reviewed official evidence</a></div>}
                    {editingImport?.id === row.id && ['classify_programme','resolve_hold'].includes(editingImport.mode) && <form className="grid gap-2 p-3 bg-white rounded border" onSubmit={event=>{event.preventDefault();reviewRow(row,editingImport.mode);}}>
                      <label>Official programme evidence<select required className="block w-full border rounded p-2" value={editingImport.evidenceUrl} onChange={event=>setEditingImport({...editingImport,evidenceUrl:event.target.value})}>
                        <option value="">Select a reviewed source</option>
                        {row.sources.filter(url=>!/ice-allocation-entitlements/i.test(url)).map(url=><option key={url} value={url}>{url}</option>)}
                      </select></label>
                      <label>Evidence summary<textarea required minLength={5} maxLength={2000} className="block w-full border rounded p-2" value={editingImport.reason} onChange={event=>setEditingImport({...editingImport,reason:event.target.value})} /></label>
                      {editingImport.mode==='resolve_hold' && <label>Resolved programme, season and venue scope<textarea required minLength={20} maxLength={2000} className="block w-full border rounded p-2" value={editingImport.programmeScope} onChange={event=>setEditingImport({...editingImport,programmeScope:event.target.value})} /></label>}
                      <label><input type="checkbox" required checked={editingImport.evidenceReviewed} onChange={event=>setEditingImport({...editingImport,evidenceReviewed:event.target.checked})} /> I reviewed the official source and it identifies this programme beyond an allocation application.</label>
                      <p>This records programme identity only. Publication stays on hold.</p>
                      <div className="flex gap-3"><button type="submit" className="text-blue-700 font-semibold">{editingImport.mode==='resolve_hold'?'Save scope and release import hold':'Save classification'}</button><button type="button" onClick={()=>setEditingImport(null)}>Cancel</button></div>
                    </form>}
                    {editingImport?.id === row.id && !['classify_programme','resolve_hold'].includes(editingImport.mode) && <form className="grid gap-2 p-3 bg-white rounded border" onSubmit={event=>{event.preventDefault();reviewRow(row,'correct');}}>
                      {['name','area','category','source','reason'].map(field=><label key={field} className="grid gap-1">{field === 'reason' ? 'Reason for correction' : field}
                        <input required value={editingImport[field]} maxLength={field==='source'?2048:field==='reason'?2000:200} onChange={event=>setEditingImport({...editingImport,[field]:event.target.value})} className="border rounded p-2" />
                      </label>)}
                      <p>Applicant restrictions remain in place. Changing a source resets its recorded check date to unknown.</p>
                      <div className="flex gap-3"><button type="submit" className="text-blue-700 font-semibold">Save staged correction</button><button type="button" onClick={()=>setEditingImport(null)}>Cancel</button></div>
                    </form>}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left"><caption className="text-left font-semibold">Field comparison</caption>
                        <thead><tr><th>Field</th><th>Current record</th><th>Incoming research</th></tr></thead>
                        <tbody>{row.fields?.map(field => <tr key={field.field} className={field.changed ? 'bg-amber-50' : ''}>
                          <th className="font-normal">{field.field}</th><td>{field.current ?? 'No existing value'}</td><td>{field.incoming || 'Unknown'}</td>
                        </tr>)}</tbody>
                      </table>
                    </div>
                    <div className="space-y-1">
                      <p>Source check: {row.checkedAt ? row.checkedAt.slice(0, 10) : 'Not recorded'} · {row.freshness}</p>
                      {row.sources?.map(url => <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block break-all text-blue-700 underline">{url}</a>)}
                      {!row.sources?.length && <p className="text-red-700">No valid source URL supplied.</p>}
                      {row.sourceReview && <div className="rounded border border-amber-200 bg-amber-50 p-2 space-y-1">
                        <p><strong>Source review: {row.sourceReview.result.replaceAll('_', ' ')}</strong> ({row.sourceReview.reviewedOn})</p>
                        <p>{row.sourceReview.note}</p>
                        {row.sourceReview.recommendedSource && <a href={row.sourceReview.recommendedSource} target="_blank" rel="noopener noreferrer" className="block break-all text-blue-700 underline">Suggested evidence: {row.sourceReview.recommendedSource}</a>}
                        <p>Research note only. Reconcile the record before approval; this does not confirm availability.</p>
                      </div>}
                      <p>Fees, nights, season and availability remain unknown. A supplied source link is not proof that every field is verified.</p>
                    </div>
                    {row.conflictInfo && (
                      <div className="text-amber-700 bg-amber-50 p-2 rounded text-[11px] border border-amber-200">
                        ⚠️ {row.conflictInfo.message}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Acceptance Matrix (A01 - A22) */}
      {activeTab === 'tests' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Database Diagnostics
              </h3>
              <p className="text-xs text-slate-600">
                Checks database tables and row-level security without modifying records. Full integration tests run separately.
              </p>
            </div>

            <button
              onClick={handleRunAcceptanceTests}
              disabled={runningTests}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow flex items-center gap-1.5 self-start sm:self-auto disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              <span>{runningTests ? 'Checking...' : 'Check Database'}</span>
            </button>
          </div>

          {testResults && (
            <div className="space-y-4">
              <div className={`p-4 rounded-xl text-xs font-bold flex items-center justify-between ${
                testResults.allPassed ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-red-50 text-red-900 border border-red-200'
              }`}>
                <span>Matrix Execution Result: {testResults.passed} / {testResults.total} Tests Passed</span>
                {testResults.allPassed && <span>Database checks passed</span>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {testResults.results.map((t) => (
                  <div key={t.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">[{t.id}] {t.title}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        t.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {t.passed ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">{t.details}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
