/**
 * Dedicated Mentor Attention & Counseling Center Handler
 */

let targetStudentId = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!checkAuth()) return;
  initLayout('mentor-attention');

  document.getElementById('attentionReasonFilter').addEventListener('change', loadAttentionList);
  document.getElementById('attentionDeptFilter').addEventListener('change', loadAttentionList);

  loadAttentionList();
});

async function loadAttentionList() {
  const container = document.getElementById('attentionCardsGrid');
  const countBadge = document.getElementById('attentionTotalCount');

  container.innerHTML = `
    <div class="col-12 text-center py-5">
      <div class="spinner-border text-primary" role="status"></div>
      <p class="text-muted mt-2">Evaluating academic rules and identifying students...</p>
    </div>`;

  const reasonType = document.getElementById('attentionReasonFilter').value;
  const department = document.getElementById('attentionDeptFilter').value;

  const queryParams = new URLSearchParams({
    ...(reasonType && { reasonType }),
    ...(department && { department }),
  });

  try {
    const res = await apiCall(`/insights/mentor-attention?${queryParams.toString()}`);
    if (res.success && res.data) {
      const students = res.data.students || [];
      countBadge.textContent = `${students.length} Students Flagged`;
      renderAttentionCards(students);
    }
  } catch (err) {
    container.innerHTML = `
      <div class="col-12 text-center py-4 text-danger">
        <i class="bi bi-exclamation-triangle me-2"></i> Failed to load mentor attention records: ${err.message}
      </div>`;
  }
}

function renderAttentionCards(students = []) {
  const container = document.getElementById('attentionCardsGrid');

  if (students.length === 0) {
    container.innerHTML = `
      <div class="col-12 text-center py-5">
        <div class="empty-state py-4">
          <i class="bi bi-shield-check text-success"></i>
          <h5>All Students On Track</h5>
          <p>No students match the selected attention filters. All academic metrics and attendance levels are compliant with mentor guidelines.</p>
        </div>
      </div>`;
    return;
  }

  container.innerHTML = students
    .map((s) => {
      const interventions = s.interventions || [];
      const latestInt = interventions.length > 0 ? interventions[interventions.length - 1] : null;

      return `
      <div class="col-lg-6">
        <div class="card border-warning h-100 shadow-sm">
          <div class="card-header bg-warning-subtle text-warning-emphasis d-flex justify-content-between align-items-center">
            <div>
              <span class="fw-bold fs-6">${s.name}</span>
              <span class="badge bg-light text-dark border ms-2">${s.registerNumber}</span>
            </div>
            <span class="badge bg-light text-dark border">${s.department} - ${s.section}</span>
          </div>
          <div class="card-body">
            <!-- Academic Metrics Snapshot -->
            <div class="row g-2 mb-3 text-center small">
              <div class="col-4">
                <div class="p-2 bg-light rounded border">
                  <span class="text-muted d-block">Current CGPA</span>
                  <strong class="text-primary fs-6">${s.currentCGPA || 0}</strong>
                </div>
              </div>
              <div class="col-4">
                <div class="p-2 bg-light rounded border">
                  <span class="text-muted d-block">Attendance</span>
                  <strong class="${s.attendance < 75 ? 'text-danger' : 'text-dark'} fs-6">${s.attendance || 0}%</strong>
                </div>
              </div>
              <div class="col-4">
                <div class="p-2 bg-light rounded border">
                  <span class="text-muted d-block">Pending Arrears</span>
                  <strong class="${s.pendingArrears > 0 ? 'text-danger' : 'text-success'} fs-6">${s.pendingArrears}</strong>
                </div>
              </div>
            </div>

            <!-- Transparent Reasons -->
            <div class="mb-3">
              <strong class="d-block small text-dark mb-1"><i class="bi bi-exclamation-circle-fill text-warning me-1"></i> Reasons for Mentor Attention:</strong>
              <ul class="small text-muted mb-0 ps-3">
                ${s.reasons.map((r) => `<li class="mb-1">${r}</li>`).join('')}
              </ul>
            </div>

            <!-- Previous Interventions Summary -->
            <div class="p-2 bg-light rounded border small mb-3">
              <div class="d-flex justify-content-between align-items-center">
                <span class="fw-semibold text-muted">Intervention History:</span>
                <span class="badge ${interventions.length > 0 ? 'bg-info-subtle text-info-emphasis' : 'bg-secondary-subtle text-secondary'}">
                  ${interventions.length} logged
                </span>
              </div>
              ${
                latestInt
                  ? `<div class="mt-1 text-truncate text-muted" style="font-size: 0.78rem;">
                       <strong>Latest (${formatDate(latestInt.date)}):</strong> "${latestInt.reason}" [${latestInt.status}]
                     </div>`
                  : `<span class="text-muted" style="font-size: 0.78rem;">No counseling session logged yet.</span>`
              }
            </div>

            <!-- Action Buttons -->
            <div class="d-flex justify-content-between align-items-center pt-2 border-top">
              <a href="student-profile.html?id=${s._id}" class="btn btn-sm btn-outline-primary" style="font-size: 0.8rem;">
                <i class="bi bi-eye me-1"></i> Full Profile
              </a>
              <button class="btn btn-sm btn-warning fw-semibold" style="font-size: 0.8rem;" onclick="promptQuickIntervention('${s._id}', '${s.name}', '${s.registerNumber}', '${s.reasons[0] || 'Academic & Welfare Counseling'}')">
                <i class="bi bi-clipboard-plus me-1"></i> Log Counseling Session
              </button>
            </div>
          </div>
        </div>
      </div>`;
    })
    .join('');
}

function promptQuickIntervention(id, name, regNo, primaryReason) {
  targetStudentId = id;
  document.getElementById('modalTargetStudentName').textContent = name;
  document.getElementById('modalTargetStudentReg').textContent = `Register Number: ${regNo}`;
  document.getElementById('qiDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('qiReason').value = primaryReason;
  document.getElementById('qiNote').value = '';
  document.getElementById('qiAction').value = '';
  document.getElementById('qiFollowUp').value = '';

  const modalEl = document.getElementById('quickInterventionModal');
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
}

async function submitQuickIntervention() {
  if (!targetStudentId) return;

  const date = document.getElementById('qiDate').value;
  const status = document.getElementById('qiStatus').value;
  const reason = document.getElementById('qiReason').value.trim();
  const note = document.getElementById('qiNote').value.trim();
  const action = document.getElementById('qiAction').value.trim();
  const followUp = document.getElementById('qiFollowUp').value || null;

  if (!reason || !note) {
    showToast('Please provide both Reason and Counseling Note.', 'warning');
    return;
  }

  try {
    const res = await apiCall(`/students/${targetStudentId}/interventions`, {
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
      showToast('Counseling session recorded successfully!', 'success');
      const modalEl = document.getElementById('quickInterventionModal');
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();

      loadAttentionList();
    }
  } catch (err) {
    showToast(`Failed to record intervention: ${err.message}`, 'danger');
  }
}
