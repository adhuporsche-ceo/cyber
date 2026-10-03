/**
 * Insight and Analytics Service
 * Computes academic trends, mentor attention triggers, and college-wide analytics.
 */

const { pool } = require('../config/postgres');

/**
 * Computes Academic Trend from chronological semesters
 * Returns: { trend: 'Improving' | 'Declining' | 'Stable' | 'Insufficient Data', diff: number, semesters: [] }
 */
const calculateAcademicTrend = (semesters = []) => {
  if (!semesters || semesters.length < 2) {
    return {
      trend: 'Insufficient Data',
      label: 'Insufficient Data',
      badgeClass: 'bg-secondary',
      diff: 0,
      description: 'At least 2 semesters of SGPA records are needed to evaluate progression.',
    };
  }

  // Sort ascending by semester number
  const sorted = [...semesters].sort((a, b) => a.semesterNumber - b.semesterNumber);
  const sgpas = sorted.map((s) => Number(s.sgpa) || 0);

  // Compare recent semester with previous
  const last = sgpas[sgpas.length - 1];
  const prev = sgpas[sgpas.length - 2];
  const diff = Number((last - prev).toFixed(2));

  // Also check overall slope if 3+ semesters
  let trend = 'Stable';
  let badgeClass = 'bg-info text-dark';
  let description = 'Academic performance has remained consistent between recent semesters.';

  if (diff >= 0.25) {
    trend = 'Improving';
    badgeClass = 'bg-success';
    description = `Academic trend shows consistent improvement (+${diff} SGPA in the latest semester).`;
  } else if (diff <= -0.25) {
    trend = 'Declining';
    badgeClass = 'bg-warning text-dark';
    description = `Academic trend shows a decline (${diff} SGPA in the latest semester). Mentor counseling recommended.`;
  }

  return {
    trend,
    label: `${trend} Trend`,
    badgeClass,
    diff,
    lastSgpa: last,
    prevSgpa: prev,
    description,
    dataPoints: sorted.map((s) => ({ semester: `Sem ${s.semesterNumber}`, sgpa: s.sgpa, cgpa: s.cgpa })),
  };
};

/**
 * Checks whether a student requires mentor attention and gathers specific reasons
 */
const evaluateMentorAttention = (student, config = {}) => {
  const reasons = [];
  const cgpaThreshold = Number(config.cgpaThreshold || process.env.CGPA_ATTENTION_THRESHOLD || 6.5);
  const attendanceThreshold = Number(config.attendanceThreshold || process.env.ATTENDANCE_ATTENTION_THRESHOLD || 75);

  const semesters = student.semesters || [];
  const arrears = student.arrears || [];
  const tech = student.technicalProfile || {};
  const selfEval = student.selfEvaluation || {};
  const family = student.familyDetails || {};

  // 1. Check current CGPA
  let currentCgpa = 0;
  if (semesters.length > 0) {
    const sorted = [...semesters].sort((a, b) => b.semesterNumber - a.semesterNumber);
    currentCgpa = sorted[0].cgpa || 0;
    const latestAttendance = sorted[0].attendance || 0;

    if (currentCgpa > 0 && currentCgpa < cgpaThreshold) {
      reasons.push(`Cumulative CGPA (${currentCgpa}) is below threshold of ${cgpaThreshold}`);
    }

    // 2. Attendance
    if (latestAttendance < attendanceThreshold) {
      reasons.push(`Latest semester attendance (${latestAttendance}%) is below requirement of ${attendanceThreshold}%`);
    }
  } else {
    reasons.push('No academic semester records logged yet');
  }

  // 3. Academic Trend
  const trendInfo = calculateAcademicTrend(semesters);
  if (trendInfo.trend === 'Declining') {
    reasons.push(`Declining academic trend (${trendInfo.diff} SGPA drop in recent semester)`);
  }

  // 4. Arrears
  const pendingArrears = arrears.filter((a) => a.status === 'Pending');
  if (pendingArrears.length > 0) {
    reasons.push(`${pendingArrears.length} pending academic arrear(s) requiring remediation`);
  }

  // 5. Technical Profile Gaps
  const projectCount = (tech.projects && tech.projects.length) || 0;
  const certCount = (tech.certifications && tech.certifications.length) || 0;
  const hasGithub = Boolean(tech.profileLinks && tech.profileLinks.github);

  if (semesters.length >= 3 && projectCount === 0) {
    reasons.push('No practical software/engineering projects recorded');
  }
  if (semesters.length >= 3 && certCount === 0) {
    reasons.push('No technical certifications completed');
  }
  if (semesters.length >= 3 && !hasGithub) {
    reasons.push('GitHub portfolio link is missing');
  }

  // 6. Communication or Aptitude
  if (tech.communicationLevel === 'Beginner') {
    reasons.push('Self-evaluated communication skill is at Beginner level');
  }
  if (tech.aptitudeLevel === 'Beginner') {
    reasons.push('Self-evaluated aptitude skill is at Beginner level');
  }

  // 7. Student explicitly requested guidance/support
  if (selfEval.mentorSupportExpected && selfEval.mentorSupportExpected.trim().length > 5) {
    reasons.push(`Student explicitly requested mentor assistance: "${selfEval.mentorSupportExpected}"`);
  }
  if (family.guidanceRequired === 'Yes') {
    reasons.push('Family details indicate financial/scholarship guidance requested');
  }

  const attentionRequired = reasons.length > 0;

  return {
    attentionRequired,
    statusText: attentionRequired ? 'Mentor Attention Required' : 'On Track',
    badgeClass: attentionRequired ? 'bg-warning text-dark' : 'bg-success',
    reasons,
    pendingArrearCount: pendingArrears.length,
    currentCgpa,
  };
};

/**
 * Computes college-level dashboard analytics and summary KPIs
 */
const getDashboardMetrics = async () => {
  const { rows } = await pool.query('SELECT id, profile FROM students WHERE deleted_at IS NULL');
  const students = rows.map(({ id, profile }) => ({ ...profile, _id: id }));
  const totalStudents = students.length;

  if (totalStudents === 0) {
    return {
      kpis: {
        totalStudents: 0,
        hostellers: 0,
        dayScholars: 0,
        avgCgpa: 0,
        highestCgpa: 0,
        lowestCgpa: 0,
        activeArrears: 0,
        pendingArrears: 0,
        clearedArrears: 0,
        attentionRequiredCount: 0,
      },
      charts: {
        semesterSgpa: { labels: [], datasets: [] },
        cgpaDistribution: { labels: [], data: [] },
        careerGoals: { labels: [], data: [] },
        categoryRatio: { labels: ['Hostellers', 'Day Scholars'], data: [0, 0] },
        arrearStatus: { labels: ['Pending Arrears', 'Cleared Arrears'], data: [0, 0] },
        departmentCounts: { labels: [], data: [] },
      },
      lists: {
        recentStudents: [],
        attentionList: [],
        activeArrearList: [],
        decliningTrendList: [],
        improvingTrendList: [],
        missingTechList: [],
      },
    };
  }

  let hostellers = 0;
  let dayScholars = 0;
  let totalCgpaSum = 0;
  let highestCgpa = 0;
  let lowestCgpa = 10;
  let totalPendingArrears = 0;
  let totalClearedArrears = 0;
  let attentionRequiredCount = 0;

  const departmentMap = {};
  const careerGoalMap = { Placement: 0, 'Higher Studies': 0, Entrepreneurship: 0 };
  const cgpaBuckets = { 'Below 6.0': 0, '6.0 - 7.0': 0, '7.0 - 8.0': 0, '8.0 - 9.0': 0, '9.0 - 10.0': 0 };
  const semesterSgpaSums = {};
  const semesterSgpaCounts = {};

  const attentionList = [];
  const activeArrearList = [];
  const decliningTrendList = [];
  const improvingTrendList = [];
  const missingTechList = [];

  students.forEach((student) => {
    const pd = student.personalDetails || {};
    const semesters = student.semesters || [];
    const arrears = student.arrears || [];
    const tech = student.technicalProfile || {};
    const cg = student.careerGoal || {};

    // Category
    if (pd.category === 'Hosteller') hostellers++;
    else dayScholars++;

    // Department
    const dept = pd.department || 'General';
    departmentMap[dept] = (departmentMap[dept] || 0) + 1;

    // Career Goal
    const goal = cg.primaryGoal || 'Placement';
    if (careerGoalMap[goal] !== undefined) careerGoalMap[goal]++;

    // Latest CGPA & Semesters
    let curCgpa = 0;
    if (semesters.length > 0) {
      const sorted = [...semesters].sort((a, b) => b.semesterNumber - a.semesterNumber);
      curCgpa = sorted[0].cgpa || 0;
      totalCgpaSum += curCgpa;
      if (curCgpa > highestCgpa) highestCgpa = curCgpa;
      if (curCgpa < lowestCgpa) lowestCgpa = curCgpa;

      // Accumulate for semester-wise average SGPA chart
      semesters.forEach((s) => {
        const semNum = `Sem ${s.semesterNumber}`;
        semesterSgpaSums[semNum] = (semesterSgpaSums[semNum] || 0) + (s.sgpa || 0);
        semesterSgpaCounts[semNum] = (semesterSgpaCounts[semNum] || 0) + 1;
      });
    }

    // CGPA Bucket
    if (curCgpa < 6.0) cgpaBuckets['Below 6.0']++;
    else if (curCgpa < 7.0) cgpaBuckets['6.0 - 7.0']++;
    else if (curCgpa < 8.0) cgpaBuckets['7.0 - 8.0']++;
    else if (curCgpa < 9.0) cgpaBuckets['8.0 - 9.0']++;
    else cgpaBuckets['9.0 - 10.0']++;

    // Arrears
    const pending = arrears.filter((a) => a.status === 'Pending').length;
    const cleared = arrears.filter((a) => a.status === 'Cleared').length;
    totalPendingArrears += pending;
    totalClearedArrears += cleared;

    if (pending > 0) {
      activeArrearList.push({
        _id: student._id,
        registerNumber: pd.registerNumber,
        name: pd.name,
        department: pd.department,
        pendingArrears: pending,
        arrearDetails: arrears.filter((a) => a.status === 'Pending'),
      });
    }

    // Trend
    const trendInfo = calculateAcademicTrend(semesters);
    if (trendInfo.trend === 'Declining') {
      decliningTrendList.push({
        _id: student._id,
        registerNumber: pd.registerNumber,
        name: pd.name,
        department: pd.department,
        trendInfo,
      });
    } else if (trendInfo.trend === 'Improving') {
      improvingTrendList.push({
        _id: student._id,
        registerNumber: pd.registerNumber,
        name: pd.name,
        department: pd.department,
        trendInfo,
      });
    }

    // Missing Tech Profile
    const hasProjects = tech.projects && tech.projects.length > 0;
    const hasCerts = tech.certifications && tech.certifications.length > 0;
    if (!hasProjects || !hasCerts) {
      missingTechList.push({
        _id: student._id,
        registerNumber: pd.registerNumber,
        name: pd.name,
        department: pd.department,
        hasProjects,
        hasCerts,
      });
    }

    // Attention check
    const attention = evaluateMentorAttention(student);
    if (attention.attentionRequired) {
      attentionRequiredCount++;
      attentionList.push({
        _id: student._id,
        registerNumber: pd.registerNumber,
        name: pd.name,
        department: pd.department,
        currentCgpa: curCgpa,
        reasons: attention.reasons,
      });
    }
  });

  const avgCgpa = Number((totalCgpaSum / totalStudents).toFixed(2));
  if (lowestCgpa === 10 && totalStudents === 0) lowestCgpa = 0;

  // Format semester SGPA line chart
  const semKeys = Object.keys(semesterSgpaSums).sort(
    (a, b) => Number(a.replace('Sem ', '')) - Number(b.replace('Sem ', ''))
  );
  const semSgpaAvgData = semKeys.map((k) =>
    Number((semesterSgpaSums[k] / semesterSgpaCounts[k]).toFixed(2))
  );

  return {
    kpis: {
      totalStudents,
      hostellers,
      dayScholars,
      avgCgpa,
      highestCgpa,
      lowestCgpa: lowestCgpa === 10 ? 0 : lowestCgpa,
      activeArrears: totalPendingArrears,
      pendingArrears: totalPendingArrears,
      clearedArrears: totalClearedArrears,
      attentionRequiredCount,
    },
    charts: {
      semesterSgpa: {
        labels: semKeys,
        data: semSgpaAvgData,
      },
      cgpaDistribution: {
        labels: Object.keys(cgpaBuckets),
        data: Object.values(cgpaBuckets),
      },
      careerGoals: {
        labels: Object.keys(careerGoalMap),
        data: Object.values(careerGoalMap),
      },
      categoryRatio: {
        labels: ['Hostellers', 'Day Scholars'],
        data: [hostellers, dayScholars],
      },
      arrearStatus: {
        labels: ['Pending Arrears', 'Cleared Arrears'],
        data: [totalPendingArrears, totalClearedArrears],
      },
      departmentCounts: {
        labels: Object.keys(departmentMap),
        data: Object.values(departmentMap),
      },
    },
    lists: {
      recentStudents: students
        .slice(-6)
        .reverse()
        .map((s) => ({
          _id: s._id,
          registerNumber: s.personalDetails.registerNumber,
          name: s.personalDetails.name,
          department: s.personalDetails.department,
          cgpa: s.currentCGPA || (s.semesters && s.semesters.length > 0 ? s.semesters[s.semesters.length - 1].cgpa : 0),
          careerGoal: s.careerGoal && s.careerGoal.primaryGoal,
          createdAt: s.createdAt,
        })),
      attentionList: attentionList.slice(0, 10),
      activeArrearList: activeArrearList.slice(0, 10),
      decliningTrendList: decliningTrendList.slice(0, 10),
      improvingTrendList: improvingTrendList.slice(0, 10),
      missingTechList: missingTechList.slice(0, 10),
    },
  };
};

module.exports = {
  calculateAcademicTrend,
  evaluateMentorAttention,
  getDashboardMetrics,
};
