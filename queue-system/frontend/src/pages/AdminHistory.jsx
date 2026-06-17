import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import Navbar from '../components/Navbar';
import StatusBadge from '../components/StatusBadge';

export default function AdminHistory() {
  const [data, setData] = useState({ tokens: [], total: 0, pages: 1 });
  const [filters, setFilters] = useState({ search: '', status: '', page: 1 });
  const [loading, setLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: filters.page, limit: 20 });
      if (filters.search) params.set('search', filters.search);
      if (filters.status) params.set('status', filters.status);
      const { data: res } = await api.get(`/admin/history?${params}`);
      setData(res);
    } catch {}
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  function set(key, val) {
    setFilters(f => ({ ...f, [key]: val, page: key !== 'page' ? 1 : val }));
  }

  return (
    <div className="min-h-screen">
      <Navbar isAdmin />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Queue History</h1>

        {/* Filters */}
        <div className="card mb-6 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Search</label>
            <input
              className="input"
              placeholder="Token, name, or mobile..."
              value={filters.search}
              onChange={e => set('search', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Status</label>
            <select className="input w-36" value={filters.status} onChange={e => set('status', e.target.value)}>
              <option value="">All</option>
              <option value="waiting">Waiting</option>
              <option value="serving">Serving</option>
              <option value="completed">Completed</option>
              <option value="skipped">Skipped</option>
            </select>
          </div>
          <button onClick={fetchHistory} className="btn-primary px-4">Search</button>
        </div>

        {/* Table */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">{data.total} records found</p>
          </div>
          {loading ? (
            <div className="text-center py-8 text-gray-400">Loading...</div>
          ) : data.tokens.length === 0 ? (
            <div className="text-center py-8 text-gray-400">No records found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    <th className="pb-3 pr-4">Token</th>
                    <th className="pb-3 pr-4">Name</th>
                    <th className="pb-3 pr-4">Mobile</th>
                    <th className="pb-3 pr-4">Service</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 pr-4">Wait (m)</th>
                    <th className="pb-3">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {data.tokens.map(t => (
                    <tr key={t._id} className="hover:bg-gray-50 dark:hover:bg-amazon-light/30 transition-colors">
                      <td className="py-2.5 pr-4 font-mono font-bold text-amazon-orange">{t.tokenNumber}</td>
                      <td className="py-2.5 pr-4">{t.customerName}</td>
                      <td className="py-2.5 pr-4 text-gray-500 dark:text-gray-400">{t.mobileNumber}</td>
                      <td className="py-2.5 pr-4">{t.serviceType}</td>
                      <td className="py-2.5 pr-4"><StatusBadge status={t.status} /></td>
                      <td className="py-2.5 pr-4 text-center">{t.waitTime ?? '—'}</td>
                      <td className="py-2.5 text-xs text-gray-400">
                        {new Date(t.joinedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {data.pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                disabled={filters.page <= 1}
                onClick={() => set('page', filters.page - 1)}
                className="btn-secondary px-3 py-1 text-sm"
              >← Prev</button>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Page {filters.page} of {data.pages}
              </span>
              <button
                disabled={filters.page >= data.pages}
                onClick={() => set('page', filters.page + 1)}
                className="btn-secondary px-3 py-1 text-sm"
              >Next →</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
