const notFound = (req, res, next) => {
  const error = new Error(`Resource not found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message || 'Internal Server Error';
  let errors = [];

  if (err.code === '23505') {
    message = 'A record with this value already exists.';
    statusCode = 409;
  } else if (err.code === '23503' || err.code === '22P02' || err.code === '23514') {
    message = 'The request contains an invalid value or reference.';
    statusCode = 400;
  } else if (err.code === 11000) {
    message = 'A record with this value already exists.';
    statusCode = 409;
  } else if (err.name === 'CastError') {
    message = 'The requested record identifier is invalid.';
    statusCode = 404;
  } else if (err.name === 'ValidationError') {
    message = 'Validation failed';
    statusCode = 400;
    errors = Object.values(err.errors).map((val) => val.message);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    message = 'Invalid authentication token';
    statusCode = 401;
  }
  if (err.name === 'TokenExpiredError') {
    message = 'Authentication token expired';
    statusCode = 401;
  }

  res.status(statusCode).json({
    success: false,
    message,
    errors: errors.length > 0 ? errors : undefined,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};

module.exports = { notFound, errorHandler };
