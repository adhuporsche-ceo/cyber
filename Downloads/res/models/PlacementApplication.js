const mongoose = require('mongoose');

const placementApplicationSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
    },
    companyName: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      default: 'Software Engineer',
    },
    package: {
      type: String,
      default: '',
    },
    studentId: {
      type: String,
      required: true,
    },
    studentRegisterNumber: {
      type: String,
      required: true,
      trim: true,
    },
    studentName: {
      type: String,
      required: true,
      trim: true,
    },
    studentEmail: {
      type: String,
      trim: true,
      default: '',
    },
    studentDepartment: {
      type: String,
      default: 'CSE',
    },
    cgpa: {
      type: Number,
      default: 0,
    },
    resumeUrl: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: [
        'Applied',
        'Shortlisted',
        'Aptitude Round',
        'Technical Round',
        'HR Round',
        'Selected',
        'Rejected',
        'Offer Released',
      ],
      default: 'Applied',
    },
    roundsHistory: [
      {
        roundName: String,
        status: String,
        remarks: String,
        updatedAt: {
          type: Date,
          default: Date.now,
        },
        updatedBy: String,
      },
    ],
    interviewSchedule: {
      date: Date,
      time: String,
      venue: String,
      meetingLink: String,
      instructions: String,
    },
    offerDetails: {
      package: String,
      designation: String,
      joiningDate: Date,
      offerLetterUrl: String,
      releasedAt: Date,
    },
    mentorRemarks: {
      type: String,
      default: '',
    },
    mentorReviewStatus: {
      type: String,
      enum: ['Pending', 'Approved', 'Changes Requested', 'Rejected'],
      default: 'Pending',
    },
    appliedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

placementApplicationSchema.index({ studentRegisterNumber: 1, companyId: 1 }, { unique: true });
placementApplicationSchema.index({ status: 1 });
placementApplicationSchema.index({ companyId: 1, status: 1 });

module.exports =
  mongoose.models.PlacementApplication ||
  mongoose.model('PlacementApplication', placementApplicationSchema);
