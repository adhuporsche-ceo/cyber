require('dotenv').config();

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const User = require('../models/User');

const workspaceRoot = path.join(__dirname, '..');
const envPath = path.join(workspaceRoot, '.env');
const credentialsPath = path.join(workspaceRoot, '.local-accounts.json');
const accountDefinitions = [
  {
    name: 'System Administrator',
    email: 'admin@college.edu',
    role: 'SUPER_ADMIN',
    department: 'ALL',
    passwordEnv: 'ADMIN_LOGIN_PASSWORD',
  },
  {
    name: 'Placement Coordinator',
    email: 'coordinator@college.edu',
    role: 'PLACEMENT_COORDINATOR',
    department: 'ALL',
    passwordEnv: 'PLACEMENT_COORDINATOR_PASSWORD',
  },
  {
    name: 'Student',
    email: 'student@college.edu',
    role: 'STUDENT',
    department: 'CSE',
    registerNumber: '710021104001',
  },
];

const readCredentials = () => {
  if (!fs.existsSync(credentialsPath)) return { accounts: [] };
  return JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
};

const ensureJwtSecret = () => {
  if (process.env.JWT_SECRET) return;
  const secret = crypto.randomBytes(48).toString('base64url');
  const envContents = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  fs.appendFileSync(envPath, `${envContents.endsWith('\n') || !envContents ? '' : '\n'}JWT_SECRET=${secret}\n`);
  process.env.JWT_SECRET = secret;
};

const seedAccounts = async () => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');

  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGODB_DB_NAME || 'studentProfilingSystem',
    serverSelectionTimeoutMS: 10000,
  });

  const credentials = readCredentials();
  const credentialByEmail = new Map(credentials.accounts.map((account) => [account.email, account]));
  const accountsToCreate = [];

  for (const definition of accountDefinitions) {
    const email = definition.email.toLowerCase();
    const existing = await User.findOne({ email }).select('+password');
    const configuredPassword = process.env[definition.passwordEnv];
    if (existing) {
      if (configuredPassword && !(await existing.comparePassword(configuredPassword))) {
        existing.password = configuredPassword;
        await existing.save();
        credentialByEmail.set(email, { email, role: definition.role, password: configuredPassword });
        console.log(`Updated password for ${definition.role} account: ${email}`);
      }
      continue;
    }

    const savedCredential = credentialByEmail.get(email);
    const password = configuredPassword || savedCredential?.password || crypto.randomBytes(24).toString('base64url');
    const credential = { email, role: definition.role, password };
    credentialByEmail.set(email, credential);
    const { passwordEnv, ...userFields } = definition;
    accountsToCreate.push({ ...userFields, email, password });
  }

  ensureJwtSecret();
  credentials.accounts = accountDefinitions
    .map((definition) => credentialByEmail.get(definition.email))
    .filter(Boolean);
  fs.writeFileSync(credentialsPath, `${JSON.stringify(credentials, null, 2)}\n`, { mode: 0o600 });

  for (const account of accountsToCreate) {
    const user = new User(account);
    await user.save();
    console.log(`Created ${account.role} account: ${account.email}`);
  }

  if (!accountsToCreate.length) console.log('Atlas login accounts are ready; existing passwords were preserved unless explicitly configured.');
  console.log('Local login credentials are stored in .local-accounts.json.');
};

seedAccounts()
  .catch((error) => {
    console.error('MongoDB account setup failed:', error.code || error.name || 'UnknownError');
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  });