const mongoose = require('mongoose');

// Semester Subdocument
const semesterSchema = new mongoose.Schema(
  {
    semesterNumber: {
      type: Number,
      required: [true, 'Semester number is required'],
      min: [1, 'Semester must be between 1 and 8'],
      max: [8, 'Semester must be between 1 and 8'],
    },
    sgpa: {
      type: Number,
      required: [true, 'SGPA is required'],
      min: [0, 'SGPA must be between 0 and 10'],
      max: [10, 'SGPA must be between 0 and 10'],
    },
    cgpa: {
      type: Number,
      required: [true, 'CGPA is required'],
      min: [0, 'CGPA must be between 0 and 10'],
      max: [10, 'CGPA must be between 0 and 10'],
    },
    attendance: {
      type: Number,
      required: [true, 'Attendance percentage is required'],
      min: [0, 'Attendance must be between 0 and 100'],
      max: [100, 'Attendance must be between 0 and 100'],
    },
    arrearStatus: {
      type: String,
      enum: ['Yes', 'No'],
      default: 'No',
    },
    numberOfArrears: {
      type: Number,
      default: 0,
      min: [0, 'Arrears count cannot be negative'],
    },
    academicAchievements: {
      type: String,
      default: '',
      trim: true,
    },
    subjectsStrong: {
      type: [String],
      default: [],
    },
  },
  { _id: true, timestamps: true }
);

// Arrear Subdocument
const arrearSchema = new mongoose.Schema(
  {
    semesterOccurred: {
      type: Number,
      required: [true, 'Semester in which arrear occurred is required'],
      min: 1,
      max: 8,
    },
    subjectCode: {
      type: String,
      required: [true, 'Subject code is required'],
      trim: true,
      uppercase: true,
    },
    subjectName: {
      type: String,
      required: [true, 'Subject name is required'],
      trim: true,
    },
    attempts: {
      type: Number,
      default: 1,
      min: [1, 'Attempts must be at least 1'],
    },
    status: {
      type: String,
      enum: ['Pending', 'Cleared'],
      default: 'Pending',
    },
    clearedSemester: {
      type: Number,
      min: 1,
      max: 8,
      default: null,
    },
    clearedGrade: {
      type: String,
      default: '',
      trim: true,
    },
    reason: {
      type: String,
      default: '',
      trim: true,
    },
    remedialRequired: {
      type: String,
      enum: ['Yes', 'No'],
      default: 'No',
    },
    mentorSupportRequired: {
      type: String,
      enum: ['Yes', 'No'],
      default: 'No',
    },
  },
  { _id: true, timestamps: true }
);

// Certification Subdocument
const certificationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    issuingOrg: { type: String, required: true, trim: true },
    completionDate: { type: String, default: '' },
    certificateLink: { type: String, default: '', trim: true },
  },
  { _id: true }
);

// Project Subdocument
const projectSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    technologies: { type: [String], default: [] },
    projectStatus: {
      type: String,
      enum: ['Completed', 'In Progress'],
      default: 'In Progress',
    },
    githubLink: { type: String, default: '', trim: true },
  },
  { _id: true }
);

// Hackathon Subdocument
const hackathonSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    date: { type: String, default: '' },
    achievement: { type: String, default: '', trim: true },
  },
  { _id: true }
);

// Coding Contest Subdocument
const contestSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    platform: { type: String, default: '', trim: true },
    result: { type: String, default: '', trim: true },
  },
  { _id: true }
);

// Internship Subdocument
const internshipSchema = new mongoose.Schema(
  {
    company: { type: String, required: true, trim: true },
    role: { type: String, required: true, trim: true },
    duration: { type: String, default: '', trim: true },
    description: { type: String, default: '', trim: true },
  },
  { _id: true }
);

// Mentor Intervention Subdocument
const mentorInterventionSchema = new mongoose.Schema(
  {
    date: { type: Date, default: Date.now },
    reason: { type: String, required: [true, 'Reason is required'], trim: true },
    mentorNote: { type: String, required: [true, 'Mentor note is required'], trim: true },
    actionTaken: { type: String, default: '', trim: true },
    followUpDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ['Open', 'In Progress', 'Resolved'],
      default: 'Open',
    },
    mentorName: { type: String, default: 'Faculty Mentor' },
    mentorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: true, timestamps: true }
);

// Main Student Schema
const studentSchema = new mongoose.Schema(
  {
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdByRole: { type: String, default: '' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedByRole: { type: String, default: '' },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date, default: null, index: true },
    mentorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    personalDetails: {
      registerNumber: {
        type: String,
        required: [true, 'Register Number is required'],
        unique: true,
        trim: true,
        uppercase: true,
      },
      name: {
        type: String,
        required: [true, 'Student Name is required'],
        trim: true,
      },
      dob: {
        type: String,
        required: [true, 'Date of Birth is required'],
      },
      gender: {
        type: String,
        required: [true, 'Gender is required'],
        enum: ['Male', 'Female', 'Other'],
      },
      department: {
        type: String,
        required: [true, 'Department is required'],
        trim: true,
        uppercase: true,
      },
      section: {
        type: String,
        required: [true, 'Section is required'],
        trim: true,
        uppercase: true,
      },
      institutionalEmail: {
        type: String,
        required: [true, 'Institutional Email is required'],
        lowercase: true,
        trim: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Invalid institutional email format'],
      },
      personalEmail: {
        type: String,
        required: [true, 'Personal Email is required'],
        lowercase: true,
        trim: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Invalid personal email format'],
      },
      mobile: {
        type: String,
        required: [true, 'Mobile Number is required'],
        trim: true,
      },
      residentialAddress: {
        type: String,
        required: [true, 'Residential Address is required'],
        trim: true,
      },
      category: {
        type: String,
        required: [true, 'Student Category is required'],
        enum: ['Hosteller', 'Day Scholar'],
      },
      hostelName: {
        type: String,
        trim: true,
        default: '',
      },
      distanceFromCollege: {
        type: Number,
        default: 0,
        min: 0,
      },
    },

    familyDetails: {
      father: {
        name: { type: String, default: '', trim: true },
        occupation: { type: String, default: '', trim: true },
        incomeRange: {
          type: String,
          enum: ['Below ₹1 Lakh', '₹1–3 Lakhs', '₹3–5 Lakhs', '₹5–10 Lakhs', 'Above ₹10 Lakhs', ''],
          default: '',
        },
        mobile: { type: String, default: '', trim: true },
      },
      mother: {
        name: { type: String, default: '', trim: true },
        occupation: { type: String, default: '', trim: true },
        incomeRange: {
          type: String,
          enum: ['Below ₹1 Lakh', '₹1–3 Lakhs', '₹3–5 Lakhs', '₹5–10 Lakhs', 'Above ₹10 Lakhs', ''],
          default: '',
        },
        mobile: { type: String, default: '', trim: true },
      },
      guardianName: { type: String, default: '', trim: true },
      emergencyContact: {
        type: String,
        required: [true, 'Emergency Contact Number is required'],
        trim: true,
      },
      firstGenGraduate: {
        type: String,
        enum: ['Yes', 'No'],
        default: 'No',
      },
      scholarshipReceived: {
        type: String,
        enum: ['Yes', 'No'],
        default: 'No',
      },
      guidanceRequired: {
        type: String,
        enum: ['Yes', 'No'],
        default: 'No',
      },
    },

    semesters: {
      type: [semesterSchema],
      default: [],
    },

    arrears: {
      type: [arrearSchema],
      default: [],
    },

    technicalProfile: {
      programmingLanguages: { type: [String], default: [] },
      technicalSkills: { type: [String], default: [] },
      preferredDomain: {
        type: String,
        default: 'Web Development',
        trim: true,
      },
      areasOfInterest: { type: [String], default: [] },
      certifications: { type: [certificationSchema], default: [] },
      projects: { type: [projectSchema], default: [] },
      hackathons: { type: [hackathonSchema], default: [] },
      codingContests: { type: [contestSchema], default: [] },
      internships: { type: [internshipSchema], default: [] },
      profileLinks: {
        github: { type: String, default: '', trim: true },
        linkedin: { type: String, default: '', trim: true },
        hackerrank: { type: String, default: '', trim: true },
        hackerearth: { type: String, default: '', trim: true },
      },
      communicationLevel: {
        type: String,
        enum: ['Beginner', 'Intermediate', 'Advanced', 'Excellent'],
        default: 'Intermediate',
      },
      aptitudeLevel: {
        type: String,
        enum: ['Beginner', 'Intermediate', 'Advanced', 'Excellent'],
        default: 'Intermediate',
      },
    },

    selfEvaluation: {
      academicStrengths: { type: [String], default: [] },
      technicalStrengths: { type: [String], default: [] },
      communicationStrengths: { type: [String], default: [] },
      leadershipQualities: { type: [String], default: [] },
      teamworkAbilities: { type: [String], default: [] },
      improvementAreas: { type: [String], default: [] },
      subjectsNeedSupport: { type: [String], default: [] },
      techSkillsToDevelop: { type: [String], default: [] },
      commSkillsToImprove: { type: [String], default: [] },
      aptitudeSkillsToImprove: { type: [String], default: [] },
      mentorSupportExpected: { type: String, default: '', trim: true },
      shortTermGoal: { type: String, default: '', trim: true },
      longTermGoal: { type: String, default: '', trim: true },
    },

    careerGoal: {
      primaryGoal: {
        type: String,
        enum: ['Placement', 'Higher Studies', 'Entrepreneurship'],
        required: [true, 'Career goal selection is required'],
      },
      placement: {
        preferredRole: { type: String, default: '', trim: true },
        preferredDomain: { type: String, default: '', trim: true },
        companyType: {
          type: String,
          enum: ['Product', 'Service', 'Core', 'Start-up', ''],
          default: '',
        },
        expectedSalary: { type: String, default: '', trim: true },
        preferredLocation: { type: String, default: '', trim: true },
        targetCompanies: { type: [String], default: [] },
        trainingSupport: { type: String, default: '', trim: true },
        skillsToImprove: { type: [String], default: [] },
      },
      higherStudies: {
        preferredProgramme: { type: String, default: '', trim: true },
        specialization: { type: String, default: '', trim: true },
        preferredCountry: { type: String, default: '', trim: true },
        targetInstitutions: { type: [String], default: [] },
        plannedExams: { type: [String], default: [] },
        admissionYear: { type: Number, default: null },
        guidanceRequired: { type: String, default: '', trim: true },
      },
      entrepreneurship: {
        startupIdea: { type: String, default: '', trim: true },
        problemAddressed: { type: String, default: '', trim: true },
        proposedSolution: { type: String, default: '', trim: true },
        targetCustomers: { type: String, default: '', trim: true },
        currentStage: {
          type: String,
          enum: ['Idea', 'Prototype', 'MVP', 'Revenue', ''],
          default: 'Idea',
        },
        teamDetails: { type: String, default: '', trim: true },
        techSupport: { type: String, default: '', trim: true },
        fundingSupport: { type: String, default: '', trim: true },
        incubationSupport: { type: String, default: '', trim: true },
        expectedLaunchYear: { type: Number, default: null },
      },
    },

    mentorInterventions: {
      type: [mentorInterventionSchema],
      default: [],
    },

    consent: {
      type: Boolean,
      required: [true, 'Consent is required for student profiling'],
      validate: {
        validator: function (v) {
          return v === true;
        },
        message: 'You must provide consent for academic mentoring purposes',
      },
    },
  },
  {
    timestamps: true,
  }
);

// Virtual for Current CGPA (latest semester CGPA)
studentSchema.virtual('currentCGPA').get(function () {
  if (this.semesters && this.semesters.length > 0) {
    const sorted = [...this.semesters].sort((a, b) => b.semesterNumber - a.semesterNumber);
    return sorted[0].cgpa;
  }
  return 0;
});

// Virtual for Current Attendance (latest semester or average)
studentSchema.virtual('latestAttendance').get(function () {
  if (this.semesters && this.semesters.length > 0) {
    const sorted = [...this.semesters].sort((a, b) => b.semesterNumber - a.semesterNumber);
    return sorted[0].attendance;
  }
  return 0;
});

// Ensure virtuals are serialized in JSON
studentSchema.set('toJSON', { virtuals: true });
studentSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Student', studentSchema);
