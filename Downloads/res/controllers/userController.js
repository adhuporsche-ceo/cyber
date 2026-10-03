const bcrypt = require('bcryptjs');
const { pool } = require('../config/postgres');
const { ROLES } = require('../config/permissions');

const listUsers = async (req, res, next) => {
  try {
    const { rows: users } = await pool.query(
      `SELECT id AS _id, name, email, role, department,
              register_number AS "registerNumber", student_profile_id AS "studentProfileId",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM users ORDER BY name`
    );
    res.json({ success: true, data: users });
  } catch (error) { next(error); }
};

const createUser = async (req, res, next) => {
  try {
    const { name, email, password, role, department, registerNumber, studentProfileId } = req.body;
    if (!name || !email || !password || !role) return res.status(400).json({ success: false, message: 'Name, email, password, and role are required.' });
    if (!Object.values(ROLES).includes(role) || role === ROLES.SUPER_ADMIN && req.user.role !== ROLES.SUPER_ADMIN) return res.status(400).json({ success: false, message: 'Invalid or restricted role.' });
    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, department, register_number, student_profile_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (email) DO NOTHING
       RETURNING id AS _id, name, email, role, department,
                 register_number AS "registerNumber", student_profile_id AS "studentProfileId",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [name.trim(), email.toLowerCase().trim(), passwordHash, role, department || 'General', registerNumber || null, studentProfileId || null]
    );
    if (!rows[0]) return res.status(409).json({ success: false, message: 'A user with this email already exists.' });
    await pool.query(
      `INSERT INTO audit_logs (user_id, user_name, user_role, action, details, ip_address)
       VALUES ($1, $2, $3, 'USER_CREATED', $4, $5)`,
      [req.user._id, req.user.name, req.user.role, `Created ${role} user ${rows[0].email}`, req.ip || '']
    );
    res.status(201).json({ success: true, message: 'User created successfully.', data: rows[0] });
  } catch (error) { next(error); }
};

const updateUser = async (req, res, next) => {
  try {
    const updates = {};
    ['name', 'department', 'registerNumber', 'studentProfileId', 'role'].forEach((field) => { if (req.body[field] !== undefined) updates[field] = req.body[field]; });
    if (updates.role && !Object.values(ROLES).includes(updates.role)) return res.status(400).json({ success: false, message: 'Invalid role.' });
    const columns = { name: 'name', department: 'department', registerNumber: 'register_number', studentProfileId: 'student_profile_id', role: 'role' };
    const values = [];
    const assignments = Object.entries(updates).map(([field, value]) => {
      values.push(value);
      return `${columns[field]} = $${values.length}`;
    });
    if (!assignments.length) return res.status(400).json({ success: false, message: 'No valid fields to update.' });
    values.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE users SET ${assignments.join(', ')}, updated_at = NOW()
       WHERE id = $${values.length}
       RETURNING id AS _id, name, email, role, department,
                 register_number AS "registerNumber", student_profile_id AS "studentProfileId",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      values
    );
    const user = rows[0];
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    await pool.query(
      `INSERT INTO audit_logs (user_id, user_name, user_role, action, details, ip_address)
       VALUES ($1, $2, $3, 'USER_UPDATED', $4, $5)`,
      [req.user._id, req.user.name, req.user.role, `Updated user ${user.email}`, req.ip || '']
    );
    res.json({ success: true, data: user });
  } catch (error) { next(error); }
};

module.exports = { listUsers, createUser, updateUser };
