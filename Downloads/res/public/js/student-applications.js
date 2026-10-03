const escapeApplicationHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[character]));

const showApplicationMessage = (message, type = 'danger') => {
  const element = document.getElementById('applicationMessage');
  element.className = `alert alert-${type}`;
  element.textContent = message;
};

const loadApplications = async () => {
  const body = document.getElementById('applicationsTableBody');
  const status = document.getElementById('applicationStatus').value;
  body.innerHTML = '<tr><td colspan="6" class="text-muted py-4">Loading applications...</td></tr>';

  try {
    const result = await apiCall(`/student-applications?status=${encodeURIComponent(status)}`);
    const applications = result.data || [];
    const message = document.getElementById('applicationMessage');
    message.classList.add('d-none');
    message.textContent = '';
    document.getElementById('applicationCount').textContent = `${applications.length} application${applications.length === 1 ? '' : 's'}`;

    if (!applications.length) {
      body.innerHTML = '<tr><td colspan="6" class="text-muted py-4">No applications in this status.</td></tr>';
      return;
    }

    body.innerHTML = applications.map((item) => {
      const profile = item.application || {};
      const personal = profile.personalDetails || {};
      const applicationId = item._id || item.id;
      const canReview = status === 'PENDING';
      const submittedAt = item.submittedAt ? new Date(item.submittedAt).toLocaleString() : '';
      const details = escapeApplicationHtml(JSON.stringify(profile, null, 2));
      return `<tr>
        <td class="fw-semibold">${escapeApplicationHtml(item.registerNumber)}</td>
        <td>${escapeApplicationHtml(personal.name)}</td>
        <td>${escapeApplicationHtml(personal.department)} / ${escapeApplicationHtml(personal.section)}</td>
        <td>${escapeApplicationHtml(submittedAt)}</td>
        <td><details><summary>View details</summary><pre class="small text-wrap mt-2 mb-0" style="max-width: 480px; white-space: pre-wrap">${details}</pre></details></td>
        <td class="text-end text-nowrap">${canReview ? `<button class="btn btn-sm btn-success me-1" data-review="APPROVED" data-id="${escapeApplicationHtml(applicationId)}" type="button" title="Approve and add to directory" aria-label="Approve ${escapeApplicationHtml(item.registerNumber)}"><i class="bi bi-check-lg"></i></button><button class="btn btn-sm btn-outline-danger" data-review="REJECTED" data-id="${escapeApplicationHtml(applicationId)}" type="button" title="Reject application" aria-label="Reject ${escapeApplicationHtml(item.registerNumber)}"><i class="bi bi-x-lg"></i></button>` : escapeApplicationHtml(item.status)}</td>
      </tr>`;
    }).join('');
  } catch (error) {
    body.innerHTML = '<tr><td colspan="6" class="text-danger py-4">Could not load applications.</td></tr>';
    showApplicationMessage(error.message);
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  if (!checkAuth()) return;
  if (!canClient('canCreate')) {
    window.location.replace('dashboard.html');
    return;
  }

  initLayout('student-applications');
  document.getElementById('applicationStatus').addEventListener('change', loadApplications);
  document.getElementById('refreshApplications').addEventListener('click', loadApplications);
  document.getElementById('applicationsTableBody').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-review]');
    if (!button) return;
    const action = button.dataset.review;
    const confirmation = action === 'APPROVED'
      ? 'Approve this application and add the profile to the student directory?'
      : 'Reject this student application?';
    if (!window.confirm(confirmation)) return;

    button.disabled = true;
    try {
      await apiCall(`/student-applications/${encodeURIComponent(button.dataset.id)}/status`, {
        method: 'PATCH',
        body: { status: action },
      });
      showApplicationMessage(action === 'APPROVED' ? 'Application approved and student profile created.' : 'Application rejected.', 'success');
      await loadApplications();
    } catch (error) {
      button.disabled = false;
      showApplicationMessage(error.message);
    }
  });
  await loadApplications();
});
