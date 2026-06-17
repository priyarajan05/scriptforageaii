# QueueFlow — Amazon-Style Queue Management System

## Quick Start

### 1. Backend

```bash
cd queue-system/backend
cp .env .env.local   # edit MONGODB_URI
npm install
npm run dev          # runs on http://localhost:5000
```

### 2. Frontend

```bash
cd queue-system/frontend
npm install
npm run dev          # runs on http://localhost:5173
```

> ⚠️ **Never open `index.html` directly** (`file://`). Always use `http://localhost:5173`.

---

## Environment Variables

### `queue-system/backend/.env`

| Variable | Description |
|---|---|
| `PORT` | Backend port (default: 5000) |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Secret key for JWT tokens |
| `ADMIN_USERNAME` | Default admin username (default: admin) |
| `ADMIN_PASSWORD` | Default admin password (default: admin123) |
| `CLIENT_URL` | Frontend URL for CORS (default: http://localhost:5173) |

---

## URLs

| URL | Description |
|---|---|
| `http://localhost:5173` | Customer frontend |
| `http://localhost:5173/status` | Queue status / token search |
| `http://localhost:5173/admin` | Admin dashboard |
| `http://localhost:5173/admin/history` | Token history |
| `http://localhost:5173/admin/analytics` | Analytics |
| `http://localhost:5000/api/health` | Backend health check |

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/queue/join` | No | Join queue, get token |
| GET | `/api/queue/status` | No | Live queue status |
| GET | `/api/queue/position/:token` | No | Token position |
| POST | `/api/admin/login` | No | Admin login |
| GET | `/api/admin/dashboard` | Yes | Dashboard stats |
| POST | `/api/admin/next` | Yes | Serve next token |
| POST | `/api/admin/skip` | Yes | Skip current token |
| POST | `/api/admin/recall` | Yes | Recall a token |
| POST | `/api/admin/complete` | Yes | Complete current token |
| GET | `/api/admin/history` | Yes | Token history |
| GET | `/api/admin/analytics` | Yes | Analytics data |

---

## Deployment

For production, build the frontend:

```bash
cd queue-system/frontend
npm run build
```

Then serve the `dist/` folder from the backend by adding:

```js
app.use(express.static(path.join(__dirname, '../frontend/dist')));
```

---

## Folder Structure

```
queue-system/
├── backend/
│   ├── middleware/auth.js
│   ├── models/index.js
│   ├── routes/admin.js
│   ├── routes/queue.js
│   ├── server.js
│   └── .env
└── frontend/
    └── src/
        ├── pages/
        │   ├── JoinQueue.jsx
        │   ├── TokenPage.jsx
        │   ├── QueueStatus.jsx
        │   ├── AdminLogin.jsx
        │   ├── AdminDashboard.jsx
        │   ├── AdminHistory.jsx
        │   └── AdminAnalytics.jsx
        ├── components/
        │   ├── Navbar.jsx
        │   ├── StatCard.jsx
        │   └── StatusBadge.jsx
        ├── context/ThemeContext.jsx
        ├── api.js
        ├── socket.js
        ├── App.jsx
        └── main.jsx
```
