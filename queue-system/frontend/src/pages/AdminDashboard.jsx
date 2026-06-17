import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import Navbar from '../components/Navbar';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { useSocket } from '../socket';

// ── Diagnostics Panel ────────────────────────────────────────────────────────
function DiagnosticsPanel() {
  const [status, setStatus] = useState(null);
  const [checking, setChecking] = useState(false);

  async function check() {
    setChecking(true);
    try {
      const { data } = await api.get('/health');
      setStatus({ ok: true, data });
    } catch (err) {
      const isCors = err.message?.toLowerCase().includes('network') || err.code === 'ERR_NETWORK';
      const isMissing = err.response?.status === undefined;
      setStatus({
        ok: false,
        corsError: isCors,
        backendMissing: isMissing,
        httpStatus: err.response?.status,
        message: err.response?.data?.error || err.message
      });
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => { check(); }, []);

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-500 dark:text-gray-400">
          System Diagnostics
        </h2>
        <button onClick={check} disabled={checking} className="btn-secondary text-xs px-3 py-1">
          {checking ? 'Checking...' : '🔄 Refresh'}
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div className="bg-gray-50 dark:bg-amazon-light rounded p-2">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Frontend URL</p>
          <p className="font-mono text-xs truncate">{window.location.origin}</p>
        </div>
        <div className="bg-gray-50 dark:bg-amazon-light rounded p-2">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Backend URL</p>
          <p className="font-mono text-xs truncate">{window.location.origin}/api</p>
        </div>
        <div className="bg-gray-50 dark:bg-amazon-light rounded p-2">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">API Status</p>
          <p className={`font-semibold text-xs ${status?.ok ? 'text-green-500' : 'text-red-500'}`}>
            {!status ? '...' : status.ok ? '✅ Connected' : '❌ Unreachable'}
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-amazon-light rounded p-2">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Connection</p>
          <p className={`font-semibold text-xs ${status?.ok ? 'text-green-500' : 'text-red-500'}`}>
            {!status ? '...' : status.ok ? '🟢 Online' : '🔴 Offline'}
          </p>
        </div>
      </div>
      {status && !status.ok && (
        <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-400">
          {status.corsError && <p>⚠️ <strong>CORS error</strong> — ensure the backend has <code>CLIENT_URL</code> set to <code>{window.location.origin}</code></p>}
          {status.backendMissing && <p>⚠️ <strong>Backend not running</strong> — start it with <code>npm run dev</code> in <code>queue-system/backend/</code></p>}
          {status.httpStatus && <p>HTTP {status.httpStatus}: {status.message}</p>}
          {!status.corsError && !status.backendMissing && !status.httpStatus && <p>{status.message}</p>}
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const [recallToken, setRecallToken] = useState('');

  const fetchDashboard = useCallback(async () => {
    try {
      const [dashRes, histRes] = await Promise.all([
        api.get('/admin/dashboard'),
        api.get('/admin/history?limit=10')
      ]);
      setStats(dashRes.data);
      setQueue(histRes.data.tokens.filter(t => t.status === 'waiting' || t.status === 'serving'));
    } catch {}
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);
  useSocket('queue:update', () => fetchDashboard());

  async function action(endpoint, body = {}) {
    setLoading(true);
    setActionMsg('');
    try {
      const { data } = await api.post(endpoint, body);
      setActionMsg(data.message || data.currentToken || 'Done');
      await fetchDashboard();
    } catch (err) {
      setActionMsg(err.response?.data?.error || 'Action failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <Navbar isAdmin />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Queue Dashboard</h1>
          <button onClick={fetchDashboard} className="btn-secondary text-sm">🔄 Refresh</button>
        </div>

        <DiagnosticsPanel />

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Waiting" value={stats?.waitingCount ?? '—'} icon="⏳" />
          <StatCard label="Serving" value={stats?.servingCount ?? '—'} icon="🔔" color="text-green-500" />
          <StatCard label="Completed Today" value={stats?.completedCount ?? '—'} icon="✅" color="text-blue-500" />
          <StatCard label="Avg Wait (min)" value={stats?.avgWaitTime ?? '—'} icon="⏱️" color="text-purple-500" />
        </div>

        {/* Current token */}
        <div className="card mb-6 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Now Serving</p>
          <div className="text-6xl font-black text-amazon-orange">
            {stats?.currentToken || '—'}
          </div>
        </div>

        {/* Queue controls */}
        <div className="card mb-6">
          <h2 className="font-semibold mb-4">Queue Controls</h2>
          {actionMsg && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 px-4 py-2 rounded mb-4 text-sm">
              {actionMsg}
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <button onClick={() => action('/admin/next')} disabled={loading} className="btn-primary py-3 flex flex-col items-center gap-1">
              <span className="text-xl">▶️</span>
              <span className="text-xs">Next Token</span>
            </button>
            <button onClick={() => action('/admin/complete')} disabled={loading} className="btn-secondary py-3 flex flex-col items-center gap-1">
              <span className="text-xl">✅</span>
              <span className="text-xs">Mark Complete</span>
            </button>
            <button onClick={() => action('/admin/skip')} disabled={loading} className="btn-secondary py-3 flex flex-col items-center gap-1">
              <span className="text-xl">⏭️</span>
              <span className="text-xs">Skip Token</span>
            </button>
            <div className="flex gap-2">
              <input
                className="input flex-1 text-sm"
                placeholder="Token e.g. A001"
                value={recallToken}
                onChange={e => setRecallToken(e.target.value.toUpperCase())}
              />
              <button
                onClick={() => { action('/admin/recall', { tokenNumber: recallToken }); setRecallToken(''); }}
                disabled={loading || !recallToken}
                className="btn-secondary px-3 text-sm"
                title="Recall Token"
              >🔁</button>
            </div>
          </div>
        </div>

        {/* Live queue */}
        <div className="card">
          <h2 className="font-semibold mb-4">Live Queue</h2>
          {queue.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">Queue is empty</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500 dark:text-gray-400">
                    <th className="pb-2 pr-4">Token</th>
                    <th className="pb-2 pr-4">Name</th>
                    <th className="pb-2 pr-4">Service</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {queue.map(t => (
                    <tr key={t._id} className={t.status === 'serving' ? 'bg-green-50 dark:bg-green-900/10' : ''}>
                      <td className="py-2 pr-4 font-mono font-bold text-amazon-orange">{t.tokenNumber}</td>
                      <td className="py-2 pr-4">{t.customerName}</td>
                      <td className="py-2 pr-4">{t.serviceType}</td>
                      <td className="py-2 pr-4"><StatusBadge status={t.status} /></td>
                      <td className="py-2 text-gray-400 text-xs">
                        {new Date(t.joinedAt).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
