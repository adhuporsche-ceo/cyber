const mongoose = require('mongoose');

const studentApplicationSchema = new mongoose.Schema(
  {
    registerNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    section: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewedBy: {
      type: String,
      default: '',
    },
    studentId: {
      type: String,
      default: '',
    },
    mongoStudentId: {
      type: String,
      default: '',
    },
    application: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'student_applications',
  }
);

module.exports = mongoose.model('StudentApplication', studentApplicationSchema);
