import { Routes, Route, Navigate } from 'react-router-dom';
import JoinQueue from './pages/JoinQueue';
import TokenPage from './pages/TokenPage';
import QueueStatus from './pages/QueueStatus';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AdminHistory from './pages/AdminHistory';
import AdminAnalytics from './pages/AdminAnalytics';

function RequireAuth({ children }) {
  return localStorage.getItem('adminToken') ? children : <Navigate to="/admin/login" replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Customer routes */}
      <Route path="/" element={<JoinQueue />} />
      <Route path="/token/:token" element={<TokenPage />} />
      <Route path="/status" element={<QueueStatus />} />

      {/* Admin routes */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<RequireAuth><AdminDashboard /></RequireAuth>} />
      <Route path="/admin/history" element={<RequireAuth><AdminHistory /></RequireAuth>} />
      <Route path="/admin/analytics" element={<RequireAuth><AdminAnalytics /></RequireAuth>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
