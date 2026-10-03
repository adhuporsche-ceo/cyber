document.addEventListener('DOMContentLoaded', () => {
  if (!checkAuth()) return;
  const isEdit = Boolean(new URLSearchParams(window.location.search).get('id')) || window.location.pathname.includes('edit-student');
  const allowed = isEdit ? canClient('canEdit') : canClient('canCreate');
  if (!allowed) {
    initLayout('students');
    showToast('Not authorized for this action.', 'danger');
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 700);
  }
});