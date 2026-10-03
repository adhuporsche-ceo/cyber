const mongoose = require('mongoose');
const { pool } = require('../config/postgres');
const { randomUUID } = require('crypto');
const StudentApplication = require('../models/StudentApplication');
const Student = require('../models/Student');
const User = require('../models/User');

const validGoals = new Set(['Placement', 'Higher Studies', 'Entrepreneurship']);
const validStatuses = new Set(['PENDING', 'APPROVED', 'REJECTED']);

const validateApplication = (application) => {
  const personal = application?.personalDetails || {};
  const family = application?.familyDetails || {};
  const requiredPersonal = [
    'registerNumber', 'name', 'dob', 'gender', 'department', 'section',
    'institutionalEmail', 'personalEmail', 'mobile', 'residentialAddress', 'category',
  ];
  if (requiredPersonal.some((key) => !String(personal[key] || '').trim())) {
    return 'Complete all required personal details.';
  }
  if (!String(family.emergencyContact || '').trim()) return 'Emergency contact is required.';
  if (!validGoals.has(application?.careerGoal?.primaryGoal)) return 'Select a valid career goal.';
  if (application.consent !== true) return 'Consent is required to submit this application.';
  return null;
};

const submitApplication = async (req, res, next) => {
  const application = req.body;
  const validationError = validateApplication(application);
  if (validationError) return res.status(400).json({ success: false, message: validationError });

  const registerNumber = application.personalDetails.registerNumber.trim().toUpperCase();
  const department = application.personalDetails.department.trim().toUpperCase();
  const section = application.personalDetails.section.trim().toUpperCase();

  try {
    let mongoRecord = null;
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      const existing = await StudentApplication.findOne({ registerNumber, status: 'PENDING' }).lean();
      if (existing) {
        return res.status(409).json({ success: false, message: 'An application with this register number is already pending.' });
      }

      mongoRecord = await StudentApplication.create({
        registerNumber,
        department,
        section,
        status: 'PENDING',
        submittedAt: new Date(),
        application,
      });
    }

    // Always also persist to pool (PostgreSQL / In-Memory database)
    let pgRecord = null;
    try {
      const { rows } = await pool.query(
        'INSERT INTO student_applications (register_number, application) VALUES ($1, $2) RETURNING id, register_number, status, submitted_at',
        [registerNumber, JSON.stringify(application)]
      );
      pgRecord = rows[0];
    } catch (pgErr) {
      if (pgErr.code === '23505' && !mongoRecord) {
        return res.status(409).json({ success: false, message: 'An application with this register number is already pending.' });
      }
    }

    const finalId = (mongoRecord && mongoRecord._id) || (pgRecord && pgRecord.id) || `app-${Date.now()}`;
    const resultData = {
      _id: finalId,
      registerNumber,
      department,
      section,
      status: 'PENDING',
      submittedAt: (mongoRecord && mongoRecord.submittedAt) || (pgRecord && pgRecord.submitted_at) || new Date().toISOString(),
      application,
    };

    if (req.app && Array.isArray(req.app.locals.fallbackApplications)) {
      req.app.locals.fallbackApplications.unshift(resultData);
    }

    // Real-time broadcast to all connected mentors and admins
    try {
      const io = req.app.get('io');
      if (io) {
        io.emit('application:submitted', {
          _id: finalId,
          registerNumber,
          department,
          section,
          studentName: application.personalDetails?.name || 'Student',
          timestamp: new Date().toISOString(),
        });
        io.emit('notification:new', {
          title: 'New Student Application',
          message: `${application.personalDetails?.name || 'Student'} (${registerNumber}) submitted profile application for mentor review.`,
          type: 'INFO',
          createdAt: new Date().toISOString(),
        });
      }
    } catch (sockErr) {
      // Non-blocking socket emission
    }

    return res.status(201).json({
      success: true,
      message: 'Student application submitted and saved directly to database!',
      data: resultData,
    });
  } catch (error) {
    next(error);
  }
};

const listApplications = async (req, res, next) => {
  const status = String(req.query.status || 'PENDING').toUpperCase();
  if (!validStatuses.has(status)) return res.status(400).json({ success: false, message: 'Invalid application status.' });

  try {
    if (mongoose.connection.readyState === 1) {
      const rows = await StudentApplication.find({ status }).sort({ submittedAt: -1 }).lean();
      return res.json({ success: true, data: rows });
    }

    if (req.app && Array.isArray(req.app.locals.fallbackApplications)) {
      const rows = req.app.locals.fallbackApplications.filter((item) => item.status === status);
      return res.json({ success: true, data: rows });
    }

    return res.json({ success: true, data: [] });
  } catch (error) { next(error); }
};

const getMyApplication = async (req, res, next) => {
  const registerNumber = String(req.user.registerNumber || '').trim().toUpperCase();
  if (!registerNumber) return res.json({ success: true, data: null });

  try {
    if (mongoose.connection.readyState === 1) {
      const application = await StudentApplication.findOne({ registerNumber })
        .sort({ submittedAt: -1 })
        .lean();
      return res.json({ success: true, data: application });
    }

    const { rows } = await pool.query(
      'SELECT * FROM student_applications WHERE register_number = $1 ORDER BY submitted_at DESC LIMIT 1',
      [registerNumber]
    );
    const application = rows.find((row) => String(row.register_number || row.registerNumber).toUpperCase() === registerNumber);
    return res.json({
      success: true,
      data: application ? {
        _id: application.id || application._id,
        registerNumber,
        status: application.status,
        submittedAt: application.submitted_at || application.submittedAt,
        reviewedAt: application.reviewed_at || application.reviewedAt,
        studentId: application.student_id || application.studentId || '',
        application: application.application,
      } : null,
    });
  } catch (error) {
    next(error);
  }
};

const reviewApplication = async (req, res, next) => {
  const status = String(req.body.status || '').toUpperCase();
  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Status must be APPROVED or REJECTED.' });
  }

  if (mongoose.connection.readyState === 1) {
    let client;
    let transactionStarted = false;
    let committed = false;
    let mongoStudent = null;
    let mongoApplication = null;
    let mongoApplicationUpdated = false;
    let studentId = null;

    try {
      mongoApplication = await StudentApplication.findById(req.params.id);
      if (!mongoApplication) return res.status(404).json({ success: false, message: 'Application not found.' });
      if (mongoApplication.status !== 'PENDING') {
        return res.status(409).json({ success: false, message: 'This application has already been reviewed.' });
      }

      const application = mongoApplication.application;
      const personal = application.personalDetails;
      const registerNumber = personal.registerNumber.trim().toUpperCase();
      client = await pool.connect();
      await client.query('BEGIN');
      transactionStarted = true;

      if (status === 'APPROVED') {
        const existingMongoStudent = await Student.findOne({ 'personalDetails.registerNumber': registerNumber }).select('_id');
        if (existingMongoStudent) {
          await client.query('ROLLBACK');
          transactionStarted = false;
          return res.status(409).json({ success: false, message: 'A student profile with this register number already exists.' });
        }

        const { rows: existingPgStudents } = await client.query(
          'SELECT register_number FROM students WHERE register_number = ANY($1::text[])',
          [[registerNumber]]
        );
        if (existingPgStudents.some((row) => String(row.register_number).toUpperCase() === registerNumber)) {
          await client.query('ROLLBACK');
          transactionStarted = false;
          return res.status(409).json({ success: false, message: 'A student profile with this register number already exists.' });
        }

        const profile = {
          ...application,
          createdBy: String(req.user._id),
          createdByRole: req.user.role,
          updatedBy: String(req.user._id),
          updatedByRole: req.user.role,
        };
        for (const key of ['semesters', 'arrears', 'mentorInterventions']) {
          profile[key] = (profile[key] || []).map((item) => ({ ...item, _id: item._id || randomUUID() }));
        }

        const inserted = await client.query(
          `INSERT INTO students (register_number, department, section, created_by, updated_by, profile)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb)
           RETURNING id`,
          [registerNumber, personal.department.trim().toUpperCase(), personal.section.trim().toUpperCase(), null, null, JSON.stringify(profile)]
        );
        studentId = inserted.rows[0].id;

        mongoStudent = await Student.create({
          ...application,
          createdBy: req.user._id,
          createdByRole: req.user.role,
          updatedBy: req.user._id,
          updatedByRole: req.user.role,
        });
      }

      const { rows: pgApplications } = await client.query(
        'SELECT * FROM student_applications WHERE register_number = $1 AND status = $2',
        [mongoApplication.registerNumber, 'PENDING']
      );
      const pgApplication = pgApplications.find((row) => String(row.register_number || row.registerNumber).toUpperCase() === registerNumber);
      if (pgApplication) {
        await client.query(
          `UPDATE student_applications SET status = $1, reviewed_by = NULL, reviewed_at = NOW()
           WHERE id = $3`,
          [status, null, pgApplication.id || pgApplication._id]
        );
      }

      await client.query(
        `INSERT INTO audit_logs (user_id, user_name, user_role, action, student_id,
          student_register_number, student_name, details, ip_address)
         VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8)`,
        [req.user.name, req.user.role, `STUDENT_APPLICATION_${status}`, studentId,
          registerNumber, personal.name, `Reviewed application ${req.params.id}`, req.ip || '']
      );

      mongoApplication.status = status;
      mongoApplication.reviewedBy = String(req.user._id);
      mongoApplication.reviewedAt = new Date();
      mongoApplication.studentId = studentId ? String(studentId) : '';
      mongoApplication.mongoStudentId = mongoStudent ? String(mongoStudent._id) : '';
      await mongoApplication.save();
      mongoApplicationUpdated = true;

      if (studentId) {
        await User.updateOne(
          { registerNumber },
          { $set: { studentProfileId: String(studentId) } }
        );
      }

      await client.query('COMMIT');
      committed = true;
      return res.json({
        success: true,
        data: {
          _id: String(mongoApplication._id),
          registerNumber,
          status,
          submittedAt: mongoApplication.submittedAt,
          reviewedAt: mongoApplication.reviewedAt,
          studentId: studentId ? String(studentId) : null,
          mongoStudentId: mongoStudent ? String(mongoStudent._id) : null,
        },
      });
    } catch (error) {
      if (transactionStarted && !committed && client) await client.query('ROLLBACK').catch(() => {});
      if (!committed) {
        if (mongoStudent) await Student.deleteOne({ _id: mongoStudent._id }).catch(() => {});
        if (mongoApplicationUpdated && mongoApplication) {
          mongoApplication.status = 'PENDING';
          mongoApplication.reviewedBy = '';
          mongoApplication.reviewedAt = null;
          mongoApplication.studentId = '';
          mongoApplication.mongoStudentId = '';
          await mongoApplication.save().catch(() => {});
        }
        if (mongoApplication?.status === 'PENDING' && mongoApplication.registerNumber) {
          await User.updateOne({ registerNumber: mongoApplication.registerNumber }, { $unset: { studentProfileId: '' } }).catch(() => {});
        }
      }
      if (error.code === '23505' || error.code === 11000) {
        return res.status(409).json({ success: false, message: 'A student profile with this register number already exists.' });
      }
      return next(error);
    } finally {
      if (client) client.release();
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'SELECT * FROM student_applications WHERE id = $1 FOR UPDATE',
      [req.params.id]
    );
    const applicationRow = rows[0];
    if (!applicationRow) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }
    if (applicationRow.status !== 'PENDING') {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'This application has already been reviewed.' });
    }

    let studentId = null;
    if (status === 'APPROVED') {
      const application = applicationRow.application;
      const personal = application.personalDetails;
      const profile = {
        ...application,
        createdBy: req.user._id,
        createdByRole: req.user.role,
        updatedBy: req.user._id,
        updatedByRole: req.user.role,
      };
      for (const key of ['semesters', 'arrears', 'mentorInterventions']) {
        profile[key] = (profile[key] || []).map((item) => ({ ...item, _id: item._id || randomUUID() }));
      }
      const inserted = await client.query(
        `INSERT INTO students (register_number, department, section, created_by, updated_by, profile)
         VALUES ($1, $2, $3, $4, $4, $5::jsonb)
         RETURNING id`,
        [personal.registerNumber.trim().toUpperCase(), personal.department.trim().toUpperCase(), personal.section.trim().toUpperCase(), req.user._id, JSON.stringify(profile)]
      );
      studentId = inserted.rows[0].id;
    }

    const updated = await client.query(
      `UPDATE student_applications SET status = $1, reviewed_by = $2, reviewed_at = NOW()
       WHERE id = $3
       RETURNING id, register_number AS "registerNumber", status, submitted_at AS "submittedAt", reviewed_at AS "reviewedAt"`,
      [status, req.user._id, req.params.id]
    );
    await client.query(
      `INSERT INTO audit_logs (user_id, user_name, user_role, action, student_id, student_register_number, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [req.user._id, req.user.name, req.user.role, `STUDENT_APPLICATION_${status}`, studentId, applicationRow.register_number, `Reviewed application ${req.params.id}`, req.ip || '']
    );
    await client.query('COMMIT');
    res.json({ success: true, data: { ...updated.rows[0], studentId } });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'A student profile with this register number already exists.' });
    }
    next(error);
  } finally {
    client.release();
  }
};

module.exports = { submitApplication, listApplications, getMyApplication, reviewApplication };