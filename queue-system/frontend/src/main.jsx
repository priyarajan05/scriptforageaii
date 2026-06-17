import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import './index.css';
import App from './App.jsx';

// ── file:// protocol guard ───────────────────────────────────────────────────
if (window.location.protocol === 'file:') {
  document.getElementById('root').innerHTML = `
    <div style="
      min-height:100vh;display:flex;align-items:center;justify-content:center;
      background:#131921;font-family:system-ui,sans-serif;padding:2rem;
    ">
      <div style="
        max-width:520px;background:#232F3E;border:2px solid #FF9900;
        border-radius:12px;padding:2.5rem;text-align:center;color:#fff;
      ">
        <div style="font-size:3rem;margin-bottom:1rem">⚠️</div>
        <h1 style="color:#FF9900;font-size:1.4rem;margin-bottom:1rem">
          Wrong Launch Method Detected
        </h1>
        <p style="color:#ccc;line-height:1.6;margin-bottom:1.5rem">
          This application cannot run when opened directly as a file.<br><br>
          <strong style="color:#fff">Please run it using:</strong>
        </p>
        <code style="
          display:block;background:#131921;color:#FF9900;padding:0.75rem 1rem;
          border-radius:8px;font-size:1rem;margin-bottom:1.5rem;letter-spacing:0.5px;
        ">http://localhost:5173</code>
        <p style="color:#9ca3af;font-size:0.85rem;line-height:1.6">
          Start the frontend with <code style="color:#FF9900">npm run dev</code> inside
          <code style="color:#FF9900">queue-system/frontend/</code><br>
          and the backend with <code style="color:#FF9900">npm run dev</code> inside
          <code style="color:#FF9900">queue-system/backend/</code>
        </p>
      </div>
    </div>
  `;
} else {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <BrowserRouter>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </BrowserRouter>
    </StrictMode>
  );
}
