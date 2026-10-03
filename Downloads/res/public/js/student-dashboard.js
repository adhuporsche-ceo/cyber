let myStudentData = null;
let resumeModal = null;
let offerModal = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!checkAuth()) return;
  initLayout('student-dashboard');

  resumeModal = new bootstrap.Modal(document.getElementById('resumeModal'));
  offerModal = new bootstrap.Modal(document.getElementById('offerModal'));

  await Promise.all([loadStudentPlacementCockpit(), loadMyProfileApplication()]);
});

window.reloadPlacementData = async function () {
  await loadStudentPlacementCockpit(true);
};

async function loadStudentPlacementCockpit(silent = false) {
  try {
    const user = getCurrentUser();
    const regNum = user?.registerNumber || '710021104001';

    const res = await apiCall(`/student/overview?registerNumber=${regNum}`);
    if (!res.success) throw new Error(res.message || 'Failed to load cockpit');

    myStudentData = res.data;
    const kpis = myStudentData.kpis || {};

    // KPIs
    document.getElementById('kpiStudentApplied').textContent = kpis.appliedCount || 0;
    document.getElementById('kpiStudentShortlisted').textContent = kpis.shortlistedCount || 0;
    document.getElementById('kpiStudentOffers').textContent = kpis.offerReleasedCount || 0;
    document.getElementById('myAppsCount').textContent = `${myStudentData.applications?.length || 0} Active`;

    // Check for any upcoming interview
    const upcomingInterviewApp = (myStudentData.applications || []).find((a) => a.interviewSchedule && a.interviewSchedule.date);
    const alertBox = document.getElementById('activeInterviewAlert');
    if (upcomingInterviewApp && alertBox) {
      const sch = upcomingInterviewApp.interviewSchedule;
      document.getElementById('interviewAlertTitle').textContent = `Interview Round Confirmed: ${upcomingInterviewApp.companyName} (${upcomingInterviewApp.role})`;
      document.getElementById('interviewAlertDetails').textContent = `Slot: ${sch.time || '10:00 AM'} | Venue: ${sch.venue || 'Campus Placement Hall'}. Instructions: ${sch.instructions || 'Carry 2 copies of your resume.'}`;
      const meetBtn = document.getElementById('interviewMeetingBtn');
      if (sch.meetingLink) {
        meetBtn.href = sch.meetingLink;
        meetBtn.classList.remove('d-none');
      } else {
        meetBtn.classList.add('d-none');
      }
      alertBox.classList.remove('d-none');
    } else if (alertBox) {
      alertBox.classList.add('d-none');
    }

    renderApplicationsList(myStudentData.applications || []);
    renderOpenOpportunities(myStudentData.availableCompanies || []);
  } catch (err) {
    if (!silent) showToast(`Failed to load cockpit: ${err.message}`, 'danger');
  }
}

const escapeProfileValue = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[character]));

const formatProfileLabel = (value) => escapeProfileValue(String(value)
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .replace(/[_-]+/g, ' ')
  .replace(/^./, (character) => character.toUpperCase()));

const renderProfileValue = (value) => {
  if (value === null || value === undefined || value === '') return '<span class="text-muted">Not provided</span>';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    if (!value.length) return '<span class="text-muted">None</span>';
    return `<ul class="mb-0 ps-3">${value.map((item) => `<li>${renderProfileValue(item)}</li>`).join('')}</ul>`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value);
    if (!entries.length) return '<span class="text-muted">Not provided</span>';
    return `<dl class="row mb-0">${entries.map(([key, entry]) => `
      <dt class="col-sm-4 fw-semibold">${formatProfileLabel(key)}</dt>
      <dd class="col-sm-8">${renderProfileValue(entry)}</dd>`).join('')}
    </dl>`;
  }
  return escapeProfileValue(value);
};

async function loadMyProfileApplication() {
  const content = document.getElementById('myProfileApplicationContent');
  const statusBadge = document.getElementById('myProfileApplicationStatus');
  if (!content || !statusBadge) return;

  try {
    const result = await apiCall('/student-applications/mine');
    const record = result.data;
    if (!record) {
      statusBadge.textContent = 'Not submitted';
      content.innerHTML = '<p class="text-muted mb-2">You have not submitted a student profile application yet.</p><a class="btn btn-primary btn-sm" href="add-student.html"><i class="bi bi-file-earmark-plus me-1"></i> Complete profile application</a>';
      return;
    }

    const statusLabels = {
      PENDING: 'Awaiting review',
      APPROVED: 'Approved',
      REJECTED: 'Needs changes',
    };
    statusBadge.textContent = statusLabels[record.status] || record.status;
    statusBadge.className = `badge ${record.status === 'APPROVED' ? 'bg-success-subtle text-success-emphasis' : record.status === 'REJECTED' ? 'bg-danger-subtle text-danger-emphasis' : 'bg-primary-subtle text-primary-emphasis'}`;

    const submittedAt = record.submittedAt ? new Date(record.submittedAt).toLocaleString() : 'Unknown';
    const profile = record.application || {};
    const sections = Object.entries(profile).map(([key, value]) => `
      <details class="border rounded p-3 mb-2">
        <summary class="fw-semibold">${formatProfileLabel(key)}</summary>
        <div class="mt-3">${renderProfileValue(value)}</div>
      </details>`).join('');
    const profileLink = record.status === 'APPROVED' && record.studentId
      ? `<a class="btn btn-primary btn-sm mt-3" href="student-profile.html?id=${encodeURIComponent(record.studentId)}"><i class="bi bi-person-lines-fill me-1"></i> View approved profile</a>`
      : '';

    content.innerHTML = `
      <div class="small text-muted mb-3">Submitted ${escapeProfileValue(submittedAt)}</div>
      <details>
        <summary class="text-primary fw-semibold">View complete submitted application</summary>
        <div class="mt-3">${sections}</div>
      </details>
      ${profileLink}`;
  } catch (error) {
    content.innerHTML = `<p class="text-danger mb-0">Could not load your profile application: ${escapeProfileValue(error.message)}</p>`;
  }
}

// ---------------------------------------------------------------------------
// Render Candidate Applications with Live Round Pipeline
// ---------------------------------------------------------------------------

function renderApplicationsList(applications) {
  const container = document.getElementById('studentAppsContainer');
  if (!applications || applications.length === 0) {
    container.innerHTML = `
      <div class="text-center py-5">
        <i class="bi bi-briefcase text-muted fs-1 mb-2"></i>
        <div class="fw-semibold">No active applications yet.</div>
        <p class="text-muted small">Browse the open partner companies below and submit your application with 1-click!</p>
      </div>`;
    return;
  }

  container.innerHTML = applications
    .map((app) => {
      const statusBadge = getAppStatusBadge(app.status);
      const isOffer = app.status === 'Offer Released';
      const offerPkg = app.offerDetails?.package || app.package || '';
      const offerUrl = app.offerDetails?.offerLetterUrl || '#';

      return `
        <div class="card border rounded-3 p-3 mb-3 shadow-sm ${isOffer ? 'border-success bg-success-subtle bg-opacity-10' : ''}">
          <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
            <div>
              <h5 class="fw-bold text-dark mb-0">${app.companyName}</h5>
              <div class="small text-muted">${app.role} · <span class="fw-semibold text-primary">${app.package || 'Competitive'}</span></div>
            </div>
            <div class="d-flex align-items-center gap-2">
              ${statusBadge}
              ${
                isOffer
                  ? `<button class="btn btn-sm btn-success" onclick="openOfferModal('${app.companyName}', '${app.role}', '${offerPkg}', '${offerUrl}')">
                      <i class="bi bi-gift-fill me-1"></i> View Offer Letter
                    </button>`
                  : ''
              }
            </div>
          </div>

          <!-- Round Timeline Progress Bar -->
          <div class="my-2 py-1">
            ${getPipelineProgressHtml(app.status)}
          </div>

          <!-- Recent Round Feedback / Interview notes -->
          ${
            app.interviewSchedule
              ? `<div class="p-2.5 bg-light rounded small mt-2 d-flex align-items-center justify-content-between">
                  <div>
                    <i class="bi bi-calendar2-event text-primary me-1"></i>
                    <strong>Next Round Slot:</strong> ${app.interviewSchedule.time || '10:00 AM'} · ${app.interviewSchedule.venue || 'Online'}
                  </div>
                  ${app.interviewSchedule.meetingLink ? `<a href="${app.interviewSchedule.meetingLink}" target="_blank" class="btn btn-xs btn-outline-primary py-0 px-2">Join Meeting</a>` : ''}
                </div>`
              : ''
          }
        </div>
      `;
    })
    .join('');
}

function getPipelineProgressHtml(currentStatus) {
  const steps = ['Applied', 'Shortlisted', 'Aptitude Round', 'Technical Round', 'HR Round', 'Offer Released'];
  const stepIdx = steps.indexOf(currentStatus);
  const activeIndex = stepIdx >= 0 ? stepIdx : currentStatus === 'Selected' ? 4 : currentStatus === 'Rejected' ? -1 : 0;

  return `
    <div class="d-flex align-items-center justify-content-between position-relative px-2">
      ${steps
        .map((step, idx) => {
          const isPassed = activeIndex >= idx;
          const isCurrent = activeIndex === idx;
          return `
            <div class="text-center" style="z-index: 2; width: 80px;">
              <div class="rounded-circle d-inline-grid place-items-center border ${
                isCurrent
                  ? 'bg-primary text-white border-primary fw-bold shadow-sm'
                  : isPassed
                  ? 'bg-success text-white border-success'
                  : 'bg-white text-muted border-secondary-subtle'
              }" style="width: 26px; height: 26px; font-size: 11px;">
                ${isPassed ? '<i class="bi bi-check"></i>' : idx + 1}
              </div>
              <div class="small fw-semibold mt-1 text-truncate" style="font-size: 10px; color: ${isCurrent ? '#244fe0' : isPassed ? '#4d7de2' : '#94a3b8'};">
                ${step}
              </div>
            </div>
          `;
        })
        .join('')}
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Render Open Campus Placement Drives (1-Click Apply)
// ---------------------------------------------------------------------------

function renderOpenOpportunities(companies) {
  const container = document.getElementById('openCompaniesContainer');
  if (!companies || companies.length === 0) {
    container.innerHTML = `
      <div class="text-center py-4 text-muted">
        <i class="bi bi-check2-all fs-2 text-success mb-1"></i>
        <div>You have applied for all currently open campus drives!</div>
      </div>`;
    return;
  }

  container.innerHTML = companies
    .map((c) => {
      const id = c._id || c.id;
      const skills = (c.requiredSkills || []).slice(0, 4).map((s) => `<span class="badge bg-light text-dark border me-1">${s}</span>`).join('');
      const driveDateStr = c.driveDate ? formatDate(c.driveDate) : 'TBA';

      return `
        <div class="d-flex align-items-center justify-content-between p-3 border-bottom flex-wrap gap-2">
          <div>
            <div class="d-flex align-items-center gap-2">
              <h6 class="fw-bold text-dark mb-0">${c.name}</h6>
              <span class="badge bg-success-subtle text-success border border-success-subtle">${c.package}</span>
            </div>
            <div class="small text-primary fw-semibold">${c.role} · <span class="text-muted"><i class="bi bi-geo-alt"></i> ${c.location || 'Chennai'}</span></div>
            <div class="small text-muted mt-1">Min CGPA: ${c.eligibilityCgpa || 6.5}+ · Drive: ${driveDateStr}</div>
            <div class="mt-1">${skills}</div>
          </div>
          <button class="btn btn-sm btn-primary px-3" onclick="applyToCompany('${id}', '${c.name}', '${c.role}', '${c.package}')">
            <i class="bi bi-send-fill me-1"></i> 1-Click Apply
          </button>
        </div>
      `;
    })
    .join('');
}

async function applyToCompany(companyId, companyName, role, pkg) {
  const user = getCurrentUser();
  const regNum = user?.registerNumber || '710021104001';

  try {
    const res = await apiCall('/applications', {
      method: 'POST',
      body: {
        companyId,
        studentRegisterNumber: regNum,
        studentName: user?.name || 'Aarav Sundaram',
        studentEmail: user?.email || 'aarav.s21@college.edu',
        studentDepartment: user?.department || 'CSE',
        cgpa: 8.92,
        resumeUrl: document.getElementById('currentResumeLink')?.href || '',
      },
    });

    if (res.success) {
      showToast(`Applied for ${companyName} (${role})! Tracking is live.`, 'success');
      await loadStudentPlacementCockpit();
    }
  } catch (err) {
    showToast(`Application error: ${err.message}`, 'danger');
  }
}

// ---------------------------------------------------------------------------
// Resume & Offer Modals
// ---------------------------------------------------------------------------

function openResumeUpdateModal() {
  document.getElementById('modalResumeUrl').value = document.getElementById('currentResumeLink')?.href || '';
  resumeModal.show();
}

function saveResumeLink() {
  const url = document.getElementById('modalResumeUrl').value.trim();
  if (!url) {
    showToast('Please enter a valid resume link.', 'warning');
    return;
  }
  const linkEl = document.getElementById('currentResumeLink');
  if (linkEl) {
    linkEl.href = url;
    linkEl.textContent = url;
  }
  showToast('Placement resume updated and submitted to mentor for verification!', 'success');
  resumeModal.hide();
}

function openOfferModal(compName, role, pkg, offerUrl) {
  document.getElementById('offerCompanyTitle').textContent = compName;
  document.getElementById('offerRoleTitle').textContent = role;
  document.getElementById('offerPackageBadge').textContent = pkg;
  document.getElementById('offerDownloadBtn').href = offerUrl;
  offerModal.show();
}

function getAppStatusBadge(status) {
  switch (status) {
    case 'Applied':
      return '<span class="badge bg-light text-dark border">Applied</span>';
    case 'Shortlisted':
      return '<span class="badge bg-info text-dark"><i class="bi bi-person-check me-1"></i>Shortlisted</span>';
    case 'Aptitude Round':
      return '<span class="badge bg-warning text-dark"><i class="bi bi-pencil-square me-1"></i>Aptitude Round</span>';
    case 'Technical Round':
      return '<span class="badge bg-primary"><i class="bi bi-code-slash me-1"></i>Technical Round</span>';
    case 'HR Round':
      return '<span class="badge bg-primary-subtle text-primary border border-primary-subtle"><i class="bi bi-chat-dots me-1"></i>HR Round</span>';
    case 'Selected':
      return '<span class="badge bg-success"><i class="bi bi-check-circle-fill me-1"></i>Selected</span>';
    case 'Offer Released':
      return '<span class="badge bg-success-subtle text-success border border-success-subtle fw-bold"><i class="bi bi-gift-fill me-1"></i>Offer Released</span>';
    case 'Rejected':
      return '<span class="badge bg-danger"><i class="bi bi-x-circle me-1"></i>Rejected</span>';
    default:
      return `<span class="badge bg-secondary">${status}</span>`;
  }
}
