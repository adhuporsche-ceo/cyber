const http = require('http');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const accountsPath = path.join(__dirname, '..', '.local-accounts.json');
const seededAccounts = fs.existsSync(accountsPath)
  ? JSON.parse(fs.readFileSync(accountsPath, 'utf8')).accounts || []
  : [];
const adminAccount = seededAccounts.find((account) => account.role === 'SUPER_ADMIN');

const request = (method, path, body = null, token = null) => {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const data = body ? JSON.stringify(body) : null;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);

    const req = http.request(
      {
        hostname: 'localhost',
        port: Number(process.env.PORT) || 3000,
        path,
        method,
        headers,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            const parsed = res.headers['content-type']?.includes('json')
              ? JSON.parse(raw)
              : raw;
            resolve({ status: res.statusCode, headers: res.headers, data: parsed });
          } catch (e) {
            resolve({ status: res.statusCode, headers: res.headers, raw });
          }
        });
      }
    );

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
};

const runTests = async () => {
  console.log('--- STARTING SYSTEM INTEGRATION & API TESTS ---\n');
  let token = null;
  let testStudentId = null;

  try {
    // 1. Health check
    console.log('1. Testing GET /api/health...');
    const health = await request('GET', '/api/health');
    console.log(`   Status: ${health.status}, Success: ${health.data.success}`);
    if (health.status !== 200) throw new Error('Health check failed');

    // 2. Auth Login (Admin)
    console.log('\n2. Testing POST /api/auth/login (Admin)...');
    const loginRes = await request('POST', '/api/auth/login', {
      email: adminAccount?.email || 'admin@college.edu',
      password: adminAccount?.password || 'Admin@123',
    });
    console.log(`   Status: ${loginRes.status}, User: ${loginRes.data.data?.user?.name}, Role: ${loginRes.data.data?.user?.role}`);
    if (loginRes.status !== 200) throw new Error('Admin login failed');
    token = loginRes.data.data.token;

    // 3. Auth Me
    console.log('\n3. Testing GET /api/auth/me...');
    const meRes = await request('GET', '/api/auth/me', null, token);
    console.log(`   Status: ${meRes.status}, Email: ${meRes.data.data?.email}`);
    if (meRes.status !== 200) throw new Error('Get current user failed');

    // 4. Dashboard Insights
    console.log('\n4. Testing GET /api/insights/dashboard...');
    const dashRes = await request('GET', '/api/insights/dashboard', null, token);
    const kpis = dashRes.data.data?.kpis || {};
    console.log(`   Status: ${dashRes.status}`);
    console.log(`   Total Students: ${kpis.totalStudents}`);
    console.log(`   Avg CGPA: ${kpis.avgCgpa}`);
    console.log(`   Hostellers: ${kpis.hostellers}, Day Scholars: ${kpis.dayScholars}`);
    console.log(`   Active Arrears: ${kpis.activeArrears}`);
    console.log(`   Attention Required Count: ${kpis.attentionRequiredCount}`);
    if (dashRes.status !== 200) throw new Error('Dashboard insights failed');

    // 5. Students Directory Listing & Filters
    console.log('\n5. Testing GET /api/students with filters...');
    const studentsRes = await request('GET', '/api/students?department=CSE', null, token);
    console.log(`   Status: ${studentsRes.status}, Found: ${studentsRes.data.data?.length} CSE students`);
    if (studentsRes.status !== 200) throw new Error('Get students list failed');

    // 6. Create New Student Profile
    console.log('\n6. Testing POST /api/students (Creating Test Student)...');
    const newStudentData = {
      personalDetails: {
        registerNumber: '710021104999',
        name: 'Test Candidate Student',
        dob: '2003-04-15',
        gender: 'Male',
        department: 'CSE',
        section: 'B',
        institutionalEmail: 'test.student21@college.edu',
        personalEmail: 'candidate.test@gmail.com',
        mobile: '9840999999',
        residentialAddress: 'No. 99, University Avenue, Chennai',
        category: 'Hosteller',
        hostelName: 'Bhavani Boys Hostel - Room 301',
        distanceFromCollege: 0,
      },
      familyDetails: {
        father: { name: 'R. Candidate', occupation: 'Teacher', incomeRange: '₹3–5 Lakhs', mobile: '9840999998' },
        mother: { name: 'S. Candidate', occupation: 'Homemaker', incomeRange: 'Below ₹1 Lakh', mobile: '9840999997' },
        emergencyContact: '9840999998',
        firstGenGraduate: 'Yes',
        scholarshipReceived: 'No',
        guidanceRequired: 'Yes',
      },
      semesters: [
        { semesterNumber: 1, sgpa: 7.5, cgpa: 7.5, attendance: 85, arrearStatus: 'No', numberOfArrears: 0, subjectsStrong: ['Python'] },
        { semesterNumber: 2, sgpa: 7.8, cgpa: 7.65, attendance: 88, arrearStatus: 'No', numberOfArrears: 0, subjectsStrong: ['Data Structures'] },
      ],
      arrears: [],
      technicalProfile: {
        programmingLanguages: ['Java', 'Python'],
        technicalSkills: ['SQL', 'Git'],
        preferredDomain: 'Web Development',
        communicationLevel: 'Intermediate',
        aptitudeLevel: 'Intermediate',
        projects: [
          { title: 'Campus Note Sharing Portal', technologies: ['Java', 'SQL'], projectStatus: 'Completed' },
        ],
      },
      selfEvaluation: {
        academicStrengths: ['Punctual', 'Fast learner'],
        improvementAreas: ['Communication speed'],
        shortTermGoal: 'Pass all semester exams with 8.0+ SGPA',
        longTermGoal: 'Software Engineer in IT company',
      },
      careerGoal: {
        primaryGoal: 'Placement',
        placement: {
          preferredRole: 'Software Trainee',
          preferredDomain: 'Web Development',
          companyType: 'Service',
          expectedSalary: '₹4–6 LPA',
          targetCompanies: ['Zoho', 'TCS'],
        },
      },
      consent: true,
    };

    const createRes = await request('POST', '/api/students', newStudentData, token);
    console.log(`   Status: ${createRes.status}, Message: ${createRes.data.message}`);
    if (createRes.status !== 201) throw new Error(`Create student failed: ${JSON.stringify(createRes.data)}`);
    testStudentId = createRes.data.data._id;
    console.log(`   Created Test Student ID: ${testStudentId}`);

    // 7. Get Single Student
    console.log(`\n7. Testing GET /api/students/${testStudentId}...`);
    const getSingleRes = await request('GET', `/api/students/${testStudentId}`, null, token);
    console.log(`   Status: ${getSingleRes.status}`);
    console.log(`   Profile Completion: ${getSingleRes.data.data?.analytics?.completion?.percentage}%`);
    console.log(`   Academic Trend: ${getSingleRes.data.data?.analytics?.academicTrend?.label}`);
    console.log(`   Mentor Attention: ${getSingleRes.data.data?.analytics?.mentorAttention?.statusText}`);
    console.log(`   Skill Gap Domain: ${getSingleRes.data.data?.analytics?.skillGap?.targetDomain}`);
    if (getSingleRes.status !== 200) throw new Error('Get single student failed');

    // 8. Add Semester to Student
    console.log(`\n8. Testing POST /api/students/${testStudentId}/semesters...`);
    const addSemRes = await request(
      'POST',
      `/api/students/${testStudentId}/semesters`,
      {
        semesterNumber: 3,
        sgpa: 8.2,
        cgpa: 7.83,
        attendance: 90,
        arrearStatus: 'No',
        numberOfArrears: 0,
        academicAchievements: 'Distinction in DBMS',
      },
      token
    );
    console.log(`   Status: ${addSemRes.status}, Message: ${addSemRes.data.message}`);
    if (addSemRes.status !== 201) throw new Error('Add semester failed');

    // 9. Add Arrear Record
    console.log(`\n9. Testing POST /api/students/${testStudentId}/arrears...`);
    const addArrRes = await request(
      'POST',
      `/api/students/${testStudentId}/arrears`,
      {
        semesterOccurred: 2,
        subjectCode: 'CS8251',
        subjectName: 'Programming in C',
        attempts: 1,
        status: 'Pending',
        reason: 'Pointers syntax difficulty',
        remedialRequired: 'Yes',
        mentorSupportRequired: 'Yes',
      },
      token
    );
    console.log(`   Status: ${addArrRes.status}, Message: ${addArrRes.data.message}`);
    if (addArrRes.status !== 201) throw new Error('Add arrear failed');
    const arrearId = addArrRes.data.data[0]?._id;

    // 10. Update Arrear (Mark Cleared)
    console.log(`\n10. Testing PUT /api/students/${testStudentId}/arrears/${arrearId}...`);
    const updateArrRes = await request(
      'PUT',
      `/api/students/${testStudentId}/arrears/${arrearId}`,
      {
        status: 'Cleared',
        clearedSemester: 3,
        clearedGrade: 'B+',
      },
      token
    );
    console.log(`   Status: ${updateArrRes.status}, Message: ${updateArrRes.data.message}`);
    if (updateArrRes.status !== 200) throw new Error('Update arrear failed');

    // 11. Add Mentor Intervention
    console.log(`\n11. Testing POST /api/students/${testStudentId}/interventions...`);
    const intRes = await request(
      'POST',
      `/api/students/${testStudentId}/interventions`,
      {
        reason: 'Quarterly academic review & arrear clearance confirmation',
        mentorNote: 'Candidate cleared C programming arrear in Sem 3 with grade B+. Advised to focus on web development projects.',
        actionTaken: 'Cleared from remedial tutorial list.',
        status: 'Resolved',
      },
      token
    );
    console.log(`   Status: ${intRes.status}, Message: ${intRes.data.message}`);
    if (intRes.status !== 201) throw new Error('Add mentor intervention failed');

    // 12. Student Comparison API
    console.log('\n12. Testing GET /api/insights/compare...');
    // Compare with another seeded student
    const seedStudents = studentsRes.data.data || [];
    if (seedStudents.length >= 2) {
      const compareIds = `${seedStudents[0]._id},${seedStudents[1]._id}`;
      const compRes = await request('GET', `/api/insights/compare?ids=${compareIds}`, null, token);
      console.log(`   Status: ${compRes.status}, Compared ${compRes.data.data?.length} students`);
      console.log(`   Student 1 Name: ${compRes.data.data[0]?.name}, CGPA: ${compRes.data.data[0]?.currentCGPA}`);
      console.log(`   Student 2 Name: ${compRes.data.data[1]?.name}, CGPA: ${compRes.data.data[1]?.currentCGPA}`);
      if (compRes.status !== 200) throw new Error('Compare students failed');
    }

    // 13. Reports CSV Export
    console.log('\n13. Testing GET /api/reports/export?type=students...');
    const reportRes = await request('GET', '/api/reports/export?type=students', null, token);
    console.log(`   Status: ${reportRes.status}, Content-Type: ${reportRes.headers['content-type']}`);
    console.log(`   CSV Header Sample: ${String(reportRes.data).split('\r\n')[0]}`);
    if (reportRes.status !== 200) throw new Error('Export reports failed');

    // 14. Audit Logs (Admin)
    console.log('\n14. Testing GET /api/audit-logs...');
    const auditRes = await request('GET', '/api/audit-logs', null, token);
    console.log(`   Status: ${auditRes.status}, Total Audit Logs: ${auditRes.data.pagination?.total}`);
    console.log(`   Most Recent Action: ${auditRes.data.data[0]?.action} by ${auditRes.data.data[0]?.userName}`);
    if (auditRes.status !== 200) throw new Error('Get audit logs failed');

    // 15. Delete Test Student Profile
    console.log(`\n15. Testing DELETE /api/students/${testStudentId}...`);
    const delRes = await request('DELETE', `/api/students/${testStudentId}`, null, token);
    console.log(`   Status: ${delRes.status}, Message: ${delRes.data.message}`);
    if (delRes.status !== 200) throw new Error('Delete student failed');

    console.log('\n======================================================');
    console.log('ALL INTEGRATION & API TESTS PASSED WITH 100% SUCCESS!');
    console.log('======================================================\n');
  } catch (err) {
    console.error('\n❌ Test Failure:', err.message);
    process.exit(1);
  }
};

runTests();
