const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');

const connectionString = process.env.DATABASE_URL;

// Demo User UUIDs
const ADMIN_ID = 'e8888888-8888-4888-8888-888888888881';
const PLACEMENT_ID = 'e8888888-8888-4888-8888-888888888882';
const HOD_ID = 'e8888888-8888-4888-8888-888888888883';
const MENTOR_ID = 'e8888888-8888-4888-8888-888888888884';
const STUDENT_USER_ID = 'e8888888-8888-4888-8888-888888888885';

// Pre-hashed passwords for instant boot
const DEFAULT_PASSWORDS = {
  admin: bcrypt.hashSync('Admin@123', 10),
  coordinator: bcrypt.hashSync('Coordinator@123', 10),
  hod: bcrypt.hashSync('Hod@123', 10),
  mentor: bcrypt.hashSync('Mentor@123', 10),
  student: bcrypt.hashSync('Student@123', 10),
};

// In-Memory Database Store (used when DATABASE_URL is not set or unavailable)
class InMemoryDatabase {
  constructor() {
    this.users = [];
    this.students = [];
    this.student_applications = [];
    this.audit_logs = [];
    this.app_settings = {
      id: true,
      attendance_threshold: Number(process.env.ATTENDANCE_ATTENTION_THRESHOLD || 75),
      cgpa_threshold: Number(process.env.CGPA_ATTENTION_THRESHOLD || 6.5),
      updated_by: null,
      updated_at: new Date(),
    };
    this.seeded = false;
  }

  seed() {
    if (this.seeded) return;
    this.seeded = true;

    // 1. Seed Default Demo Users
    this.users = [
      {
        id: ADMIN_ID,
        name: 'Preview Administrator',
        email: 'admin@college.edu',
        password_hash: DEFAULT_PASSWORDS.admin,
        role: 'SUPER_ADMIN',
        department: 'ALL',
        register_number: null,
        student_profile_id: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: PLACEMENT_ID,
        name: 'Placement Coordinator',
        email: 'coordinator@college.edu',
        password_hash: DEFAULT_PASSWORDS.coordinator,
        role: 'PLACEMENT_COORDINATOR',
        department: 'ALL',
        register_number: null,
        student_profile_id: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: HOD_ID,
        name: 'Dr. K. S. Ramanathan (HOD)',
        email: 'hod@college.edu',
        password_hash: DEFAULT_PASSWORDS.hod,
        role: 'HOD',
        department: 'CSE',
        register_number: null,
        student_profile_id: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: MENTOR_ID,
        name: 'Prof. Priya Chandrasekar',
        email: 'faculty@college.edu',
        password_hash: DEFAULT_PASSWORDS.mentor,
        role: 'FACULTY_MENTOR',
        department: 'CSE',
        register_number: null,
        student_profile_id: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: STUDENT_USER_ID,
        name: 'Preview Student',
        email: 'student@college.edu',
        password_hash: DEFAULT_PASSWORDS.student,
        role: 'STUDENT',
        department: 'CSE',
        register_number: '710021104001',
        student_profile_id: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    if (process.env.INITIAL_ADMIN_EMAIL && process.env.INITIAL_ADMIN_EMAIL.toLowerCase().trim() !== 'admin@college.edu') {
      this.users.push({
        id: randomUUID(),
        name: process.env.INITIAL_ADMIN_NAME || 'Custom Administrator',
        email: process.env.INITIAL_ADMIN_EMAIL.toLowerCase().trim(),
        password_hash: process.env.INITIAL_ADMIN_PASSWORD
          ? bcrypt.hashSync(process.env.INITIAL_ADMIN_PASSWORD, 10)
          : DEFAULT_PASSWORDS.admin,
        role: 'SUPER_ADMIN',
        department: 'ALL',
        register_number: null,
        student_profile_id: null,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    // 2. Seed Sample Students
    try {
      const sampleStudents = require('../seed/sampleStudents');
      if (Array.isArray(sampleStudents)) {
        for (const item of sampleStudents) {
          const personal = item.personalDetails || {};
          const studentId = randomUUID();
          for (const key of ['semesters', 'arrears', 'mentorInterventions']) {
            if (Array.isArray(item[key])) {
              item[key] = item[key].map((child) => ({ ...child, _id: child._id || randomUUID() }));
            }
          }
          item.createdBy = ADMIN_ID;
          item.createdByRole = 'SUPER_ADMIN';
          item.updatedBy = ADMIN_ID;
          item.updatedByRole = 'SUPER_ADMIN';
          item.mentorId = MENTOR_ID;

          this.students.push({
            id: studentId,
            register_number: String(personal.registerNumber || '').toUpperCase(),
            department: String(personal.department || 'CSE').toUpperCase(),
            section: String(personal.section || 'A').toUpperCase(),
            mentor_id: MENTOR_ID,
            created_by: ADMIN_ID,
            updated_by: ADMIN_ID,
            deleted_at: null,
            version: 1,
            profile: item,
            created_at: new Date(),
            updated_at: new Date(),
          });
        }
      }
    } catch (err) {
      console.warn('[AI Studio] Could not load sampleStudents:', err.message);
    }

    // 3. Seed Initial Audit Log
    this.audit_logs.push({
      id: randomUUID(),
      user_id: ADMIN_ID,
      user_name: 'Preview Administrator',
      user_role: 'SUPER_ADMIN',
      action: 'SYSTEM_BOOT',
      student_id: null,
      student_register_number: null,
      student_name: null,
      details: `Initialized in-memory database with ${this.students.length} students and ${this.users.length} users.`,
      ip_address: '127.0.0.1',
      created_at: new Date(),
    });
  }

  async executeQuery(text, params = []) {
    const sql = String(text || '').trim();

    // 1. Simple Health / Schema / Transaction queries
    if (/^SELECT\s+1/i.test(sql)) {
      return { rows: [{ '?column?': 1 }] };
    }
    if (/^CREATE\s+TABLE/i.test(sql) || /^CREATE\s+INDEX/i.test(sql) || /^ALTER\s+TABLE/i.test(sql)) {
      return { rows: [] };
    }
    if (/^BEGIN/i.test(sql) || /^COMMIT/i.test(sql) || /^ROLLBACK/i.test(sql)) {
      return { rows: [] };
    }

    // 2. App Settings queries
    if (/FROM\s+app_settings/i.test(sql)) {
      return {
        rows: [
          {
            attendanceThreshold: this.app_settings.attendance_threshold,
            cgpaThreshold: this.app_settings.cgpa_threshold,
            updatedAt: this.app_settings.updated_at,
          },
        ],
      };
    }
    if (/INSERT\s+INTO\s+app_settings/i.test(sql)) {
      this.app_settings.attendance_threshold = Number(params[0] ?? this.app_settings.attendance_threshold);
      this.app_settings.cgpa_threshold = Number(params[1] ?? this.app_settings.cgpa_threshold);
      this.app_settings.updated_by = params[2] || null;
      this.app_settings.updated_at = new Date();
      return {
        rows: [
          {
            attendanceThreshold: this.app_settings.attendance_threshold,
            cgpaThreshold: this.app_settings.cgpa_threshold,
            updatedAt: this.app_settings.updated_at,
          },
        ],
      };
    }

    // 3. Users queries
    if (/FROM\s+users/i.test(sql)) {
      if (/EXISTS/i.test(sql)) {
        return { rows: [{ has_users: this.users.length > 0 }] };
      }
      if (/password_hash/i.test(sql) && /WHERE\s+id/i.test(sql)) {
        const user = this.users.find((u) => u.id === params[0]);
        return { rows: user ? [{ password_hash: user.password_hash }] : [] };
      }
      if (/WHERE\s+id\s*=\s*\$1/i.test(sql)) {
        const user = this.users.find((u) => u.id === params[0]);
        return { rows: user ? [{ ...user }] : [] };
      }
      if (/lower\(email\)/i.test(sql) || /lower\(register_number\)/i.test(sql)) {
        const input = String(params[0] || '').toLowerCase().trim();
        const user = this.users.find(
          (u) =>
            (u.email && u.email.toLowerCase() === input) ||
            (u.register_number && u.register_number.toLowerCase() === input)
        );
        return { rows: user ? [{ ...user }] : [] };
      }
      // List all users
      const sorted = [...this.users].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      return {
        rows: sorted.map((u) => ({
          _id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          department: u.department,
          registerNumber: u.register_number,
          studentProfileId: u.student_profile_id,
          createdAt: u.created_at,
          updatedAt: u.updated_at,
        })),
      };
    }

    if (/INSERT\s+INTO\s+users/i.test(sql)) {
      const [name, email, password_hash, role, department, register_number, student_profile_id] = params;
      const normalizedEmail = String(email || '').toLowerCase().trim();
      const existing = this.users.find((u) => u.email.toLowerCase() === normalizedEmail);
      if (existing) {
        if (/ON\s+CONFLICT.*DO\s+NOTHING/i.test(sql)) {
          return { rows: [] };
        }
        const err = new Error('duplicate key value violates unique constraint "users_email_key"');
        err.code = '23505';
        throw err;
      }
      const newUser = {
        id: randomUUID(),
        name: name.trim(),
        email: normalizedEmail,
        password_hash,
        role: role || 'FACULTY_MENTOR',
        department: department || 'General',
        register_number: register_number || null,
        student_profile_id: student_profile_id || null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      this.users.push(newUser);
      return {
        rows: [
          {
            _id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
            department: newUser.department,
            registerNumber: newUser.register_number,
            studentProfileId: newUser.student_profile_id,
            createdAt: newUser.created_at,
            updatedAt: newUser.updated_at,
          },
        ],
      };
    }

    if (/UPDATE\s+users\s+SET\s+password_hash/i.test(sql)) {
      const user = this.users.find((u) => u.id === params[1]);
      if (user) {
        user.password_hash = params[0];
        user.updated_at = new Date();
      }
      return { rows: [] };
    }

    // 4. Students queries
    if (/SELECT\s+register_number\s+FROM\s+students\s+WHERE\s+register_number\s*=\s*ANY/i.test(sql)) {
      const regList = Array.isArray(params[0]) ? params[0] : [];
      const matches = this.students.filter((s) => regList.includes(s.register_number));
      return { rows: matches.map((s) => ({ register_number: s.register_number })) };
    }

    if (/FROM\s+students/i.test(sql) && /WHERE[\s\S]*?id\s*=\s*\$1/i.test(sql)) {
      const student = this.students.find((s) => s.id === params[0]);
      if (!student) return { rows: [] };
      if (/deleted_at\s+IS\s+NULL/i.test(sql) && student.deleted_at) {
        return { rows: [] };
      }
      return { rows: [{ ...student, profile: JSON.parse(JSON.stringify(student.profile)) }] };
    }

    if (/INSERT\s+INTO\s+students/i.test(sql)) {
      let regNum, dept, sec, mentor, createdBy, profileJson;
      if (/VALUES\s*\(\$1,\s*\$2,\s*\$3,\s*\$4,\s*\$5,\s*\$5,\s*\$6::jsonb\)/i.test(sql)) {
        [regNum, dept, sec, mentor, createdBy, profileJson] = params;
      } else if (/VALUES\s*\(\$1,\s*\$2,\s*\$3,\s*\$4,\s*\$4,\s*\$5::jsonb\)/i.test(sql)) {
        [regNum, dept, sec, createdBy, profileJson] = params;
        mentor = null;
      } else if (params.length === 8) {
        const [id, r, d, s, m, cb, ub, pf] = params;
        regNum = r; dept = d; sec = s; mentor = m; createdBy = cb; profileJson = pf;
      } else {
        [regNum, dept, sec, mentor, createdBy, profileJson] = params;
      }

      const regUpper = String(regNum || '').trim().toUpperCase();
      const existing = this.students.find((s) => s.register_number === regUpper && !s.deleted_at);
      if (existing) {
        const err = new Error('duplicate key value violates unique constraint "students_register_number_key"');
        err.code = '23505';
        throw err;
      }

      let parsedProfile = {};
      try {
        parsedProfile = typeof profileJson === 'string' ? JSON.parse(profileJson) : profileJson;
      } catch (e) {
        parsedProfile = profileJson || {};
      }

      const newStudent = {
        id: randomUUID(),
        register_number: regUpper,
        department: String(dept || '').toUpperCase(),
        section: String(sec || '').toUpperCase(),
        mentor_id: mentor || null,
        created_by: createdBy || null,
        updated_by: createdBy || null,
        deleted_at: null,
        version: 1,
        profile: parsedProfile,
        created_at: new Date(),
        updated_at: new Date(),
      };
      this.students.push(newStudent);
      return { rows: [{ ...newStudent }] };
    }

    if (/UPDATE\s+students\s+SET/i.test(sql)) {
      if (/SET\s+deleted_at\s*=\s*NOW\(\)/i.test(sql)) {
        const [updatedBy, studentId] = params;
        const student = this.students.find((s) => s.id === studentId);
        if (student) {
          student.deleted_at = new Date();
          student.updated_by = updatedBy;
          student.version += 1;
          student.updated_at = new Date();
        }
        return { rows: student ? [{ ...student }] : [] };
      }

      if (/SET\s+deleted_at\s*=\s*NULL/i.test(sql)) {
        const [updatedBy, studentId] = params;
        const student = this.students.find((s) => s.id === studentId);
        if (student) {
          student.deleted_at = null;
          student.updated_by = updatedBy;
          student.version += 1;
          student.updated_at = new Date();
        }
        return { rows: student ? [{ ...student }] : [] };
      }

      if (/profile\s*=\s*\$6::jsonb/i.test(sql)) {
        const [regNum, dept, sec, mentor, updatedBy, profileJson, studentId, expectedVersion] = params;
        const student = this.students.find((s) => s.id === studentId);
        if (!student) return { rows: [] };
        if (expectedVersion !== undefined && student.version !== Number(expectedVersion)) {
          return { rows: [] };
        }
        let parsedProfile = {};
        try {
          parsedProfile = typeof profileJson === 'string' ? JSON.parse(profileJson) : profileJson;
        } catch (e) {
          parsedProfile = profileJson || {};
        }
        student.register_number = String(regNum || '').trim().toUpperCase();
        student.department = String(dept || '').toUpperCase();
        student.section = String(sec || '').toUpperCase();
        student.mentor_id = mentor || null;
        student.updated_by = updatedBy;
        student.profile = parsedProfile;
        student.version += 1;
        student.updated_at = new Date();
        return { rows: [{ ...student }] };
      }
    }

    if (/FROM\s+students/i.test(sql)) {
      let filtered = [...this.students];

      if (/deleted_at\s+IS\s+NULL/i.test(sql)) {
        filtered = filtered.filter((s) => !s.deleted_at);
      }

      if (/department\s*=\s*\$(\d+)/i.test(sql)) {
        const match = sql.match(/department\s*=\s*\$(\d+)/i);
        const paramIndex = parseInt(match[1], 10) - 1;
        const deptVal = String(params[paramIndex] || '').toUpperCase();
        if (deptVal) {
          filtered = filtered.filter((s) => s.department === deptVal);
        }
      }

      if (/mentor_id\s*=\s*\$(\d+)/i.test(sql)) {
        const match = sql.match(/mentor_id\s*=\s*\$(\d+)/i);
        const paramIndex = parseInt(match[1], 10) - 1;
        const mentorVal = params[paramIndex];
        if (mentorVal) {
          filtered = filtered.filter((s) => s.mentor_id === mentorVal);
        }
      }

      if (/SELECT\s+id,\s*profile\s+FROM/i.test(sql)) {
        return { rows: filtered.map((s) => ({ id: s.id, profile: s.profile })) };
      }
      if (/SELECT\s+id,\s*mentor_id,\s*profile\s+FROM/i.test(sql)) {
        return { rows: filtered.map((s) => ({ id: s.id, mentor_id: s.mentor_id, profile: s.profile })) };
      }

      return { rows: filtered.map((s) => ({ ...s })) };
    }

    // 5. Audit Logs queries
    if (/INSERT\s+INTO\s+audit_logs/i.test(sql)) {
      let log;
      if (params.length === 5) {
        log = {
          id: randomUUID(),
          user_id: params[0],
          user_name: params[1],
          user_role: params[2],
          action: 'LOGIN',
          details: params[3],
          ip_address: params[4],
          created_at: new Date(),
        };
      } else if (params.length === 6) {
        log = {
          id: randomUUID(),
          user_id: params[0],
          user_name: params[1],
          user_role: params[2],
          action: params[3],
          details: params[4],
          ip_address: params[5],
          created_at: new Date(),
        };
      } else if (params.length === 9) {
        log = {
          id: randomUUID(),
          user_id: params[0],
          user_name: params[1],
          user_role: params[2],
          action: params[3],
          student_id: params[4],
          student_register_number: params[5],
          student_name: params[6],
          details: params[7],
          ip_address: params[8],
          created_at: new Date(),
        };
      } else {
        log = {
          id: randomUUID(),
          user_id: params[0] || null,
          user_name: params[1] || '',
          user_role: params[2] || '',
          action: params[3] || '',
          details: params[params.length - 2] || '',
          ip_address: params[params.length - 1] || '',
          created_at: new Date(),
        };
      }
      this.audit_logs.push(log);
      return { rows: [] };
    }

    if (/SELECT\s+COUNT\(\*\)::int\s+AS\s+total\s+FROM\s+audit_logs/i.test(sql)) {
      let filtered = [...this.audit_logs];
      if (/action\s*=\s*\$(\d+)/i.test(sql)) {
        const match = sql.match(/action\s*=\s*\$(\d+)/i);
        const idx = parseInt(match[1], 10) - 1;
        filtered = filtered.filter((l) => l.action === params[idx]);
      }
      return { rows: [{ total: filtered.length }] };
    }

    if (/FROM\s+audit_logs/i.test(sql)) {
      let filtered = [...this.audit_logs];
      if (/action\s*=\s*\$(\d+)/i.test(sql)) {
        const match = sql.match(/action\s*=\s*\$(\d+)/i);
        const idx = parseInt(match[1], 10) - 1;
        filtered = filtered.filter((l) => l.action === params[idx]);
      }
      filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      let limit = 20;
      let offset = 0;
      if (params.length >= 2) {
        offset = Number(params[params.length - 1]) || 0;
        limit = Number(params[params.length - 2]) || 20;
      }
      const page = filtered.slice(offset, offset + limit);
      return {
        rows: page.map((l) => ({
          _id: l.id,
          userId: l.user_id,
          userName: l.user_name,
          userRole: l.user_role,
          action: l.action,
          studentId: l.student_id,
          studentRegisterNumber: l.student_register_number,
          studentName: l.student_name,
          details: l.details,
          ipAddress: l.ip_address,
          timestamp: l.created_at,
        })),
      };
    }

    // 6. Student Applications queries
    if (/INSERT\s+INTO\s+student_applications/i.test(sql)) {
      const [regNum, appJson] = params;
      const regUpper = String(regNum || '').trim().toUpperCase();
      const existing = this.student_applications.find((a) => a.register_number === regUpper && a.status === 'PENDING');
      if (existing) {
        const err = new Error('duplicate key value violates unique constraint "student_applications_pending_register_unique"');
        err.code = '23505';
        throw err;
      }
      const app = {
        id: randomUUID(),
        register_number: regUpper,
        status: 'PENDING',
        application: appJson,
        submitted_at: new Date(),
        reviewed_at: null,
        reviewed_by: null,
      };
      this.student_applications.push(app);
      return {
        rows: [
          {
            id: app.id,
            register_number: app.register_number,
            status: app.status,
            submitted_at: app.submitted_at,
          },
        ],
      };
    }

    if (/SELECT.*FROM\s+student_applications/i.test(sql)) {
      if (/WHERE\s+id\s*=\s*\$1/i.test(sql)) {
        const app = this.student_applications.find((a) => a.id === params[0]);
        return { rows: app ? [{ ...app }] : [] };
      }
      return {
        rows: this.student_applications.map((a) => ({
          _id: a.id,
          registerNumber: a.register_number,
          status: a.status,
          application: a.application,
          submittedAt: a.submitted_at,
          reviewedAt: a.reviewed_at,
          reviewedBy: a.reviewed_by,
        })),
      };
    }

    if (/UPDATE\s+student_applications\s+SET\s+status\s*=\s*\$1/i.test(sql)) {
      const [status, reviewer, appId] = params;
      const app = this.student_applications.find((a) => a.id === appId);
      if (app) {
        app.status = status;
        app.reviewed_by = reviewer;
        app.reviewed_at = new Date();
      }
      return {
        rows: app
          ? [
              {
                id: app.id,
                registerNumber: app.register_number,
                status: app.status,
                submittedAt: app.submitted_at,
                reviewedAt: app.reviewed_at,
              },
            ]
          : [],
      };
    }

    return { rows: [] };
  }
}

const memoryDb = new InMemoryDatabase();
let isRealPoolConnected = false;
let realPool = null;

if (connectionString) {
  try {
    realPool = new Pool({
      connectionString,
      ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      max: 10,
    });
    realPool.on('error', (err) => {
      console.warn('[AI Studio] PostgreSQL pool error — falling back to in-memory database:', err.message);
      isRealPoolConnected = false;
    });
  } catch (err) {
    console.warn('[AI Studio] Failed to construct PostgreSQL pool:', err.message);
  }
}

// Unified Pool Object
const pool = {
  query: async (text, params) => {
    if (isRealPoolConnected && realPool) {
      try {
        return await realPool.query(text, params);
      } catch (err) {
        console.warn('[AI Studio] Real PostgreSQL query failed, using in-memory store:', err.message);
      }
    }
    return memoryDb.executeQuery(text, params);
  },
  connect: async () => {
    if (isRealPoolConnected && realPool) {
      try {
        const client = await realPool.connect();
        return client;
      } catch (err) {
        console.warn('[AI Studio] Real PostgreSQL connect failed, using in-memory client:', err.message);
      }
    }
    return {
      query: (text, params) => memoryDb.executeQuery(text, params),
      release: () => {},
    };
  },
  end: async () => {
    if (realPool) {
      try {
        await realPool.end();
      } catch (e) {}
    }
  },
};

const initializeDatabase = async () => {
  if (connectionString && realPool) {
    try {
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 1500));
      await Promise.race([realPool.query('SELECT 1'), timeoutPromise]);
      const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
      await realPool.query(schema);

      if (process.env.INITIAL_ADMIN_EMAIL && process.env.INITIAL_ADMIN_PASSWORD) {
        const { rows } = await realPool.query('SELECT EXISTS (SELECT 1 FROM users) AS has_users');
        if (!rows[0].has_users) {
          const passwordHash = await bcrypt.hash(process.env.INITIAL_ADMIN_PASSWORD, 12);
          await realPool.query(
            `INSERT INTO users (name, email, password_hash, role, department)
             VALUES ($1, $2, $3, 'SUPER_ADMIN', 'General')`,
            [
              process.env.INITIAL_ADMIN_NAME || 'System Administrator',
              process.env.INITIAL_ADMIN_EMAIL.trim().toLowerCase(),
              passwordHash,
            ]
          );
        }
      }
      isRealPoolConnected = true;
      console.log('Connected to real PostgreSQL database.');
      return;
    } catch (err) {
      console.warn('[AI Studio] PostgreSQL connection failed. Activating in-memory database mock:', err.message);
      isRealPoolConnected = false;
    }
  }

  // Activate in-memory store with demo data
  memoryDb.seed();
  console.log('[AI Studio] In-memory database active with demo accounts and student profiles.');
};

module.exports = { pool, initializeDatabase };