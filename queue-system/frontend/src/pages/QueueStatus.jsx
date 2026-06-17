import { useState, useEffect } from 'react';
import api from '../api';
import Navbar from '../components/Navbar';
import { useSocket } from '../socket';

export default function QueueStatus() {
  const [status, setStatus] = useState(null);
  const [search, setSearch] = useState('');
  const [tokenData, setTokenData] = useState(null);
  const [searching, setSearching] = useState(false);
  const [err, setErr] = useState('');

  async function fetchStatus() {
    try {
      const { data } = await api.get('/queue/status');
      setStatus(data);
    } catch {}
  }

  async function searchToken(e) {
    e.preventDefault();
    if (!search.trim()) return;
    setSearching(true);
    setErr('');
    setTokenData(null);
    try {
      const { data } = await api.get(`/queue/position/${search.trim()}`);
      setTokenData(data);
    } catch (e) {
      setErr(e.response?.data?.error || 'Token not found');
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => { fetchStatus(); }, []);
  useSocket('queue:update', () => fetchStatus());

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-6 text-amazon-orange">Queue Status</h1>

        {/* Live status board */}
        {status && (
          <div className="grid grid-cols-2 gap-4 mb-8 sm:grid-cols-4">
            <div className="card text-center col-span-2 sm:col-span-1">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Now Serving</p>
              <p className="text-3xl font-black text-amazon-orange">{status.currentToken || '—'}</p>
            </div>
            <div className="card text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Waiting</p>
              <p className="text-3xl font-black text-blue-500">{status.waitingCount}</p>
            </div>
            <div className="card text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Avg Wait</p>
              <p className="text-3xl font-black text-green-500">{status.avgWaitTime}<span className="text-sm font-normal">m</span></p>
            </div>
            <div className="card text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Status</p>
              <p className={`text-sm font-bold mt-1 ${status.isActive ? 'text-green-500' : 'text-red-500'}`}>
                {status.isActive ? '🟢 Open' : '🔴 Closed'}
              </p>
            </div>
          </div>
        )}

        {/* Token search */}
        <div className="card">
          <h2 className="font-semibold mb-3">Search Your Token</h2>
          <form onSubmit={searchToken} className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Enter token (e.g. A001)"
              value={search}
              onChange={e => setSearch(e.target.value.toUpperCase())}
            />
            <button type="submit" disabled={searching} className="btn-primary px-5">
              {searching ? '...' : 'Search'}
            </button>
          </form>

          {err && <p className="text-red-500 text-sm mt-3">{err}</p>}

          {tokenData && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-2xl font-black text-amazon-orange">{tokenData.tokenNumber}</span>
                <span className={`badge ${
                  tokenData.status === 'serving' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                  tokenData.status === 'waiting' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                  'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                }`}>{tokenData.status}</span>
              </div>
              <p className="text-sm"><span className="text-gray-500 dark:text-gray-400">Name:</span> {tokenData.customerName}</p>
              <p className="text-sm"><span className="text-gray-500 dark:text-gray-400">Service:</span> {tokenData.serviceType}</p>
              {tokenData.status === 'waiting' && (
                <>
                  <p className="text-sm"><span className="text-gray-500 dark:text-gray-400">Position:</span> <strong>#{tokenData.position}</strong></p>
                  <p className="text-sm"><span className="text-gray-500 dark:text-gray-400">Est. wait:</span> <strong>{tokenData.estimatedWait} min</strong></p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
