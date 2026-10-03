require('dotenv').config();

const { pool, initializeDatabase } = require('../config/postgres');

const seed = async () => {
  try {
    await initializeDatabase();
    console.log('PostgreSQL schema is ready.');
    if (!process.env.INITIAL_ADMIN_EMAIL || !process.env.INITIAL_ADMIN_PASSWORD) {
      console.log('Set INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD in .env to create the first administrator.');
    } else {
      console.log('Initial administrator is configured.');
    }
  } catch (error) {
    const reason = error.code || (error.message.includes('DATABASE_URL') ? error.message : error.name);
    console.error('PostgreSQL setup failed:', reason);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

seed();
