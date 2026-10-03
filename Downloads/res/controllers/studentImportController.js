const { pool } = require('../config/postgres');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < String(text || '').length; index += 1) {
    const char = text[index];
    if (char === '"' && text[index + 1] === '"') { cell += '"'; index += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === ',' && !quoted) { row.push(cell.trim()); cell = ''; continue; }
    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; cell = ''; continue;
    }
    cell += char;
  }
  if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
  if (rows.length < 2) return [];
  const headers = rows.shift().map((header) => header.toLowerCase().replace(/[^a-z0-9]+/g, ''));
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])));
}

const validateRows = async (rows) => {
  const registerNumbers = rows.map((row) => row.registernumber).filter(Boolean);
  const { rows: existingRows } = await pool.query(
    'SELECT register_number FROM students WHERE register_number = ANY($1::text[])',
    [registerNumbers.map((value) => value.toUpperCase())]
  );
  const existingSet = new Set(existingRows.map((student) => student.register_number));
  const seen = new Set();
  const valid = [];
  const invalid = [];
  rows.forEach((row, index) => {
    const errors = [];
    const registerNumber = String(row.registernumber || '').trim().toUpperCase();
    const email = String(row.institutionalemail || '').trim().toLowerCase();
    const mobile = String(row.mobile || '').trim();
    if (!/^\d{12}$/.test(registerNumber)) errors.push('Register number must be 12 digits');
    if (existingSet.has(registerNumber) || seen.has(registerNumber)) errors.push('Register number is not unique');
    if (!/^\S+@\S+\.\S+$/.test(email)) errors.push('Institutional email is invalid');
    if (!/^[6-9]\d{9}$/.test(mobile)) errors.push('Mobile must be a valid 10-digit number');
    if (!row.name || !row.department || !row.section) errors.push('Name, department, and section are required');
    const normalized = { ...row, registernumber: registerNumber, institutionalemail: email, mobile };
    if (errors.length) invalid.push({ row: index + 2, data: normalized, errors });
    else { valid.push(normalized); seen.add(registerNumber); }
  });
  return { valid, invalid };
};

const importStudents = async (req, res, next) => {
  try {
    const rows = parseCsv(req.body);
    const result = await validateRows(rows);
    if (req.query.preview === 'true' || req.body?.preview === true) return res.json({ success: true, data: result });
    if (!result.valid.length) return res.status(400).json({ success: false, message: 'No valid student rows to import.', data: result });
    const documents = result.valid.map((row) => ({
      personalDetails: {
        registerNumber: row.registernumber,
        name: row.name,
        dob: row.dob || '2000-01-01',
        gender: row.gender || 'Other',
        department: row.department.toUpperCase(),
        section: row.section.toUpperCase(),
        institutionalEmail: row.institutionalemail,
        personalEmail: row.personalemail || row.institutionalemail,
        mobile: row.mobile,
        residentialAddress: row.address || 'Not provided',
        category: row.category === 'Hosteller' ? 'Hosteller' : 'Day Scholar',
      },
      familyDetails: { emergencyContact: row.mobile },
      semesters: [], arrears: [], technicalProfile: {}, selfEvaluation: {},
      careerGoal: { primaryGoal: row.careergoal || 'Placement' }, consent: true,
      createdBy: req.user._id, createdByRole: req.user.role, updatedBy: req.user._id, updatedByRole: req.user.role,
    }));
    const client = await pool.connect();
    const inserted = [];
    try {
      await client.query('BEGIN');
      for (const profile of documents) {
        const personal = profile.personalDetails;
        const { rows } = await client.query(
          `INSERT INTO students (register_number, department, section, created_by, updated_by, profile)
           VALUES ($1, $2, $3, $4, $4, $5::jsonb)
           RETURNING id, profile, version, mentor_id, deleted_at, created_at, updated_at`,
          [personal.registerNumber, personal.department, personal.section, req.user._id, JSON.stringify(profile)]
        );
        inserted.push({ ...rows[0].profile, _id: rows[0].id, __v: rows[0].version, createdAt: rows[0].created_at });
      }
      await client.query(
        `INSERT INTO audit_logs (user_id, user_name, user_role, action, details, ip_address)
         VALUES ($1, $2, $3, 'STUDENT_IMPORTED', $4, $5)`,
        [req.user._id, req.user.name, req.user.role, JSON.stringify({ count: inserted.length, invalid: result.invalid.length }), req.ip || '']
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
    res.status(201).json({ success: true, message: `${inserted.length} students imported.`, data: { imported: inserted.length, invalid: result.invalid, students: inserted } });
  } catch (error) { next(error); }
};

const downloadTemplate = (req, res) => {
  res.type('text/csv').send('registerNumber,name,department,section,institutionalEmail,personalEmail,mobile,dob,gender,category,careerGoal\n710021104999,Example Student,CSE,A,student@college.edu,student@example.com,9876543210,2003-01-01,Other,Day Scholar,Placement\n');
};

module.exports = { importStudents, downloadTemplate };
