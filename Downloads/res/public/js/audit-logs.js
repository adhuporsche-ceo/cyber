/**
 * Administrator Audit Log Management Handler
 */

let auditPage = 1;
const auditPageSize = 20;
let auditTotalPages = 1;

document.addEventListener('DOMContentLoaded', () => {
  if (!checkAuth('admin')) return;
  initLayout('audit-logs');

  let searchTimeout = null;
  document.getElementById('auditSearchInput').addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      auditPage = 1;
      loadAuditLogs();
    }, 350);
  });

  document.getElementById('auditActionFilter').addEventListener('change', () => {
    auditPage = 1;
    loadAuditLogs();
  });

  loadAuditLogs();
});

function resetAuditFilters() {
  document.getElementById('auditSearchInput').value = '';
  document.getElementById('auditActionFilter').value = '';
  auditPage = 1;
  loadAuditLogs();
}

async function loadAuditLogs() {
  const tbody = document.getElementById('auditTableBody');
  tbody.innerHTML = `
    <tr>
      <td colspan="5" class="text-center py-5">
        <div class="spinner-border text-primary" role="status"></div>
      </td>
    </tr>`;

  const search = document.getElementById('auditSearchInput').value.trim();
  const action = document.getElementById('auditActionFilter').value;

  const queryParams = new URLSearchParams({
    page: auditPage,
    limit: auditPageSize,
    ...(search && { search }),
    ...(action && { action }),
  });

  try {
    const res = await apiCall(`/audit-logs?${queryParams.toString()}`);
    if (res.success && res.data) {
      renderAuditTable(res.data);
      renderAuditPagination(res.pagination);
    }
  } catch (err) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center py-4 text-danger">
          <i class="bi bi-exclamation-triangle me-2"></i> Failed to load audit logs: ${err.message}
        </td>
      </tr>`;
  }
}

function renderAuditTable(logs = []) {
  const tbody = document.getElementById('auditTableBody');

  if (logs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center py-5">
          <div class="empty-state py-3">
            <i class="bi bi-shield-check text-muted"></i>
            <h5>No Audit Records Found</h5>
            <p>No activity logs match the selected search or filter criteria.</p>
          </div>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = logs
    .map((l) => {
      const actionBadge = getActionBadge(l.action);
      const studentLabel = l.studentName
        ? `<div><strong>${l.studentName}</strong></div><small class="text-muted">${l.studentRegisterNumber || ''}</small>`
        : '<span class="text-muted">-</span>';

      return `
      <tr>
        <td>
          <span class="text-dark small fw-semibold">${formatDate(l.timestamp)}</span>
          <small class="text-muted d-block">${new Date(l.timestamp).toLocaleTimeString()}</small>
        </td>
        <td>
          <div class="fw-semibold text-dark">${l.userName}</div>
          <span class="badge ${l.userRole === 'admin' ? 'bg-danger-subtle text-danger' : 'bg-primary-subtle text-primary'}" style="font-size: 0.65rem;">
            ${(l.userRole || 'faculty').toUpperCase()}
          </span>
        </td>
        <td>${actionBadge}</td>
        <td>${studentLabel}</td>
        <td><small class="text-muted">${l.details || 'No additional details'}</small></td>
      </tr>`;
    })
    .join('');
}

function getActionBadge(action) {
  switch (action) {
    case 'LOGIN':
      return '<span class="badge bg-info-subtle text-info-emphasis">LOGIN</span>';
    case 'LOGOUT':
      return '<span class="badge bg-secondary-subtle text-secondary">LOGOUT</span>';
    case 'STUDENT_CREATED':
      return '<span class="badge bg-success-subtle text-success">STUDENT CREATED</span>';
    case 'STUDENT_UPDATED':
      return '<span class="badge bg-primary-subtle text-primary">STUDENT UPDATED</span>';
    case 'STUDENT_DELETED':
      return '<span class="badge bg-danger-subtle text-danger">STUDENT DELETED</span>';
    case 'SEMESTER_ADDED':
    case 'SEMESTER_UPDATED':
      return '<span class="badge bg-light text-dark border">SEMESTER CHANGE</span>';
    case 'ARREAR_ADDED':
    case 'ARREAR_UPDATED':
      return '<span class="badge bg-warning-subtle text-warning-emphasis">ARREAR CHANGE</span>';
    case 'INTERVENTION_ADDED':
    case 'INTERVENTION_UPDATED':
      return '<span class="badge bg-warning text-dark">MENTOR INTERVENTION</span>';
    case 'SYSTEM_SEED':
      return '<span class="badge bg-dark text-white">SYSTEM SEED</span>';
    default:
      return `<span class="badge bg-light text-dark border">${action}</span>`;
  }
}

function renderAuditPagination(pagination) {
  const info = document.getElementById('auditPaginationInfo');
  const list = document.getElementById('auditPaginationList');

  if (!pagination) return;
  auditTotalPages = pagination.pages || 1;
  info.textContent = `Showing page ${pagination.page} of ${auditTotalPages} (${pagination.total} audit logs)`;

  let items = `
    <li class="page-item ${pagination.page <= 1 ? 'disabled' : ''}">
      <button class="page-link" onclick="changeAuditPage(${pagination.page - 1})">Previous</button>
    </li>`;

  for (let i = 1; i <= auditTotalPages; i++) {
    if (i === 1 || i === auditTotalPages || (i >= pagination.page - 1 && i <= pagination.page + 1)) {
      items += `
        <li class="page-item ${i === pagination.page ? 'active' : ''}">
          <button class="page-link" onclick="changeAuditPage(${i})">${i}</button>
        </li>`;
    }
  }

  items += `
    <li class="page-item ${pagination.page >= auditTotalPages ? 'disabled' : ''}">
      <button class="page-link" onclick="changeAuditPage(${pagination.page + 1})">Next</button>
    </li>`;

  list.innerHTML = items;
}

function changeAuditPage(page) {
  if (page < 1 || page > auditTotalPages) return;
  auditPage = page;
  loadAuditLogs();
}
