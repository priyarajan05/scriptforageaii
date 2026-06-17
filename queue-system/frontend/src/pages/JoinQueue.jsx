import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import Navbar from '../components/Navbar';

const SERVICE_TYPES = ['General', 'Premium', 'Express', 'Technical Support', 'Billing'];

export default function JoinQueue() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ customerName: '', mobileNumber: '', serviceType: 'General' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!/^\d{10}$/.test(form.mobileNumber)) {
      setError('Enter a valid 10-digit mobile number');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/queue/join', form);
      navigate(`/token/${data.token}`, { state: data });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to join queue');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="card">
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">🎫</div>
            <h1 className="text-2xl font-bold text-amazon-orange">Join the Queue</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Get your digital token instantly</p>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Full Name</label>
              <input
                className="input"
                placeholder="John Doe"
                value={form.customerName}
                onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Mobile Number</label>
              <input
                className="input"
                placeholder="10-digit number"
                value={form.mobileNumber}
                onChange={e => setForm(f => ({ ...f, mobileNumber: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Service Type</label>
              <select
                className="input"
                value={form.serviceType}
                onChange={e => setForm(f => ({ ...f, serviceType: e.target.value }))}
              >
                {SERVICE_TYPES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base mt-2">
              {loading ? 'Joining...' : 'Get Token →'}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Already have a token?{' '}
              <a href="/status" className="text-amazon-orange hover:underline">Check status</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
