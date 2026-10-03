/**
 * Profile Completion Calculation Service
 * Evaluates the completeness of each profile section and returns an overall percentage.
 */

const calculateProfileCompletion = (student) => {
  if (!student) return { percentage: 0, sections: {}, missing: [] };

  const missing = [];
  let score = 0;
  const sections = {
    personal: false,
    family: false,
    academic: false,
    arrears: true, // true by default unless arrear status is Yes but empty
    technical: false,
    selfEvaluation: false,
    careerGoal: false,
  };

  // 1. Personal Details (20 points)
  const pd = student.personalDetails || {};
  const personalComplete = Boolean(
    pd.registerNumber &&
    pd.name &&
    pd.dob &&
    pd.gender &&
    pd.department &&
    pd.section &&
    pd.institutionalEmail &&
    pd.personalEmail &&
    pd.mobile &&
    pd.residentialAddress &&
    pd.category &&
    (pd.category === 'Hosteller' ? pd.hostelName : pd.distanceFromCollege !== undefined)
  );

  if (personalComplete) {
    score += 20;
    sections.personal = true;
  } else {
    missing.push('Personal Details (Missing required personal info or category details)');
  }

  // 2. Family Details (15 points)
  const fd = student.familyDetails || {};
  const familyComplete = Boolean(
    fd.emergencyContact &&
    ((fd.father && fd.father.name) || (fd.mother && fd.mother.name) || fd.guardianName)
  );

  if (familyComplete) {
    score += 15;
    sections.family = true;
  } else {
    missing.push('Family Details (Emergency contact or parent/guardian name missing)');
  }

  // 3. Academic Details (20 points)
  const semesters = student.semesters || [];
  if (semesters.length > 0) {
    score += 20;
    sections.academic = true;
  } else {
    missing.push('Academic Records (No semester records recorded)');
  }

  // 4. Arrear Management (5 points)
  // Check if any semester has arrearStatus === 'Yes'
  const hasArrearsReported = semesters.some((s) => s.arrearStatus === 'Yes');
  if (hasArrearsReported) {
    if (student.arrears && student.arrears.length > 0) {
      score += 5;
      sections.arrears = true;
    } else {
      sections.arrears = false;
      missing.push('Arrear Details (Arrears flagged in semester, but detailed arrear entries missing)');
    }
  } else {
    score += 5;
    sections.arrears = true;
  }

  // 5. Technical Profile (15 points)
  const tp = student.technicalProfile || {};
  const hasTechLanguagesOrSkills =
    (tp.programmingLanguages && tp.programmingLanguages.length > 0) ||
    (tp.technicalSkills && tp.technicalSkills.length > 0);
  const hasProjectOrCert =
    (tp.projects && tp.projects.length > 0) ||
    (tp.certifications && tp.certifications.length > 0);

  if (hasTechLanguagesOrSkills && hasProjectOrCert) {
    score += 15;
    sections.technical = true;
  } else if (hasTechLanguagesOrSkills || hasProjectOrCert) {
    score += 8;
    missing.push('Technical Profile (Add projects or certifications for full score)');
  } else {
    missing.push('Technical Profile (No programming languages, skills, or projects)');
  }

  // 6. Self-Evaluation (10 points)
  const se = student.selfEvaluation || {};
  const selfEvalFilled = Boolean(
    (se.academicStrengths && se.academicStrengths.length > 0) ||
    (se.technicalStrengths && se.technicalStrengths.length > 0) ||
    (se.improvementAreas && se.improvementAreas.length > 0) ||
    se.shortTermGoal ||
    se.longTermGoal
  );

  if (selfEvalFilled) {
    score += 10;
    sections.selfEvaluation = true;
  } else {
    missing.push('Self-Evaluation (Strengths, areas for improvement, or goals missing)');
  }

  // 7. Career Goal (15 points)
  const cg = student.careerGoal || {};
  let careerComplete = false;

  if (cg.primaryGoal === 'Placement' && cg.placement && (cg.placement.preferredRole || cg.placement.companyType)) {
    careerComplete = true;
  } else if (cg.primaryGoal === 'Higher Studies' && cg.higherStudies && (cg.higherStudies.preferredProgramme || cg.higherStudies.preferredCountry)) {
    careerComplete = true;
  } else if (cg.primaryGoal === 'Entrepreneurship' && cg.entrepreneurship && cg.entrepreneurship.startupIdea) {
    careerComplete = true;
  }

  if (careerComplete) {
    score += 15;
    sections.careerGoal = true;
  } else {
    missing.push(`Career Goal Details (Incomplete details for selected goal: ${cg.primaryGoal || 'None selected'})`);
  }

  // Cap score between 0 and 100
  const percentage = Math.min(100, Math.max(0, score));

  return {
    percentage,
    sections,
    missing,
  };
};

module.exports = { calculateProfileCompletion };
