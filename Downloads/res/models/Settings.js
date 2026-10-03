const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  attendanceThreshold: { type: Number, default: 75, min: 0, max: 100 },
  cgpaThreshold: { type: Number, default: 6.5, min: 0, max: 10 },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);
