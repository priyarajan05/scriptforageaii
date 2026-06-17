import { useState, useEffect } from 'react';
import api from '../api';
import Navbar from '../components/Navbar';
import StatCard from '../components/StatCard';

export default function AdminAnalytics() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/analytics?days=7')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totals = data.reduce((acc, d) => ({
    total: acc.total + (d.totalTokens || 0),
    completed: acc.completed + (d.completedTokens || 0),
    skipped: acc.skipped + (d.skippedTokens || 0),
    avgWait: acc.avgWait + (d.avgWaitTime || 0)
  }), { total: 0, completed: 0, skipped: 0, avgWait: 0 });

  const avgWait = data.length ? Math.round(totals.avgWait / data.length) : 0;
  const peakEntry = data.find(d => d.peakHour !== null);

  return (
    <div className="min-h-screen">
      <Navbar isAdmin />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Queue Analytics (Last 7 Days)</h1>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading analytics...</div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard label="Total Customers" value={totals.total} icon="👥" />
              <StatCard label="Completed" value={totals.completed} icon="✅" color="text-green-500" />
              <StatCard label="Skipped" value={totals.skipped} icon="⏭️" color="text-red-500" />
              <StatCard label="Avg Wait (min)" value={avgWait} icon="⏱️" color="text-blue-500" />
            </div>

            {/* Daily breakdown */}
            <div className="card mb-6">
              <h2 className="font-semibold mb-4">Daily Breakdown</h2>
              {data.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">No data available yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        <th className="pb-3 pr-4">Date</th>
                        <th className="pb-3 pr-4 text-right">Total</th>
                        <th className="pb-3 pr-4 text-right">Completed</th>
                        <th className="pb-3 pr-4 text-right">Skipped</th>
                        <th className="pb-3 pr-4 text-right">Avg Wait</th>
                        <th className="pb-3 text-right">Peak Hour</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {data.map(d => (
                        <tr key={d.date} className="hover:bg-gray-50 dark:hover:bg-amazon-light/30">
                          <td className="py-2.5 pr-4 font-medium">{d.date}</td>
                          <td className="py-2.5 pr-4 text-right">{d.totalTokens}</td>
                          <td className="py-2.5 pr-4 text-right text-green-500">{d.completedTokens}</td>
                          <td className="py-2.5 pr-4 text-right text-red-500">{d.skippedTokens}</td>
                          <td className="py-2.5 pr-4 text-right">{d.avgWaitTime ?? '—'} min</td>
                          <td className="py-2.5 text-right text-amazon-orange">
                            {d.peakHour !== null ? `${d.peakHour}:00` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Peak hour chart */}
            {peakEntry?.hourlyData?.length > 0 && (
              <div className="card">
                <h2 className="font-semibold mb-4">Hourly Distribution — {peakEntry.date}</h2>
                <div className="flex items-end gap-1 h-24">
                  {Array.from({ length: 24 }, (_, h) => {
                    const entry = peakEntry.hourlyData.find(hd => hd.hour === h);
                    const count = entry?.count || 0;
                    const max = Math.max(...peakEntry.hourlyData.map(hd => hd.count), 1);
                    const height = Math.round((count / max) * 100);
                    return (
                      <div key={h} className="flex-1 flex flex-col items-center gap-0.5" title={`${h}:00 — ${count} customers`}>
                        <div
                          className="w-full rounded-t bg-amazon-orange/80 hover:bg-amazon-orange transition-colors"
                          style={{ height: `${height}%`, minHeight: count ? '4px' : '0' }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1 px-0.5">
                  <span>0:00</span><span>6:00</span><span>12:00</span><span>18:00</span><span>23:00</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
