document.addEventListener('DOMContentLoaded', async () => {
  if (!checkAuth()) return;
  initLayout('settings');
  const user = getCurrentUser();
  if (user) {
    document.getElementById('settingsUserName').textContent = user.name;
    document.getElementById('settingsAvatar').textContent = user.name.charAt(0).toUpperCase();
    document.getElementById('settingsUserRole').textContent = (user.role || 'faculty').toUpperCase();
    document.getElementById('settingsUserEmail').textContent = user.email;
    document.getElementById('settingsUserDept').textContent = user.department || 'Computer Science and Engineering';
  }

  const attendance = document.getElementById('attendanceThreshold');
  const cgpa = document.getElementById('cgpaThreshold');
  const loadSettings = async () => {
    const response = await apiCall('/settings');
    attendance.value = response.data.attendanceThreshold;
    cgpa.value = response.data.cgpaThreshold;
  };
  try { await loadSettings(); } catch (error) { showToast(error.message, 'danger'); }

  document.getElementById('saveThresholds').addEventListener('click', async () => {
    try {
      await apiCall('/settings', { method: 'PUT', body: { attendanceThreshold: attendance.value, cgpaThreshold: cgpa.value } });
      showToast('Mentoring thresholds saved.', 'success');
    } catch (error) { showToast(error.message, 'danger'); }
  });
  document.getElementById('resetThresholds').addEventListener('click', () => { attendance.value = 75; cgpa.value = 6.5; });
  document.getElementById('passwordForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await apiCall('/settings/password', { method: 'PUT', body: { currentPassword: currentPassword.value, newPassword: newPassword.value } });
      event.target.reset();
      showToast('Password updated successfully.', 'success');
    } catch (error) { showToast(error.message, 'danger'); }
  });
});
