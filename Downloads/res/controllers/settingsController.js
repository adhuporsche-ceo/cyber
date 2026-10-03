const bcrypt = require('bcryptjs');
const { pool } = require('../config/postgres');

const defaults = () => ({
  attendanceThreshold: Number(process.env.ATTENDANCE_ATTENTION_THRESHOLD || 75),
  cgpaThreshold: Number(process.env.CGPA_ATTENTION_THRESHOLD || 6.5),
});

const getSettings = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT attendance_threshold AS "attendanceThreshold",
              cgpa_threshold AS "cgpaThreshold", updated_at AS "updatedAt"
       FROM app_settings WHERE id = TRUE`
    );
    const settings = rows[0] || defaults();
    res.json({ success: true, data: settings });
  } catch (error) { next(error); }
};

const updateSettings = async (req, res, next) => {
  try {
    const values = {
      attendanceThreshold: Number(req.body.attendanceThreshold),
      cgpaThreshold: Number(req.body.cgpaThreshold),
    };
    if (!Number.isFinite(values.attendanceThreshold) || values.attendanceThreshold < 0 || values.attendanceThreshold > 100 ||
        !Number.isFinite(values.cgpaThreshold) || values.cgpaThreshold < 0 || values.cgpaThreshold > 10) {
      return res.status(400).json({ success: false, message: 'Threshold values are outside the allowed range.' });
    }
    const { rows } = await pool.query(
      `INSERT INTO app_settings (id, attendance_threshold, cgpa_threshold, updated_by)
       VALUES (TRUE, $1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET attendance_threshold = EXCLUDED.attendance_threshold,
         cgpa_threshold = EXCLUDED.cgpa_threshold, updated_by = EXCLUDED.updated_by, updated_at = NOW()
       RETURNING attendance_threshold AS "attendanceThreshold", cgpa_threshold AS "cgpaThreshold", updated_at AS "updatedAt"`,
      [values.attendanceThreshold, values.cgpaThreshold, req.user._id]
    );
    const settings = rows[0];
    await pool.query(
      `INSERT INTO audit_logs (user_id, user_name, user_role, action, details, ip_address)
       VALUES ($1, $2, $3, 'UPDATE_SETTINGS', 'Updated mentor attention thresholds', $4)`,
      [req.user._id, req.user.name, req.user.role, req.ip || '']
    );
    res.json({ success: true, data: settings, message: 'Settings saved.' });
  } catch (error) { next(error); }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 6) return res.status(400).json({ success: false, message: 'A current password and a new password of at least 6 characters are required.' });
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user._id]);
    if (!rows[0] || !(await bcrypt.compare(currentPassword, rows[0].password_hash))) return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, req.user._id]);
    await pool.query(
      `INSERT INTO audit_logs (user_id, user_name, user_role, action, details, ip_address)
       VALUES ($1, $2, $3, 'CHANGE_PASSWORD', 'Changed account password', $4)`,
      [req.user._id, req.user.name, req.user.role, req.ip || '']
    );
    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (error) { next(error); }
};

module.exports = { getSettings, updateSettings, changePassword };
