/**
 * Export Reports Handler
 */

document.addEventListener('DOMContentLoaded', () => {
  if (!checkAuth()) return;
  initLayout('reports');
});

async function downloadReport(type) {
  const deptSelect = document.getElementById('reportDeptSelect');
  const department = deptSelect ? deptSelect.value : '';

  const queryParams = new URLSearchParams({
    type,
    ...(department && { department }),
  });

  const token = getAuthToken();

  showToast(`Generating ${type} report... please wait.`, 'info');

  try {
    const response = await fetch(`/api/reports/export?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errJson = await response.json();
      throw new Error(errJson.message || 'Report generation failed');
    }

    // Get filename from header if available
    let filename = `report_${type}_${Date.now()}.csv`;
    const disposition = response.headers.get('content-disposition');
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) filename = match[1];
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);

    showToast(`Report downloaded successfully: ${filename}`, 'success');
  } catch (err) {
    showToast(`Failed to export report: ${err.message}`, 'danger');
  }
}
