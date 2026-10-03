/**
 * Main Mentor & Faculty Dashboard Handler
 */

document.addEventListener('DOMContentLoaded', async () => {
  if (!checkAuth()) return;
  initLayout('dashboard');

  try {
    const res = await apiCall('/insights/dashboard');
    if (res.success && res.data) {
      renderKpis(res.data.kpis);
      renderCharts(res.data.charts);
      renderLists(res.data.lists);
    }
  } catch (err) {
    showToast(`Failed to load dashboard metrics: ${err.message}`, 'danger');
  }
});

function renderKpis(kpis = {}) {
  document.getElementById('kpiTotalStudents').textContent = kpis.totalStudents ?? 0;
  document.getElementById('kpiHostellers').textContent = kpis.hostellers ?? 0;
  document.getElementById('kpiDayScholars').textContent = kpis.dayScholars ?? 0;
  document.getElementById('kpiAvgCgpa').textContent = kpis.avgCgpa ?? '0.00';
  document.getElementById('kpiHighestCgpa').textContent = kpis.highestCgpa ?? '0.00';
  document.getElementById('kpiLowestCgpa').textContent = kpis.lowestCgpa ?? '0.00';
  document.getElementById('kpiActiveArrears').textContent = kpis.activeArrears ?? 0;
  document.getElementById('kpiPendingArrears').textContent = kpis.pendingArrears ?? 0;
  document.getElementById('kpiClearedArrears').textContent = kpis.clearedArrears ?? 0;
  document.getElementById('kpiAttentionCount').textContent = kpis.attentionRequiredCount ?? 0;
}

function renderCharts(charts = {}) {
  if (window.ChartTheme) ChartTheme.apply();
  // 1. Semester-wise Average SGPA (Line)
  const ctxSgpa = document.getElementById('semesterSgpaChart');
  if (ctxSgpa && charts.semesterSgpa) {
    new Chart(ctxSgpa, {
      type: 'line',
      data: {
        labels: charts.semesterSgpa.labels || [],
        datasets: [
          {
            label: 'Average SGPA',
            data: charts.semesterSgpa.data || [],
            borderColor: '#ffffff',
              backgroundColor: ChartTheme.patternFactory('solid'),
            fill: true,
            tension: 0.35,
            pointRadius: 5,
            pointBackgroundColor: '#ffffff',
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `Avg SGPA: ${ctx.parsed.y}`,
            },
          },
        },
        scales: {
          y: { min: 0, max: 10, ticks: { stepSize: 2 } },
        },
      },
    });
  }

  // 2. Career Goal Distribution (Doughnut)
  const ctxCareer = document.getElementById('careerGoalChart');
  if (ctxCareer && charts.careerGoals) {
    new Chart(ctxCareer, {
      type: 'doughnut',
      data: {
        labels: charts.careerGoals.labels || [],
        datasets: [
          {
            data: charts.careerGoals.data || [],
                backgroundColor: [ChartTheme.patternFactory('solid'), ChartTheme.patternFactory('diagonal')],
            borderWidth: 2,
            borderColor: '#ffffff',
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' },
        },
        cutout: '65%',
      },
    });
  }

  // 3. CGPA Distribution (Bar)
  const ctxCgpa = document.getElementById('cgpaDistributionChart');
  if (ctxCgpa && charts.cgpaDistribution) {
    new Chart(ctxCgpa, {
      type: 'bar',
      data: {
        labels: charts.cgpaDistribution.labels || [],
        datasets: [
          {
            label: 'Students',
            data: charts.cgpaDistribution.data || [],
            backgroundColor: ChartTheme.patternFactory('solid'),
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } },
        },
      },
    });
  }

  // 4. Hosteller vs Day Scholar (Pie)
  const ctxCategory = document.getElementById('categoryRatioChart');
  if (ctxCategory && charts.categoryRatio) {
    new Chart(ctxCategory, {
      type: 'pie',
      data: {
        labels: charts.categoryRatio.labels || [],
        datasets: [
          {
            data: charts.categoryRatio.data || [],
                backgroundColor: [ChartTheme.patternFactory('diagonal'), ChartTheme.patternFactory('solid')],
            borderWidth: 2,
            borderColor: '#ffffff',
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } },
      },
    });
  }

  // 5. Arrear Status (Bar)
  const ctxArrear = document.getElementById('arrearStatusChart');
  if (ctxArrear && charts.arrearStatus) {
    new Chart(ctxArrear, {
      type: 'bar',
      data: {
        labels: charts.arrearStatus.labels || [],
        datasets: [
          {
            label: 'Arrears Count',
            data: charts.arrearStatus.data || [],
            backgroundColor: [ChartTheme.patternFactory('diagonal'), ChartTheme.patternFactory('solid')],
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } },
        },
      },
    });
  }

  // 6. Department-wise Student Count (Bar)
  const ctxDept = document.getElementById('departmentChart');
  if (ctxDept && charts.departmentCounts) {
    new Chart(ctxDept, {
      type: 'bar',
      data: {
        labels: charts.departmentCounts.labels || [],
        datasets: [
          {
            label: 'Students Enrolled',
            data: charts.departmentCounts.data || [],
            backgroundColor: ChartTheme.patternFactory('cross'),
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } },
        },
      },
    });
  }
}

function renderLists(lists = {}) {
  // Attention Watchlist
  const attentionBody = document.getElementById('attentionListBody');
  if (attentionBody) {
    if (!lists.attentionList || lists.attentionList.length === 0) {
      attentionBody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-4 text-muted">
            <i class="bi bi-shield-check text-success fs-3 d-block mb-1"></i>
            All students are currently on track. No urgent attention required.
          </td>
        </tr>`;
    } else {
      attentionBody.innerHTML = lists.attentionList
        .map(
          (s) => `
        <tr>
          <td>
            <div class="fw-semibold text-dark">${s.name}</div>
            <small class="text-muted">${s.registerNumber}</small>
          </td>
          <td><span class="badge bg-light text-dark border">${s.department}</span></td>
          <td><span class="fw-bold text-primary">${s.currentCgpa}</span></td>
          <td>
            <div class="text-warning-emphasis small" style="max-width: 250px;">
              ${s.reasons.length > 0 ? s.reasons[0] : 'Needs review'}
              ${s.reasons.length > 1 ? `<span class="badge bg-warning-subtle text-warning ms-1">+${s.reasons.length - 1} more</span>` : ''}
            </div>
          </td>
          <td>
            <a href="student-profile.html?id=${s._id}" class="btn btn-sm btn-outline-primary py-1 px-2" style="font-size: 0.78rem;">
              <i class="bi bi-eye"></i> Profile
            </a>
          </td>
        </tr>`
        )
        .join('');
    }
  }

  // Active Arrears List
  const arrearBody = document.getElementById('arrearListBody');
  if (arrearBody) {
    if (!lists.activeArrearList || lists.activeArrearList.length === 0) {
      arrearBody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-4 text-muted">
            <i class="bi bi-check2-circle text-success fs-3 d-block mb-1"></i>
            No students currently have active pending arrears.
          </td>
        </tr>`;
    } else {
      arrearBody.innerHTML = lists.activeArrearList
        .map((s) => {
          const subNames = s.arrearDetails.map((a) => a.subjectCode).join(', ');
          return `
          <tr>
            <td>
              <div class="fw-semibold text-dark">${s.name}</div>
              <small class="text-muted">${s.registerNumber}</small>
            </td>
            <td><span class="badge bg-light text-dark border">${s.department}</span></td>
            <td><span class="badge badge-soft-danger">${s.pendingArrears} Pending</span></td>
            <td><small class="text-muted">${subNames || 'N/A'}</small></td>
            <td>
              <a href="student-profile.html?id=${s._id}#arrears" class="btn btn-sm btn-outline-danger py-1 px-2" style="font-size: 0.78rem;">
                <i class="bi bi-journal-text"></i> Arrears
              </a>
            </td>
          </tr>`;
        })
        .join('');
    }
  }

  // Declining Trend List
  const decliningBody = document.getElementById('decliningListBody');
  if (decliningBody) {
    if (!lists.decliningTrendList || lists.decliningTrendList.length === 0) {
      decliningBody.innerHTML = `<tr><td colspan="4" class="text-center py-3 text-muted">No students showing academic decline.</td></tr>`;
    } else {
      decliningBody.innerHTML = lists.decliningTrendList
        .map(
          (s) => `
        <tr>
          <td>
            <div class="fw-semibold text-dark">${s.name}</div>
            <small class="text-muted">${s.registerNumber}</small>
          </td>
          <td><span class="badge bg-light text-dark border">${s.department}</span></td>
          <td>
            <span class="badge badge-soft-warning"><i class="bi bi-arrow-down-right me-1"></i>${s.trendInfo.diff} SGPA</span>
            <small class="text-muted d-block" style="font-size: 0.75rem;">Sem ${s.trendInfo.prevSgpa} → ${s.trendInfo.lastSgpa}</small>
          </td>
          <td>
            <a href="student-profile.html?id=${s._id}" class="btn btn-sm btn-outline-secondary py-1 px-2" style="font-size: 0.75rem;">
              Review
            </a>
          </td>
        </tr>`
        )
        .join('');
    }
  }

  // Improving Trend List
  const improvingBody = document.getElementById('improvingListBody');
  if (improvingBody) {
    if (!lists.improvingTrendList || lists.improvingTrendList.length === 0) {
      improvingBody.innerHTML = `<tr><td colspan="4" class="text-center py-3 text-muted">No students registered with 2+ semesters yet.</td></tr>`;
    } else {
      improvingBody.innerHTML = lists.improvingTrendList
        .map(
          (s) => `
        <tr>
          <td>
            <div class="fw-semibold text-dark">${s.name}</div>
            <small class="text-muted">${s.registerNumber}</small>
          </td>
          <td><span class="badge bg-light text-dark border">${s.department}</span></td>
          <td>
            <span class="badge badge-soft-success"><i class="bi bi-arrow-up-right me-1"></i>+${s.trendInfo.diff} SGPA</span>
            <small class="text-muted d-block" style="font-size: 0.75rem;">Sem ${s.trendInfo.prevSgpa} → ${s.trendInfo.lastSgpa}</small>
          </td>
          <td>
            <a href="student-profile.html?id=${s._id}" class="btn btn-sm btn-outline-secondary py-1 px-2" style="font-size: 0.75rem;">
              Review
            </a>
          </td>
        </tr>`
        )
        .join('');
    }
  }

  // Recent Students List
  const recentBody = document.getElementById('recentListBody');
  if (recentBody) {
    if (!lists.recentStudents || lists.recentStudents.length === 0) {
      recentBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No students added yet. Click 'Add New Student' to register.</td></tr>`;
    } else {
      recentBody.innerHTML = lists.recentStudents
        .map(
          (s) => `
        <tr>
          <td><span class="fw-bold text-dark">${s.registerNumber}</span></td>
          <td><div class="fw-semibold">${s.name}</div></td>
          <td><span class="badge bg-light text-dark border">${s.department}</span></td>
          <td><span class="badge badge-soft-primary fw-bold">${s.cgpa || 0}</span></td>
          <td><span class="badge bg-info-subtle text-info-emphasis">${s.careerGoal || 'Not Set'}</span></td>
          <td><small class="text-muted">${formatDate(s.createdAt)}</small></td>
          <td>
            <a href="student-profile.html?id=${s._id}" class="btn btn-sm btn-primary py-1 px-2" style="font-size: 0.78rem; background-color: var(--primary-color);">
              <i class="bi bi-eye"></i> View Profile
            </a>
          </td>
        </tr>`
        )
        .join('');
    }
  }
}
