const mongoose = require('mongoose');

const placementDriveSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Drive title is required'],
      trim: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
    },
    companyName: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    venue: {
      type: String,
      default: 'Campus Placement Hall / Online',
    },
    eligibleBranches: {
      type: [String],
      default: ['CSE', 'IT', 'ECE'],
    },
    minCgpa: {
      type: Number,
      default: 6.5,
    },
    maxArrears: {
      type: Number,
      default: 0,
    },
    registeredCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['Scheduled', 'Ongoing', 'Completed', 'Cancelled'],
      default: 'Scheduled',
    },
    resultsSummary: {
      appeared: { type: Number, default: 0 },
      shortlisted: { type: Number, default: 0 },
      offers: { type: Number, default: 0 },
    },
    createdBy: {
      type: String,
      default: 'system',
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.models.PlacementDrive ||
  mongoose.model('PlacementDrive', placementDriveSchema);
