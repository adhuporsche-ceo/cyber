/**
 * Student Full Profile Viewer & Mentor Intervention Handler
 */

let currentStudentId = null;
let currentStudentData = null;
let sgpaChartInstance = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!checkAuth()) return;
  initLayout('students');

  const urlParams = new URLSearchParams(window.location.search);
  currentStudentId = urlParams.get('id');

  const currentUser = getCurrentUser();
  if (!currentStudentId && currentUser && currentUser.role === 'student' && currentUser.studentProfileId) {
    currentStudentId = currentUser.studentProfileId;
  }

  if (!currentStudentId) {
    showToast('No student ID specified.', 'danger');
    setTimeout(() => (window.location.href = currentUser && currentUser.role === 'student' ? 'login.html' : 'students.html'), 1500);
    return;
  }

  // Edit profile button link
  const editBtn = document.getElementById('btnEditStudentDirect');
  if (editBtn) {
    if (currentUser && currentUser.role === 'student') {
      editBtn.style.display = 'none';
    } else {
      editBtn.href = `edit-student.html?id=${currentStudentId}`;
    }
  }

  // Hide mentor intervention actions for student accounts
  if (currentUser && currentUser.role === 'student') {
    document.querySelectorAll('button[onclick="openInterventionModal()"]').forEach(btn => {
      btn.style.display = 'none';
    });
  }

  // Check URL hash for direct tab navigation (e.g. #arrears)
  if (window.location.hash) {
    const triggerEl = document.querySelector(`button[data-bs-target="#tab-${window.location.hash.replace('#', '')}"]`);
    if (triggerEl) {
      const tab = new bootstrap.Tab(triggerEl);
      tab.show();
    }
  }

  await loadStudentProfile(currentStudentId);
});

async function loadStudentProfile(id) {
  try {
    const res = await apiCall(`/students/${id}`);
    if (!res.success || !res.data) throw new Error('Student record not found');

    const { student, analytics } = res.data;
    currentStudentData = student;

    renderHeroSummary(student, analytics);
    renderAcademicTab(student, analytics);
    renderArrearsTab(student);
    renderTechnicalTab(student);
    renderCareerTab(student, analytics);
    renderPersonalFamilyTab(student);
    renderInterventionsTab(student);
  } catch (err) {
    showToast(`Failed to load student profile: ${err.message}`, 'danger');
  }
}

// ---------------------------------------------------------------------------
// 1. Hero Summary & Attention Alert
// ---------------------------------------------------------------------------

function renderHeroSummary(student, analytics) {
  const pd = student.personalDetails || {};
  const cg = student.careerGoal || {};
  const completion = analytics.completion || {};
  const attention = analytics.mentorAttention || {};
  const trend = analytics.academicTrend || {};

  // Header texts
  document.getElementById('breadcrumbName').textContent = pd.name || 'Profile';
  document.getElementById('profileHeaderName').textContent = `${pd.name}'s Profile`;
  document.getElementById('profileStudentName').textContent = pd.name;
  document.getElementById('profileAvatar').textContent = (pd.name || 'S').charAt(0).toUpperCase();
  document.getElementById('profileRegNo').textContent = pd.registerNumber;
  document.getElementById('profileDept').textContent = `${pd.department} - Sec ${pd.section}`;
  document.getElementById('profileCategory').textContent = pd.category;
  document.getElementById('profileGoalBadge').textContent = `Goal: ${cg.primaryGoal || 'Unset'}`;
  document.getElementById('profileTrendBadge').innerHTML = getAcademicTrendBadge(trend);
  document.getElementById('profileInstEmail').textContent = pd.institutionalEmail;
  document.getElementById('profileMobile').textContent = pd.mobile;

  // Completion Progress Bar
  const pct = completion.percentage || 0;
  document.getElementById('profileCompletionText').textContent = `${pct}%`;
  const bar = document.getElementById('profileCompletionBar');
  bar.style.width = `${pct}%`;
  bar.className = `progress-bar ${pct >= 80 ? 'bg-success' : pct >= 50 ? 'bg-warning' : 'bg-danger'}`;

  const checkContainer = document.getElementById('completionChecklist');
  const sections = completion.sections || {};
  checkContainer.innerHTML = `
    <span class="badge ${sections.personal ? 'bg-success-subtle text-success' : 'bg-light text-muted border'}">Personal ${sections.personal ? '✓' : '○'}</span>
    <span class="badge ${sections.family ? 'bg-success-subtle text-success' : 'bg-light text-muted border'}">Family ${sections.family ? '✓' : '○'}</span>
    <span class="badge ${sections.academic ? 'bg-success-subtle text-success' : 'bg-light text-muted border'}">Academic ${sections.academic ? '✓' : '○'}</span>
    <span class="badge ${sections.technical ? 'bg-success-subtle text-success' : 'bg-light text-muted border'}">Technical ${sections.technical ? '✓' : '○'}</span>
    <span class="badge ${sections.careerGoal ? 'bg-success-subtle text-success' : 'bg-light text-muted border'}">Career ${sections.careerGoal ? '✓' : '○'}</span>
  `;

  // Attention Banner
  const alertBanner = document.getElementById('attentionAlertBanner');
  const reasonsList = document.getElementById('attentionReasonsList');
  if (attention.attentionRequired) {
    alertBanner.classList.remove('d-none');
    reasonsList.innerHTML = `<ul class="mb-0 ps-3">${(attention.reasons || []).map((r) => `<li>${r}</li>`).join('')}</ul>`;
  } else {
    alertBanner.classList.add('d-none');
  }
}

// ---------------------------------------------------------------------------
// 2. Academic Tab & SGPA Chart
// ---------------------------------------------------------------------------

function renderAcademicTab(student, analytics) {
  if (window.ChartTheme) ChartTheme.apply();
  const semesters = student.semesters || [];
  const trend = analytics.academicTrend || {};

  document.getElementById('cardTrendBadge').innerHTML = getAcademicTrendBadge(trend);
  document.getElementById('trendDescription').innerHTML = `<i class="bi bi-info-circle me-1"></i> <strong>Academic Progression:</strong> ${trend.description || 'Evaluation based on chronological semester SGPA records.'}`;

  // KPI Summary
  const sorted = [...semesters].sort((a, b) => b.semesterNumber - a.semesterNumber);
  const latestSem = sorted[0] || {};
  document.getElementById('summaryCgpa').textContent = latestSem.cgpa ? latestSem.cgpa.toFixed(2) : '0.00';
  document.getElementById('summaryAttendance').textContent = latestSem.attendance ? `${latestSem.attendance}%` : '0%';
  document.getElementById('summarySemCount').textContent = semesters.length;

  const pendingCount = (student.arrears || []).filter((a) => a.status === 'Pending').length;
  document.getElementById('summaryActiveArrears').textContent = pendingCount;

  // Render Table
  const tbody = document.getElementById('semestersTableBody');
  if (semesters.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted">No semester records logged yet.</td></tr>`;
  } else {
    tbody.innerHTML = sorted
      .map(
        (s) => `
      <tr>
        <td class="fw-bold">Semester ${s.semesterNumber}</td>
        <td><strong class="text-primary">${s.sgpa}</strong></td>
        <td><strong class="text-success">${s.cgpa}</strong></td>
        <td><span class="${s.attendance < 75 ? 'text-danger fw-bold' : ''}">${s.attendance}%</span></td>
        <td>
          <span class="badge ${s.arrearStatus === 'Yes' ? 'badge-soft-danger' : 'badge-soft-success'}">
            ${s.arrearStatus === 'Yes' ? 'Yes (Arrear)' : 'All Clear'}
          </span>
        </td>
        <td>${s.numberOfArrears || 0}</td>
        <td><small class="text-muted">${(s.subjectsStrong || []).join(', ') || 'None'}</small></td>
        <td><small class="text-muted">${s.academicAchievements || 'None'}</small></td>
      </tr>`
      )
      .join('');
  }

  // Render Chart
  const ctx = document.getElementById('studentSgpaChart');
  if (ctx && trend.dataPoints && trend.dataPoints.length > 0) {
    if (sgpaChartInstance) sgpaChartInstance.destroy();

    sgpaChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: trend.dataPoints.map((d) => d.semester),
        datasets: [
          {
            label: 'SGPA',
            data: trend.dataPoints.map((d) => d.sgpa),
            borderColor: '#ffffff',
            backgroundColor: '#fff',
            fill: true,
            tension: 0.3,
            pointRadius: 6,
            pointBackgroundColor: '#ffffff',
          },
          {
            label: 'Cumulative CGPA',
            data: trend.dataPoints.map((d) => d.cgpa),
            borderColor: '#000',
            borderDash: [5, 5],
            fill: false,
            tension: 0.3,
            pointRadius: 5,
            pointBackgroundColor: '#000',
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'top' },
        },
        scales: {
          y: { min: 0, max: 10, ticks: { stepSize: 2 } },
        },
      },
    });
  }
}

// ---------------------------------------------------------------------------
// 3. Arrears Tab
// ---------------------------------------------------------------------------

function renderArrearsTab(student) {
  const arrears = student.arrears || [];
  const tbody = document.getElementById('arrearHistoryTableBody');
  const badge = document.getElementById('arrearCountBadge');

  const pending = arrears.filter((a) => a.status === 'Pending').length;
  badge.textContent = `${pending} Pending / ${arrears.length} Total`;
  badge.className = `badge ${pending > 0 ? 'bg-danger' : 'bg-success'}`;

  if (arrears.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center py-5 text-muted">
          <i class="bi bi-check2-circle text-success fs-3 d-block mb-1"></i>
          Exemplary academic record. No arrears recorded for this student.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = arrears
    .map(
      (a) => `
    <tr>
      <td class="fw-bold">Sem ${a.semesterOccurred}</td>
      <td><strong>${a.subjectCode}</strong></td>
      <td>${a.subjectName}</td>
      <td>${a.attempts}</td>
      <td>
        <span class="badge ${a.status === 'Cleared' ? 'badge-soft-success' : 'badge-soft-danger'}">
          ${a.status}
        </span>
      </td>
      <td>${a.status === 'Cleared' ? `Sem ${a.clearedSemester || 'N/A'} (Grade: ${a.clearedGrade || 'P'})` : '<span class="text-muted">Not Cleared</span>'}</td>
      <td><span class="badge ${a.remedialRequired === 'Yes' ? 'bg-warning text-dark' : 'bg-light text-muted'}">${a.remedialRequired}</span></td>
      <td><span class="badge ${a.mentorSupportRequired === 'Yes' ? 'bg-primary' : 'bg-light text-muted'}">${a.mentorSupportRequired}</span></td>
      <td><small class="text-muted">${a.reason || 'None specified'}</small></td>
    </tr>`
    )
    .join('');
}

// ---------------------------------------------------------------------------
// 4. Technical Tab
// ---------------------------------------------------------------------------

function renderTechnicalTab(student) {
  const tech = student.technicalProfile || {};

  // Languages & Skills Chips
  const langContainer = document.getElementById('techLanguagesBadges');
  langContainer.innerHTML = (tech.programmingLanguages || [])
    .map((l) => `<span class="badge bg-secondary-subtle text-secondary fs-6">${l}</span>`)
    .join('') || '<span class="text-muted small">No programming languages listed</span>';

  const skillsContainer = document.getElementById('techSkillsBadges');
  skillsContainer.innerHTML = (tech.technicalSkills || [])
    .map((s) => `<span class="badge bg-primary-subtle text-primary fs-6">${s}</span>`)
    .join('') || '<span class="text-muted small">No technical skills listed</span>';

  document.getElementById('techPreferredDomain').textContent = tech.preferredDomain || 'Not specified';
  document.getElementById('techCommText').textContent = tech.communicationLevel || 'Intermediate';
  document.getElementById('techAptText').textContent = tech.aptitudeLevel || 'Intermediate';

  // Profile Links
  const linksContainer = document.getElementById('profileLinksContainer');
  const links = tech.profileLinks || {};
  linksContainer.innerHTML = `
    <ul class="list-group list-group-flush small">
      <li class="list-group-item d-flex justify-content-between align-items-center px-0">
        <span><i class="bi bi-github me-2 text-dark"></i> GitHub</span>
        ${links.github ? `<a href="${links.github}" target="_blank" class="text-truncate text-primary" style="max-width: 200px;">${links.github}</a>` : '<span class="text-muted">Not linked</span>'}
      </li>
      <li class="list-group-item d-flex justify-content-between align-items-center px-0">
        <span><i class="bi bi-linkedin me-2 text-primary"></i> LinkedIn</span>
        ${links.linkedin ? `<a href="${links.linkedin}" target="_blank" class="text-truncate text-primary" style="max-width: 200px;">${links.linkedin}</a>` : '<span class="text-muted">Not linked</span>'}
      </li>
      <li class="list-group-item d-flex justify-content-between align-items-center px-0">
        <span><i class="bi bi-code-square me-2 text-success"></i> HackerRank</span>
        ${links.hackerrank ? `<a href="${links.hackerrank}" target="_blank" class="text-truncate text-primary" style="max-width: 200px;">${links.hackerrank}</a>` : '<span class="text-muted">Not linked</span>'}
      </li>
      <li class="list-group-item d-flex justify-content-between align-items-center px-0">
        <span><i class="bi bi-terminal me-2 text-danger"></i> HackerEarth</span>
        ${links.hackerearth ? `<a href="${links.hackerearth}" target="_blank" class="text-truncate text-primary" style="max-width: 200px;">${links.hackerearth}</a>` : '<span class="text-muted">Not linked</span>'}
      </li>
    </ul>`;

  // Projects Grid
  const projectsGrid = document.getElementById('projectsCardGrid');
  const projects = tech.projects || [];
  if (projects.length === 0) {
    projectsGrid.innerHTML = `<div class="col-12 text-center py-4 text-muted">No practical projects added yet.</div>`;
  } else {
    projectsGrid.innerHTML = projects
      .map(
        (p) => `
      <div class="col-md-6">
        <div class="card h-100 border p-3">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <h6 class="fw-bold text-dark mb-0">${p.title}</h6>
            <span class="badge ${p.projectStatus === 'Completed' ? 'badge-soft-success' : 'badge-soft-warning'}">
              ${p.projectStatus}
            </span>
          </div>
          <p class="small text-muted mb-2">${p.description || 'No description provided.'}</p>
          <div class="d-flex flex-wrap gap-1 mb-2">
            ${(p.technologies || []).map((t) => `<span class="badge bg-light text-dark border" style="font-size: 0.7rem;">${t}</span>`).join('')}
          </div>
          ${p.githubLink ? `<a href="${p.githubLink}" target="_blank" class="small text-primary mt-auto"><i class="bi bi-github me-1"></i> Repository</a>` : ''}
        </div>
      </div>`
      )
      .join('');
  }

  // Certifications
  const certsContainer = document.getElementById('certsListContainer');
  const certs = tech.certifications || [];
  if (certs.length === 0) {
    certsContainer.innerHTML = `<div class="text-center py-3 text-muted small">No certifications logged.</div>`;
  } else {
    certsContainer.innerHTML = certs
      .map(
        (c) => `
      <div class="p-2 bg-light rounded border mb-2 d-flex justify-content-between align-items-center small">
        <div>
          <strong class="d-block text-dark">${c.name}</strong>
          <span class="text-muted">${c.issuingOrg} • ${c.completionDate ? c.completionDate.split('T')[0] : 'Completed'}</span>
        </div>
        ${c.certificateLink ? `<a href="${c.certificateLink}" target="_blank" class="btn btn-sm btn-outline-secondary py-0">Verify</a>` : ''}
      </div>`
      )
      .join('');
  }

  // Internships
  const internContainer = document.getElementById('internshipsListContainer');
  const internships = tech.internships || [];
  if (internships.length === 0) {
    internContainer.innerHTML = `<div class="text-center py-3 text-muted small">No internship experience logged.</div>`;
  } else {
    internContainer.innerHTML = internships
      .map(
        (i) => `
      <div class="p-2 bg-light rounded border mb-2 small">
        <div class="d-flex justify-content-between align-items-center mb-1">
          <strong class="text-dark">${i.company}</strong>
          <span class="badge bg-secondary-subtle text-secondary">${i.duration || 'Intern'}</span>
        </div>
        <div class="text-primary fw-semibold">${i.role}</div>
        <p class="text-muted mb-0 mt-1">${i.description || ''}</p>
      </div>`
      )
      .join('');
  }
}

// ---------------------------------------------------------------------------
// 5. Career & Rule-Based Skill Gap Tab
// ---------------------------------------------------------------------------

function renderCareerTab(student, analytics) {
  const cg = student.careerGoal || {};
  const sg = analytics.skillGap || {};
  const se = student.selfEvaluation || {};

  document.getElementById('careerTrackName').textContent = cg.primaryGoal || 'Unset';

  // Career details
  const detailsContainer = document.getElementById('careerTrackDetailsContainer');
  if (cg.primaryGoal === 'Placement' && cg.placement) {
    detailsContainer.innerHTML = `
      <table class="table table-borderless small mb-0">
        <tbody>
          <tr><td class="text-muted" style="width: 140px;">Preferred Role:</td><td class="fw-bold">${cg.placement.preferredRole || 'N/A'}</td></tr>
          <tr><td class="text-muted">Target Domain:</td><td>${cg.placement.preferredDomain || 'N/A'}</td></tr>
          <tr><td class="text-muted">Company Type:</td><td><span class="badge bg-light text-dark border">${cg.placement.companyType || 'N/A'}</span></td></tr>
          <tr><td class="text-muted">Expected Salary:</td><td><strong class="text-success">${cg.placement.expectedSalary || 'N/A'}</strong></td></tr>
          <tr><td class="text-muted">Target Companies:</td><td>${(cg.placement.targetCompanies || []).join(', ') || 'N/A'}</td></tr>
          <tr><td class="text-muted">Preferred Location:</td><td>${cg.placement.preferredLocation || 'N/A'}</td></tr>
          <tr><td class="text-muted">Training Support:</td><td>${cg.placement.trainingSupport || 'N/A'}</td></tr>
        </tbody>
      </table>`;
  } else if (cg.primaryGoal === 'Higher Studies' && cg.higherStudies) {
    detailsContainer.innerHTML = `
      <table class="table table-borderless small mb-0">
        <tbody>
          <tr><td class="text-muted" style="width: 140px;">Programme:</td><td class="fw-bold">${cg.higherStudies.preferredProgramme || 'N/A'}</td></tr>
          <tr><td class="text-muted">Specialization:</td><td>${cg.higherStudies.specialization || 'N/A'}</td></tr>
          <tr><td class="text-muted">Target Country:</td><td>${cg.higherStudies.preferredCountry || 'N/A'}</td></tr>
          <tr><td class="text-muted">Institutions:</td><td>${(cg.higherStudies.targetInstitutions || []).join(', ') || 'N/A'}</td></tr>
          <tr><td class="text-muted">Planned Exams:</td><td><span class="badge bg-info-subtle text-info-emphasis">${(cg.higherStudies.plannedExams || []).join(', ') || 'N/A'}</span></td></tr>
          <tr><td class="text-muted">Admission Year:</td><td>${cg.higherStudies.admissionYear || 'N/A'}</td></tr>
        </tbody>
      </table>`;
  } else if (cg.primaryGoal === 'Entrepreneurship' && cg.entrepreneurship) {
    detailsContainer.innerHTML = `
      <table class="table table-borderless small mb-0">
        <tbody>
          <tr><td class="text-muted" style="width: 140px;">Startup Idea:</td><td class="fw-bold">${cg.entrepreneurship.startupIdea || 'N/A'}</td></tr>
          <tr><td class="text-muted">Current Stage:</td><td><span class="badge bg-warning text-dark">${cg.entrepreneurship.currentStage || 'Idea'}</span></td></tr>
          <tr><td class="text-muted">Problem:</td><td>${cg.entrepreneurship.problemAddressed || 'N/A'}</td></tr>
          <tr><td class="text-muted">Solution:</td><td>${cg.entrepreneurship.proposedSolution || 'N/A'}</td></tr>
          <tr><td class="text-muted">Target Market:</td><td>${cg.entrepreneurship.targetCustomers || 'N/A'}</td></tr>
          <tr><td class="text-muted">Funding Support:</td><td>${cg.entrepreneurship.fundingSupport || 'N/A'}</td></tr>
        </tbody>
      </table>`;
  }

  // Rule-Based Skill Gap Cards
  const acquiredContainer = document.getElementById('sgAcquiredSkills');
  acquiredContainer.innerHTML = (sg.acquiredSkills || [])
    .map((s) => `<span class="badge bg-success-subtle text-success fs-6">${s}</span>`)
    .join('') || '<span class="text-muted small">None matched yet</span>';

  const toDevContainer = document.getElementById('sgSkillsToDevelop');
  toDevContainer.innerHTML = (sg.skillsToDevelop || [])
    .map((s) => `<span class="badge bg-warning-subtle text-warning-emphasis fs-6">${s}</span>`)
    .join('') || '<span class="text-success small">No immediate skill gaps identified!</span>';

  document.getElementById('sgSuggestedCerts').innerHTML = (sg.suggestedCertifications || [])
    .map((c) => `<li>${c}</li>`)
    .join('') || '<li>None suggested</li>';

  document.getElementById('sgSuggestedProjects').innerHTML = (sg.suggestedProjects || [])
    .map((p) => `<li>${p}</li>`)
    .join('') || '<li>None suggested</li>';

  document.getElementById('sgSoftSkills').innerHTML = (sg.softSkillRecommendations || [])
    .map((m) => `<li>${m}</li>`)
    .join('') || '<li>Soft skill and aptitude competencies meet current target requirements.</li>';

  // Self Evaluation Section
  const seContainer = document.getElementById('selfEvalContainer');
  seContainer.innerHTML = `
    <div class="row g-3 small">
      <div class="col-md-4">
        <strong class="d-block text-dark mb-1"><i class="bi bi-star-fill text-warning me-1"></i> Academic Strengths</strong>
        <p class="text-muted">${(se.academicStrengths || []).join(', ') || 'None recorded'}</p>
      </div>
      <div class="col-md-4">
        <strong class="d-block text-dark mb-1"><i class="bi bi-tools text-primary me-1"></i> Technical Strengths</strong>
        <p class="text-muted">${(se.technicalStrengths || []).join(', ') || 'None recorded'}</p>
      </div>
      <div class="col-md-4">
        <strong class="d-block text-dark mb-1"><i class="bi bi-arrow-repeat text-danger me-1"></i> Areas for Improvement</strong>
        <p class="text-muted">${(se.improvementAreas || []).join(', ') || 'None recorded'}</p>
      </div>
      <div class="col-md-6">
        <strong class="d-block text-dark mb-1"><i class="bi bi-flag me-1"></i> Short-Term Goal</strong>
        <p class="text-muted">${se.shortTermGoal || 'None specified'}</p>
      </div>
      <div class="col-md-6">
        <strong class="d-block text-dark mb-1"><i class="bi bi-trophy me-1"></i> Long-Term Goal</strong>
        <p class="text-muted">${se.longTermGoal || 'None specified'}</p>
      </div>
      <div class="col-12 border-top pt-2">
        <strong class="d-block text-dark mb-1"><i class="bi bi-person-raised-hand text-info me-1"></i> Support Expected from Mentor</strong>
        <p class="text-muted mb-0">${se.mentorSupportExpected || 'Routine mentoring & career guidance.'}</p>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// 6. Personal & Family Tab (Strictly Scoped View)
// ---------------------------------------------------------------------------

function renderPersonalFamilyTab(student) {
  const pd = student.personalDetails || {};
  const fd = student.familyDetails || {};

  document.getElementById('piRegNo').textContent = pd.registerNumber;
  document.getElementById('piName').textContent = pd.name;
  document.getElementById('piDob').textContent = formatDate(pd.dob);
  document.getElementById('piGender').textContent = pd.gender;
  document.getElementById('piDeptSec').textContent = `${pd.department} - Section ${pd.section}`;
  document.getElementById('piCategory').textContent = pd.category;

  if (pd.category === 'Hosteller') {
    document.getElementById('piCategoryDetailLabel').textContent = 'Hostel & Room:';
    document.getElementById('piCategoryDetailValue').textContent = pd.hostelName || 'Hostel resident';
  } else {
    document.getElementById('piCategoryDetailLabel').textContent = 'Commute Distance:';
    document.getElementById('piCategoryDetailValue').textContent = `${pd.distanceFromCollege || 0} km from college`;
  }

  document.getElementById('piAddress').textContent = pd.residentialAddress;

  // Family Info
  if (fd.father) {
    document.getElementById('fiFather').textContent = fd.father.name || 'N/A';
    document.getElementById('fiFatherOcc').textContent = fd.father.occupation || 'N/A';
    document.getElementById('fiFatherIncome').textContent = fd.father.incomeRange || 'Not disclosed';
  }
  if (fd.mother) {
    document.getElementById('fiMother').textContent = fd.mother.name || 'N/A';
    document.getElementById('fiMotherOcc').textContent = fd.mother.occupation || 'N/A';
    document.getElementById('fiMotherIncome').textContent = fd.mother.incomeRange || 'Not disclosed';
  }

  document.getElementById('fiEmergency').textContent = fd.emergencyContact || 'N/A';
  document.getElementById('fiFirstGen').textContent = fd.firstGenGraduate || 'No';
  document.getElementById('fiScholarship').textContent = fd.scholarshipReceived || 'No';
  document.getElementById('fiGuidance').textContent = fd.guidanceRequired || 'No';
}

// ---------------------------------------------------------------------------
// 7. Mentor Interventions Tab & Modal
// ---------------------------------------------------------------------------

function renderInterventionsTab(student) {
  const timeline = document.getElementById('interventionsTimeline');
  const interventions = student.mentorInterventions || [];

  if (interventions.length === 0) {
    timeline.innerHTML = `
      <div class="text-center py-5 text-muted">
        <i class="bi bi-chat-heart fs-3 d-block mb-1"></i>
        No mentoring interventions logged yet. Click <strong>"Add Mentor Intervention"</strong> to record meeting notes.
      </div>`;
    return;
  }

  timeline.innerHTML = interventions
    .map(
      (m) => `
    <div class="timeline-item">
      <div class="timeline-dot"></div>
      <div class="timeline-content">
        <div class="d-flex justify-content-between align-items-center mb-1">
          <span class="fw-bold text-dark fs-6">${m.reason}</span>
          <span class="badge ${m.status === 'Resolved' ? 'bg-success' : m.status === 'In Progress' ? 'bg-warning text-dark' : 'bg-secondary'}">
            ${m.status}
          </span>
        </div>
        <div class="small text-muted mb-2">
          <i class="bi bi-calendar3 me-1"></i> ${formatDate(m.date)} • Logged by: <strong>${m.mentorName || 'Faculty'}</strong>
          ${m.followUpDate ? ` • <i class="bi bi-arrow-repeat me-1"></i> Follow-up: ${formatDate(m.followUpDate)}` : ''}
        </div>
        <p class="small text-dark mb-2">${m.mentorNote}</p>
        ${m.actionTaken ? `<div class="p-2 bg-white rounded border small text-muted"><strong>Action Taken:</strong> ${m.actionTaken}</div>` : ''}
      </div>
    </div>`
    )
    .join('');
}

function openInterventionModal() {
  const form = document.getElementById('interventionForm');
  form.reset();
  document.getElementById('miDate').value = new Date().toISOString().split('T')[0];

  const modalEl = document.getElementById('interventionModal');
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
}

async function saveMentorIntervention() {
  const date = document.getElementById('miDate').value;
  const status = document.getElementById('miStatus').value;
  const reason = document.getElementById('miReason').value.trim();
  const note = document.getElementById('miNote').value.trim();
  const action = document.getElementById('miAction').value.trim();
  const followUp = document.getElementById('miFollowUp').value || null;

  if (!reason || !note) {
    showToast('Please provide both Reason and Mentor Counseling Note.', 'warning');
    return;
  }

  try {
    const res = await apiCall(`/students/${currentStudentId}/interventions`, {
      method: 'POST',
      body: {
        date,
        status,
        reason,
        mentorNote: note,
        actionTaken: action,
        followUpDate: followUp,
      },
    });

    if (res.success) {
      showToast('Mentor intervention recorded successfully!', 'success');
      const modalEl = document.getElementById('interventionModal');
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();

      await loadStudentProfile(currentStudentId);
    }
  } catch (err) {
    showToast(`Failed to record intervention: ${err.message}`, 'danger');
  }
}
