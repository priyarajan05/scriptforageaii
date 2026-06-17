import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useTheme } from '../context/ThemeContext';

export default function AdminLogin() {
  const navigate = useNavigate();
  const { dark, toggle } = useTheme();
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/admin/login', form);
      localStorage.setItem('adminToken', data.token);
      navigate('/admin');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Check credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-amazon-dark flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🎫</div>
          <h1 className="text-2xl font-bold text-amazon-orange">QueueFlow Admin</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Sign in to manage the queue</p>
        </div>

        <div className="card">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded mb-4 text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Username</label>
              <input
                className="input"
                placeholder="admin"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                required autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <div className="text-center mt-4">
          <button onClick={toggle} className="text-sm text-gray-500 dark:text-gray-400 hover:text-amazon-orange transition-colors">
            {dark ? '☀️ Light mode' : '🌙 Dark mode'}
          </button>
        </div>
        <p className="text-center text-xs text-gray-400 mt-4">
          Default: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">admin / admin123</code>
        </p>
      </div>
    </div>
  );
}
