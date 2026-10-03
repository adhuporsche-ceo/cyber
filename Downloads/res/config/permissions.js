const ROLES = Object.freeze({
  SUPER_ADMIN: 'SUPER_ADMIN',
  PLACEMENT_COORDINATOR: 'PLACEMENT_COORDINATOR',
  HOD: 'HOD',
  FACULTY_MENTOR: 'FACULTY_MENTOR',
  STUDENT: 'STUDENT',
});

const LEGACY_ROLE_MAP = Object.freeze({
  admin: ROLES.SUPER_ADMIN,
  faculty: ROLES.FACULTY_MENTOR,
  student: ROLES.STUDENT,
  SUPER_ADMIN: ROLES.SUPER_ADMIN,
  PLACEMENT_COORDINATOR: ROLES.PLACEMENT_COORDINATOR,
  HOD: ROLES.HOD,
  FACULTY_MENTOR: ROLES.FACULTY_MENTOR,
  STUDENT: ROLES.STUDENT,
});

const PERMISSIONS = Object.freeze({
  'student.create': [ROLES.SUPER_ADMIN, ROLES.PLACEMENT_COORDINATOR, ROLES.FACULTY_MENTOR, ROLES.STUDENT],
  'student.update': [ROLES.SUPER_ADMIN, ROLES.PLACEMENT_COORDINATOR, ROLES.FACULTY_MENTOR, ROLES.STUDENT],
  'student.delete': [ROLES.SUPER_ADMIN],
  'student.restore': [ROLES.SUPER_ADMIN],
  'student.import': [ROLES.SUPER_ADMIN, ROLES.PLACEMENT_COORDINATOR],
  'student.view.all': [ROLES.SUPER_ADMIN, ROLES.PLACEMENT_COORDINATOR],
  'student.mentor-action': [ROLES.SUPER_ADMIN, ROLES.PLACEMENT_COORDINATOR, ROLES.HOD, ROLES.FACULTY_MENTOR],
  'user.manage': [ROLES.SUPER_ADMIN],
  'audit.view.all': [ROLES.SUPER_ADMIN],
  'audit.view.own': [ROLES.PLACEMENT_COORDINATOR, ROLES.HOD],
  'settings.manage': [ROLES.SUPER_ADMIN],
  'settings.placement': [ROLES.PLACEMENT_COORDINATOR],
});

function normalizeRole(role) {
  return LEGACY_ROLE_MAP[role] || String(role || '').toUpperCase();
}

function hasPermission(role, permission) {
  return (PERMISSIONS[permission] || []).includes(normalizeRole(role));
}

module.exports = { ROLES, PERMISSIONS, normalizeRole, hasPermission };
