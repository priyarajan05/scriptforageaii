const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const { User, Token, Queue, Analytics } = require('../models');
const { updateAnalytics, getOrCreateQueue, today } = require('./queue');

const emit = (req, event, data) => req.app.get('io')?.emit(event, data);

// POST /api/admin/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );
    res.json({ token, username: user.username, role: user.role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/dashboard
router.get('/dashboard', auth, async (req, res) => {
  try {
    const date = today();
    const [waiting, serving, completed, analytics, queue] = await Promise.all([
      Token.countDocuments({ date, status: 'waiting' }),
      Token.countDocuments({ date, status: 'serving' }),
      Token.countDocuments({ date, status: 'completed' }),
      Analytics.findOne({ date }),
      getOrCreateQueue(date)
    ]);
    res.json({
      waitingCount: waiting,
      servingCount: serving,
      completedCount: completed,
      currentToken: queue.currentToken,
      avgWaitTime: analytics?.avgWaitTime || 0,
      avgServiceTime: analytics?.avgServiceTime || 0,
      totalToday: waiting + serving + completed
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/next
router.post('/next', auth, async (req, res) => {
  try {
    const date = today();
    const serving = await Token.findOne({ date, status: 'serving' });
    if (serving) {
      const serviceTime = Math.round((Date.now() - serving.servedAt) / 60000);
      await Token.updateOne({ _id: serving._id }, { status: 'completed', completedAt: new Date(), serviceTime });
    }

    const next = await Token.findOne({ date, status: 'waiting' }).sort({ sequence: 1 });
    if (!next) {
      await Queue.updateOne({ date }, { currentToken: null });
      await updateAnalytics(date);
      emit(req, 'queue:update', { type: 'empty', currentToken: null });
      return res.json({ message: 'No more tokens in queue', currentToken: null });
    }

    const waitTime = Math.round((Date.now() - next.joinedAt) / 60000);
    await Token.updateOne({ _id: next._id }, { status: 'serving', servedAt: new Date(), waitTime });
    await Queue.updateOne({ date }, { currentToken: next.tokenNumber, currentSequence: next.sequence });
    await updateAnalytics(date);

    emit(req, 'queue:update', { type: 'next', currentToken: next.tokenNumber, customerName: next.customerName, serviceType: next.serviceType });
    res.json({ currentToken: next.tokenNumber, customerName: next.customerName, serviceType: next.serviceType });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/skip
router.post('/skip', auth, async (req, res) => {
  try {
    const date = today();
    const serving = await Token.findOne({ date, status: 'serving' });
    if (!serving) return res.status(400).json({ error: 'No token currently serving' });

    await Token.updateOne({ _id: serving._id }, { status: 'skipped', completedAt: new Date() });
    await updateAnalytics(date);
    emit(req, 'queue:update', { type: 'skip', tokenNumber: serving.tokenNumber });
    res.json({ message: `Token ${serving.tokenNumber} skipped` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/recall
router.post('/recall', auth, async (req, res) => {
  try {
    const date = today();
    const { tokenNumber } = req.body;
    const token = await Token.findOne({ date, tokenNumber: tokenNumber?.toUpperCase() });
    if (!token) return res.status(404).json({ error: 'Token not found' });

    await Token.updateOne({ _id: token._id }, { status: 'serving', servedAt: new Date() });
    await Queue.updateOne({ date }, { currentToken: token.tokenNumber });
    emit(req, 'queue:update', { type: 'recall', currentToken: token.tokenNumber });
    res.json({ message: `Token ${token.tokenNumber} recalled`, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/complete
router.post('/complete', auth, async (req, res) => {
  try {
    const date = today();
    const serving = await Token.findOne({ date, status: 'serving' });
    if (!serving) return res.status(400).json({ error: 'No token currently serving' });

    const serviceTime = Math.round((Date.now() - serving.servedAt) / 60000);
    await Token.updateOne({ _id: serving._id }, { status: 'completed', completedAt: new Date(), serviceTime });
    await Queue.updateOne({ date }, { currentToken: null });
    await updateAnalytics(date);
    emit(req, 'queue:update', { type: 'complete', tokenNumber: serving.tokenNumber });
    res.json({ message: `Token ${serving.tokenNumber} completed` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/history
router.get('/history', auth, async (req, res) => {
  try {
    const { date = today(), status, search, page = 1, limit = 20 } = req.query;
    const filter = { date };
    if (status) filter.status = status;
    if (search) filter.$or = [
      { tokenNumber: { $regex: search, $options: 'i' } },
      { customerName: { $regex: search, $options: 'i' } },
      { mobileNumber: { $regex: search, $options: 'i' } }
    ];
    const [tokens, total] = await Promise.all([
      Token.find(filter).sort({ sequence: 1 }).skip((+page - 1) * +limit).limit(+limit),
      Token.countDocuments(filter)
    ]);
    res.json({ tokens, total, page: +page, pages: Math.ceil(total / +limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/analytics
router.get('/analytics', auth, async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const dates = Array.from({ length: +days }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().slice(0, 10);
    });
    const analytics = await Analytics.find({ date: { $in: dates } }).sort({ date: -1 });
    res.json(analytics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
