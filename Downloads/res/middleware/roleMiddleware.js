const { normalizeRole } = require('../config/permissions');

const authorize = (...roles) => {
  return (req, res, next) => {
    const allowedRoles = roles.map(normalizeRole);
    if (!req.user || !allowedRoles.includes(normalizeRole(req.user.role))) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user ? req.user.role : 'unauthorized'}' is not authorized to access this route.`,
      });
    }
    next();
  };
};

module.exports = { authorize };
