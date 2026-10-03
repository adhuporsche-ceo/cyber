/**
 * Analytical Charts and Professional Readiness Metrics Handler
 */

document.addEventListener('DOMContentLoaded', async () => {
  if (!checkAuth()) return;
  initLayout('analytics');

  try {
    const res = await apiCall('/insights/analytics');
    if (res.success && res.data) {
      renderReadinessBars(res.data.professionalCoverage || {});
      renderAnalyticsCharts(res.data);
    }
  } catch (err) {
    showToast(`Failed to load analytics: ${err.message}`, 'danger');
  }
});

function renderReadinessBars(cov = {}) {
  const container = document.getElementById('readinessProgressBars');
  const total = cov.total || 1;

  const metrics = [
    { label: 'Completed Projects', count: cov.withProjects || 0, color: 'bg-primary' },
    { label: 'Certified Students', count: cov.withCertifications || 0, color: 'bg-success' },
    { label: 'Internship Experience', count: cov.withInternships || 0, color: 'bg-info' },
    { label: 'Active GitHub Portfolios', count: cov.withGithub || 0, color: 'bg-dark' },
    { label: 'LinkedIn Profiles', count: cov.withLinkedin || 0, color: 'bg-primary' },
  ];

  container.innerHTML = metrics
    .map((m) => {
      const pct = Math.round((m.count / total) * 100);
      return `
      <div class="col-md">
        <div class="d-flex justify-content-between align-items-center mb-1 small">
          <span class="fw-semibold text-dark">${m.label}</span>
          <span class="fw-bold">${pct}% (${m.count}/${total})</span>
        </div>
        <div class="progress" style="height: 8px;">
          <div class="progress-bar ${m.color}" role="progressbar" style="width: ${pct}%;"></div>
        </div>
      </div>`;
    })
    .join('');
}

function renderAnalyticsCharts(data) {
  if (window.ChartTheme) ChartTheme.apply();
  const charts = data.charts || {};
  const chartColors = ChartTheme.colors();

  // 1. CGPA Distribution
  const ctxCgpa = document.getElementById('analyticsCgpaChart');
  if (ctxCgpa && charts.cgpaDistribution) {
    new Chart(ctxCgpa, {
      type: 'bar',
      data: {
        labels: charts.cgpaDistribution.labels || [],
        datasets: [
          {
            label: 'Students Count',
            data: charts.cgpaDistribution.data || [],
            backgroundColor: chartColors[0],
            borderColor: chartColors[1],
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    });
  }

  // 2. SGPA Trend
  const ctxSgpa = document.getElementById('analyticsSgpaChart');
  if (ctxSgpa && charts.semesterSgpa) {
    new Chart(ctxSgpa, {
      type: 'line',
      data: {
        labels: charts.semesterSgpa.labels || [],
        datasets: [
          {
            label: 'Average SGPA',
            borderColor: chartColors[1],
            backgroundColor: chartColors[0],
            fill: false,
            tension: 0.25,
            pointRadius: 4,
            pointBackgroundColor: chartColors[3],
            pointBorderColor: chartColors[1],
            pointBorderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { min: 0, max: 10, ticks: { stepSize: 2 } } },
      },
    });
  }

  // 3. Top Skills
  const ctxSkills = document.getElementById('analyticsSkillsChart');
  if (ctxSkills && data.topSkills) {
    new Chart(ctxSkills, {
      type: 'bar',
      data: {
              datasets: [
          {
            label: 'Students with Skill',
            data: data.topSkills.data || [],
            backgroundColor: chartColors[2],
            borderColor: chartColors[1],
            borderWidth: 2,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    });
  }

  // 4. Top Languages
  const ctxLang = document.getElementById('analyticsLanguagesChart');
  if (ctxLang && data.topLanguages) {
    new Chart(ctxLang, {
      type: 'bar',
      data: {
        labels: data.topLanguages.labels || [],
        datasets: [
          {
            label: 'Students Fluent',
            data: data.topLanguages.data || [],
            backgroundColor: chartColors[1],
            borderColor: chartColors[3],
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    });
  }

  // 5. Career Goals
  const ctxCareer = document.getElementById('analyticsCareerChart');
  if (ctxCareer && charts.careerGoals) {
    new Chart(ctxCareer, {
      type: 'doughnut',
      data: {
        labels: charts.careerGoals.labels || [],
        datasets: [
          {
            data: charts.careerGoals.data || [],
            backgroundColor: chartColors,
            borderWidth: 2,
            borderColor: chartColors[3],
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } },
        cutout: '60%',
      },
    });
  }

  // 6. Arrear Status
  const ctxArrear = document.getElementById('analyticsArrearChart');
  if (ctxArrear && charts.arrearStatus) {
    new Chart(ctxArrear, {
      type: 'pie',
      data: {
        labels: charts.arrearStatus.labels || [],
        datasets: [
          {
            data: charts.arrearStatus.data || [],
            backgroundColor: [chartColors[1], chartColors[2]],
            borderWidth: 2,
            borderColor: chartColors[3],
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } },
      },
    });
  }

  // 7. Category Ratio
  const ctxCategory = document.getElementById('analyticsCategoryChart');
  if (ctxCategory && charts.categoryRatio) {
    new Chart(ctxCategory, {
      type: 'doughnut',
      data: {
        labels: charts.categoryRatio.labels || [],
        datasets: [
          {
            data: charts.categoryRatio.data || [],
            backgroundColor: [chartColors[0], chartColors[2]],
            borderWidth: 2,
            borderColor: chartColors[3],
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } },
        cutout: '60%',
      },
    });
  }

  // 8. Department Enrollment
  const ctxDept = document.getElementById('analyticsDeptChart');
  if (ctxDept && charts.departmentCounts) {
    new Chart(ctxDept, {
      type: 'bar',
      data: {
        labels: charts.departmentCounts.labels || [],
        datasets: [
          {
            label: 'Enrollment',
            data: charts.departmentCounts.data || [],
            backgroundColor: chartColors[0],
            borderColor: chartColors[1],
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    });
  }

  // 9. Interventions Summary
  const ctxIntervention = document.getElementById('analyticsInterventionChart');
  const intSum = data.interventionsSummary || { open: 0, inProgress: 0, resolved: 0 };
  if (ctxIntervention) {
    new Chart(ctxIntervention, {
      type: 'polarArea',
      data: {
        labels: ['Open', 'In Progress', 'Resolved'],
        datasets: [
          {
            data: [intSum.open, intSum.inProgress, intSum.resolved],
            backgroundColor: [chartColors[2], chartColors[0], chartColors[1]],
            borderWidth: 2,
            borderColor: chartColors[3],
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } },
      },
    });
  }
}
