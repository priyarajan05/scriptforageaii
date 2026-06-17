const router = require('express').Router();
const { Token, Queue, Analytics } = require('../models');

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function getOrCreateQueue(date) {
  let queue = await Queue.findOne({ date });
  if (!queue) queue = await Queue.create({ date, serviceTypes: ['General', 'Premium', 'Express'] });
  return queue;
}

async function updateAnalytics(date) {
  const tokens = await Token.find({ date });
  const completed = tokens.filter(t => t.status === 'completed');
  const skipped = tokens.filter(t => t.status === 'skipped');

  const avgWait = completed.length
    ? Math.round(completed.reduce((s, t) => s + (t.waitTime || 0), 0) / completed.length)
    : 0;
  const avgService = completed.length
    ? Math.round(completed.reduce((s, t) => s + (t.serviceTime || 0), 0) / completed.length)
    : 0;

  const hourCounts = {};
  tokens.forEach(t => {
    const h = new Date(t.joinedAt).getHours();
    hourCounts[h] = (hourCounts[h] || 0) + 1;
  });
  const hourlyData = Object.entries(hourCounts).map(([hour, count]) => ({ hour: +hour, count }));
  const peakHour = hourlyData.length ? hourlyData.reduce((a, b) => a.count > b.count ? a : b).hour : null;

  await Analytics.findOneAndUpdate(
    { date },
    { totalTokens: tokens.length, completedTokens: completed.length, skippedTokens: skipped.length, avgWaitTime: avgWait, avgServiceTime: avgService, peakHour, hourlyData },
    { upsert: true }
  );
}

// POST /api/queue/join
router.post('/join', async (req, res) => {
  try {
    const { customerName, mobileNumber, serviceType } = req.body;
    if (!customerName || !mobileNumber || !serviceType) {
      return res.status(400).json({ error: 'All fields required' });
    }

    const date = today();
    const queue = await getOrCreateQueue(date);
    const sequence = queue.lastSequence + 1;
    const tokenNumber = `A${String(sequence).padStart(3, '0')}`;

    const token = await Token.create({ tokenNumber, sequence, customerName, mobileNumber, serviceType, date });
    await Queue.updateOne({ date }, { lastSequence: sequence });

    const waiting = await Token.countDocuments({ date, status: 'waiting' });
    req.app.get('io')?.emit('queue:update', { type: 'join', tokenNumber: token.tokenNumber, waitingCount: waiting });

    res.json({ token: token.tokenNumber, customerName, serviceType, message: 'Successfully joined the queue' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/queue/status
router.get('/status', async (req, res) => {
  try {
    const date = today();
    const queue = await getOrCreateQueue(date);
    const waiting = await Token.countDocuments({ date, status: 'waiting' });
    const analytics = await Analytics.findOne({ date });

    res.json({
      currentToken: queue.currentToken,
      waitingCount: waiting,
      avgWaitTime: analytics?.avgWaitTime || 5,
      isActive: queue.isActive
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/queue/position/:token
router.get('/position/:token', async (req, res) => {
  try {
    const date = today();
    const token = await Token.findOne({ tokenNumber: req.params.token.toUpperCase(), date });
    if (!token) return res.status(404).json({ error: 'Token not found' });

    const queue = await Queue.findOne({ date });
    const ahead = await Token.countDocuments({ date, status: 'waiting', sequence: { $lt: token.sequence } });
    const analytics = await Analytics.findOne({ date });
    const avgWait = analytics?.avgWaitTime || 5;

    res.json({
      tokenNumber: token.tokenNumber,
      status: token.status,
      position: ahead + 1,
      estimatedWait: ahead * avgWait,
      currentServing: queue?.currentToken || null,
      customerName: token.customerName,
      serviceType: token.serviceType
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.updateAnalytics = updateAnalytics;
module.exports.getOrCreateQueue = getOrCreateQueue;
module.exports.today = today;
