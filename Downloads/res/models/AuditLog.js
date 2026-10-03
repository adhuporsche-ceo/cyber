const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    userName: {
      type: String,
      required: true,
      default: 'System',
    },
    userRole: {
      type: String,
      default: 'faculty',
    },
    action: {
      type: String,
      required: true,
      enum: [
        'LOGIN',
        'LOGOUT',
        'STUDENT_CREATED',
        'STUDENT_UPDATED',
        'STUDENT_DELETED',
        'SEMESTER_ADDED',
        'SEMESTER_UPDATED',
        'SEMESTER_DELETED',
        'ARREAR_ADDED',
        'ARREAR_UPDATED',
        'ARREAR_DELETED',
        'INTERVENTION_ADDED',
        'INTERVENTION_UPDATED',
        'SYSTEM_SEED',
        'USER_CREATED',
        'USER_UPDATED',
        'STUDENT_IMPORTED',
        'UPDATE_SETTINGS',
        'CHANGE_PASSWORD',
      ],
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: false,
    },
    studentRegisterNumber: {
      type: String,
      default: '',
    },
    studentName: {
      type: String,
      default: '',
    },
    details: {
      type: String,
      default: '',
    },
    ipAddress: {
      type: String,
      default: '',
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
