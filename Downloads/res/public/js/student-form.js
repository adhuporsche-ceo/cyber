/**
 * Multi-Step Student Profiling Wizard Handler (Add & Edit Modes)
 */

let currentStep = 1;
const totalSteps = 8;
let isEditMode = false;
let studentId = null;
let studentVersion = null;

// Dynamic In-Memory Data Collections
let semesterRecords = [];
let arrearRecords = [];
let projectRecords = [];
let certRecords = [];
let internshipRecords = [];

// Edit subdocument tracking index
let editingSemesterIndex = -1;
let editingArrearIndex = -1;

document.addEventListener('DOMContentLoaded', async () => {
  if (!checkAuth()) return;

  // Determine mode
  const urlParams = new URLSearchParams(window.location.search);
  studentId = urlParams.get('id');
  isEditMode = Boolean(studentId && (window.location.pathname.includes('edit-student') || studentId));
  const currentUser = getCurrentUser();
  const isStudentSubmission = normalizeClientRole(currentUser?.role) === 'STUDENT';

  if ((!isEditMode && !isStudentSubmission && !canClient('canCreate')) || (isEditMode && !canClient('canEdit'))) {
    initLayout('students');
    showToast('Not authorized for this action.', 'danger');
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 700);
    return;
  }

  initLayout(isEditMode ? 'students' : 'add-student');

  if (isEditMode) {
    document.getElementById('formPageTitle').textContent = 'Edit Student Profile';
    document.getElementById('formPageSubtitle').textContent = 'Update student records, semesters, arrears, and career aspirations.';
    document.getElementById('submitBtnLabel').textContent = 'Update Student Profile';

    const viewBtn = document.getElementById('btnViewProfileDirect');
    if (viewBtn) {
      viewBtn.href = `student-profile.html?id=${studentId}`;
    }

    await loadStudentDataForEdit(studentId);
  } else {
    const registerNumberInput = document.getElementById('pdRegisterNumber');
    if (isStudentSubmission) {
      registerNumberInput.value = String(currentUser.registerNumber || '').toUpperCase();
      registerNumberInput.readOnly = true;
    }

    // Initial dynamic sample or empty setup
    renderSemesterTable();
    renderArrearTable();
  }

  updateStepUI();
});

// ---------------------------------------------------------------------------
// Step Navigation & UI
// ---------------------------------------------------------------------------

function goToStep(step) {
  if (step < 1 || step > totalSteps) return;

  // If jumping forward, validate current step first
  if (step > currentStep) {
    if (!validateCurrentStep(currentStep)) return;
  }

  currentStep = step;
  updateStepUI();
}

function nextStep() {
  if (!validateCurrentStep(currentStep)) return;

  if (currentStep < totalSteps) {
    currentStep++;
    updateStepUI();
  }
}

function prevStep() {
  if (currentStep > 1) {
    currentStep--;
    updateStepUI();
  }
}

function updateStepUI() {
  // Update step sections
  document.querySelectorAll('.form-step-section').forEach((el) => el.classList.remove('active'));
  const currentSection = document.getElementById(`step${currentStep}`);
  if (currentSection) currentSection.classList.add('active');

  // Update step navigation items
  document.querySelectorAll('.wizard-step-item').forEach((item) => {
    const stepNum = parseInt(item.getAttribute('data-step'), 10);
    item.classList.remove('active', 'completed');
    if (stepNum === currentStep) {
      item.classList.add('active');
    } else if (stepNum < currentStep) {
      item.classList.add('completed');
    }
  });

  // Update navigation buttons
  const btnPrev = document.getElementById('btnPrev');
  const btnNext = document.getElementById('btnNext');
  const btnSubmit = document.getElementById('btnSubmit');
  const btnSubmitReview = document.getElementById('btnSubmitReview');

  btnPrev.disabled = currentStep === 1;

  if (currentStep === totalSteps) {
    btnNext.classList.add('d-none');
    btnSubmit.classList.remove('d-none');
    if (btnSubmitReview && !isEditMode) {
      btnSubmitReview.classList.remove('d-none');
    }
    renderReviewSummary();
  } else {
    btnNext.classList.remove('d-none');
    btnSubmit.classList.add('d-none');
    if (btnSubmitReview) btnSubmitReview.classList.add('d-none');
  }

  // Scroll to top of card
  window.scrollTo({ top: 120, behavior: 'smooth' });
}

// ---------------------------------------------------------------------------
// Step Validation
// ---------------------------------------------------------------------------

function validateCurrentStep(step) {
  let valid = true;

  if (step === 1) {
    const regNo = document.getElementById('pdRegisterNumber').value.trim();
    const name = document.getElementById('pdName').value.trim();
    const dob = document.getElementById('pdDob').value;
    const gender = document.getElementById('pdGender').value;
    const dept = document.getElementById('pdDepartment').value;
    const sec = document.getElementById('pdSection').value.trim();
    const instEmail = document.getElementById('pdInstEmail').value.trim();
    const personalEmail = document.getElementById('pdPersonalEmail').value.trim();
    const mobile = document.getElementById('pdMobile').value.trim();
    const address = document.getElementById('pdAddress').value.trim();
    const category = document.getElementById('pdCategory').value;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const mobileRegex = /^[6-9]\d{9}$/;

    if (!regNo || !name || !dob || !gender || !dept || !sec || !address || !category) {
      showToast('Please fill all mandatory personal details marked with *', 'warning');
      valid = false;
    } else if (!emailRegex.test(instEmail) || !emailRegex.test(personalEmail)) {
      showToast('Please provide valid institutional and personal email addresses.', 'warning');
      valid = false;
    } else if (!mobileRegex.test(mobile)) {
      showToast('Please provide a valid 10-digit Indian mobile number.', 'warning');
      valid = false;
    } else if (category === 'Hosteller' && !document.getElementById('pdHostelName').value.trim()) {
      showToast('Please provide the hostel name and room number.', 'warning');
      valid = false;
    } else if (category === 'Day Scholar' && document.getElementById('pdDistance').value === '') {
      showToast('Please specify the distance from residence to college in km.', 'warning');
      valid = false;
    }
  } else if (step === 2) {
    const emergency = document.getElementById('fdEmergency').value.trim();
    if (!emergency) {
      showToast('Emergency contact number is mandatory.', 'warning');
      valid = false;
    }
  }

  return valid;
}

// ---------------------------------------------------------------------------
// Conditional Field Logic
// ---------------------------------------------------------------------------

function handleCategoryChange() {
  const category = document.getElementById('pdCategory').value;
  const hostellerGroup = document.getElementById('hostellerFieldGroup');
  const dayScholarGroup = document.getElementById('dayScholarFieldGroup');

  if (category === 'Hosteller') {
    hostellerGroup.style.display = 'block';
    dayScholarGroup.style.display = 'none';
  } else if (category === 'Day Scholar') {
    hostellerGroup.style.display = 'none';
    dayScholarGroup.style.display = 'block';
  } else {
    hostellerGroup.style.display = 'none';
    dayScholarGroup.style.display = 'none';
  }
}

function handleGoalChange() {
  const selected = document.querySelector('input[name="careerGoalChoice"]:checked').value;
  document.getElementById('placementFieldsGroup').style.display = selected === 'Placement' ? 'block' : 'none';
  document.getElementById('higherStudiesFieldsGroup').style.display = selected === 'Higher Studies' ? 'block' : 'none';
  document.getElementById('entrepreneurshipFieldsGroup').style.display = selected === 'Entrepreneurship' ? 'block' : 'none';
}

// ---------------------------------------------------------------------------
// Dynamic Semester Subdocument Operations
// ---------------------------------------------------------------------------

function showAddSemesterModal(index = -1) {
  editingSemesterIndex = index;
  const modalEl = document.getElementById('semesterModal');
  const form = document.getElementById('modalSemesterForm');
  form.reset();

  const title = document.getElementById('semModalTitle');
  if (index >= 0) {
    title.textContent = 'Edit Semester Record';
    const s = semesterRecords[index];
    document.getElementById('modalSemNumber').value = s.semesterNumber;
    document.getElementById('modalSemAttendance').value = s.attendance;
    document.getElementById('modalSemSgpa').value = s.sgpa;
    document.getElementById('modalSemCgpa').value = s.cgpa;
    document.getElementById('modalSemArrearStatus').value = s.arrearStatus || 'No';
    document.getElementById('modalSemArrearCount').value = s.numberOfArrears || 0;
    document.getElementById('modalSemStrongSubjects').value = (s.subjectsStrong || []).join(', ');
    document.getElementById('modalSemAchievements').value = s.academicAchievements || '';
  } else {
    title.textContent = 'Add Semester Record';
    const nextSem = semesterRecords.length + 1;
    if (nextSem <= 8) {
      document.getElementById('modalSemNumber').value = nextSem;
    }
  }

  const modal = new bootstrap.Modal(modalEl);
  modal.show();
}

function saveSemesterFromModal() {
  const semNum = parseInt(document.getElementById('modalSemNumber').value, 10);
  const att = parseFloat(document.getElementById('modalSemAttendance').value);
  const sgpa = parseFloat(document.getElementById('modalSemSgpa').value);
  const cgpa = parseFloat(document.getElementById('modalSemCgpa').value);
  const arrearStatus = document.getElementById('modalSemArrearStatus').value;
  const numArrears = parseInt(document.getElementById('modalSemArrearCount').value, 10) || 0;
  const strongSubs = document.getElementById('modalSemStrongSubjects').value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const achievements = document.getElementById('modalSemAchievements').value.trim();

  if (isNaN(semNum) || isNaN(att) || isNaN(sgpa) || isNaN(cgpa)) {
    showToast('Please provide valid numbers for Semester, Attendance, SGPA, and CGPA.', 'warning');
    return;
  }

  // Check duplicate semester number
  const duplicate = semesterRecords.some((s, idx) => s.semesterNumber === semNum && idx !== editingSemesterIndex);
  if (duplicate) {
    showToast(`Semester ${semNum} record already exists in the table. Please edit that record instead.`, 'warning');
    return;
  }

  const record = {
    semesterNumber: semNum,
    attendance: att,
    sgpa,
    cgpa,
    arrearStatus,
    numberOfArrears: numArrears,
    subjectsStrong: strongSubs,
    academicAchievements: achievements,
  };

  if (editingSemesterIndex >= 0) {
    semesterRecords[editingSemesterIndex] = record;
  } else {
    semesterRecords.push(record);
  }

  // Keep sorted by semester number
  semesterRecords.sort((a, b) => a.semesterNumber - b.semesterNumber);

  renderSemesterTable();

  const modalEl = document.getElementById('semesterModal');
  const modal = bootstrap.Modal.getInstance(modalEl);
  if (modal) modal.hide();
}

function removeSemester(index) {
  if (confirm('Are you sure you want to delete this semester record?')) {
    semesterRecords.splice(index, 1);
    renderSemesterTable();
  }
}

function renderSemesterTable() {
  const tbody = document.getElementById('semesterRecordsTableBody');
  if (!tbody) return;

  if (semesterRecords.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center py-4 text-muted">
          No semester records added yet. Click <strong>"Add Semester Record"</strong> to log semester progress.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = semesterRecords
    .map(
      (s, idx) => `
      <tr>
        <td class="fw-bold">Sem ${s.semesterNumber}</td>
        <td><strong class="text-primary">${s.sgpa}</strong></td>
        <td><strong class="text-success">${s.cgpa}</strong></td>
        <td>${s.attendance}%</td>
        <td>
          <span class="badge ${s.arrearStatus === 'Yes' ? 'bg-danger' : 'bg-success'}">
            ${s.arrearStatus === 'Yes' ? 'Yes (Arrear)' : 'Clear'}
          </span>
        </td>
        <td>${s.numberOfArrears || 0}</td>
        <td><small class="text-muted">${(s.subjectsStrong || []).join(', ') || 'None'}</small></td>
        <td><small class="text-muted">${s.academicAchievements || 'None'}</small></td>
        <td class="text-end text-nowrap">
          <button type="button" class="btn btn-sm btn-outline-secondary py-0 px-2" onclick="showAddSemesterModal(${idx})">Edit</button>
          <button type="button" class="btn btn-sm btn-outline-danger py-0 px-2" onclick="removeSemester(${idx})">Delete</button>
        </td>
      </tr>`
    )
    .join('');
}

// ---------------------------------------------------------------------------
// Dynamic Arrear Subdocument Operations
// ---------------------------------------------------------------------------

function showAddArrearModal(index = -1) {
  editingArrearIndex = index;
  const modalEl = document.getElementById('arrearModal');
  const form = document.getElementById('modalArrearForm');
  form.reset();

  const title = document.getElementById('arrearModalTitle');
  if (index >= 0) {
    title.textContent = 'Edit Arrear Record';
    const a = arrearRecords[index];
    document.getElementById('modalArrearOccurredSem').value = a.semesterOccurred;
    document.getElementById('modalArrearSubCode').value = a.subjectCode;
    document.getElementById('modalArrearSubName').value = a.subjectName;
    document.getElementById('modalArrearAttempts').value = a.attempts || 1;
    document.getElementById('modalArrearStatus').value = a.status || 'Pending';
    document.getElementById('modalArrearClearedSem').value = a.clearedSemester || '';
    document.getElementById('modalArrearClearedGrade').value = a.clearedGrade || '';
    document.getElementById('modalArrearReason').value = a.reason || '';
    document.getElementById('modalArrearRemedial').value = a.remedialRequired || 'No';
    document.getElementById('modalArrearMentorSupport').value = a.mentorSupportRequired || 'No';
  } else {
    title.textContent = 'Add Arrear Record';
  }

  toggleModalClearedFields();
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
}

function toggleModalClearedFields() {
  const status = document.getElementById('modalArrearStatus').value;
  const semGroup = document.getElementById('modalClearedSemGroup');
  const gradeGroup = document.getElementById('modalClearedGradeGroup');
  const isCleared = status === 'Cleared';
  semGroup.style.display = isCleared ? 'block' : 'none';
  gradeGroup.style.display = isCleared ? 'block' : 'none';
}

function saveArrearFromModal() {
  const occurredSem = parseInt(document.getElementById('modalArrearOccurredSem').value, 10);
  const subCode = document.getElementById('modalArrearSubCode').value.trim().toUpperCase();
  const subName = document.getElementById('modalArrearSubName').value.trim();
  const attempts = parseInt(document.getElementById('modalArrearAttempts').value, 10) || 1;
  const status = document.getElementById('modalArrearStatus').value;
  const clearedSem = document.getElementById('modalArrearClearedSem').value ? parseInt(document.getElementById('modalArrearClearedSem').value, 10) : null;
  const clearedGrade = document.getElementById('modalArrearClearedGrade').value.trim().toUpperCase();
  const reason = document.getElementById('modalArrearReason').value.trim();
  const remedial = document.getElementById('modalArrearRemedial').value;
  const mentorSupport = document.getElementById('modalArrearMentorSupport').value;

  if (!subCode || !subName) {
    showToast('Subject Code and Subject Name are required for arrear documentation.', 'warning');
    return;
  }

  const record = {
    semesterOccurred: occurredSem,
    subjectCode: subCode,
    subjectName: subName,
    attempts,
    status,
    clearedSemester: clearedSem,
    clearedGrade,
    reason,
    remedialRequired: remedial,
    mentorSupportRequired: mentorSupport,
  };

  if (editingArrearIndex >= 0) {
    arrearRecords[editingArrearIndex] = record;
  } else {
    arrearRecords.push(record);
  }

  renderArrearTable();

  const modalEl = document.getElementById('arrearModal');
  const modal = bootstrap.Modal.getInstance(modalEl);
  if (modal) modal.hide();
}

function removeArrear(index) {
  if (confirm('Are you sure you want to remove this arrear entry?')) {
    arrearRecords.splice(index, 1);
    renderArrearTable();
  }
}

function renderArrearTable() {
  const tbody = document.getElementById('arrearRecordsTableBody');
  if (!tbody) return;

  if (arrearRecords.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center py-4 text-muted">
          <i class="bi bi-check2-circle text-success fs-4 d-block mb-1"></i>
          No arrears recorded. Click <strong>"Add Arrear Record"</strong> to document arrears.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = arrearRecords
    .map(
      (a, idx) => `
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
        <td>${a.status === 'Cleared' ? `Sem ${a.clearedSemester || 'N/A'} (Grade: ${a.clearedGrade || 'Pass'})` : 'Pending'}</td>
        <td><span class="badge ${a.remedialRequired === 'Yes' ? 'bg-warning text-dark' : 'bg-light text-muted'}">${a.remedialRequired}</span></td>
        <td><span class="badge ${a.mentorSupportRequired === 'Yes' ? 'bg-primary' : 'bg-light text-muted'}">${a.mentorSupportRequired}</span></td>
        <td class="text-end text-nowrap">
          <button type="button" class="btn btn-sm btn-outline-secondary py-0 px-2" onclick="showAddArrearModal(${idx})">Edit</button>
          <button type="button" class="btn btn-sm btn-outline-danger py-0 px-2" onclick="removeArrear(${idx})">Delete</button>
        </td>
      </tr>`
    )
    .join('');
}

// ---------------------------------------------------------------------------
// Dynamic Projects, Certifications, and Internships Rows
// ---------------------------------------------------------------------------

function addProjectRow(data = {}) {
  const container = document.getElementById('projectsContainer');
  const index = projectRecords.length;
  const projectHtml = `
    <div class="card p-3 mb-2 bg-light border project-row-card" data-idx="${index}">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <span class="fw-bold small text-primary"><i class="bi bi-folder-fill me-1"></i> Project Record</span>
        <button type="button" class="btn btn-sm text-danger py-0" onclick="this.closest('.project-row-card').remove()">
          <i class="bi bi-trash"></i> Remove
        </button>
      </div>
      <div class="row g-2">
        <div class="col-md-5">
          <input type="text" class="form-control form-control-sm project-title" placeholder="Project Title" value="${data.title || ''}">
        </div>
        <div class="col-md-4">
          <input type="text" class="form-control form-control-sm project-tech" placeholder="Technologies (e.g. Node, React)" value="${(data.technologies || []).join(', ')}">
        </div>
        <div class="col-md-3">
          <select class="form-select form-select-sm project-status">
            <option value="Completed" ${data.projectStatus === 'Completed' ? 'selected' : ''}>Completed</option>
            <option value="In Progress" ${data.projectStatus === 'In Progress' ? 'selected' : ''}>In Progress</option>
          </select>
        </div>
        <div class="col-md-6">
          <input type="text" class="form-control form-control-sm project-desc" placeholder="Brief project description" value="${data.description || ''}">
        </div>
        <div class="col-md-6">
          <input type="url" class="form-control form-control-sm project-github" placeholder="GitHub link" value="${data.githubLink || ''}">
        </div>
      </div>
    </div>`;
  container.insertAdjacentHTML('beforeend', projectHtml);
}

function addCertRow(data = {}) {
  const container = document.getElementById('certsContainer');
  const certHtml = `
    <div class="card p-3 mb-2 bg-light border cert-row-card">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <span class="fw-bold small text-success"><i class="bi bi-award-fill me-1"></i> Certification Record</span>
        <button type="button" class="btn btn-sm text-danger py-0" onclick="this.closest('.cert-row-card').remove()">
          <i class="bi bi-trash"></i> Remove
        </button>
      </div>
      <div class="row g-2">
        <div class="col-md-4">
          <input type="text" class="form-control form-control-sm cert-name" placeholder="Certificate Name" value="${data.name || ''}">
        </div>
        <div class="col-md-3">
          <input type="text" class="form-control form-control-sm cert-org" placeholder="Issuing Organization" value="${data.issuingOrg || ''}">
        </div>
        <div class="col-md-2">
          <input type="date" class="form-control form-control-sm cert-date" value="${data.completionDate ? data.completionDate.split('T')[0] : ''}">
        </div>
        <div class="col-md-3">
          <input type="url" class="form-control form-control-sm cert-link" placeholder="Verification URL" value="${data.certificateLink || ''}">
        </div>
      </div>
    </div>`;
  container.insertAdjacentHTML('beforeend', certHtml);
}

function addInternshipRow(data = {}) {
  const container = document.getElementById('internshipsContainer');
  const internHtml = `
    <div class="card p-3 mb-2 bg-light border intern-row-card">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <span class="fw-bold small text-info"><i class="bi bi-briefcase-fill me-1"></i> Internship Experience</span>
        <button type="button" class="btn btn-sm text-danger py-0" onclick="this.closest('.intern-row-card').remove()">
          <i class="bi bi-trash"></i> Remove
        </button>
      </div>
      <div class="row g-2">
        <div class="col-md-4">
          <input type="text" class="form-control form-control-sm intern-company" placeholder="Company Name" value="${data.company || ''}">
        </div>
        <div class="col-md-4">
          <input type="text" class="form-control form-control-sm intern-role" placeholder="Role (e.g. SDE Intern)" value="${data.role || ''}">
        </div>
        <div class="col-md-4">
          <input type="text" class="form-control form-control-sm intern-duration" placeholder="Duration (e.g. 2 Months)" value="${data.duration || ''}">
        </div>
        <div class="col-12">
          <input type="text" class="form-control form-control-sm intern-desc" placeholder="Description of work and technologies used" value="${data.description || ''}">
        </div>
      </div>
    </div>`;
  container.insertAdjacentHTML('beforeend', internHtml);
}

// ---------------------------------------------------------------------------
// Step 8 Review Summary
// ---------------------------------------------------------------------------

function renderReviewSummary() {
  const container = document.getElementById('reviewSummaryContent');
  const regNo = document.getElementById('pdRegisterNumber').value.trim();
  const name = document.getElementById('pdName').value.trim();
  const dept = document.getElementById('pdDepartment').value;
  const sec = document.getElementById('pdSection').value.trim();
  const cat = document.getElementById('pdCategory').value;
  const primaryGoal = document.querySelector('input[name="careerGoalChoice"]:checked').value;

  const summaryHtml = `
    <div class="row g-3">
      <div class="col-md-6">
        <div class="card h-100 border">
          <div class="card-header bg-light fw-bold small text-uppercase">Student Identification</div>
          <div class="card-body">
            <div><strong>Register Number:</strong> ${regNo || 'N/A'}</div>
            <div><strong>Full Name:</strong> ${name || 'N/A'}</div>
            <div><strong>Department & Section:</strong> ${dept} - ${sec}</div>
            <div><strong>Category:</strong> ${cat}</div>
            <div><strong>Contact:</strong> ${document.getElementById('pdMobile').value} | ${document.getElementById('pdInstEmail').value}</div>
          </div>
        </div>
      </div>

      <div class="col-md-6">
        <div class="card h-100 border">
          <div class="card-header bg-light fw-bold small text-uppercase">Academic & Arrear Summary</div>
          <div class="card-body">
            <div><strong>Semesters Documented:</strong> ${semesterRecords.length} recorded</div>
            <div><strong>Total Arrears Logged:</strong> ${arrearRecords.length} (Pending: ${arrearRecords.filter((a) => a.status === 'Pending').length})</div>
            <div><strong>Primary Career Goal:</strong> <span class="badge bg-primary">${primaryGoal}</span></div>
            <div><strong>Technical Skills:</strong> ${document.getElementById('techSkills').value || 'None listed'}</div>
          </div>
        </div>
      </div>
    </div>`;

  container.innerHTML = summaryHtml;
}

// ---------------------------------------------------------------------------
// Form Submission (Add / Update)
// ---------------------------------------------------------------------------

async function submitStudentForm(directSave = true) {
  const consentChecked = document.getElementById('profilingConsent').checked;
  if (!consentChecked) {
    showToast('You must confirm the mandatory academic mentoring consent checkbox before saving.', 'danger');
    return;
  }

  // Gather projects
  const projects = [];
  document.querySelectorAll('.project-row-card').forEach((card) => {
    const title = card.querySelector('.project-title').value.trim();
    if (title) {
      projects.push({
        title,
        technologies: card.querySelector('.project-tech').value.split(',').map((t) => t.trim()).filter(Boolean),
        projectStatus: card.querySelector('.project-status').value,
        description: card.querySelector('.project-desc').value.trim(),
        githubLink: card.querySelector('.project-github').value.trim(),
      });
    }
  });

  // Gather certs
  const certs = [];
  document.querySelectorAll('.cert-row-card').forEach((card) => {
    const name = card.querySelector('.cert-name').value.trim();
    if (name) {
      certs.push({
        name,
        issuingOrg: card.querySelector('.cert-org').value.trim(),
        completionDate: card.querySelector('.cert-date').value || null,
        certificateLink: card.querySelector('.cert-link').value.trim(),
      });
    }
  });

  // Gather internships
  const internships = [];
  document.querySelectorAll('.intern-row-card').forEach((card) => {
    const company = card.querySelector('.intern-company').value.trim();
    if (company) {
      internships.push({
        company,
        role: card.querySelector('.intern-role').value.trim(),
        duration: card.querySelector('.intern-duration').value.trim(),
        description: card.querySelector('.intern-desc').value.trim(),
      });
    }
  });

  const primaryGoal = document.querySelector('input[name="careerGoalChoice"]:checked').value;

  const payload = {
    personalDetails: {
      registerNumber: document.getElementById('pdRegisterNumber').value.trim().toUpperCase(),
      name: document.getElementById('pdName').value.trim(),
      dob: document.getElementById('pdDob').value,
      gender: document.getElementById('pdGender').value,
      department: document.getElementById('pdDepartment').value,
      section: document.getElementById('pdSection').value.trim().toUpperCase(),
      institutionalEmail: document.getElementById('pdInstEmail').value.trim().toLowerCase(),
      personalEmail: document.getElementById('pdPersonalEmail').value.trim().toLowerCase(),
      mobile: document.getElementById('pdMobile').value.trim(),
      residentialAddress: document.getElementById('pdAddress').value.trim(),
      category: document.getElementById('pdCategory').value,
      hostelName: document.getElementById('pdHostelName').value.trim(),
      distanceFromCollege: parseFloat(document.getElementById('pdDistance').value) || 0,
    },

    familyDetails: {
      father: {
        name: document.getElementById('fdFatherName').value.trim(),
        occupation: document.getElementById('fdFatherOcc').value.trim(),
        incomeRange: document.getElementById('fdFatherIncome').value,
        mobile: document.getElementById('fdFatherMobile').value.trim(),
      },
      mother: {
        name: document.getElementById('fdMotherName').value.trim(),
        occupation: document.getElementById('fdMotherOcc').value.trim(),
        incomeRange: document.getElementById('fdMotherIncome').value,
        mobile: document.getElementById('fdMotherMobile').value.trim(),
      },
      guardianName: document.getElementById('fdGuardianName').value.trim(),
      emergencyContact: document.getElementById('fdEmergency').value.trim(),
      firstGenGraduate: document.getElementById('fdFirstGen').value,
      scholarshipReceived: document.getElementById('fdScholarship').value,
      guidanceRequired: document.getElementById('fdGuidance').value,
    },

    semesters: semesterRecords,
    arrears: arrearRecords,

    technicalProfile: {
      programmingLanguages: document.getElementById('techLanguages').value.split(',').map((l) => l.trim()).filter(Boolean),
      technicalSkills: document.getElementById('techSkills').value.split(',').map((s) => s.trim()).filter(Boolean),
      preferredDomain: document.getElementById('techPreferredDomain').value,
      areasOfInterest: document.getElementById('techInterests').value.split(',').map((i) => i.trim()).filter(Boolean),
      certifications: certs,
      projects,
      internships,
      profileLinks: {
        github: document.getElementById('linkGithub').value.trim(),
        linkedin: document.getElementById('linkLinkedin').value.trim(),
        hackerrank: document.getElementById('linkHackerrank').value.trim(),
        hackerearth: document.getElementById('linkHackerearth').value.trim(),
      },
      communicationLevel: document.getElementById('techCommLevel').value,
      aptitudeLevel: document.getElementById('techAptLevel').value,
    },

    selfEvaluation: {
      academicStrengths: document.getElementById('seAcademicStrengths').value.split('\n').map((s) => s.trim()).filter(Boolean),
      technicalStrengths: document.getElementById('seTechnicalStrengths').value.split('\n').map((s) => s.trim()).filter(Boolean),
      communicationStrengths: [document.getElementById('seCommStrengths').value.trim()].filter(Boolean),
      leadershipQualities: [document.getElementById('seLeadership').value.trim()].filter(Boolean),
      teamworkAbilities: [document.getElementById('seTeamwork').value.trim()].filter(Boolean),
      improvementAreas: document.getElementById('seImprovementAreas').value.split('\n').map((s) => s.trim()).filter(Boolean),
      subjectsNeedSupport: document.getElementById('seSubjectsSupport').value.split('\n').map((s) => s.trim()).filter(Boolean),
      techSkillsToDevelop: [document.getElementById('seTechToDevelop').value.trim()].filter(Boolean),
      commSkillsToImprove: [document.getElementById('seCommToImprove').value.trim()].filter(Boolean),
      aptitudeSkillsToImprove: [document.getElementById('seAptToImprove').value.trim()].filter(Boolean),
      mentorSupportExpected: document.getElementById('seMentorExpected').value.trim(),
      shortTermGoal: document.getElementById('seShortTermGoal').value.trim(),
      longTermGoal: document.getElementById('seLongTermGoal').value.trim(),
    },

    careerGoal: {
      primaryGoal,
      placement: {
        preferredRole: document.getElementById('cgPlacementRole').value.trim(),
        preferredDomain: document.getElementById('cgPlacementDomain').value.trim(),
        companyType: document.getElementById('cgPlacementCompanyType').value,
        expectedSalary: document.getElementById('cgPlacementSalary').value.trim(),
        preferredLocation: document.getElementById('cgPlacementLocation').value.trim(),
        targetCompanies: document.getElementById('cgPlacementCompanies').value.split(',').map((c) => c.trim()).filter(Boolean),
        trainingSupport: document.getElementById('cgPlacementTraining').value.trim(),
        skillsToImprove: document.getElementById('cgPlacementSkills').value.split(',').map((s) => s.trim()).filter(Boolean),
      },
      higherStudies: {
        preferredProgramme: document.getElementById('cgHsProgramme').value.trim(),
        specialization: document.getElementById('cgHsSpecialization').value.trim(),
        preferredCountry: document.getElementById('cgHsCountry').value.trim(),
        targetInstitutions: document.getElementById('cgHsInstitutions').value.split(',').map((i) => i.trim()).filter(Boolean),
        plannedExams: document.getElementById('cgHsExams').value.split(',').map((e) => e.trim()).filter(Boolean),
        admissionYear: parseInt(document.getElementById('cgHsYear').value, 10) || null,
        guidanceRequired: document.getElementById('cgHsGuidance').value.trim(),
      },
      entrepreneurship: {
        startupIdea: document.getElementById('cgEntIdea').value.trim(),
        currentStage: document.getElementById('cgEntStage').value,
        problemAddressed: document.getElementById('cgEntProblem').value.trim(),
        proposedSolution: document.getElementById('cgEntSolution').value.trim(),
        targetCustomers: document.getElementById('cgEntCustomers').value.trim(),
        teamDetails: document.getElementById('cgEntTeam').value.trim(),
        techSupport: document.getElementById('cgEntTechSupport').value.trim(),
        fundingSupport: document.getElementById('cgEntFunding').value.trim(),
        expectedLaunchYear: parseInt(document.getElementById('cgEntYear').value, 10) || null,
      },
    },

    consent: consentChecked,
  };

  const btnSubmit = document.getElementById('btnSubmit');
  const btnSubmitReview = document.getElementById('btnSubmitReview');
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Saving...';
  }
  if (btnSubmitReview) btnSubmitReview.disabled = true;

  try {
    const isDirect = isEditMode || directSave;
    const endpoint = isEditMode ? `/students/${studentId}` : isDirect ? '/students' : '/student-applications';
    const method = isEditMode ? 'PUT' : 'POST';

    const res = await apiCall(endpoint, {
      method,
      body: isEditMode ? { ...payload, version: studentVersion } : payload,
    });

    if (res.success) {
      showToast(
        isEditMode
          ? 'Student profile updated successfully in database!'
          : isDirect
          ? 'Student profile created and saved directly to database!'
          : 'Student application submitted! Mentors have been notified.',
        'success'
      );
      const targetId = isEditMode ? studentId : res.data?._id;
      setTimeout(() => {
        if (isEditMode) {
          window.location.href = `student-profile.html?id=${targetId}`;
        } else if (isDirect) {
          window.location.href = 'students.html';
        } else if (normalizeClientRole(getCurrentUser()?.role) === 'STUDENT') {
          window.location.href = 'student-dashboard.html';
        } else {
          window.location.href = 'student-applications.html';
        }
      }, 1000);
    }
  } catch (err) {
    showToast(`Submission failed: ${err.message}`, 'danger');
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = `<i class="bi bi-cloud-check-fill me-1"></i> ${isEditMode ? 'Update Student Profile' : 'Save Directly to Database'}`;
    }
    if (btnSubmitReview) btnSubmitReview.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Pre-populate Data in Edit Mode
// ---------------------------------------------------------------------------

async function loadStudentDataForEdit(id) {
  try {
    const res = await apiCall(`/students/${id}`);
    if (!res.success || !res.data) throw new Error('Student data not found');

    const s = res.data.student;
    studentVersion = s.__v;
    const pd = s.personalDetails || {};
    const fd = s.familyDetails || {};
    const tech = s.technicalProfile || {};
    const se = s.selfEvaluation || {};
    const cg = s.careerGoal || {};

    // 1. Personal
    document.getElementById('pdRegisterNumber').value = pd.registerNumber || '';
    document.getElementById('pdName').value = pd.name || '';
    if (pd.dob) document.getElementById('pdDob').value = pd.dob.split('T')[0];
    document.getElementById('pdGender').value = pd.gender || '';
    document.getElementById('pdDepartment').value = pd.department || '';
    document.getElementById('pdSection').value = pd.section || '';
    document.getElementById('pdInstEmail').value = pd.institutionalEmail || '';
    document.getElementById('pdPersonalEmail').value = pd.personalEmail || '';
    document.getElementById('pdMobile').value = pd.mobile || '';
    document.getElementById('pdAddress').value = pd.residentialAddress || '';
    document.getElementById('pdCategory').value = pd.category || '';
    handleCategoryChange();
    document.getElementById('pdHostelName').value = pd.hostelName || '';
    document.getElementById('pdDistance').value = pd.distanceFromCollege || 0;

    // 2. Family
    if (fd.father) {
      document.getElementById('fdFatherName').value = fd.father.name || '';
      document.getElementById('fdFatherOcc').value = fd.father.occupation || '';
      document.getElementById('fdFatherIncome').value = fd.father.incomeRange || '';
      document.getElementById('fdFatherMobile').value = fd.father.mobile || '';
    }
    if (fd.mother) {
      document.getElementById('fdMotherName').value = fd.mother.name || '';
      document.getElementById('fdMotherOcc').value = fd.mother.occupation || '';
      document.getElementById('fdMotherIncome').value = fd.mother.incomeRange || '';
      document.getElementById('fdMotherMobile').value = fd.mother.mobile || '';
    }
    document.getElementById('fdGuardianName').value = fd.guardianName || '';
    document.getElementById('fdEmergency').value = fd.emergencyContact || '';
    document.getElementById('fdFirstGen').value = fd.firstGenGraduate || 'No';
    document.getElementById('fdScholarship').value = fd.scholarshipReceived || 'No';
    document.getElementById('fdGuidance').value = fd.guidanceRequired || 'No';

    // 3. Semesters & Arrears
    semesterRecords = [...(s.semesters || [])];
    arrearRecords = [...(s.arrears || [])];
    renderSemesterTable();
    renderArrearTable();

    // 4. Tech
    document.getElementById('techLanguages').value = (tech.programmingLanguages || []).join(', ');
    document.getElementById('techSkills').value = (tech.technicalSkills || []).join(', ');
    document.getElementById('techPreferredDomain').value = tech.preferredDomain || 'Web Development';
    document.getElementById('techInterests').value = (tech.areasOfInterest || []).join(', ');
    document.getElementById('techCommLevel').value = tech.communicationLevel || 'Intermediate';
    document.getElementById('techAptLevel').value = tech.aptitudeLevel || 'Intermediate';

    if (tech.profileLinks) {
      document.getElementById('linkGithub').value = tech.profileLinks.github || '';
      document.getElementById('linkLinkedin').value = tech.profileLinks.linkedin || '';
      document.getElementById('linkHackerrank').value = tech.profileLinks.hackerrank || '';
      document.getElementById('linkHackerearth').value = tech.profileLinks.hackerearth || '';
    }

    (tech.projects || []).forEach((p) => addProjectRow(p));
    (tech.certifications || []).forEach((c) => addCertRow(c));
    (tech.internships || []).forEach((i) => addInternshipRow(i));

    // 5. Self-Evaluation
    document.getElementById('seAcademicStrengths').value = (se.academicStrengths || []).join('\n');
    document.getElementById('seTechnicalStrengths').value = (se.technicalStrengths || []).join('\n');
    document.getElementById('seCommStrengths').value = (se.communicationStrengths || []).join(', ');
    document.getElementById('seLeadership').value = (se.leadershipQualities || []).join(', ');
    document.getElementById('seTeamwork').value = (se.teamworkAbilities || []).join(', ');
    document.getElementById('seImprovementAreas').value = (se.improvementAreas || []).join('\n');
    document.getElementById('seSubjectsSupport').value = (se.subjectsNeedSupport || []).join('\n');
    document.getElementById('seTechToDevelop').value = (se.techSkillsToDevelop || []).join(', ');
    document.getElementById('seCommToImprove').value = (se.commSkillsToImprove || []).join(', ');
    document.getElementById('seAptToImprove').value = (se.aptitudeSkillsToImprove || []).join(', ');
    document.getElementById('seMentorExpected').value = se.mentorSupportExpected || '';
    document.getElementById('seShortTermGoal').value = se.shortTermGoal || '';
    document.getElementById('seLongTermGoal').value = se.longTermGoal || '';

    // 6. Career Goal
    const goalChoice = cg.primaryGoal || 'Placement';
    const radioEl = document.querySelector(`input[name="careerGoalChoice"][value="${goalChoice}"]`);
    if (radioEl) radioEl.checked = true;
    handleGoalChange();

    if (cg.placement) {
      document.getElementById('cgPlacementRole').value = cg.placement.preferredRole || '';
      document.getElementById('cgPlacementDomain').value = cg.placement.preferredDomain || '';
      document.getElementById('cgPlacementCompanyType').value = cg.placement.companyType || '';
      document.getElementById('cgPlacementSalary').value = cg.placement.expectedSalary || '';
      document.getElementById('cgPlacementLocation').value = cg.placement.preferredLocation || '';
      document.getElementById('cgPlacementCompanies').value = (cg.placement.targetCompanies || []).join(', ');
      document.getElementById('cgPlacementTraining').value = cg.placement.trainingSupport || '';
      document.getElementById('cgPlacementSkills').value = (cg.placement.skillsToImprove || []).join(', ');
    }

    if (cg.higherStudies) {
      document.getElementById('cgHsProgramme').value = cg.higherStudies.preferredProgramme || '';
      document.getElementById('cgHsSpecialization').value = cg.higherStudies.specialization || '';
      document.getElementById('cgHsCountry').value = cg.higherStudies.preferredCountry || '';
      document.getElementById('cgHsInstitutions').value = (cg.higherStudies.targetInstitutions || []).join(', ');
      document.getElementById('cgHsExams').value = (cg.higherStudies.plannedExams || []).join(', ');
      document.getElementById('cgHsYear').value = cg.higherStudies.admissionYear || '';
      document.getElementById('cgHsGuidance').value = cg.higherStudies.guidanceRequired || '';
    }

    if (cg.entrepreneurship) {
      document.getElementById('cgEntIdea').value = cg.entrepreneurship.startupIdea || '';
      document.getElementById('cgEntStage').value = cg.entrepreneurship.currentStage || 'Idea';
      document.getElementById('cgEntProblem').value = cg.entrepreneurship.problemAddressed || '';
      document.getElementById('cgEntSolution').value = cg.entrepreneurship.proposedSolution || '';
      document.getElementById('cgEntCustomers').value = cg.entrepreneurship.targetCustomers || '';
      document.getElementById('cgEntTeam').value = cg.entrepreneurship.teamDetails || '';
      document.getElementById('cgEntTechSupport').value = cg.entrepreneurship.techSupport || '';
      document.getElementById('cgEntFunding').value = cg.entrepreneurship.fundingSupport || '';
      document.getElementById('cgEntYear').value = cg.entrepreneurship.expectedLaunchYear || '';
    }
  } catch (err) {
    showToast(`Failed to load student for editing: ${err.message}`, 'danger');
  }
}
