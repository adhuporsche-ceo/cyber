let allCompanies = [];
let allApplications = [];
let companyModal = null;
let statusModal = null;
let interviewModal = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!checkAuth()) return;
  initLayout('placement-crm');

  companyModal = new bootstrap.Modal(document.getElementById('companyModal'));
  statusModal = new bootstrap.Modal(document.getElementById('statusModal'));
  interviewModal = new bootstrap.Modal(document.getElementById('interviewModal'));

  await loadPlacementData();
});

// Exposed hook for real-time Socket.IO triggers from common.js
window.reloadPlacementData = async function () {
  await loadPlacementData(true);
};

async function loadPlacementData(silent = false) {
  try {
    const [compRes, appRes, statsRes] = await Promise.all([
      apiCall('/companies'),
      apiCall('/applications'),
      apiCall('/stats'),
    ]);

    allCompanies = compRes.data || [];
    allApplications = appRes.data || [];

    // Update KPIs
    const stats = statsRes.data?.kpis || {};
    document.getElementById('kpiTotalCompanies').textContent = stats.totalCompanies || allCompanies.length;
    document.getElementById('kpiActiveDrives').textContent = stats.activeDrives || 2;
    document.getElementById('kpiTotalApps').textContent = stats.totalApplications || allApplications.length;
    document.getElementById('kpiTotalOffers').textContent = stats.totalOffers || 0;

    document.getElementById('companiesCountBadge').textContent = allCompanies.length;
    document.getElementById('applicationsCountBadge').textContent = allApplications.length;

    // Populate company filter dropdown
    const compFilterSelect = document.getElementById('appCompanyFilter');
    if (compFilterSelect) {
      const currentVal = compFilterSelect.value;
      let opts = '<option value="all">All Companies</option>';
      allCompanies.forEach((c) => {
        opts += `<option value="${c._id || c.id}">${c.name}</option>`;
      });
      compFilterSelect.innerHTML = opts;
      if (currentVal) compFilterSelect.value = currentVal;
    }

    renderCompaniesTable();
    renderApplicationsTable();
    renderDrivesTable(statsRes.data?.recentDrives || []);
  } catch (err) {
    if (!silent) showToast(`Failed to load placement CRM data: ${err.message}`, 'danger');
  }
}

// ---------------------------------------------------------------------------
// Companies Table & Filtering
// ---------------------------------------------------------------------------

function renderCompaniesTable() {
  const tbody = document.getElementById('companiesTableBody');
  const search = (document.getElementById('companySearchInput')?.value || '').toLowerCase().trim();
  const status = document.getElementById('companyStatusFilter')?.value || 'all';

  let list = allCompanies;
  if (status !== 'all') {
    list = list.filter((c) => c.hiringStatus.toLowerCase() === status.toLowerCase());
  }
  if (search) {
    list = list.filter(
      (c) =>
        c.name.toLowerCase().includes(search) ||
        c.role.toLowerCase().includes(search) ||
        (c.requiredSkills && c.requiredSkills.some((s) => s.toLowerCase().includes(search)))
    );
  }

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">No hiring companies match the selected filter.</td></tr>';
    return;
  }

  tbody.innerHTML = list
    .map((c) => {
      const id = c._id || c.id;
      const statusBadge = getHiringStatusBadge(c.hiringStatus);
      const driveDateStr = c.driveDate ? formatDate(c.driveDate) : 'TBA';
      const skillsHtml = (c.requiredSkills || []).slice(0, 3).map((s) => `<span class="badge bg-light text-dark border me-1">${s}</span>`).join('');

      return `
        <tr>
          <td>
            <div class="fw-bold text-dark">${c.name}</div>
            <small class="text-muted"><i class="bi bi-geo-alt me-1"></i>${c.location || 'Chennai'}</small>
          </td>
          <td>
            <div class="fw-semibold text-primary">${c.role}</div>
            <span class="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">${c.package}</span>
          </td>
          <td>
            <div><small class="fw-semibold">Min CGPA:</small> ${c.eligibilityCgpa || 6.5}+</div>
            <div><small class="fw-semibold">Arrears:</small> Max ${c.eligibilityArrears ?? 0}</div>
          </td>
          <td>
            <div>${driveDateStr}</div>
            <div class="mt-1">${skillsHtml}</div>
          </td>
          <td>${statusBadge}</td>
          <td class="text-end">
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-secondary" onclick="editCompany('${id}')" title="Edit Company Details">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-outline-danger" onclick="deleteCompany('${id}', '${c.name}')" title="Delete Company">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
}

function filterCompanies() {
  renderCompaniesTable();
}

function getHiringStatusBadge(status) {
  switch (status) {
    case 'Open':
      return '<span class="badge bg-success"><i class="bi bi-check-circle me-1"></i>Open</span>';
    case 'Upcoming':
      return '<span class="badge bg-info text-dark"><i class="bi bi-clock me-1"></i>Upcoming</span>';
    case 'In Progress':
      return '<span class="badge bg-warning text-dark"><i class="bi bi-arrow-repeat me-1"></i>In Progress</span>';
    case 'Completed':
      return '<span class="badge bg-secondary"><i class="bi bi-check2-all me-1"></i>Completed</span>';
    default:
      return `<span class="badge bg-light text-dark border">${status}</span>`;
  }
}

// ---------------------------------------------------------------------------
// Company CRUD Operations
// ---------------------------------------------------------------------------

function openAddCompanyModal() {
  document.getElementById('companyForm').reset();
  document.getElementById('compEditId').value = '';
  document.getElementById('companyModalTitle').innerHTML = '<i class="bi bi-building me-2"></i> Add Hiring Company';
  companyModal.show();
}

function editCompany(id) {
  const comp = allCompanies.find((c) => (c._id || c.id) === id);
  if (!comp) return;

  document.getElementById('compEditId').value = id;
  document.getElementById('compName').value = comp.name || '';
  document.getElementById('compRole').value = comp.role || '';
  document.getElementById('compPackage').value = comp.package || '';
  document.getElementById('compLocation').value = comp.location || '';
  document.getElementById('compStatus').value = comp.hiringStatus || 'Open';
  document.getElementById('compCgpa').value = comp.eligibilityCgpa || 6.5;
  document.getElementById('compArrears').value = comp.eligibilityArrears ?? 0;
  document.getElementById('compDriveDate').value = comp.driveDate ? comp.driveDate.slice(0, 10) : '';
  document.getElementById('compHrName').value = comp.hrName || '';
  document.getElementById('compEmail').value = comp.email || '';
  document.getElementById('compSkills').value = (comp.requiredSkills || []).join(', ');
  document.getElementById('compDesc').value = comp.description || '';

  document.getElementById('companyModalTitle').innerHTML = '<i class="bi bi-pencil-square me-2"></i> Edit Company: ' + comp.name;
  companyModal.show();
}

async function saveCompany() {
  const editId = document.getElementById('compEditId').value;
  const name = document.getElementById('compName').value.trim();
  const role = document.getElementById('compRole').value.trim();
  const pkg = document.getElementById('compPackage').value.trim();

  if (!name || !role || !pkg) {
    showToast('Company name, role, and package are required.', 'warning');
    return;
  }

  const payload = {
    name,
    role,
    package: pkg,
    location: document.getElementById('compLocation').value.trim(),
    hiringStatus: document.getElementById('compStatus').value,
    eligibilityCgpa: parseFloat(document.getElementById('compCgpa').value) || 6.5,
    eligibilityArrears: parseInt(document.getElementById('compArrears').value, 10) || 0,
    driveDate: document.getElementById('compDriveDate').value || null,
    hrName: document.getElementById('compHrName').value.trim(),
    email: document.getElementById('compEmail').value.trim(),
    requiredSkills: document.getElementById('compSkills').value.split(',').map((s) => s.trim()).filter(Boolean),
    description: document.getElementById('compDesc').value.trim(),
  };

  try {
    const endpoint = editId ? `/companies/${editId}` : '/companies';
    const method = editId ? 'PUT' : 'POST';

    const res = await apiCall(endpoint, { method, body: payload });
    if (res.success) {
      showToast(editId ? 'Company updated successfully!' : 'New hiring company registered!', 'success');
      companyModal.hide();
      await loadPlacementData();
    }
  } catch (err) {
    showToast(`Save failed: ${err.message}`, 'danger');
  }
}

async function deleteCompany(id, name) {
  if (!confirm(`Are you sure you want to remove "${name}" from hiring companies?`)) return;

  try {
    const res = await apiCall(`/companies/${id}`, { method: 'DELETE' });
    if (res.success) {
      showToast(`Company "${name}" removed.`, 'success');
      await loadPlacementData();
    }
  } catch (err) {
    showToast(`Delete failed: ${err.message}`, 'danger');
  }
}

// ---------------------------------------------------------------------------
// Applications Pipeline & Management
// ---------------------------------------------------------------------------

function renderApplicationsTable() {
  const tbody = document.getElementById('applicationsTableBody');
  const compFilter = document.getElementById('appCompanyFilter')?.value || 'all';
  const statusFilter = document.getElementById('appStatusFilter')?.value || 'all';

  let list = allApplications;
  if (compFilter !== 'all') {
    list = list.filter((a) => String(a.companyId) === compFilter);
  }
  if (statusFilter !== 'all') {
    list = list.filter((a) => a.status.toLowerCase() === statusFilter.toLowerCase());
  }

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">No candidate applications found for the selected filter.</td></tr>';
    return;
  }

  tbody.innerHTML = list
    .map((a) => {
      const id = a._id || a.id;
      const statusBadge = getAppStatusBadge(a.status);
      const appliedDateStr = a.appliedAt ? formatDate(a.appliedAt) : 'N/A';
      const mentorStatusBadge = getMentorReviewBadge(a.mentorReviewStatus);

      return `
        <tr>
          <td>
            <div class="fw-bold text-dark">${a.studentName}</div>
            <div class="mono text-muted small">${a.studentRegisterNumber} · ${a.studentDepartment || 'CSE'} (CGPA: ${a.cgpa || 8.0})</div>
          </td>
          <td>
            <div class="fw-semibold text-primary">${a.companyName}</div>
            <small class="text-muted">${a.role} (${a.package || 'TBD'})</small>
          </td>
          <td>${statusBadge}</td>
          <td>${appliedDateStr}</td>
          <td>${mentorStatusBadge}</td>
          <td class="text-end">
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-primary" onclick="openStatusModal('${id}', '${a.studentName}', '${a.companyName}', '${a.status}')">
                <i class="bi bi-arrow-right-circle me-1"></i> Advance
              </button>
              <button class="btn btn-outline-secondary" onclick="openInterviewModal('${id}', '${a.studentName}', '${a.companyName}')" title="Schedule Interview">
                <i class="bi bi-calendar-event"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
}

function filterApplications() {
  renderApplicationsTable();
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

function getMentorReviewBadge(status) {
  switch (status) {
    case 'Approved':
      return '<span class="badge bg-success-subtle text-success border border-success-subtle"><i class="bi bi-shield-check me-1"></i>Approved</span>';
    case 'Changes Requested':
      return '<span class="badge bg-warning-subtle text-warning border border-warning-subtle"><i class="bi bi-exclamation-triangle me-1"></i>Changes Req</span>';
    case 'Rejected':
      return '<span class="badge bg-danger-subtle text-danger border border-danger-subtle"><i class="bi bi-x me-1"></i>Rejected</span>';
    default:
      return '<span class="badge bg-light text-muted border"><i class="bi bi-hourglass me-1"></i>Pending</span>';
  }
}

// ---------------------------------------------------------------------------
// Update Status & Schedule Interview Modals
// ---------------------------------------------------------------------------

function openStatusModal(id, studentName, compName, currentStatus) {
  document.getElementById('statusAppId').value = id;
  document.getElementById('statusCandidateInfo').textContent = `${studentName} — ${compName}`;
  document.getElementById('modalAppStatus').value = currentStatus || 'Applied';
  document.getElementById('modalAppRemarks').value = '';
  toggleStatusModalExtras();
  statusModal.show();
}

function toggleStatusModalExtras() {
  const status = document.getElementById('modalAppStatus').value;
  const extras = document.getElementById('offerReleaseFields');
  if (status === 'Offer Released') {
    extras.classList.remove('d-none');
  } else {
    extras.classList.add('d-none');
  }
}

async function confirmStatusUpdate() {
  const id = document.getElementById('statusAppId').value;
  const status = document.getElementById('modalAppStatus').value;
  const remarks = document.getElementById('modalAppRemarks').value.trim();

  try {
    if (status === 'Offer Released') {
      const pkg = document.getElementById('offerPkg').value.trim();
      const designation = document.getElementById('offerDesignation').value.trim();
      const offerUrl = document.getElementById('offerUrl').value.trim();

      const res = await apiCall(`/applications/${id}/offer`, {
        method: 'PUT',
        body: { package: pkg, designation, offerLetterUrl: offerUrl },
      });
      if (res.success) {
        showToast('Official offer released and candidate notified in real time!', 'success');
        statusModal.hide();
        await loadPlacementData();
      }
    } else {
      const res = await apiCall(`/applications/${id}/status`, {
        method: 'PUT',
        body: { status, remarks },
      });
      if (res.success) {
        showToast(`Status updated to ${status}! Candidate notified live.`, 'success');
        statusModal.hide();
        await loadPlacementData();
      }
    }
  } catch (err) {
    showToast(`Status update failed: ${err.message}`, 'danger');
  }
}

function openInterviewModal(id, studentName, compName) {
  document.getElementById('interviewAppId').value = id;
  document.getElementById('interviewCandidateInfo').textContent = `${studentName} — ${compName}`;
  document.getElementById('intDate').value = new Date().toISOString().slice(0, 10);
  document.getElementById('intTime').value = '10:30 AM';
  document.getElementById('intVenue').value = 'Campus Placement Hall / Online';
  document.getElementById('intLink').value = '';
  document.getElementById('intInstructions').value = 'Please carry 2 copies of your updated resume and college ID card.';
  interviewModal.show();
}

async function confirmScheduleInterview() {
  const id = document.getElementById('interviewAppId').value;
  const payload = {
    date: document.getElementById('intDate').value,
    time: document.getElementById('intTime').value,
    venue: document.getElementById('intVenue').value,
    meetingLink: document.getElementById('intLink').value,
    instructions: document.getElementById('intInstructions').value,
  };

  try {
    const res = await apiCall(`/applications/${id}/interview`, {
      method: 'PUT',
      body: payload,
    });
    if (res.success) {
      showToast('Interview slot confirmed and candidate notified!', 'success');
      interviewModal.hide();
      await loadPlacementData();
    }
  } catch (err) {
    showToast(`Failed to schedule interview: ${err.message}`, 'danger');
  }
}

// ---------------------------------------------------------------------------
// Drives Table
// ---------------------------------------------------------------------------

function renderDrivesTable(drives) {
  const tbody = document.getElementById('drivesTableBody');
  if (!drives || drives.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">No scheduled recruitment drives found.</td></tr>';
    return;
  }

  tbody.innerHTML = drives
    .map((d) => {
      const branches = (d.eligibleBranches || ['CSE', 'IT']).map((b) => `<span class="badge bg-light text-dark border me-1">${b}</span>`).join('');
      return `
        <tr>
          <td><div class="fw-bold text-dark">${d.title}</div></td>
          <td><span class="fw-semibold text-primary">${d.companyName}</span></td>
          <td>${formatDate(d.date)}</td>
          <td><i class="bi bi-geo-alt me-1 text-muted"></i>${d.venue || 'Placement Hall'}</td>
          <td>${branches}</td>
          <td><span class="badge bg-success">${d.status || 'Scheduled'}</span></td>
        </tr>
      `;
    })
    .join('');
}

function openScheduleDriveModal() {
  showToast('Drive schedule creation initialized.', 'info');
  openAddCompanyModal();
}

// ---------------------------------------------------------------------------
// Export Placement Report (CSV)
// ---------------------------------------------------------------------------

function exportPlacementReport() {
  if (allApplications.length === 0) {
    showToast('No application records to export.', 'warning');
    return;
  }

  const headers = ['Register Number', 'Candidate Name', 'Department', 'CGPA', 'Company Name', 'Role', 'Status', 'Mentor Review'];
  const rows = allApplications.map((a) => [
    `"${a.studentRegisterNumber || ''}"`,
    `"${a.studentName || ''}"`,
    `"${a.studentDepartment || ''}"`,
    a.cgpa || 8.0,
    `"${a.companyName || ''}"`,
    `"${a.role || ''}"`,
    `"${a.status || ''}"`,
    `"${a.mentorReviewStatus || ''}"`,
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `SPS_Placement_CRM_Report_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  showToast('Placement report downloaded successfully.', 'success');
}
