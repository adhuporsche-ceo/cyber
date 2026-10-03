const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const MongoUser = require('../models/User');
const { pool } = require('../config/postgres');
const { normalizeRole, hasPermission } = require('../config/permissions');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this resource. Please log in.',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'college_student_profiling_jwt_secret_key_viva_2026_secure');
    let user;
    if (mongoose.connection.readyState === 1) {
      const mongoUser = await MongoUser.findById(decoded.id).lean();
      if (mongoUser) {
        user = {
          ...mongoUser,
          id: String(mongoUser._id),
          _id: String(mongoUser._id),
          registerNumber: mongoUser.registerNumber,
          studentProfileId: mongoUser.studentProfileId,
        };
      }
    } else {
      const { rows } = await pool.query(
        `SELECT id, name, email, role, department, register_number, student_profile_id
         FROM users WHERE id = $1`,
        [decoded.id]
      );
      user = rows[0];
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'The user belonging to this token no longer exists.',
      });
    }

    req.user = {
      ...user,
      _id: user.id,
      registerNumber: user.registerNumber ?? user.register_number,
      studentProfileId: user.studentProfileId ?? user.student_profile_id,
      role: normalizeRole(user.role),
    };
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token. Please log in again.',
    });
  }
};

const can = (permission) => (req, res, next) => {
  if (!req.user || !hasPermission(req.user.role, permission)) {
    return res.status(403).json({
      success: false,
      message: `Role '${req.user?.role || 'UNAUTHENTICATED'}' is not allowed to perform '${permission}'.`,
    });
  }
  next();
};

const canAny = (...permissions) => (req, res, next) => {
  if (!req.user || !permissions.some((permission) => hasPermission(req.user.role, permission))) {
    return res.status(403).json({ success: false, message: `Role '${req.user?.role || 'UNAUTHENTICATED'}' is not allowed to perform this action.` });
  }
  next();
};

const authorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this resource. Please log in.',
    });
  }
  const userRole = normalizeRole(req.user.role);
  const normalizedRoles = roles.map((r) => normalizeRole(r));
  if (!normalizedRoles.includes(userRole)) {
    return res.status(403).json({
      success: false,
      message: `Role '${req.user.role}' is not authorized to access this resource.`,
    });
  }
  next();
};

module.exports = { protect, can, canAny, authorize };
