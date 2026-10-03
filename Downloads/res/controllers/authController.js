const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const validator = require('validator');
const MongoUser = require('../models/User');
const { pool } = require('../config/postgres');
const { normalizeRole } = require('../config/permissions');

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET || 'college_student_profiling_jwt_secret_key_viva_2026_secure',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email/register number and password',
      });
    }

    const input = email.trim().toLowerCase();

    let user;
    let passwordMatches;

    if (mongoose.connection.readyState === 1) {
      const mongoUser = await MongoUser.findOne({
        $or: [
          { email: input },
          { registerNumber: input },
          { registerNumber: input.toUpperCase() },
        ],
      }).select('+password');

      if (mongoUser) {
        user = {
          id: String(mongoUser._id),
          name: mongoUser.name,
          email: mongoUser.email,
          role: mongoUser.role,
          department: mongoUser.department,
          register_number: mongoUser.registerNumber,
          student_profile_id: mongoUser.studentProfileId,
        };
        passwordMatches = await mongoUser.comparePassword(password);
      }
    } else {
      const { rows } = await pool.query(
        `SELECT id, name, email, password_hash, role, department, register_number, student_profile_id
         FROM users
         WHERE lower(email) = $1 OR lower(register_number) = $1
         LIMIT 1`,
        [input]
      );
      user = rows[0];
      if (user) passwordMatches = await bcrypt.compare(password, user.password_hash);
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. User does not exist.',
      });
    }

    // Check password
    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Incorrect password.',
      });
    }

    const token = generateToken(user.id);
    await pool.query(
      `INSERT INTO audit_logs (user_id, user_name, user_role, action, details, ip_address)
       VALUES ($1, $2, $3, 'LOGIN', $4, $5)`,
      [user.id, user.name, user.role, `User ${user.email} logged in successfully`, req.ip || '']
    );

    res.status(200).json({
      success: true,
      message: 'Logged in successfully',
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: normalizeRole(user.role),
          department: user.department,
          registerNumber: user.register_number,
          studentProfileId: user.student_profile_id,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

const signupStudent = async (req, res, next) => {
  try {
    const { name, email, registerNumber, department, password } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedRegisterNumber = String(registerNumber || '').trim().toUpperCase();

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Student registration is temporarily unavailable.' });
    }
    if (!String(name || '').trim() || !validator.isEmail(normalizedEmail) || !/^[A-Z0-9]+$/.test(normalizedRegisterNumber)) {
      return res.status(400).json({ success: false, message: 'Enter a name, valid email, and an alphanumeric register number.' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must contain at least 8 characters.' });
    }

    const existing = await MongoUser.findOne({
      $or: [{ email: normalizedEmail }, { registerNumber: normalizedRegisterNumber }],
    }).select('_id');
    if (existing) {
      return res.status(409).json({ success: false, message: 'That email or register number is already registered.' });
    }

    const student = await MongoUser.create({
      name: String(name).trim(),
      email: normalizedEmail,
      password,
      role: 'STUDENT',
      department: String(department || 'CSE').trim().toUpperCase(),
      registerNumber: normalizedRegisterNumber,
    });
    const user = {
      id: String(student._id),
      name: student.name,
      email: student.email,
      role: normalizeRole(student.role),
      department: student.department,
      registerNumber: student.registerNumber,
      studentProfileId: student.studentProfileId,
    };

    return res.status(201).json({
      success: true,
      message: 'Student account created successfully.',
      data: { token: generateToken(user.id), user },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'That email or register number is already registered.' });
    }
    return next(error);
  }
};

// @desc    Logout user / clear audit
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res, next) => {
  try {
    if (req.user) {
      await pool.query(
        `INSERT INTO audit_logs (user_id, user_name, user_role, action, details, ip_address)
         VALUES ($1, $2, $3, 'LOGOUT', $4, $5)`,
        [req.user._id, req.user.name, req.user.role, `User ${req.user.email} logged out`, req.ip || '']
      );
    }

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: { ...req.user, role: normalizeRole(req.user.role) },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { login, signupStudent, logout, getMe };
