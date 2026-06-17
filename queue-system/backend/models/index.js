const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'staff'], default: 'admin' }
}, { timestamps: true });

const TokenSchema = new mongoose.Schema({
  tokenNumber: { type: String, required: true, unique: true },
  prefix: { type: String, default: 'A' },
  sequence: { type: Number, required: true },
  customerName: { type: String, required: true },
  mobileNumber: { type: String, required: true },
  serviceType: { type: String, required: true },
  status: { type: String, enum: ['waiting', 'serving', 'completed', 'skipped', 'recalled'], default: 'waiting' },
  joinedAt: { type: Date, default: Date.now },
  servedAt: { type: Date },
  completedAt: { type: Date },
  waitTime: { type: Number },
  serviceTime: { type: Number },
  date: { type: String, required: true }
}, { timestamps: true });

const QueueSchema = new mongoose.Schema({
  date: { type: String, required: true, unique: true },
  currentToken: { type: String, default: null },
  currentSequence: { type: Number, default: 0 },
  lastSequence: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  serviceTypes: [{ type: String }]
}, { timestamps: true });

const AnalyticsSchema = new mongoose.Schema({
  date: { type: String, required: true, unique: true },
  totalTokens: { type: Number, default: 0 },
  completedTokens: { type: Number, default: 0 },
  skippedTokens: { type: Number, default: 0 },
  avgWaitTime: { type: Number, default: 0 },
  avgServiceTime: { type: Number, default: 0 },
  peakHour: { type: Number, default: null },
  hourlyData: [{ hour: Number, count: Number }]
}, { timestamps: true });

module.exports = {
  User: mongoose.model('User', UserSchema),
  Token: mongoose.model('Token', TokenSchema),
  Queue: mongoose.model('Queue', QueueSchema),
  Analytics: mongoose.model('Analytics', AnalyticsSchema)
};
