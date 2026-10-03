const { pool } = require('../config/postgres');
const { ROLES } = require('../config/permissions');

// Helper to escape CSV cell content
const escapeCsv = (val) => {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
};

// @desc    Export CSV Reports
// @route   GET /api/reports/export
// @access  Private
const exportReport = async (req, res, next) => {
  try {
    const { type = 'students', department } = req.query;
    const filters = ['deleted_at IS NULL'];
    const values = [];
    if (req.user.role === ROLES.HOD) {
      values.push(String(req.user.department || '').toUpperCase());
      filters.push(`department = $${values.length}`);
    }
    if (req.user.role === ROLES.FACULTY_MENTOR) {
      values.push(req.user._id);
      filters.push(`mentor_id = $${values.length}`);
    }
    if (department && department.trim() !== '') {
      values.push(department.trim().toUpperCase());
      filters.push(`department = $${values.length}`);
    }

    const { rows } = await pool.query(
      `SELECT id, mentor_id, profile FROM students WHERE ${filters.join(' AND ')}`,
      values
    );
    const students = rows.map(({ id, mentor_id, profile }) => ({ ...profile, _id: id, mentorId: mentor_id }));
    let csvRows = [];
    let filename = `report_${type}_${Date.now()}.csv`;

    switch (type) {
      case 'students': {
        filename = `students_directory_${Date.now()}.csv`;
        const headers = [
          'Register Number',
          'Student Name',
          'Department',
          'Section',
          'Gender',
          'Category',
          'Institutional Email',
          'Mobile',
          'Current CGPA',
          'Latest Attendance (%)',
          'Pending Arrears',
          'Career Goal',
        ];
        csvRows.push(headers.map(escapeCsv).join(','));

        students.forEach((s) => {
          const pd = s.personalDetails || {};
          const sorted = s.semesters ? [...s.semesters].sort((a, b) => b.semesterNumber - a.semesterNumber) : [];
          const latestSem = sorted[0] || {};
          const pending = s.arrears ? s.arrears.filter((arr) => arr.status === 'Pending').length : 0;

          const row = [
            pd.registerNumber,
            pd.name,
            pd.department,
            pd.section,
            pd.gender,
            pd.category,
            pd.institutionalEmail,
            pd.mobile,
            latestSem.cgpa || 0,
            latestSem.attendance || 0,
            pending,
            (s.careerGoal && s.careerGoal.primaryGoal) || 'Unspecified',
          ];
          csvRows.push(row.map(escapeCsv).join(','));
        });
        break;
      }

      case 'academics': {
        filename = `academic_performance_report_${Date.now()}.csv`;
        const headers = [
          'Register Number',
          'Student Name',
          'Department',
          'Semester',
          'SGPA',
          'Cumulative CGPA',
          'Attendance (%)',
          'Arrear Status',
          'Number of Arrears',
          'Academic Achievements',
        ];
        csvRows.push(headers.map(escapeCsv).join(','));

        students.forEach((s) => {
          const pd = s.personalDetails || {};
          (s.semesters || []).forEach((sem) => {
            const row = [
              pd.registerNumber,
              pd.name,
              pd.department,
              sem.semesterNumber,
              sem.sgpa,
              sem.cgpa,
              sem.attendance,
              sem.arrearStatus,
              sem.numberOfArrears,
              sem.academicAchievements || 'None',
            ];
            csvRows.push(row.map(escapeCsv).join(','));
          });
        });
        break;
      }

      case 'arrears': {
        filename = `arrear_management_report_${Date.now()}.csv`;
        const headers = [
          'Register Number',
          'Student Name',
          'Department',
          'Occurred Semester',
          'Subject Code',
          'Subject Name',
          'Attempts',
          'Current Status',
          'Cleared Semester',
          'Cleared Grade',
          'Reason for Difficulty',
          'Remedial Training Required',
          'Mentor Support Required',
        ];
        csvRows.push(headers.map(escapeCsv).join(','));

        students.forEach((s) => {
          const pd = s.personalDetails || {};
          (s.arrears || []).forEach((arr) => {
            const row = [
              pd.registerNumber,
              pd.name,
              pd.department,
              arr.semesterOccurred,
              arr.subjectCode,
              arr.subjectName,
              arr.attempts,
              arr.status,
              arr.clearedSemester || 'N/A',
              arr.clearedGrade || 'N/A',
              arr.reason || 'N/A',
              arr.remedialRequired,
              arr.mentorSupportRequired,
            ];
            csvRows.push(row.map(escapeCsv).join(','));
          });
        });
        break;
      }

      case 'career': {
        filename = `career_goals_report_${Date.now()}.csv`;
        const headers = [
          'Register Number',
          'Student Name',
          'Department',
          'Primary Career Goal',
          'Target Domain / Program / Idea',
          'Key Technical Skills',
          'Target Organization / Institutions',
          'Expected Salary / Admission Year / Stage',
          'Guidance Required / Training Support',
        ];
        csvRows.push(headers.map(escapeCsv).join(','));

        students.forEach((s) => {
          const pd = s.personalDetails || {};
          const cg = s.careerGoal || {};
          const tech = s.technicalProfile || {};
          let target = '';
          let targetOrg = '';
          let expectedVal = '';
          let supportVal = '';

          if (cg.primaryGoal === 'Placement' && cg.placement) {
            target = cg.placement.preferredRole || cg.placement.preferredDomain || '';
            targetOrg = (cg.placement.targetCompanies || []).join('; ');
            expectedVal = cg.placement.expectedSalary || '';
            supportVal = cg.placement.trainingSupport || '';
          } else if (cg.primaryGoal === 'Higher Studies' && cg.higherStudies) {
            target = `${cg.higherStudies.preferredProgramme || ''} (${cg.higherStudies.specialization || ''})`;
            targetOrg = (cg.higherStudies.targetInstitutions || []).join('; ');
            expectedVal = cg.higherStudies.admissionYear || '';
            supportVal = cg.higherStudies.guidanceRequired || '';
          } else if (cg.primaryGoal === 'Entrepreneurship' && cg.entrepreneurship) {
            target = cg.entrepreneurship.startupIdea || '';
            targetOrg = `Stage: ${cg.entrepreneurship.currentStage || 'Idea'}`;
            expectedVal = cg.entrepreneurship.expectedLaunchYear || '';
            supportVal = cg.entrepreneurship.incubationSupport || '';
          }

          const row = [
            pd.registerNumber,
            pd.name,
            pd.department,
            cg.primaryGoal || 'Unspecified',
            target,
            (tech.technicalSkills || []).join('; '),
            targetOrg,
            expectedVal,
            supportVal,
          ];
          csvRows.push(row.map(escapeCsv).join(','));
        });
        break;
      }

      case 'mentor-intervention': {
        filename = `mentor_interventions_report_${Date.now()}.csv`;
        const headers = [
          'Register Number',
          'Student Name',
          'Department',
          'Intervention Date',
          'Reason',
          'Mentor Note',
          'Action Taken',
          'Follow-up Date',
          'Status',
          'Faculty Mentor',
        ];
        csvRows.push(headers.map(escapeCsv).join(','));

        students.forEach((s) => {
          const pd = s.personalDetails || {};
          (s.mentorInterventions || []).forEach((m) => {
            const row = [
              pd.registerNumber,
              pd.name,
              pd.department,
              m.date ? new Date(m.date).toLocaleDateString() : '',
              m.reason,
              m.mentorNote,
              m.actionTaken || '',
              m.followUpDate ? new Date(m.followUpDate).toLocaleDateString() : '',
              m.status,
              m.mentorName || 'Faculty',
            ];
            csvRows.push(row.map(escapeCsv).join(','));
          });
        });
        break;
      }

      default:
        return res.status(400).json({ success: false, message: 'Invalid report type specified' });
    }

    const csvContent = csvRows.join('\r\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csvContent);
  } catch (err) {
    next(err);
  }
};

module.exports = { exportReport };
