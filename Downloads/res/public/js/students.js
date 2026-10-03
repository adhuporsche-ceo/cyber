/**
 * Students Directory Management & Comparison Handler
 */

let currentPage = 1;
const pageSize = 10;
let totalPages = 1;
let selectedStudentIds = new Set();
let studentToDelete = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!checkAuth()) return;
  initLayout('students');

  if (!canClient('canCreate')) document.querySelectorAll('a[href="add-student.html"]').forEach((element) => { element.classList.add('d-none'); });
  if (canClient('canImport')) {
    document.getElementById('btnDownloadTemplate')?.classList.remove('d-none');
    document.getElementById('btnImportStudents')?.classList.remove('d-none');
    document.getElementById('btnImportStudents')?.addEventListener('click', () => document.getElementById('studentImportFile').click());
    document.getElementById('studentImportFile')?.addEventListener('change', handleStudentImport);
    document.getElementById('btnDownloadTemplate')?.addEventListener('click', downloadImportTemplate);
  }

  // Read URL params if any
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('search')) {
    document.getElementById('filterSearch').value = urlParams.get('search');
  }
  if (urlParams.get('department')) {
    document.getElementById('filterDept').value = urlParams.get('department');
  }
  if (urlParams.get('arrearStatus')) {
    document.getElementById('filterArrears').value = urlParams.get('arrearStatus');
  }
  if (urlParams.get('careerGoal')) {
    document.getElementById('filterCareer').value = urlParams.get('careerGoal');
  }

  // Bind filter events
  let searchTimeout = null;
  document.getElementById('filterSearch').addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentPage = 1;
      loadStudents();
    }, 350);
  });

  ['filterDept', 'filterCategory', 'filterCareer', 'filterArrears', 'filterSort', 'filterMinCgpa', 'filterMinAtt'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', () => {
        currentPage = 1;
        loadStudents();
      });
    }
  });

  document.getElementById('btnResetFilters').addEventListener('click', () => {
    document.getElementById('filterSearch').value = '';
    document.getElementById('filterDept').value = '';
    document.getElementById('filterCategory').value = '';
    document.getElementById('filterCareer').value = '';
    document.getElementById('filterArrears').value = '';
    document.getElementById('filterSort').value = 'recent';
    document.getElementById('filterMinCgpa').value = '';
    document.getElementById('filterMinAtt').value = '';
    currentPage = 1;
    loadStudents();
  });

  // Confirm delete button
  document.getElementById('confirmDeleteBtn').addEventListener('click', handleDeleteStudent);

  loadStudents();
});

async function downloadImportTemplate() {
  try {
    const response = await apiCall('/students/import/template');
    const blob = await response.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'student-import-template.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (error) { showToast(error.message, 'danger'); }
}

async function handleStudentImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const csv = await file.text();
    const preview = await apiCall('/students/import?preview=true', { method: 'POST', headers: { 'Content-Type': 'text/csv' }, body: csv });
    const invalidCount = preview.data.invalid.length;
    const validCount = preview.data.valid.length;
    if (!validCount) throw new Error('No valid rows found in the CSV.');
    const invalidMessage = invalidCount ? ` ${invalidCount} invalid rows will be skipped.` : '';
    if (!window.confirm(`${validCount} valid students are ready to import.${invalidMessage} Continue?`)) return;
    const result = await apiCall('/students/import', { method: 'POST', headers: { 'Content-Type': 'text/csv' }, body: csv });
    showToast(result.message, 'success');
    currentPage = 1;
    loadStudents();
  } catch (error) { showToast(`Import failed: ${error.message}`, 'danger'); }
  finally { event.target.value = ''; }
}

async function loadStudents() {
  const tbody = document.getElementById('studentsTableBody');
  tbody.innerHTML = `
    <tr>
      <td colspan="11" class="text-center py-5">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
      </td>
    </tr>`;

  const search = document.getElementById('filterSearch').value.trim();
  const department = document.getElementById('filterDept').value;
  const category = document.getElementById('filterCategory').value;
  const careerGoal = document.getElementById('filterCareer').value;
  const arrearStatus = document.getElementById('filterArrears').value;
  const sortBy = document.getElementById('filterSort').value;
  const minCgpa = document.getElementById('filterMinCgpa').value;
  const minAttendance = document.getElementById('filterMinAtt').value;

  const queryParams = new URLSearchParams({
    page: currentPage,
    limit: pageSize,
    ...(search && { search }),
    ...(department && { department }),
    ...(category && { category }),
    ...(careerGoal && { careerGoal }),
    ...(arrearStatus && { arrearStatus }),
    ...(sortBy && { sortBy }),
    ...(minCgpa && { minCgpa }),
    ...(minAttendance && { minAttendance }),
    ...(canClient('canDelete') && { includeDeleted: 'true' }),
  });

  try {
    const res = await apiCall(`/students?${queryParams.toString()}`);
    if (res.success) {
      renderTable(res.data);
      renderPagination(res.pagination);
    }
  } catch (err) {
    tbody.innerHTML = `
      <tr>
        <td colspan="11" class="text-center py-4 text-danger">
          <i class="bi bi-exclamation-triangle me-2"></i> Failed to load students: ${err.message}
        </td>
      </tr>`;
  }
}

function renderTable(students = []) {
  const tbody = document.getElementById('studentsTableBody');
  const resultsCount = document.getElementById('resultsCount');

  if (!students || students.length === 0) {
    resultsCount.textContent = 'Showing 0 students';
    tbody.innerHTML = `
      <tr>
        <td colspan="11" class="text-center py-5">
          <div class="empty-state py-3">
            <i class="bi bi-person-x"></i>
            <h5>No Students Found</h5>
            <p>No student records matched your search filters. Try adjusting or clearing filters.</p>
            ${canClient('canCreate') ? '<a href="add-student.html" class="btn btn-sm btn-primary">' : ''}
              <i class="bi bi-person-plus-fill me-1"></i> Add New Student
            ${canClient('canCreate') ? '</a>' : ''}
          </div>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = students
    .map((s) => {
      const isChecked = selectedStudentIds.has(s._id);
      const completion = s.profileCompletion || 0;
      let completionColor = 'bg-danger';
      if (completion >= 80) completionColor = 'bg-success';
      else if (completion >= 50) completionColor = 'bg-warning';

      return `
      <tr>
        <td>
          <input
            type="checkbox"
            class="form-check-input student-select-checkbox"
            value="${s._id}"
            ${isChecked ? 'checked' : ''}
            onchange="handleStudentSelect(this, '${s._id}')"
          />
        </td>
        <td><strong class="text-dark">${s.registerNumber}</strong></td>
        <td>
          <a href="student-profile.html?id=${s._id}" class="text-decoration-none fw-semibold text-primary">
            ${s.name}
          </a>
        </td>
        <td><span class="badge bg-light text-dark border">${s.department} - ${s.section}</span></td>
        <td>
          <span class="badge ${s.category === 'Hosteller' ? 'bg-info-subtle text-info-emphasis' : 'bg-secondary-subtle text-secondary'}">
            ${s.category}
          </span>
        </td>
        <td><strong class="text-primary">${s.currentCGPA || 0}</strong></td>
        <td>
          <span class="${s.latestAttendance < 75 ? 'text-danger fw-bold' : 'text-dark'}">
            ${s.latestAttendance || 0}%
          </span>
        </td>
        <td>
          ${
            s.pendingArrearsCount > 0
              ? `<span class="badge badge-soft-danger">${s.pendingArrearsCount} Pending</span>`
              : `<span class="badge badge-soft-success">Clear</span>`
          }
        </td>
        <td>
          <span class="badge bg-primary-subtle text-primary">
            ${s.careerGoal || 'Unset'}
          </span>
        </td>
        <td style="min-width: 110px;">
          <div class="d-flex align-items-center gap-2">
            <div class="progress flex-grow-1" style="height: 6px;">
              <div class="progress-bar ${completionColor}" role="progressbar" style="width: ${completion}%;"></div>
            </div>
            <small class="text-muted fw-semibold" style="font-size: 0.72rem;">${completion}%</small>
          </div>
        </td>
        <td class="text-end text-nowrap">
          <a href="student-profile.html?id=${s._id}" class="btn btn-sm btn-outline-primary py-1 px-2" title="View Profile">
            <i class="bi bi-eye"></i>
          </a>
          ${s.deletedAt && canClient('canDelete') ? `<button class="btn btn-sm btn-outline-primary py-1 px-2" title="Restore Student" onclick="restoreStudent('${s._id}')"><i class="bi bi-arrow-counterclockwise"></i></button>` : ''}
          ${!s.deletedAt && canClient('canEdit') ? `<a href="edit-student.html?id=${s._id}" class="btn btn-sm btn-outline-secondary py-1 px-2" title="Edit Student"><i class="bi bi-pencil-square"></i></a>` : ''}
          ${!s.deletedAt && canClient('canDelete') ? `<button class="btn btn-sm btn-outline-danger py-1 px-2" title="Delete Student" onclick="promptDeleteStudent('${s._id}', '${s.name}', '${s.registerNumber}')"><i class="bi bi-trash"></i></button>` : ''}
        </td>
      </tr>`;
    })
    .join('');
}

async function restoreStudent(id) {
  if (!window.confirm('Restore this student profile?')) return;
  try {
    await apiCall(`/students/${id}/restore`, { method: 'PUT' });
    showToast('Student restored successfully.', 'success');
    loadStudents();
  } catch (error) { showToast(error.message, 'danger'); }
}

function renderPagination(pagination) {
  const info = document.getElementById('paginationInfo');
  const list = document.getElementById('paginationList');
  const resultsCount = document.getElementById('resultsCount');

  if (!pagination) return;

  totalPages = pagination.pages || 1;
  resultsCount.textContent = `Showing ${pagination.total} total students`;
  info.textContent = `Page ${pagination.page} of ${totalPages} (${pagination.total} students)`;

  let items = '';
  // Prev
  items += `
    <li class="page-item ${pagination.page <= 1 ? 'disabled' : ''}">
      <button class="page-link" onclick="changePage(${pagination.page - 1})">Previous</button>
    </li>`;

  // Page Numbers
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= pagination.page - 1 && i <= pagination.page + 1)) {
      items += `
        <li class="page-item ${i === pagination.page ? 'active' : ''}">
          <button class="page-link" onclick="changePage(${i})">${i}</button>
        </li>`;
    }
  }

  // Next
  items += `
    <li class="page-item ${pagination.page >= totalPages ? 'disabled' : ''}">
      <button class="page-link" onclick="changePage(${pagination.page + 1})">Next</button>
    </li>`;

  list.innerHTML = items;
}

function changePage(page) {
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  loadStudents();
}

// ---------------------------------------------------------------------------
// Student Comparison Handling (Max 3, Non-Sensitive Data Only)
// ---------------------------------------------------------------------------

function handleStudentSelect(checkbox, id) {
  if (checkbox.checked) {
    if (selectedStudentIds.size >= 3) {
      checkbox.checked = false;
      showToast('You can select a maximum of 3 students to compare.', 'warning');
      return;
    }
    selectedStudentIds.add(id);
  } else {
    selectedStudentIds.delete(id);
  }

  updateCompareButton();
}

function updateCompareButton() {
  const btn = document.getElementById('btnCompare');
  const countSpan = document.getElementById('selectedCount');
  countSpan.textContent = selectedStudentIds.size;
  btn.disabled = selectedStudentIds.size < 2;
}

async function openComparisonModal() {
  if (selectedStudentIds.size < 2) {
    showToast('Please select at least 2 students to compare.', 'warning');
    return;
  }

  const modalEl = document.getElementById('compareModal');
  const modalContent = document.getElementById('compareModalContent');
  modalContent.innerHTML = `
    <div class="text-center py-5">
      <div class="spinner-border text-primary" role="status"></div>
      <p class="text-muted mt-2">Loading comparative analysis...</p>
    </div>`;

  const modal = new bootstrap.Modal(modalEl);
  modal.show();

  try {
    const ids = Array.from(selectedStudentIds).join(',');
    const res = await apiCall(`/insights/compare?ids=${ids}`);

    if (res.success && res.data) {
      renderComparisonTable(res.data);
    }
  } catch (err) {
    modalContent.innerHTML = `<div class="alert alert-danger">Comparison failed: ${err.message}</div>`;
  }
}

function renderComparisonTable(students = []) {
  const container = document.getElementById('compareModalContent');
  if (students.length === 0) {
    container.innerHTML = `<p class="text-muted">No student records to display.</p>`;
    return;
  }

  let tableHtml = `
    <div class="table-responsive">
      <table class="table table-bordered align-middle">
        <thead class="table-light">
          <tr>
            <th style="width: 220px;">Attribute</th>
            ${students
              .map(
                (s) => `
              <th class="text-center">
                <div class="fw-bold text-primary fs-6">${s.name}</div>
                <span class="badge bg-light text-dark border">${s.registerNumber}</span>
                <div class="small text-muted mt-1">${s.department} - Section ${s.section}</div>
              </th>`
              )
              .join('')}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="fw-semibold">Student Category</td>
            ${students.map((s) => `<td class="text-center">${s.category}</td>`).join('')}
          </tr>
          <tr>
            <td class="fw-semibold">Current CGPA</td>
            ${students
              .map(
                (s) => `
              <td class="text-center">
                <span class="fs-5 fw-bold text-primary">${s.currentCGPA}</span>
              </td>`
              )
              .join('')}
          </tr>
          <tr>
            <td class="fw-semibold">Academic Progression Trend</td>
            ${students
              .map(
                (s) => `
              <td class="text-center">
                ${getAcademicTrendBadge(s.academicTrend)}
              </td>`
              )
              .join('')}
          </tr>
          <tr>
            <td class="fw-semibold">Latest Attendance</td>
            ${students.map((s) => `<td class="text-center">${s.latestAttendance}</td>`).join('')}
          </tr>
          <tr>
            <td class="fw-semibold">Pending Arrears</td>
            ${students
              .map(
                (s) => `
              <td class="text-center">
                ${
                  s.pendingArrears > 0
                    ? `<span class="badge badge-soft-danger">${s.pendingArrears} Pending</span>`
                    : `<span class="badge badge-soft-success">None</span>`
                }
              </td>`
              )
              .join('')}
          </tr>
          <tr>
            <td class="fw-semibold">Cleared Arrears History</td>
            ${students
              .map(
                (s) => `
              <td class="text-center">
                ${s.clearedArrears > 0 ? `<span class="badge badge-soft-info">${s.clearedArrears} Cleared</span>` : '0'}
              </td>`
              )
              .join('')}
          </tr>
          <tr>
            <td class="fw-semibold">Primary Career Goal</td>
            ${students
              .map(
                (s) => `
              <td class="text-center">
                <span class="badge bg-primary">${s.careerGoal}</span>
              </td>`
              )
              .join('')}
          </tr>
          <tr>
            <td class="fw-semibold">Programming Languages</td>
            ${students
              .map(
                (s) => `
              <td class="text-center small">
                ${(s.programmingLanguages || []).join(', ') || '<span class="text-muted">None listed</span>'}
              </td>`
              )
              .join('')}
          </tr>
          <tr>
            <td class="fw-semibold">Technical Skills</td>
            ${students
              .map(
                (s) => `
              <td class="text-center small">
                ${(s.technicalSkills || []).join(', ') || '<span class="text-muted">None listed</span>'}
              </td>`
              )
              .join('')}
          </tr>
          <tr>
            <td class="fw-semibold">Practical Projects Count</td>
            ${students.map((s) => `<td class="text-center fw-bold">${s.projectsCount}</td>`).join('')}
          </tr>
          <tr>
            <td class="fw-semibold">Certifications Completed</td>
            ${students.map((s) => `<td class="text-center fw-bold">${s.certificationsCount}</td>`).join('')}
          </tr>
          <tr>
            <td class="fw-semibold">Communication Skill</td>
            ${students.map((s) => `<td class="text-center">${s.communicationLevel}</td>`).join('')}
          </tr>
          <tr>
            <td class="fw-semibold">Aptitude Skill</td>
            ${students.map((s) => `<td class="text-center">${s.aptitudeLevel}</td>`).join('')}
          </tr>
        </tbody>
      </table>
    </div>`;

  container.innerHTML = tableHtml;
}

// ---------------------------------------------------------------------------
// Student Deletion Modal
// ---------------------------------------------------------------------------

function promptDeleteStudent(id, name, regNo) {
  studentToDelete = { id, name, regNo };
  document.getElementById('deleteStudentName').textContent = name;
  document.getElementById('deleteStudentReg').textContent = `Register Number: ${regNo}`;

  const modalEl = document.getElementById('deleteModal');
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
}

async function handleDeleteStudent() {
  if (!studentToDelete) return;

  const confirmBtn = document.getElementById('confirmDeleteBtn');
  confirmBtn.disabled = true;
  confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Deleting...';

  try {
    const res = await apiCall(`/students/${studentToDelete.id}`, { method: 'DELETE' });
    if (res.success) {
      showToast(`Student ${studentToDelete.name} deleted successfully.`, 'success');
      selectedStudentIds.delete(studentToDelete.id);
      updateCompareButton();

      const modalEl = document.getElementById('deleteModal');
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();

      loadStudents();
    }
  } catch (err) {
    showToast(`Failed to delete student: ${err.message}`, 'danger');
  } finally {
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = 'Delete Student Profile';
    studentToDelete = null;
  }
}
