const mongoose = require('mongoose');

const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
      maxlength: 120,
    },
    hrName: {
      type: String,
      trim: true,
      default: '',
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    role: {
      type: String,
      required: [true, 'Job role is required'],
      trim: true,
      default: 'Software Engineer',
    },
    package: {
      type: String,
      required: [true, 'Package is required (e.g. 6.5 LPA)'],
      trim: true,
    },
    packageNumber: {
      type: Number,
      default: 0,
    },
    location: {
      type: String,
      trim: true,
      default: 'Chennai / Hybrid',
    },
    eligibilityCgpa: {
      type: Number,
      default: 6.5,
      min: 0,
      max: 10,
    },
    eligibilityArrears: {
      type: Number,
      default: 0,
      min: 0,
    },
    eligibleDepartments: {
      type: [String],
      default: ['CSE', 'IT', 'ECE', 'EEE', 'MECH'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    requiredSkills: {
      type: [String],
      default: [],
    },
    driveDate: {
      type: Date,
      default: null,
    },
    deadline: {
      type: Date,
      default: null,
    },
    hiringStatus: {
      type: String,
      enum: ['Upcoming', 'Open', 'In Progress', 'Completed', 'Closed'],
      default: 'Open',
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

companySchema.index({ name: 1, hiringStatus: 1 });
companySchema.index({ driveDate: 1 });

module.exports = mongoose.models.Company || mongoose.model('Company', companySchema);
