import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

export default function Navbar({ isAdmin }) {
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();

  function logout() {
    localStorage.removeItem('adminToken');
    navigate('/admin/login');
  }

  return (
    <nav className="bg-amazon-dark text-white shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-amazon-orange text-lg">
          🎫 <span>QueueFlow</span>
        </Link>

        <div className="flex items-center gap-3">
          {!isAdmin && (
            <>
              <Link to="/" className="text-sm hover:text-amazon-orange transition-colors">Join Queue</Link>
              <Link to="/status" className="text-sm hover:text-amazon-orange transition-colors">Check Status</Link>
            </>
          )}
          {isAdmin && (
            <>
              <Link to="/admin" className="text-sm hover:text-amazon-orange transition-colors">Dashboard</Link>
              <Link to="/admin/history" className="text-sm hover:text-amazon-orange transition-colors">History</Link>
              <Link to="/admin/analytics" className="text-sm hover:text-amazon-orange transition-colors">Analytics</Link>
              <button onClick={logout} className="text-sm text-red-400 hover:text-red-300 transition-colors">Logout</button>
            </>
          )}
          <button
            onClick={toggle}
            className="p-1.5 rounded bg-amazon-navy hover:bg-amazon-light transition-colors text-base"
            title="Toggle theme"
          >
            {dark ? '☀️' : '🌙'}
          </button>
        </div>
      </div>
    </nav>
  );
}
