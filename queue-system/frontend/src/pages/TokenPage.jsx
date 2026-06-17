import { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import api from '../api';
import Navbar from '../components/Navbar';
import StatusBadge from '../components/StatusBadge';
import { useSocket } from '../socket';

export default function TokenPage() {
  const { token } = useParams();
  const { state } = useLocation();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  async function fetchPosition() {
    try {
      const res = await api.get(`/queue/position/${token}`);
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Token not found');
    }
  }

  useEffect(() => { fetchPosition(); }, [token]);

  useSocket('queue:update', () => fetchPosition());

  if (error) return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-md mx-auto px-4 py-12 text-center">
        <div className="card">
          <div className="text-5xl mb-4">❌</div>
          <p className="text-red-500">{error}</p>
          <a href="/" className="btn-primary mt-4 inline-block">Back to Home</a>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-md mx-auto px-4 py-12">
        {/* Token Card */}
        <div className="card text-center mb-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Your Token Number</p>
          <div className="text-6xl font-black text-amazon-orange tracking-wider my-4">
            {token}
          </div>
          {data && <StatusBadge status={data.status} />}
          {state && (
            <div className="mt-4 text-sm text-gray-600 dark:text-gray-300 space-y-1">
              <p><span className="font-medium">Name:</span> {state.customerName}</p>
              <p><span className="font-medium">Service:</span> {state.serviceType}</p>
            </div>
          )}
        </div>

        {/* Position Info */}
        {data && data.status === 'waiting' && (
          <div className="card text-center mb-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Your Position</p>
            <div className="text-5xl font-black text-blue-500">{data.position}</div>
            <p className="text-sm mt-2 text-gray-600 dark:text-gray-300">
              {data.position === 1 ? "You're next!" : `${data.position - 1} people ahead of you`}
            </p>
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">Estimated wait</p>
              <p className="text-xl font-bold">{data.estimatedWait} min</p>
            </div>
          </div>
        )}

        {data && data.status === 'serving' && (
          <div className="card text-center mb-4 border-2 border-green-400">
            <div className="text-4xl mb-2">🔔</div>
            <p className="text-xl font-bold text-green-500">Your turn! Please proceed.</p>
          </div>
        )}

        {data && data.status === 'completed' && (
          <div className="card text-center mb-4">
            <div className="text-4xl mb-2">✅</div>
            <p className="text-lg font-semibold text-blue-500">Service completed. Thank you!</p>
          </div>
        )}

        {/* Current serving */}
        {data?.currentServing && (
          <div className="card text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">Now Serving</p>
            <p className="text-3xl font-black text-amazon-orange">{data.currentServing}</p>
          </div>
        )}

        <div className="mt-4 text-center">
          <button onClick={fetchPosition} className="btn-secondary text-sm">
            🔄 Refresh Status
          </button>
        </div>
      </div>
    </div>
  );
}
