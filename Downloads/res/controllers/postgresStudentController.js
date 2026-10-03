const { randomUUID } = require('crypto');
const { pool } = require('../config/postgres');
const { calculateProfileCompletion } = require('../services/profileCompletionService');
const { calculateAcademicTrend, evaluateMentorAttention } = require('../services/insightService');
const { analyzeSkillGap } = require('../services/skillGapService');
const { ROLES } = require('../config/permissions');

const editableFields = new Set([
  'personalDetails', 'familyDetails', 'semesters', 'arrears', 'technicalProfile',
  'selfEvaluation', 'careerGoal', 'mentorInterventions', 'consent', 'mentorId',
]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const addChildIds = (profile) => {
  for (const key of ['semesters', 'arrears', 'mentorInterventions']) {
    profile[key] = (profile[key] || []).map((item) => ({ ...item, _id: item._id || randomUUID() }));
  }
  return profile;
};

const mapStudent = (row) => ({
  ...row.profile,
  _id: row.id,
  __v: row.version,
  mentorId: row.mentor_id,
  deletedAt: row.deleted_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const loadStudent = async (id, includeDeleted = false, executor = pool) => {
  if (!uuidPattern.test(id)) return null;
  const { rows } = await executor.query(
    `SELECT id, profile, version, mentor_id, deleted_at, created_at, updated_at
     FROM students WHERE id = $1 ${includeDeleted ? '' : 'AND deleted_at IS NULL'}`,
    [id]
  );
  return rows[0] || null;
};

const hasAccess = (row, user) => {
  if (!row || !user) return false;
  if ([ROLES.SUPER_ADMIN, ROLES.PLACEMENT_COORDINATOR].includes(user.role)) return true;
  if (user.role === ROLES.HOD) return row.department === String(user.department || '').toUpperCase();
  if (user.role === ROLES.FACULTY_MENTOR) {
    return !row.mentor_id || row.mentor_id === user._id || row.department === String(user.department || '').toUpperCase();
  }
  if (user.role === ROLES.STUDENT) {
    const studentProfileMatch = user.studentProfileId && (user.studentProfileId === row.id || user.studentProfileId === row._id);
    const regMatch = user.registerNumber && String(user.registerNumber).toUpperCase() === String(row.register_number || row.personalDetails?.registerNumber || '').toUpperCase();
    return Boolean(studentProfileMatch || regMatch);
  }
  return false;
};

const addAudit = async (req, action, row, details = '') => {
  const profile = row?.profile || {};
  const personal = profile.personalDetails || {};
  await pool.query(
    `INSERT INTO audit_logs (user_id, user_name, user_role, action, student_id,
      student_register_number, student_name, details, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [req.user._id, req.user.name, req.user.role, action, row?.id || null,
      personal.registerNumber || '', personal.name || '', details, req.ip || '']
  );
};

const persistProfile = async (client, row, profile, user) => {
  const personal = profile.personalDetails || {};
  profile.updatedBy = user._id;
  profile.updatedByRole = user.role;
  const { rows } = await client.query(
    `UPDATE students SET register_number = $1, department = $2, section = $3,
       mentor_id = $4, updated_by = $5, profile = $6::jsonb, version = version + 1,
       updated_at = NOW()
     WHERE id = $7 AND version = $8
     RETURNING id, profile, version, mentor_id, deleted_at, created_at, updated_at`,
    [String(personal.registerNumber || row.register_number).trim().toUpperCase(),
      String(personal.department || row.department).trim().toUpperCase(),
      String(personal.section || row.section).trim().toUpperCase(),
      profile.mentorId || row.mentor_id || null, user._id, JSON.stringify(profile), row.id, row.version]
  );
  return rows[0] || null;
};

const getStudents = async (req, res, next) => {
  try {
    const values = [];
    const filters = [req.user.role === ROLES.SUPER_ADMIN && req.query.includeDeleted === 'true' ? 'TRUE' : 'deleted_at IS NULL'];
    if (req.user.role === ROLES.HOD) {
      values.push(String(req.user.department || '').toUpperCase());
      filters.push(`department = $${values.length}`);
    } else if (req.user.role === ROLES.FACULTY_MENTOR) {
      values.push(req.user._id);
      filters.push(`mentor_id = $${values.length}`);
    }
    const { rows } = await pool.query(
      `SELECT id, profile, version, mentor_id, deleted_at, created_at, updated_at
       FROM students WHERE ${filters.join(' AND ')}`,
      values
    );
    let students = rows.map(mapStudent);
    const { search, department, section, category, careerGoal, arrearStatus, minCgpa, maxCgpa, minAttendance, sortBy } = req.query;
    if (search) {
      const term = search.trim().toLowerCase();
      students = students.filter((student) => [student.personalDetails?.name, student.personalDetails?.registerNumber]
        .some((value) => String(value || '').toLowerCase().includes(term)));
    }
    if (department && ![ROLES.HOD, ROLES.FACULTY_MENTOR].includes(req.user.role)) students = students.filter((student) => student.personalDetails?.department === department.toUpperCase());
    if (section) students = students.filter((student) => student.personalDetails?.section === section.toUpperCase());
    if (category) students = students.filter((student) => student.personalDetails?.category === category);
    if (careerGoal) students = students.filter((student) => student.careerGoal?.primaryGoal === careerGoal);
    if (arrearStatus === 'Pending' || arrearStatus === 'Cleared') students = students.filter((student) => student.arrears?.some((arrear) => arrear.status === arrearStatus));
    if (arrearStatus === 'None') students = students.filter((student) => !(student.arrears || []).length);
    const latest = (student) => [...(student.semesters || [])].sort((a, b) => b.semesterNumber - a.semesterNumber)[0] || {};
    if (minCgpa !== undefined && minCgpa !== '') students = students.filter((student) => Number(latest(student).cgpa) >= Number(minCgpa));
    if (maxCgpa !== undefined && maxCgpa !== '') students = students.filter((student) => Number(latest(student).cgpa) <= Number(maxCgpa));
    if (minAttendance !== undefined && minAttendance !== '') students = students.filter((student) => Number(latest(student).attendance) >= Number(minAttendance));
    const comparators = {
      'name-asc': (a, b) => a.personalDetails.name.localeCompare(b.personalDetails.name),
      'name-desc': (a, b) => b.personalDetails.name.localeCompare(a.personalDetails.name),
      'cgpa-desc': (a, b) => Number(latest(b).cgpa || 0) - Number(latest(a).cgpa || 0),
      'cgpa-asc': (a, b) => Number(latest(a).cgpa || 0) - Number(latest(b).cgpa || 0),
      'attendance-desc': (a, b) => Number(latest(b).attendance || 0) - Number(latest(a).attendance || 0),
      'arrears-desc': (a, b) => (b.arrears || []).filter((item) => item.status === 'Pending').length - (a.arrears || []).filter((item) => item.status === 'Pending').length,
    };
    students.sort(comparators[sortBy] || ((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    const total = students.length;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const data = students.slice((page - 1) * limit, page * limit).map((student) => ({
      _id: student._id,
      registerNumber: student.personalDetails.registerNumber,
      name: student.personalDetails.name,
      department: student.personalDetails.department,
      section: student.personalDetails.section,
      category: student.personalDetails.category,
      currentCGPA: latest(student).cgpa || 0,
      latestAttendance: latest(student).attendance || 0,
      pendingArrearsCount: (student.arrears || []).filter((item) => item.status === 'Pending').length,
      careerGoal: student.careerGoal?.primaryGoal,
      profileCompletion: calculateProfileCompletion(student).percentage,
      createdAt: student.createdAt,
      deletedAt: student.deletedAt,
    }));
    res.json({ success: true, data, pagination: { total, page, pages: Math.ceil(total / limit) || 1, limit } });
  } catch (error) { next(error); }
};

const getStudentById = async (req, res, next) => {
  try {
    const row = await loadStudent(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: 'Student not found.' });
    if (!hasAccess(row, req.user)) return res.status(403).json({ success: false, message: 'You cannot view this student.' });
    const student = mapStudent(row);
    res.json({ success: true, data: { student, analytics: {
      completion: calculateProfileCompletion(student),
      academicTrend: calculateAcademicTrend(student.semesters),
      mentorAttention: evaluateMentorAttention(student),
      skillGap: analyzeSkillGap(student),
    } } });
  } catch (error) { next(error); }
};

const createStudent = async (req, res, next) => {
  try {
    const profile = addChildIds({ ...req.body });
    const personal = profile.personalDetails || {};
    if (profile.consent !== true) return res.status(400).json({ success: false, message: 'Consent confirmation is required for profiling.' });
    if (!personal.registerNumber || !personal.name) return res.status(400).json({ success: false, message: 'Register number and student name are required.' });
    profile.createdBy = req.user._id;
    profile.createdByRole = req.user.role;
    profile.updatedBy = req.user._id;
    profile.updatedByRole = req.user.role;
    profile.deletedAt = null;
    const { rows } = await pool.query(
      `INSERT INTO students (register_number, department, section, mentor_id, created_by, updated_by, profile)
       VALUES ($1, $2, $3, $4, $5, $5, $6::jsonb)
       RETURNING id, profile, version, mentor_id, deleted_at, created_at, updated_at`,
      [personal.registerNumber.trim().toUpperCase(), String(personal.department || '').toUpperCase(), String(personal.section || '').toUpperCase(), profile.mentorId || null, req.user._id, JSON.stringify(profile)]
    );

    // If user is a student, associate the created student profile with the user account
    if (req.user.role === ROLES.STUDENT && req.user._id) {
      try {
        await pool.query('UPDATE users SET student_profile_id = $1 WHERE id = $2', [rows[0].id, req.user._id]);
        req.user.studentProfileId = rows[0].id;
      } catch (assocErr) {
        console.warn('[AI Studio] Could not link student_profile_id to user:', assocErr.message);
      }
    }

    // Direct MongoDB sync if connected
    try {
      const mongoose = require('mongoose');
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        const StudentModel = require('../models/Student');
        await StudentModel.findOneAndUpdate(
          { 'personalDetails.registerNumber': personal.registerNumber.trim().toUpperCase() },
          { ...profile, _id: rows[0].id },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        ).catch(() => {});
      }
    } catch (mErr) {
      // Mongoose sync is best-effort alongside primary DB
    }

    await addAudit(req, 'STUDENT_CREATED', rows[0], `Created student profile ${personal.registerNumber}`);

    // Real-time Socket.IO notification broadcast
    try {
      const io = req.app.get('io');
      if (io) {
        io.emit('student:created', {
          id: rows[0].id,
          name: personal.name,
          registerNumber: personal.registerNumber,
          department: personal.department,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (sockErr) {
      // Socket emission non-blocking
    }

    res.status(201).json({ success: true, message: 'Student profile created successfully.', data: mapStudent(rows[0]) });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ success: false, message: 'A student with this register number already exists.' });
    next(error);
  }
};

const updateStudent = async (req, res, next) => {
  try {
    const row = await loadStudent(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: 'Student not found.' });
    if (!hasAccess(row, req.user)) return res.status(403).json({ success: false, message: 'You cannot edit this student.' });
    if (req.body.version !== undefined && Number(req.body.version) !== row.version) return res.status(409).json({ success: false, message: 'Student was changed by another user. Reload before saving.' });
    const profile = mapStudent(row);
    for (const [field, value] of Object.entries(req.body)) if (editableFields.has(field)) profile[field] = value;
    const updated = await persistProfile(pool, row, profile, req.user);
    if (!updated) return res.status(409).json({ success: false, message: 'Student changed while saving. Reload and try again.' });

    // Direct MongoDB sync if connected
    try {
      const mongoose = require('mongoose');
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        const StudentModel = require('../models/Student');
        const regNo = profile.personalDetails?.registerNumber || updated.register_number;
        if (regNo) {
          await StudentModel.findOneAndUpdate(
            { 'personalDetails.registerNumber': regNo.trim().toUpperCase() },
            { ...profile, _id: updated.id },
            { upsert: true, new: true }
          ).catch(() => {});
        }
      }
    } catch (mErr) {
      // Non-blocking
    }

    await addAudit(req, 'STUDENT_UPDATED', updated, 'Updated student profile.');

    // Real-time Socket.IO notification broadcast
    try {
      const io = req.app.get('io');
      if (io) {
        io.emit('student:updated', {
          id: updated.id,
          name: profile.personalDetails?.name,
          registerNumber: profile.personalDetails?.registerNumber,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (sockErr) {
      // Non-blocking
    }

    res.json({ success: true, message: 'Student profile updated successfully.', data: mapStudent(updated) });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ success: false, message: 'That register number is already in use.' });
    next(error);
  }
};

const deleteStudent = async (req, res, next) => {
  try {
    const row = await loadStudent(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: 'Student not found.' });
    if (!hasAccess(row, req.user)) return res.status(403).json({ success: false, message: 'You cannot delete this student.' });
    const { rows } = await pool.query(
      `UPDATE students SET deleted_at = NOW(), updated_by = $1, version = version + 1, updated_at = NOW()
       WHERE id = $2 RETURNING id, profile, version, mentor_id, deleted_at, created_at, updated_at`,
      [req.user._id, row.id]
    );
    await addAudit(req, 'STUDENT_DELETED', rows[0], 'Soft-deleted student profile.');
    res.json({ success: true, message: 'Student profile deleted successfully.' });
  } catch (error) { next(error); }
};

const restoreStudent = async (req, res, next) => {
  try {
    const row = await loadStudent(req.params.id, true);
    if (!row) return res.status(404).json({ success: false, message: 'Student not found.' });
    if (req.user.role !== ROLES.SUPER_ADMIN) return res.status(403).json({ success: false, message: 'Only administrators can restore students.' });
    const { rows } = await pool.query(
      `UPDATE students SET deleted_at = NULL, updated_by = $1, version = version + 1, updated_at = NOW()
       WHERE id = $2 RETURNING id, profile, version, mentor_id, deleted_at, created_at, updated_at`,
      [req.user._id, row.id]
    );
    await addAudit(req, 'STUDENT_UPDATED', rows[0], 'Restored student profile.');
    res.json({ success: true, message: 'Student restored successfully.', data: mapStudent(rows[0]) });
  } catch (error) { next(error); }
};

const mutateArray = (field, action, auditAction) => async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const row = await loadStudent(req.params.id, false, client);
    if (!row) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }
    if (!hasAccess(row, req.user)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: 'You cannot update this student.' });
    }
    const profile = mapStudent(row);
    const list = Array.isArray(profile[field]) ? profile[field] : [];
    let target = null;
    if (action === 'add') {
      target = { ...req.body, _id: randomUUID() };
      if (field === 'semesters' && list.some((item) => Number(item.semesterNumber) === Number(target.semesterNumber))) {
        await client.query('ROLLBACK');
        return res.status(409).json({ success: false, message: `Semester ${target.semesterNumber} already exists.` });
      }
      list.push(target);
    } else {
      const param = field === 'semesters' ? 'semesterId' : field === 'arrears' ? 'arrearId' : 'interventionId';
      const index = list.findIndex((item) => item._id === req.params[param]);
      if (index < 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'Record not found.' });
      }
      if (action === 'update') {
        Object.assign(list[index], req.body);
        target = list[index];
      } else {
        target = list[index];
        list.splice(index, 1);
      }
    }
    if (field === 'semesters') list.sort((a, b) => Number(a.semesterNumber) - Number(b.semesterNumber));
    profile[field] = list;
    const updated = await persistProfile(client, row, profile, req.user);
    if (!updated) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'Student changed while saving. Reload and try again.' });
    }
    await client.query(
      `INSERT INTO audit_logs (user_id, user_name, user_role, action, student_id, student_register_number, student_name, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [req.user._id, req.user.name, req.user.role, auditAction, row.id, profile.personalDetails.registerNumber, profile.personalDetails.name, `${action} ${field} record`, req.ip || '']
    );
    await client.query('COMMIT');
    res.status(action === 'add' ? 201 : 200).json({ success: true, data: list });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally { client.release(); }
};

const addSemester = mutateArray('semesters', 'add', 'SEMESTER_ADDED');
const updateSemester = mutateArray('semesters', 'update', 'SEMESTER_UPDATED');
const deleteSemester = mutateArray('semesters', 'delete', 'SEMESTER_DELETED');
const addArrear = mutateArray('arrears', 'add', 'ARREAR_ADDED');
const updateArrear = mutateArray('arrears', 'update', 'ARREAR_UPDATED');
const deleteArrear = mutateArray('arrears', 'delete', 'ARREAR_DELETED');
const addIntervention = (req, res, next) => {
  req.body = { ...req.body, mentorName: req.user.name, mentorId: req.user._id, date: req.body.date || new Date() };
  return mutateArray('mentorInterventions', 'add', 'INTERVENTION_ADDED')(req, res, next);
};
const updateIntervention = mutateArray('mentorInterventions', 'update', 'INTERVENTION_UPDATED');

module.exports = {
  getStudents, getStudentById, createStudent, updateStudent, deleteStudent, restoreStudent,
  addSemester, updateSemester, deleteSemester, addArrear, updateArrear, deleteArrear,
  addIntervention, updateIntervention,
};
