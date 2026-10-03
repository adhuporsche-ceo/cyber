const { pool } = require('../config/postgres');
const { ROLES } = require('../config/permissions');

// @desc    Get audit logs with search, action filter, pagination (Admin only)
// @route   GET /api/audit-logs
// @access  Private (Admin)
const getAuditLogs = async (req, res, next) => {
  try {
    const { action, search, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const values = [];
    const filters = [];
    if (req.user.role === ROLES.PLACEMENT_COORDINATOR) {
      values.push(req.user._id);
      filters.push(`user_id = $${values.length}`);
    } else if (req.user.role === ROLES.HOD) {
      values.push(req.user._id, String(req.user.department || '').toUpperCase());
      filters.push(`(user_id = $${values.length - 1} OR student_register_number IN (
        SELECT register_number FROM students WHERE department = $${values.length}
      ))`);
    }
    if (action && action.trim()) {
      values.push(action.trim());
      filters.push(`action = $${values.length}`);
    }
    if (search && search.trim()) {
      values.push(`%${search.trim()}%`);
      filters.push(`(user_name ILIKE $${values.length} OR student_name ILIKE $${values.length}
        OR student_register_number ILIKE $${values.length} OR details ILIKE $${values.length})`);
    }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const count = await pool.query(`SELECT COUNT(*)::int AS total FROM audit_logs ${where}`, values);
    const queryValues = [...values, limitNum, (pageNum - 1) * limitNum];
    const { rows: logs } = await pool.query(
      `SELECT id AS _id, user_id AS "userId", user_name AS "userName", user_role AS "userRole",
              action, student_id AS "studentId", student_register_number AS "studentRegisterNumber",
              student_name AS "studentName", details, ip_address AS "ipAddress", created_at AS timestamp
       FROM audit_logs ${where} ORDER BY created_at DESC
       LIMIT $${queryValues.length - 1} OFFSET $${queryValues.length}`,
      queryValues
    );
    const total = count.rows[0].total;

    res.status(200).json({
      success: true,
      data: logs,
      pagination: {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum) || 1,
        limit: limitNum,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAuditLogs };
