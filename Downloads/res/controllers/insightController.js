const { pool } = require('../config/postgres');
const { getDashboardMetrics, evaluateMentorAttention, calculateAcademicTrend } = require('../services/insightService');

// @desc    Get dashboard KPIs, charts, and student overview lists
// @route   GET /api/insights/dashboard
// @access  Private
const getDashboard = async (req, res, next) => {
  try {
    const data = await getDashboardMetrics();
    res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get students flagged for mentor attention with specific reasons and filters
// @route   GET /api/insights/mentor-attention
// @access  Private
const getMentorAttention = async (req, res, next) => {
  try {
    const { reasonType, department } = req.query;
    const values = [];
    let query = 'SELECT id, profile FROM students WHERE deleted_at IS NULL';
    if (department) {
      values.push(department.toUpperCase());
      query += ` AND department = $${values.length}`;
    }
    const { rows } = await pool.query(query, values);
    const students = rows.map(({ id, profile }) => ({ ...profile, _id: id }));
    let attentionList = [];

    students.forEach((s) => {
      const evaluation = evaluateMentorAttention(s);
      if (evaluation.attentionRequired) {
        const sortedSems = s.semesters ? [...s.semesters].sort((a, b) => b.semesterNumber - a.semesterNumber) : [];
        const latestSem = sortedSems[0] || null;

        attentionList.push({
          _id: s._id,
          registerNumber: s.personalDetails.registerNumber,
          name: s.personalDetails.name,
          department: s.personalDetails.department,
          section: s.personalDetails.section,
          currentCGPA: latestSem ? latestSem.cgpa : 0,
          attendance: latestSem ? latestSem.attendance : 0,
          pendingArrears: s.arrears ? s.arrears.filter((arr) => arr.status === 'Pending').length : 0,
          reasons: evaluation.reasons,
          interventions: s.mentorInterventions || [],
        });
      }
    });

    // Optional filter by reason category
    if (reasonType) {
      const typeLower = reasonType.toLowerCase();
      attentionList = attentionList.filter((item) =>
        item.reasons.some((r) => r.toLowerCase().includes(typeLower))
      );
    }

    res.status(200).json({
      success: true,
      data: {
        totalAttentionCount: attentionList.length,
        students: attentionList,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Compare up to 3 students on NON-SENSITIVE academic and professional data
// @route   GET /api/insights/compare
// @access  Private
const compareStudents = async (req, res, next) => {
  try {
    const { ids } = req.query;

    if (!ids) {
      return res.status(400).json({
        success: false,
        message: 'Please provide at least 2 student IDs to compare (comma separated)',
      });
    }

    const idList = ids.split(',').map((id) => id.trim()).filter(Boolean);

    if (idList.length < 2 || idList.length > 3) {
      return res.status(400).json({
        success: false,
        message: 'Student comparison supports 2 or 3 students simultaneously.',
      });
    }

    const { rows } = await pool.query(
      'SELECT id, profile FROM students WHERE id::text = ANY($1::text[]) AND deleted_at IS NULL',
      [idList]
    );
    const students = rows.map(({ id, profile }) => ({ ...profile, _id: id }));

    if (students.length < 2) {
      return res.status(404).json({
        success: false,
        message: 'Not enough matching students found for comparison.',
      });
    }

    // Map strictly non-sensitive parameters
    // STRICT PRIVACY RULE: Do NOT expose family details, parent income, or private phone numbers!
    const comparisonData = students.map((s) => {
      const sortedSems = s.semesters ? [...s.semesters].sort((a, b) => b.semesterNumber - a.semesterNumber) : [];
      const latestSem = sortedSems[0] || null;
      const trend = calculateAcademicTrend(s.semesters);
      const pendingArrears = s.arrears ? s.arrears.filter((arr) => arr.status === 'Pending').length : 0;
      const clearedArrears = s.arrears ? s.arrears.filter((arr) => arr.status === 'Cleared').length : 0;
      const tech = s.technicalProfile || {};

      return {
        _id: s._id,
        name: s.personalDetails.name,
        registerNumber: s.personalDetails.registerNumber,
        department: s.personalDetails.department,
        section: s.personalDetails.section,
        category: s.personalDetails.category,
        currentCGPA: latestSem ? latestSem.cgpa : 0,
        latestAttendance: latestSem ? `${latestSem.attendance}%` : 'N/A',
        academicTrend: trend.label,
        pendingArrears,
        clearedArrears,
        totalArrearsRecorded: (s.arrears && s.arrears.length) || 0,
        careerGoal: (s.careerGoal && s.careerGoal.primaryGoal) || 'Unspecified',
        programmingLanguages: tech.programmingLanguages || [],
        technicalSkills: tech.technicalSkills || [],
        certificationsCount: (tech.certifications && tech.certifications.length) || 0,
        projectsCount: (tech.projects && tech.projects.length) || 0,
        internshipsCount: (tech.internships && tech.internships.length) || 0,
        communicationLevel: tech.communicationLevel || 'Intermediate',
        aptitudeLevel: tech.aptitudeLevel || 'Intermediate',
      };
    });

    res.status(200).json({
      success: true,
      data: comparisonData,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get complete analytics distributions for Analytics page
// @route   GET /api/insights/analytics
// @access  Private
const getAnalytics = async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id, profile FROM students WHERE deleted_at IS NULL');
    const students = rows.map(({ id, profile }) => ({ ...profile, _id: id }));
    const total = students.length;

    // Technical skills frequency
    const skillCountMap = {};
    const languageCountMap = {};
    let withCertifications = 0;
    let withProjects = 0;
    let withInternships = 0;
    let withGithub = 0;
    let withLinkedin = 0;

    // Intervention statuses
    let openInterventions = 0;
    let inProgressInterventions = 0;
    let resolvedInterventions = 0;

    students.forEach((s) => {
      const tech = s.technicalProfile || {};
      (tech.technicalSkills || []).forEach((sk) => {
        const cleaned = sk.trim();
        if (cleaned) skillCountMap[cleaned] = (skillCountMap[cleaned] || 0) + 1;
      });
      (tech.programmingLanguages || []).forEach((l) => {
        const cleaned = l.trim();
        if (cleaned) languageCountMap[cleaned] = (languageCountMap[cleaned] || 0) + 1;
      });

      if (tech.certifications && tech.certifications.length > 0) withCertifications++;
      if (tech.projects && tech.projects.length > 0) withProjects++;
      if (tech.internships && tech.internships.length > 0) withInternships++;
      if (tech.profileLinks && tech.profileLinks.github) withGithub++;
      if (tech.profileLinks && tech.profileLinks.linkedin) withLinkedin++;

      (s.mentorInterventions || []).forEach((m) => {
        if (m.status === 'Open') openInterventions++;
        else if (m.status === 'In Progress') inProgressInterventions++;
        else if (m.status === 'Resolved') resolvedInterventions++;
      });
    });

    // Top 8 skills
    const topSkills = Object.entries(skillCountMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    // Top 6 languages
    const topLanguages = Object.entries(languageCountMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    const baseMetrics = await getDashboardMetrics();

    res.status(200).json({
      success: true,
      data: {
        ...baseMetrics,
        professionalCoverage: {
          withCertifications,
          withProjects,
          withInternships,
          withGithub,
          withLinkedin,
          total,
        },
        topSkills: {
          labels: topSkills.map((item) => item[0]),
          data: topSkills.map((item) => item[1]),
        },
        topLanguages: {
          labels: topLanguages.map((item) => item[0]),
          data: topLanguages.map((item) => item[1]),
        },
        interventionsSummary: {
          open: openInterventions,
          inProgress: inProgressInterventions,
          resolved: resolvedInterventions,
          total: openInterventions + inProgressInterventions + resolvedInterventions,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDashboard,
  getMentorAttention,
  compareStudents,
  getAnalytics,
};
