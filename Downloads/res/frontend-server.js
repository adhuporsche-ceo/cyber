const path = require('path');
const express = require('express');

const app = express();
const publicDirectory = path.join(__dirname, 'public');
const port = 3000;

const demoAccounts = [
  { email: 'admin@college.edu', password: 'Admin@123', name: 'Preview Administrator', role: 'SUPER_ADMIN', department: 'ALL' },
  { email: 'faculty@college.edu', password: 'Mentor@123', name: 'Preview Faculty Mentor', role: 'FACULTY_MENTOR', department: 'CSE' },
  { email: 'student@college.edu', password: 'Student@123', name: 'Preview Student', role: 'student', department: 'CSE' },
];

const emptyDashboard = {
  kpis: {
    totalStudents: 0, hostellers: 0, dayScholars: 0, avgCgpa: '0.00', highestCgpa: '0.00',
    lowestCgpa: '0.00', activeArrears: 0, pendingArrears: 0, clearedArrears: 0, attentionRequiredCount: 0,
  },
  charts: {
    semesterSgpa: { labels: [], data: [] },
    cgpaDistribution: { labels: [], data: [] },
    careerGoals: { labels: [], data: [] },
    categoryRatio: { labels: ['Hostellers', 'Day Scholars'], data: [0, 0] },
    arrearStatus: { labels: ['Pending Arrears', 'Cleared Arrears'], data: [0, 0] },
    departmentCounts: { labels: [], data: [] },
  },
  lists: { recentStudents: [], attentionList: [], activeArrearList: [], decliningTrendList: [], improvingTrendList: [], missingTechList: [] },
};

app.use(express.json());
app.use(express.static(publicDirectory));

app.post('/api/auth/login', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const account = demoAccounts.find((item) => item.email === email && item.password === req.body?.password);
  if (!account) return res.status(401).json({ success: false, message: 'Use one of the local demo accounts for frontend preview.' });

  return res.json({
    success: true,
    data: {
      token: 'local-frontend-preview',
      user: { id: `preview-${account.role}`, name: account.name, email: account.email, role: account.role, department: account.department },
    },
  });
});

app.post('/api/auth/logout', (req, res) => res.json({ success: true }));
app.get('/api/auth/me', (req, res) => res.json({ success: true, data: demoAccounts[0] }));
app.get('/api/health', (req, res) => res.json({ success: true, mode: 'frontend-preview' }));
app.get(['/api/insights/dashboard', '/api/insights/dashboard/stats', '/api/dashboard/stats'], (req, res) => {
  res.json({ success: true, data: emptyDashboard });
});
app.get(['/api/insights/mentor-attention', '/api/insights/mentor/attention'], (req, res) => {
  res.json({ success: true, data: { totalAttentionCount: 0, students: [] } });
});
app.get(['/api/insights/analytics', '/api/insights/analytics/overview'], (req, res) => {
  res.json({
    success: true,
    data: {
      ...emptyDashboard,
      professionalCoverage: { withCertifications: 0, withProjects: 0, withInternships: 0, withGithub: 0, withLinkedin: 0, total: 0 },
      topSkills: { labels: [], data: [] },
      topLanguages: { labels: [], data: [] },
      interventionsSummary: { open: 0, inProgress: 0, resolved: 0, total: 0 },
    },
  });
});
app.get('/api/students', (req, res) => res.json({ success: true, data: [], pagination: { total: 0, page: 1, pages: 1, limit: 10 } }));
app.get('/api/student-applications', (req, res) => res.json({ success: true, data: [] }));
app.get('/api/users', (req, res) => res.json({ success: true, data: [] }));
app.get('/api/audit-logs', (req, res) => res.json({ success: true, data: [], pagination: { total: 0, page: 1, pages: 1, limit: 20 } }));
app.get('/api/settings', (req, res) => res.json({ success: true, data: { attendanceThreshold: 75, cgpaThreshold: 6.5 } }));
app.get('/api/students/import/template', (req, res) => res.type('text/csv').send('registerNumber,name,department,section,institutionalEmail,personalEmail,mobile\n'));
app.get('/api/reports/export', (req, res) => res.type('text/csv').send('Register Number,Student Name,Department\r\n'));

app.use('/api', (req, res) => {
  res.status(501).json({
    success: false,
    message: 'This action is unavailable in frontend preview mode; no data was saved.',
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(publicDirectory, 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Frontend preview running at http://0.0.0.0:${port}`);
  console.log('Demo credentials:');
  console.log('  Super Admin -> admin@college.edu / Admin@123');
  console.log('  Faculty Mentor -> faculty@college.edu / Mentor@123');
  console.log('  Student -> student@college.edu / Student@123');
});