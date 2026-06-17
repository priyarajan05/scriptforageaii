require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { User } = require('./models');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || 'http://localhost:5173', methods: ['GET', 'POST'] }
});

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());

// Attach io to req for use in routes
app.use((req, _res, next) => { req.io = io; next(); });

app.use('/api/queue', require('./routes/queue'));
app.use('/api/admin', require('./routes/admin'));
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

io.on('connection', socket => {
  console.log(`Client connected: ${socket.id}`);
  socket.on('disconnect', () => console.log(`Client disconnected: ${socket.id}`));
});

// Expose io globally for routes to emit events
app.set('io', io);

async function seedAdmin() {
  const exists = await User.findOne({ username: process.env.ADMIN_USERNAME || 'admin' });
  if (!exists) {
    const hashed = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10);
    await User.create({ username: process.env.ADMIN_USERNAME || 'admin', password: hashed, role: 'admin' });
    console.log('Default admin created: admin / admin123');
  }
}

async function start() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected');
  await seedAdmin();

  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => console.log(`Queue System backend running on port ${PORT}`));
}

start().catch(err => { console.error('Startup error:', err); process.exit(1); });
