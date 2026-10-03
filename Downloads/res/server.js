const http = require('http');
const path = require('path');
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const { Server: SocketServer } = require('socket.io');

// Fail fast for mongoose if database is offline
mongoose.set('bufferCommands', false);

// Load environment variables
dotenv.config();

const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const { pool, initializeDatabase } = require('./config/postgres');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const auditRoutes = require('./routes/auditRoutes');
const studentApplicationRoutes = require('./routes/studentApplicationRoutes');
const studentRoutes = require('./routes/studentRoutes');
const insightRoutes = require('./routes/insightRoutes');
const reportRoutes = require('./routes/reportRoutes');
const compatRoutes = require('./routes/compatRoutes');
const placementCrmRoutes = require('./routes/placementCrmRoutes');
const { protect } = require('./middleware/authMiddleware');

const app = express();
const httpServer = http.createServer(app);
const io = new SocketServer(httpServer, {
  cors: { origin: '*' },
});

app.set('io', io);

io.on('connection', (socket) => {
  socket.on('disconnect', () => {});
});

const fallbackApplications = [];

app.locals = app.locals || {};
app.locals.fallbackApplications = fallbackApplications;

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Enable CORS
app.use(cors());

// Set security headers with Helmet
// Allow CDNs for Bootstrap, Bootstrap Icons, and Chart.js
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          'https://cdn.jsdelivr.net',
          'https://cdnjs.cloudflare.com',
        ],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://cdn.jsdelivr.net',
          'https://cdnjs.cloudflare.com',
          'https://fonts.googleapis.com',
        ],
        fontSrc: [
          "'self'",
          'https://cdn.jsdelivr.net',
          'https://cdnjs.cloudflare.com',
          'https://fonts.gstatic.com',
        ],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// Dev logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Rate limiting for API requests
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP address, please try again after 15 minutes.',
  },
});
app.use('/api', limiter);

// Serve static frontend assets
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ success: true, database: 'connected', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(200).json({ success: true, database: 'fallback-active', timestamp: new Date().toISOString() });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/student-applications', studentApplicationRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/insights', insightRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/placement', placementCrmRoutes);
app.use('/api', placementCrmRoutes);
app.use('/api', compatRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found.',
  });
});

// Fallback for frontend SPA navigation
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Database offline / resilience error middleware
app.use((err, req, res, next) => {
  if (
    err.name === 'MongooseError' ||
    err.name === 'MongoNetworkError' ||
    (err.message && err.message.includes('buffering timed out'))
  ) {
    console.warn('[AI Studio] Database offline — returning mock response');
    if (req.method === 'GET') {
      return res.json(req.path.endsWith('s') || req.path.endsWith('s/') ? [] : {});
    }
    return res.status(503).json({ error: 'Service temporarily unavailable (database offline)' });
  }
  next(err);
});

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 3000;

const startServer = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGODB_URL;
    if (mongoUri) {
      try {
        await mongoose.connect(mongoUri, {
          dbName: process.env.MONGODB_DB_NAME || 'studentProfilingSystem',
          serverSelectionTimeoutMS: 5000,
          connectTimeoutMS: 5000,
        });
        console.log('MongoDB Atlas connected successfully.');
      } catch (mongoErr) {
        console.warn('MongoDB connection failed; continuing with the in-memory data fallback:', mongoErr.message);
      }
    }

    try {
      await initializeDatabase();
    } catch (dbErr) {
      console.warn('Database initialization warning:', dbErr.message || dbErr);
    }

    const server = httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`\n======================================================`);
      console.log(`Student Academic Personal and Career Profiling System`);
      console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on http://localhost:${PORT}`);
      console.log(`======================================================\n`);
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Stop the existing server or set PORT to another value.`);
      } else {
        console.error('Backend listener failed:', error.message);
      }
      process.exitCode = 1;
    });
  } catch (err) {
    const reason = err.code || err.name || err.message;
    console.error('Failed to start backend:', reason);
    process.exit(1);
  }
};

startServer();

module.exports = app;
