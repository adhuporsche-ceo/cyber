const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const Company = require('../models/Company');
const PlacementApplication = require('../models/PlacementApplication');
const PlacementDrive = require('../models/PlacementDrive');
const Notification = require('../models/Notification');
const { pool } = require('../config/postgres');

// Initial in-memory sample seed for fallback
let memoryCompanies = [
  {
    _id: 'comp-1',
    id: 'comp-1',
    name: 'Zoho Corporation',
    hrName: 'Muralidharan R',
    email: 'careers@zohocorp.com',
    phone: '+91 44 6744 7070',
    role: 'Software Development Engineer (SDE-1)',
    package: '8.5 LPA',
    packageNumber: 8.5,
    location: 'Chennai / Tenkasi',
    eligibilityCgpa: 7.0,
    eligibilityArrears: 0,
    eligibleDepartments: ['CSE', 'IT', 'ECE', 'AI&DS'],
    description: 'Core product engineering team working on scalable enterprise cloud applications, database optimizations, and distributed SaaS architecture.',
    requiredSkills: ['Java', 'C++', 'Data Structures', 'Algorithms', 'SQL'],
    driveDate: new Date('2026-10-18T09:30:00Z'),
    deadline: new Date('2026-10-12T18:00:00Z'),
    hiringStatus: 'Open',
    createdAt: new Date(),
  },
  {
    _id: 'comp-2',
    id: 'comp-2',
    name: 'Amazon Web Services (AWS)',
    hrName: 'Priyanka Sharma',
    email: 'aws-campus-india@amazon.com',
    phone: '+91 80 4000 5000',
    role: 'Cloud Support Engineer & Systems',
    package: '14.2 LPA',
    packageNumber: 14.2,
    location: 'Bengaluru / Hyderabad',
    eligibilityCgpa: 8.0,
    eligibilityArrears: 0,
    eligibleDepartments: ['CSE', 'IT', 'ECE'],
    description: 'Global cloud infrastructure operations, linux kernel networking, containerization, and enterprise AWS customer architectural advisory.',
    requiredSkills: ['Linux', 'Networking', 'Python', 'Docker', 'AWS Services'],
    driveDate: new Date('2026-10-24T09:00:00Z'),
    deadline: new Date('2026-10-16T18:00:00Z'),
    hiringStatus: 'Upcoming',
    createdAt: new Date(),
  },
  {
    _id: 'comp-3',
    id: 'comp-3',
    name: 'Freshworks Inc.',
    hrName: 'Karthik Narayanan',
    email: 'talent@freshworks.com',
    phone: '+91 44 6607 7000',
    role: 'Full Stack Product Engineer',
    package: '12.0 LPA',
    packageNumber: 12.0,
    location: 'Chennai',
    eligibilityCgpa: 7.5,
    eligibilityArrears: 0,
    eligibleDepartments: ['CSE', 'IT'],
    description: 'Developing high-velocity CRM solutions, micro-frontends, real-time messaging pipelines, and AI-enabled customer experience bots.',
    requiredSkills: ['React.js', 'Node.js', 'Ruby on Rails', 'REST APIs', 'PostgreSQL'],
    driveDate: new Date('2026-10-20T10:00:00Z'),
    deadline: new Date('2026-10-14T23:59:00Z'),
    hiringStatus: 'Open',
    createdAt: new Date(),
  },
  {
    _id: 'comp-4',
    id: 'comp-4',
    name: 'Bosch Global Software',
    hrName: 'Sanjay Varma',
    email: 'campus.bgs@bosch.com',
    phone: '+91 422 662 2000',
    role: 'Embedded & IoT Systems Engineer',
    package: '7.8 LPA',
    packageNumber: 7.8,
    location: 'Coimbatore / Bengaluru',
    eligibilityCgpa: 6.8,
    eligibilityArrears: 1,
    eligibleDepartments: ['ECE', 'EEE', 'CSE'],
    description: 'Automotive embedded controllers, AUTOSAR firmware, sensors interfacing, and telemetry edge gateways.',
    requiredSkills: ['Embedded C', 'Microcontrollers', 'RTOS', 'CAN Protocol'],
    driveDate: new Date('2026-10-08T09:30:00Z'),
    deadline: new Date('2026-10-04T18:00:00Z'),
    hiringStatus: 'In Progress',
    createdAt: new Date(),
  },
  {
    _id: 'comp-5',
    id: 'comp-5',
    name: 'TCS Digital',
    hrName: 'Deepa Krishnan',
    email: 'campus.tcs@tcs.com',
    phone: '+91 44 6616 1111',
    role: 'Digital Innovator & Cloud Engineer',
    package: '7.2 LPA',
    packageNumber: 7.2,
    location: 'Chennai / Pan-India',
    eligibilityCgpa: 6.5,
    eligibilityArrears: 1,
    eligibleDepartments: ['CSE', 'IT', 'ECE', 'MECH', 'CIVIL'],
    description: 'High-impact enterprise digital transformation projects involving modern web applications, AI automation, and cloud deployments.',
    requiredSkills: ['Java', 'Python', 'Cloud Computing', 'SQL'],
    driveDate: new Date('2026-09-28T09:00:00Z'),
    deadline: new Date('2026-09-20T18:00:00Z'),
    hiringStatus: 'Completed',
    createdAt: new Date(),
  },
];

let memoryApplications = [
  {
    _id: 'app-1',
    id: 'app-1',
    companyId: 'comp-1',
    companyName: 'Zoho Corporation',
    role: 'Software Development Engineer (SDE-1)',
    package: '8.5 LPA',
    studentId: 'e8888888-8888-4888-8888-888888888885',
    studentRegisterNumber: '710021104001',
    studentName: 'Aarav Sundaram',
    studentEmail: 'aarav.s21@college.edu',
    studentDepartment: 'CSE',
    cgpa: 8.92,
    resumeUrl: 'https://cdn.example.com/resumes/710021104001-Aarav-Sundaram.pdf',
    status: 'Shortlisted',
    roundsHistory: [
      { roundName: 'Resume Screening', status: 'Cleared', remarks: 'Strong DSA and MERN stack projects.', updatedAt: new Date('2026-09-29T10:00:00Z'), updatedBy: 'Placement Officer' },
      { roundName: 'Online Assessment', status: 'Shortlisted', remarks: 'Scored 94/100 in Algorithmic coding round.', updatedAt: new Date('2026-10-01T14:30:00Z'), updatedBy: 'Zoho HR' },
    ],
    interviewSchedule: {
      date: new Date('2026-10-18T10:30:00Z'),
      time: '10:30 AM',
      venue: 'Main Placement Auditorium / Zoho Portal',
      meetingLink: 'https://meet.zoho.com/sps-round1',
      instructions: 'Prepare for live Data Structures coding and system design whiteboard session.',
    },
    offerDetails: null,
    mentorRemarks: 'Strong candidate for Tier-1 product placement. Resume validated.',
    mentorReviewStatus: 'Approved',
    appliedAt: new Date('2026-09-25T08:00:00Z'),
  },
  {
    _id: 'app-2',
    id: 'app-2',
    companyId: 'comp-3',
    companyName: 'Freshworks Inc.',
    role: 'Full Stack Product Engineer',
    package: '12.0 LPA',
    studentId: 'e8888888-8888-4888-8888-888888888885',
    studentRegisterNumber: '710021104001',
    studentName: 'Aarav Sundaram',
    studentEmail: 'aarav.s21@college.edu',
    studentDepartment: 'CSE',
    cgpa: 8.92,
    resumeUrl: 'https://cdn.example.com/resumes/710021104001-Aarav-Sundaram.pdf',
    status: 'Technical Round',
    roundsHistory: [
      { roundName: 'Application Received', status: 'Cleared', remarks: 'Eligibility verified.', updatedAt: new Date('2026-09-26T11:00:00Z'), updatedBy: 'System' },
      { roundName: 'Aptitude & Coding', status: 'Cleared', remarks: 'Top 5% percentile.', updatedAt: new Date('2026-09-30T16:00:00Z'), updatedBy: 'Freshworks HR' },
    ],
    interviewSchedule: {
      date: new Date('2026-10-20T11:00:00Z'),
      time: '11:00 AM',
      venue: 'Online Google Meet',
      meetingLink: 'https://meet.google.com/fwk-sps-2026',
      instructions: 'Technical round 2 on React and Backend APIs.',
    },
    offerDetails: null,
    mentorRemarks: 'Approved for interview attendance.',
    mentorReviewStatus: 'Approved',
    appliedAt: new Date('2026-09-26T10:00:00Z'),
  },
  {
    _id: 'app-3',
    id: 'app-3',
    companyId: 'comp-5',
    companyName: 'TCS Digital',
    role: 'Digital Innovator & Cloud Engineer',
    package: '7.2 LPA',
    studentId: 'e8888888-8888-4888-8888-888888888885',
    studentRegisterNumber: '710021104001',
    studentName: 'Aarav Sundaram',
    studentEmail: 'aarav.s21@college.edu',
    studentDepartment: 'CSE',
    cgpa: 8.92,
    resumeUrl: 'https://cdn.example.com/resumes/710021104001-Aarav-Sundaram.pdf',
    status: 'Offer Released',
    roundsHistory: [
      { roundName: 'Online Exam', status: 'Cleared', remarks: 'Cleared with Distinction', updatedAt: new Date('2026-09-20T09:00:00Z'), updatedBy: 'TCS Portal' },
      { roundName: 'Technical & HR', status: 'Cleared', remarks: 'Excellent communication and problem solving.', updatedAt: new Date('2026-09-28T15:00:00Z'), updatedBy: 'TCS Panel' },
    ],
    interviewSchedule: null,
    offerDetails: {
      package: '7.2 LPA',
      designation: 'Systems Engineer - Digital Cadre',
      joiningDate: new Date('2026-07-01T00:00:00Z'),
      offerLetterUrl: 'https://cdn.example.com/offers/TCS-Digital-Offer-710021104001.pdf',
      releasedAt: new Date('2026-10-01T10:00:00Z'),
    },
    mentorRemarks: 'Congratulations! Official offer letter received.',
    mentorReviewStatus: 'Approved',
    appliedAt: new Date('2026-09-15T09:00:00Z'),
  },
];

let memoryDrives = [
  {
    _id: 'drive-1',
    id: 'drive-1',
    title: 'Zoho Corporation On-Campus Recruitment Drive 2026',
    companyId: 'comp-1',
    companyName: 'Zoho Corporation',
    date: new Date('2026-10-18T09:30:00Z'),
    venue: 'College Placement Auditorium & Lab 3',
    eligibleBranches: ['CSE', 'IT', 'ECE'],
    minCgpa: 7.0,
    maxArrears: 0,
    registeredCount: 42,
    status: 'Scheduled',
    resultsSummary: { appeared: 42, shortlisted: 12, offers: 0 },
    createdBy: 'Placement Coordinator',
  },
  {
    _id: 'drive-2',
    id: 'drive-2',
    title: 'Freshworks Campus Hiring Challenge',
    companyId: 'comp-3',
    companyName: 'Freshworks Inc.',
    date: new Date('2026-10-20T10:00:00Z'),
    venue: 'Online HackerEarth Platform + Labs',
    eligibleBranches: ['CSE', 'IT'],
    minCgpa: 7.5,
    maxArrears: 0,
    registeredCount: 28,
    status: 'Scheduled',
    resultsSummary: { appeared: 28, shortlisted: 6, offers: 0 },
    createdBy: 'Placement Coordinator',
  },
];

let memoryNotifications = [
  {
    _id: 'notif-1',
    id: 'notif-1',
    userId: 'all',
    userRole: 'ALL',
    title: 'New Placement Drive Announced',
    message: 'Zoho Corporation On-Campus Recruitment Drive is scheduled for Oct 18, 2026. Register before deadline.',
    type: 'DRIVE',
    link: 'placement-crm.html',
    read: false,
    createdAt: new Date(),
  },
  {
    _id: 'notif-2',
    id: 'notif-2',
    userId: 'all',
    userRole: 'STUDENT',
    title: 'Offer Letter Available',
    message: 'Congratulations! TCS Digital has released your official offer letter for 7.2 LPA.',
    type: 'OFFER',
    link: 'student-dashboard.html',
    read: false,
    createdAt: new Date(Date.now() - 3600000),
  },
];

// Helper: Broadcast Real-Time Socket Event
const broadcastRealtime = (req, eventName, payload) => {
  try {
    const io = req.app ? req.app.get('io') : null;
    if (io) {
      io.emit(eventName, payload);
    }
  } catch (err) {
    console.warn('Socket broadcast warning:', err.message);
  }
};

// ---------------------------------------------------------------------------
// Companies Management (CRUD)
// ---------------------------------------------------------------------------

const getCompanies = async (req, res, next) => {
  try {
    const { status, search } = req.query;

    if (mongoose.connection.readyState === 1) {
      const query = {};
      if (status && status !== 'all') query.hiringStatus = status;
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { role: { $regex: search, $options: 'i' } },
          { requiredSkills: { $in: [new RegExp(search, 'i')] } },
        ];
      }
      const companies = await Company.find(query).sort({ driveDate: 1, createdAt: -1 }).lean();
      return res.json({ success: true, data: companies });
    }

    // In-Memory Fallback
    let list = [...memoryCompanies];
    if (status && status !== 'all') {
      list = list.filter((c) => c.hiringStatus.toLowerCase() === status.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.role.toLowerCase().includes(q) ||
          (c.requiredSkills && c.requiredSkills.some((s) => s.toLowerCase().includes(q)))
      );
    }
    return res.json({ success: true, data: list });
  } catch (error) {
    next(error);
  }
};

const getCompanyById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (mongoose.connection.readyState === 1) {
      const company = await Company.findById(id).lean();
      if (!company) return res.status(404).json({ success: false, message: 'Company not found' });
      const applications = await PlacementApplication.find({ companyId: id }).lean();
      return res.json({ success: true, data: { company, applications } });
    }

    const company = memoryCompanies.find((c) => c._id === id || c.id === id);
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });
    const applications = memoryApplications.filter((a) => a.companyId === id);
    return res.json({ success: true, data: { company, applications } });
  } catch (error) {
    next(error);
  }
};

const createCompany = async (req, res, next) => {
  try {
    const body = req.body;
    if (!body.name || !body.role || !body.package) {
      return res.status(400).json({ success: false, message: 'Company name, role, and package are required.' });
    }

    const pkgNum = parseFloat(String(body.package).replace(/[^\d.]/g, '')) || 0;
    const companyData = {
      ...body,
      packageNumber: pkgNum,
      createdBy: req.user ? req.user.name : 'Staff',
      requiredSkills: Array.isArray(body.requiredSkills)
        ? body.requiredSkills
        : typeof body.requiredSkills === 'string'
        ? body.requiredSkills.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
      eligibleDepartments: Array.isArray(body.eligibleDepartments)
        ? body.eligibleDepartments
        : ['CSE', 'IT', 'ECE'],
    };

    let saved;
    if (mongoose.connection.readyState === 1) {
      saved = await Company.create(companyData);
    } else {
      saved = {
        _id: `comp-${randomUUID()}`,
        id: `comp-${randomUUID()}`,
        ...companyData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      memoryCompanies.unshift(saved);
    }

    // Create Notification
    const notif = {
      title: 'New Company Hiring: ' + saved.name,
      message: `${saved.name} is hiring for ${saved.role} (${saved.package}). Drive date: ${saved.driveDate ? new Date(saved.driveDate).toLocaleDateString() : 'TBA'}.`,
      type: 'DRIVE',
      link: 'placement-crm.html',
      createdAt: new Date(),
    };
    memoryNotifications.unshift(notif);

    // Broadcast Real-time
    broadcastRealtime(req, 'company:created', saved);
    broadcastRealtime(req, 'notification:new', notif);

    res.status(201).json({ success: true, message: 'Company created successfully.', data: saved });
  } catch (error) {
    next(error);
  }
};

const updateCompany = async (req, res, next) => {
  try {
    const { id } = req.params;
    const body = req.body;

    if (body.package) {
      body.packageNumber = parseFloat(String(body.package).replace(/[^\d.]/g, '')) || 0;
    }
    if (typeof body.requiredSkills === 'string') {
      body.requiredSkills = body.requiredSkills.split(',').map((s) => s.trim()).filter(Boolean);
    }

    let updated;
    if (mongoose.connection.readyState === 1) {
      updated = await Company.findByIdAndUpdate(id, body, { new: true, runValidators: true });
      if (!updated) return res.status(404).json({ success: false, message: 'Company not found' });
    } else {
      const idx = memoryCompanies.findIndex((c) => c._id === id || c.id === id);
      if (idx === -1) return res.status(404).json({ success: false, message: 'Company not found' });
      memoryCompanies[idx] = { ...memoryCompanies[idx], ...body, updatedAt: new Date() };
      updated = memoryCompanies[idx];
    }

    broadcastRealtime(req, 'company:updated', updated);
    res.json({ success: true, message: 'Company updated successfully.', data: updated });
  } catch (error) {
    next(error);
  }
};

const deleteCompany = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (mongoose.connection.readyState === 1) {
      await Company.findByIdAndDelete(id);
    } else {
      memoryCompanies = memoryCompanies.filter((c) => c._id !== id && c.id !== id);
    }

    broadcastRealtime(req, 'company:deleted', { id });
    res.json({ success: true, message: 'Company deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// Placement Applications (Student & Officer)
// ---------------------------------------------------------------------------

const getApplications = async (req, res, next) => {
  try {
    const { companyId, studentRegisterNumber, status, studentId } = req.query;

    if (mongoose.connection.readyState === 1) {
      const filter = {};
      if (companyId) filter.companyId = companyId;
      if (studentRegisterNumber) filter.studentRegisterNumber = studentRegisterNumber.toUpperCase();
      if (studentId) filter.studentId = studentId;
      if (status && status !== 'all') filter.status = status;

      const list = await PlacementApplication.find(filter).sort({ appliedAt: -1 }).lean();
      return res.json({ success: true, data: list });
    }

    let list = [...memoryApplications];
    if (companyId) list = list.filter((a) => a.companyId === companyId);
    if (studentRegisterNumber) {
      const reg = studentRegisterNumber.toUpperCase();
      list = list.filter((a) => a.studentRegisterNumber.toUpperCase() === reg);
    }
    if (studentId) list = list.filter((a) => a.studentId === studentId);
    if (status && status !== 'all') {
      list = list.filter((a) => a.status.toLowerCase() === status.toLowerCase());
    }

    return res.json({ success: true, data: list });
  } catch (error) {
    next(error);
  }
};

const applyForCompany = async (req, res, next) => {
  try {
    const { companyId, studentRegisterNumber, studentName, studentEmail, studentDepartment, cgpa, resumeUrl } = req.body;

    if (!companyId || !studentRegisterNumber) {
      return res.status(400).json({ success: false, message: 'Company ID and student register number are required.' });
    }

    // Find company
    let company;
    if (mongoose.connection.readyState === 1) {
      company = await Company.findById(companyId);
    } else {
      company = memoryCompanies.find((c) => c._id === companyId || c.id === companyId);
    }

    if (!company) {
      return res.status(404).json({ success: false, message: 'Target company not found.' });
    }

    // Check existing
    const regUpper = String(studentRegisterNumber).trim().toUpperCase();
    if (mongoose.connection.readyState === 1) {
      const existing = await PlacementApplication.findOne({ companyId, studentRegisterNumber: regUpper });
      if (existing) {
        return res.status(409).json({ success: false, message: 'You have already applied for this company.' });
      }
    } else {
      const existing = memoryApplications.find(
        (a) => a.companyId === companyId && a.studentRegisterNumber.toUpperCase() === regUpper
      );
      if (existing) {
        return res.status(409).json({ success: false, message: 'You have already applied for this company.' });
      }
    }

    const newApp = {
      companyId: company._id || company.id,
      companyName: company.name,
      role: company.role,
      package: company.package,
      studentId: req.user ? req.user.id || req.user._id : randomUUID(),
      studentRegisterNumber: regUpper,
      studentName: studentName || req.user?.name || 'Student Candidate',
      studentEmail: studentEmail || req.user?.email || '',
      studentDepartment: studentDepartment || req.user?.department || 'CSE',
      cgpa: Number(cgpa) || 8.0,
      resumeUrl: resumeUrl || '',
      status: 'Applied',
      roundsHistory: [
        {
          roundName: 'Application Submitted',
          status: 'Applied',
          remarks: 'Registered online via Student Placement Portal.',
          updatedAt: new Date(),
          updatedBy: studentName || req.user?.name || 'Student',
        },
      ],
      mentorReviewStatus: 'Pending',
      appliedAt: new Date(),
    };

    let saved;
    if (mongoose.connection.readyState === 1) {
      saved = await PlacementApplication.create(newApp);
    } else {
      saved = {
        _id: `app-${randomUUID()}`,
        id: `app-${randomUUID()}`,
        ...newApp,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      memoryApplications.unshift(saved);
    }

    // Notify Staff & Mentors
    const notif = {
      title: 'New Student Application: ' + company.name,
      message: `${saved.studentName} (${saved.studentRegisterNumber}) applied for ${company.name} - ${company.role}.`,
      type: 'APPLICATION',
      link: 'placement-crm.html',
      createdAt: new Date(),
    };
    memoryNotifications.unshift(notif);

    broadcastRealtime(req, 'application:new', saved);
    broadcastRealtime(req, 'notification:new', notif);

    res.status(201).json({
      success: true,
      message: `Successfully applied for ${company.name}! Application status is live in your dashboard.`,
      data: saved,
    });
  } catch (error) {
    next(error);
  }
};

const updateApplicationStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, remarks, roundName } = req.body;

    const validStatuses = [
      'Applied',
      'Shortlisted',
      'Aptitude Round',
      'Technical Round',
      'HR Round',
      'Selected',
      'Rejected',
      'Offer Released',
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid application status provided.' });
    }

    const updater = req.user ? req.user.name : 'Placement Staff';
    const newRoundEntry = {
      roundName: roundName || `${status} Update`,
      status,
      remarks: remarks || `Status progressed to ${status}.`,
      updatedAt: new Date(),
      updatedBy: updater,
    };

    let appRecord;
    if (mongoose.connection.readyState === 1) {
      appRecord = await PlacementApplication.findById(id);
      if (!appRecord) return res.status(404).json({ success: false, message: 'Application record not found.' });
      appRecord.status = status;
      appRecord.roundsHistory.push(newRoundEntry);
      await appRecord.save();
    } else {
      appRecord = memoryApplications.find((a) => a._id === id || a.id === id);
      if (!appRecord) return res.status(404).json({ success: false, message: 'Application record not found.' });
      appRecord.status = status;
      appRecord.roundsHistory.push(newRoundEntry);
      appRecord.updatedAt = new Date();
    }

    // Real-time notification for student
    const notif = {
      userId: appRecord.studentRegisterNumber,
      title: `Application Status: ${appRecord.companyName}`,
      message: `Your application status for ${appRecord.companyName} (${appRecord.role}) is now: ${status}.`,
      type: status === 'Offer Released' ? 'OFFER' : 'APPLICATION',
      link: 'student-dashboard.html',
      createdAt: new Date(),
    };
    memoryNotifications.unshift(notif);

    broadcastRealtime(req, 'application:status_updated', appRecord);
    broadcastRealtime(req, 'notification:new', notif);

    res.json({
      success: true,
      message: `Status updated to ${status} successfully.`,
      data: appRecord,
    });
  } catch (error) {
    next(error);
  }
};

const scheduleInterview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { date, time, venue, meetingLink, instructions } = req.body;

    const interviewSchedule = {
      date: date ? new Date(date) : new Date(),
      time: time || '10:00 AM',
      venue: venue || 'Campus Placement Hall / Online',
      meetingLink: meetingLink || '',
      instructions: instructions || 'Please carry 2 copies of your updated resume and college ID card.',
    };

    let appRecord;
    if (mongoose.connection.readyState === 1) {
      appRecord = await PlacementApplication.findById(id);
      if (!appRecord) return res.status(404).json({ success: false, message: 'Application not found' });
      appRecord.interviewSchedule = interviewSchedule;
      appRecord.roundsHistory.push({
        roundName: 'Interview Scheduled',
        status: appRecord.status,
        remarks: `Interview scheduled on ${time} at ${venue}.`,
        updatedAt: new Date(),
        updatedBy: req.user ? req.user.name : 'Placement Officer',
      });
      await appRecord.save();
    } else {
      appRecord = memoryApplications.find((a) => a._id === id || a.id === id);
      if (!appRecord) return res.status(404).json({ success: false, message: 'Application not found' });
      appRecord.interviewSchedule = interviewSchedule;
      appRecord.roundsHistory.push({
        roundName: 'Interview Scheduled',
        status: appRecord.status,
        remarks: `Interview scheduled on ${time} at ${venue}.`,
        updatedAt: new Date(),
        updatedBy: req.user ? req.user.name : 'Placement Officer',
      });
      appRecord.updatedAt = new Date();
    }

    const notif = {
      userId: appRecord.studentRegisterNumber,
      title: `Interview Scheduled: ${appRecord.companyName}`,
      message: `Interview slot confirmed on ${time}. Venue: ${venue}.`,
      type: 'INTERVIEW',
      link: 'student-dashboard.html',
      createdAt: new Date(),
    };
    memoryNotifications.unshift(notif);

    broadcastRealtime(req, 'interview:scheduled', appRecord);
    broadcastRealtime(req, 'notification:new', notif);

    res.json({ success: true, message: 'Interview slot scheduled successfully.', data: appRecord });
  } catch (error) {
    next(error);
  }
};

const releaseOffer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { package: pkg, designation, joiningDate, offerLetterUrl } = req.body;

    const offerDetails = {
      package: pkg || '7.5 LPA',
      designation: designation || 'Software Engineer',
      joiningDate: joiningDate ? new Date(joiningDate) : new Date('2026-07-01'),
      offerLetterUrl: offerLetterUrl || 'https://cdn.example.com/offers/Sample-Offer-Letter.pdf',
      releasedAt: new Date(),
    };

    let appRecord;
    if (mongoose.connection.readyState === 1) {
      appRecord = await PlacementApplication.findById(id);
      if (!appRecord) return res.status(404).json({ success: false, message: 'Application not found' });
      appRecord.status = 'Offer Released';
      appRecord.offerDetails = offerDetails;
      appRecord.roundsHistory.push({
        roundName: 'Offer Released',
        status: 'Offer Released',
        remarks: `Official offer released: ${offerDetails.designation} (${offerDetails.package}).`,
        updatedAt: new Date(),
        updatedBy: req.user ? req.user.name : 'Placement Officer',
      });
      await appRecord.save();
    } else {
      appRecord = memoryApplications.find((a) => a._id === id || a.id === id);
      if (!appRecord) return res.status(404).json({ success: false, message: 'Application not found' });
      appRecord.status = 'Offer Released';
      appRecord.offerDetails = offerDetails;
      appRecord.roundsHistory.push({
        roundName: 'Offer Released',
        status: 'Offer Released',
        remarks: `Official offer released: ${offerDetails.designation} (${offerDetails.package}).`,
        updatedAt: new Date(),
        updatedBy: req.user ? req.user.name : 'Placement Officer',
      });
      appRecord.updatedAt = new Date();
    }

    const notif = {
      userId: appRecord.studentRegisterNumber,
      title: `🎉 Offer Released: ${appRecord.companyName}!`,
      message: `Congratulations! ${appRecord.companyName} has issued your offer letter for ${offerDetails.package}.`,
      type: 'OFFER',
      link: 'student-dashboard.html',
      createdAt: new Date(),
    };
    memoryNotifications.unshift(notif);

    broadcastRealtime(req, 'offer:released', appRecord);
    broadcastRealtime(req, 'notification:new', notif);

    res.json({ success: true, message: 'Offer letter issued and published to student dashboard.', data: appRecord });
  } catch (error) {
    next(error);
  }
};

const mentorReviewResume = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;

    if (!['Approved', 'Changes Requested', 'Rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be Approved, Changes Requested, or Rejected.' });
    }

    let appRecord;
    if (mongoose.connection.readyState === 1) {
      appRecord = await PlacementApplication.findById(id);
      if (!appRecord) return res.status(404).json({ success: false, message: 'Application not found' });
      appRecord.mentorReviewStatus = status;
      appRecord.mentorRemarks = remarks || '';
      await appRecord.save();
    } else {
      appRecord = memoryApplications.find((a) => a._id === id || a.id === id);
      if (!appRecord) return res.status(404).json({ success: false, message: 'Application not found' });
      appRecord.mentorReviewStatus = status;
      appRecord.mentorRemarks = remarks || '';
      appRecord.updatedAt = new Date();
    }

    const notif = {
      userId: appRecord.studentRegisterNumber,
      title: `Mentor Review: ${status}`,
      message: `Your mentor (${req.user?.name || 'Faculty'}) updated your review: "${remarks || status}".`,
      type: 'MENTOR',
      link: 'student-dashboard.html',
      createdAt: new Date(),
    };
    memoryNotifications.unshift(notif);

    broadcastRealtime(req, 'resume:reviewed', appRecord);
    broadcastRealtime(req, 'notification:new', notif);

    res.json({ success: true, message: 'Mentor review saved successfully.', data: appRecord });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// Student Placement Cockpit & Overview
// ---------------------------------------------------------------------------

const getStudentPlacementOverview = async (req, res, next) => {
  try {
    const registerNumber = req.query.registerNumber || req.user?.registerNumber || '710021104001';
    const regUpper = String(registerNumber).trim().toUpperCase();

    let studentApps = [];
    if (mongoose.connection.readyState === 1) {
      studentApps = await PlacementApplication.find({ studentRegisterNumber: regUpper }).sort({ appliedAt: -1 }).lean();
    } else {
      studentApps = memoryApplications.filter((a) => a.studentRegisterNumber.toUpperCase() === regUpper);
    }

    const appliedCount = studentApps.length;
    const shortlistedCount = studentApps.filter((a) => ['Shortlisted', 'Aptitude Round', 'Technical Round', 'HR Round'].includes(a.status)).length;
    const selectedCount = studentApps.filter((a) => ['Selected', 'Offer Released'].includes(a.status)).length;
    const offerReleasedCount = studentApps.filter((a) => a.status === 'Offer Released').length;

    // Available open companies student has not applied for yet
    const appliedCompanyIds = new Set(studentApps.map((a) => String(a.companyId)));
    let availableCompanies = memoryCompanies.filter(
      (c) => c.hiringStatus === 'Open' && !appliedCompanyIds.has(String(c._id || c.id))
    );

    res.json({
      success: true,
      data: {
        registerNumber: regUpper,
        kpis: {
          appliedCount,
          shortlistedCount,
          selectedCount,
          offerReleasedCount,
        },
        applications: studentApps,
        availableCompanies,
        drives: memoryDrives,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// Executive Placement Analytics & KPI Dashboard
// ---------------------------------------------------------------------------

const getPlacementStats = async (req, res, next) => {
  try {
    const apps = memoryApplications;
    const companies = memoryCompanies;

    const totalApplications = apps.length;
    const selectedApps = apps.filter((a) => ['Selected', 'Offer Released'].includes(a.status));
    const totalOffers = apps.filter((a) => a.status === 'Offer Released').length;

    // Packages
    const packages = companies.map((c) => c.packageNumber).filter((p) => p > 0);
    const highestPackage = packages.length ? Math.max(...packages) : 14.2;
    const avgPackage = packages.length ? (packages.reduce((a, b) => a + b, 0) / packages.length).toFixed(2) : 8.4;

    const companyPlacements = {};
    apps.forEach((a) => {
      companyPlacements[a.companyName] = (companyPlacements[a.companyName] || 0) + 1;
    });

    const statusCounts = {
      Applied: apps.filter((a) => a.status === 'Applied').length,
      Shortlisted: apps.filter((a) => ['Shortlisted', 'Aptitude Round', 'Technical Round', 'HR Round'].includes(a.status)).length,
      Selected: selectedApps.length,
      Rejected: apps.filter((a) => a.status === 'Rejected').length,
      'Offer Released': totalOffers,
    };

    res.json({
      success: true,
      data: {
        kpis: {
          totalCompanies: companies.length,
          activeDrives: memoryDrives.length,
          totalApplications,
          totalPlaced: selectedApps.length,
          totalOffers,
          highestPackage: `${highestPackage} LPA`,
          averagePackage: `${avgPackage} LPA`,
        },
        statusCounts,
        companyPlacements,
        recentDrives: memoryDrives,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// Notification System
// ---------------------------------------------------------------------------

const getNotifications = async (req, res, next) => {
  try {
    const userRole = req.user?.role || 'ALL';
    const regNum = req.user?.registerNumber || '';

    const list = memoryNotifications.filter(
      (n) =>
        n.userId === 'all' ||
        n.userRole === 'ALL' ||
        n.userRole === userRole ||
        (regNum && n.userId === regNum)
    );

    const unreadCount = list.filter((n) => !n.read).length;
    res.json({ success: true, data: { notifications: list.slice(0, 30), unreadCount } });
  } catch (error) {
    next(error);
  }
};

const markNotificationRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const notif = memoryNotifications.find((n) => n._id === id || n.id === id);
    if (notif) notif.read = true;
    res.json({ success: true, message: 'Notification marked as read.' });
  } catch (error) {
    next(error);
  }
};

const markAllNotificationsRead = async (req, res, next) => {
  try {
    memoryNotifications.forEach((n) => (n.read = true));
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCompanies,
  getCompanyById,
  createCompany,
  updateCompany,
  deleteCompany,
  getApplications,
  applyForCompany,
  updateApplicationStatus,
  scheduleInterview,
  releaseOffer,
  mentorReviewResume,
  getStudentPlacementOverview,
  getPlacementStats,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
};
