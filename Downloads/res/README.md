# Student Academic Personal and Career Profiling System (SPS)

A comprehensive, production-grade full-stack web application developed for college faculty and mentors to record, evaluate, monitor, and guide students across their entire engineering and academic journey.

---

## 1. Problem Statement & Objective

In modern collegiate institutions, student academic records, arrear histories, technical portfolios, self-evaluations, and career goals are frequently scattered across disconnected spreadsheets, paper logbooks, and isolated departmental databases.

The **Student Academic Personal and Career Profiling System (SPS)** solves this by providing a unified, secure, mentor-centric platform that:
- Maintains complete semester-wise academic progression (Semesters 1 through 8).
- Preserves full arrear history without overwriting past difficulties or clearing records.
- Documents technical skills, hackathons, coding contests, certifications, and projects.
- Conducts rule-based **Career Skill Gap Analysis** matching student skills with industry benchmarks.
- Dynamically flags students requiring **Mentor Attention** based on transparent, objective rules (low attendance, low CGPA, declining trends, active arrears).
- Protects student and parent privacy by strictly isolating sensitive family and income details from public dashboards and comparisons.

---

## 2. Technology Stack

### Frontend
- **HTML5 & CSS3**: Semantic layouts, responsive typography, and mobile-first styles.
- **Bootstrap 5.3.3**: Modern UI framework, responsive grid, modals, toasts, and navigation.
- **Vanilla JavaScript (ES6+)**: Clean, framework-free architecture that is easily understood and explained during an academic viva.
- **Bootstrap Icons**: Consistent visual iconography.
- **Chart.js 4.4.2**: Rich, interactive dashboards (line charts, bar charts, doughnut charts, polar charts).

### Backend
- **Node.js**: Asynchronous event-driven server runtime.
- **Express.js 4.21**: Robust REST API framework with modular controllers and middleware.
- **node-postgres (`pg`)**: Parameterized PostgreSQL queries for Supabase-hosted storage.
- **Security & Utilities**:
  - `bcryptjs`: Secure one-way salt hashing for passwords.
  - `jsonwebtoken` (JWT): Stateless authentication for protected routes.
  - `helmet`: HTTP header hardening and Content Security Policy (CSP).
  - `express-rate-limit`: Brute-force and DDoS protection.
  - `morgan`: Request logging for development auditing.
  - `cors`: Cross-origin request control.

### Database
- **Supabase PostgreSQL**: Relational user, student, application, settings, and audit tables; full student profiles are stored as JSONB.

---

## 3. Project Structure

```
d:/full stack poject/
├── server.js                      # Express application entry point
├── package.json                   # Project dependencies and npm scripts
├── .env                           # Environment configuration
├── .env.example                   # Example environment template
├── .gitignore                     # Git ignore file
├── README.md                      # Complete system documentation
│
├── config/
│   ├── postgres.js                # Supabase PostgreSQL pool and initialization
│   └── schema.sql                 # PostgreSQL table/index definitions
│
├── models/
│   ├── User.js                    # Faculty and Admin user accounts
│   ├── Student.js                 # Structured student schema with subdocuments
│   └── AuditLog.js                # System audit log model
│
├── middleware/
│   ├── authMiddleware.js          # JWT authentication guard
│   ├── roleMiddleware.js          # Role-based access control (Admin/Faculty)
│   └── errorMiddleware.js         # Centralized error handler & 404 handler
│
├── services/
│   ├── profileCompletionService.js # Profile completion score algorithm
│   ├── insightService.js          # Academic trends, KPIs, and attention rules
│   └── skillGapService.js         # Rule-based career guidance & curriculum matrix
│
├── controllers/
│   ├── authController.js          # Login, logout, and current user
│   ├── postgresStudentController.js # Student CRUD, semesters, arrears, interventions
│   ├── studentApplicationController.js # Application submission and review
│   ├── insightController.js       # Dashboard KPIs, analytics, and comparison
│   ├── auditController.js         # Admin audit log query handler
│   └── reportController.js        # CSV report generator
│
├── routes/
│   ├── authRoutes.js              # /api/auth
│   ├── studentRoutes.js           # /api/students
│   ├── insightRoutes.js           # /api/insights
│   ├── auditRoutes.js             # /api/audit-logs (Admin only)
│   └── reportRoutes.js            # /api/reports/export
│
├── seed/
│   └── postgresSeed.js            # Safe schema/bootstrap-admin setup
│
├── test/
│   └── api-test.js                # Integration test suite for all REST APIs
│
└── public/                        # Static frontend web application
    ├── index.html                 # Gatekeeper / redirect
    ├── login.html                 # Faculty & Mentor login page
    ├── dashboard.html             # 10 KPI summary cards & 6 Chart.js graphs
    ├── students.html              # Search, filter, compare, and manage students
   ├── add-student.html           # 8-step Student Application Form
   ├── student-applications.html  # Staff application review queue
    ├── edit-student.html          # Prepopulated profile editor
    ├── student-profile.html       # Full profile view, trend graph, skill gap
    ├── analytics.html             # College-wide analytics and readiness charts
    ├── mentor-attention.html      # Proactive early intervention center
    ├── reports.html               # CSV reports export center
    ├── audit-logs.html            # Admin security audit viewer
    ├── settings.html              # Faculty profile and threshold settings
    │
    ├── css/
    │   └── style.css              # Custom styling, responsive layouts
    │
    └── js/
        ├── common.js              # Auth check, layout injector, API helper, toasts
        ├── auth.js                # Login & credentials auto-fill
        ├── dashboard.js           # Dashboard metrics & Chart.js instances
        ├── students.js            # Filter debounce, table, pagination, comparison
        ├── student-form.js        # Wizard navigation, validation, dynamic records
        ├── profile.js             # Detailed tab views & intervention modal
        ├── analytics.js           # Charts & professional readiness meters
        ├── mentor-attention.js    # Rule filtering & quick counseling log
        ├── reports.js             # CSV report file downloader
        └── audit-logs.js          # Admin audit log pagination & filter
```

---

## 4. Installation & Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.x or higher)
- A Supabase PostgreSQL project and a database password that has not been exposed publicly.

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Set these values in `.env`. Do not commit or share this file:
```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net
MONGODB_DB_NAME=studentProfilingSystem
ADMIN_LOGIN_PASSWORD=<administrator-password>
PLACEMENT_COORDINATOR_PASSWORD=<coordinator-password>
DATABASE_URL=postgresql://postgres:<new_password>@db.eciyodhjeifsxmgmjmoy.supabase.co:5432/postgres?sslmode=require
JWT_SECRET=<long-random-secret>
JWT_EXPIRES_IN=7d
INITIAL_ADMIN_NAME=System Administrator
INITIAL_ADMIN_EMAIL=admin@example.com
INITIAL_ADMIN_PASSWORD=<strong-one-time-password>
ATTENDANCE_ATTENTION_THRESHOLD=75
CGPA_ATTENTION_THRESHOLD=6.5
```
Replace placeholders locally. URL-encode reserved characters in the database password. The first server start creates the schema and creates the initial super-admin only when the `users` table is empty.

Run `npm run seed:accounts` to provision the Atlas-backed administrator and placement coordinator, plus a demo student. Set `ADMIN_LOGIN_PASSWORD` and `PLACEMENT_COORDINATOR_PASSWORD` in `.env` to choose their passwords. Students can register from the login page; account passwords are hashed before storage. Generated passwords are written to the ignored `.local-accounts.json` file and are not printed in the terminal. Authentication uses MongoDB when Atlas is connected; academic records continue to use PostgreSQL.

### Step 3: Initialize PostgreSQL
To create the schema and optional initial administrator without deleting existing records:
```bash
npm run seed
```

### Step 4: Start the Server
```bash
npm start
```
Terminal output:
```text
======================================================
Student Academic Personal and Career Profiling System
Server running in development mode on http://localhost:3000
PostgreSQL connected; database schema initialized.
======================================================
```
Open your browser at: `http://localhost:3000`

---

## 5. Student Applications

Staff users with student-create permissions can submit the existing eight-step profile as an application. Applications are stored in `student_applications` with `PENDING` status. The review queue allows authorized staff to approve or reject them; approval creates the active student profile in a transaction. Staff accounts are provisioned through the initial-admin environment variables or the protected user-management API.

---

## 6. Academic Viva Demonstration Flow

1. **Login (`login.html`)**:
   - Log in using Faculty credentials or click the **Faculty / Mentor** demo button.
2. **Dashboard (`dashboard.html`)**:
   - Review 10 live KPI cards (Total Students, Hostellers vs Day Scholars, Average/Highest/Lowest CGPA, Active Arrears, Attention Count).
   - Review 6 interactive Chart.js graphs (Semester SGPA progression, Career Goals, CGPA Distribution, Hostellers/Day Scholars, Arrear Breakdown, Department Enrollment).
   - Explore watchlists: Attention required list, active arrears list, declining trend list.
3. **Add Student Wizard (`add-student.html`)**:
   - Demonstrate 8-step wizard:
     - **Step 1 (Personal)**: Conditional category fields (Hosteller shows Hostel Name; Day Scholar shows distance in km).
     - **Step 2 (Family)**: Privacy-conscious income ranges and emergency contacts.
     - **Step 3 (Academic)**: Dynamic addition of Semester records (SGPA, CGPA, Attendance).
     - **Step 4 (Arrears)**: Dynamic logging of arrear subjects, attempts, reasons, and remedial training requirements.
     - **Step 5 (Technical)**: Languages, technical skills, projects, certifications, GitHub/LinkedIn links, communication & aptitude levels.
     - **Step 6 (Self-Evaluation)**: Academic & technical strengths, areas for improvement, goals.
     - **Step 7 (Career Goal)**: Primary track selection (Placement, Higher Studies, Entrepreneurship) with respective fields.
     - **Step 8 (Review & Consent)**: Summary cards with mandatory privacy & mentoring consent checkbox.
4. **Students Directory (`students.html`)**:
   - Test real-time search by name or register number.
   - Combine filters: Department (e.g. `CSE`), Category (`Hosteller`), Career Goal (`Placement`), Arrear Status (`Pending`).
   - Select 2 or 3 students using the checkboxes and click **"Compare Selected"** to launch the side-by-side comparison modal.
5. **Student Profile (`student-profile.html`)**:
   - Inspect individual student: CGPA/SGPA progression line chart, academic trend badge, profile completion percentage, arrear history table.
   - Review **Rule-Based Career Skill Gap Analysis**: Acquired skills vs skills to develop, suggested certifications and practical projects.
   - Click **"Add Mentor Intervention"** to log a counseling session with date, notes, and follow-up deadline.
6. **Mentor Attention Center (`mentor-attention.html`)**:
   - Review students flagged by transparent rules (low attendance, active arrears, declining trend).
   - Log quick counseling records directly from the cards.
7. **Analytics (`analytics.html`)**:
   - Review college-wide distributions, top skills, top programming languages, and portfolio readiness meters.
8. **Export Reports (`reports.html`)**:
   - Download standardized CSV reports for Student Directory, Academic Performance, Arrears, Career Goals, and Mentor Interventions.
9. **Audit Logs (`audit-logs.html`)**:
   - Log out and sign in as Admin (`admin@college.edu`) to view security logs of all system operations.

---

## 7. REST API Documentation

### Authentication
- `POST /api/auth/login`: Authenticate user and receive JWT token.
- `POST /api/auth/logout`: Invalidate session and log audit event.
- `GET /api/auth/me`: Get current authenticated user details.

### Students
- `GET /api/students`: Fetch students with search, filters (department, section, category, careerGoal, arrearStatus, minCgpa, minAttendance), sorting, and pagination.
- `GET /api/students/:id`: Fetch single student with profile completion, academic trend, and career skill gap.
- `POST /api/students`: Create new student profile with consent confirmation.
- `PUT /api/students/:id`: Update student profile details.
- `DELETE /api/students/:id`: Delete student profile and record audit entry.

### Dynamic Subdocuments
- `POST /api/students/:id/semesters`: Add a semester record.
- `PUT /api/students/:id/semesters/:semesterId`: Update a semester record.
- `DELETE /api/students/:id/semesters/:semesterId`: Delete a semester record.
- `POST /api/students/:id/arrears`: Add an arrear record.
- `PUT /api/students/:id/arrears/:arrearId`: Update an arrear record (e.g. mark as Cleared).
- `DELETE /api/students/:id/arrears/:arrearId`: Delete an arrear record.
- `POST /api/students/:id/interventions`: Log a faculty mentor counseling session.
- `PUT /api/students/:id/interventions/:interventionId`: Update an intervention record.

### Insights & Analytics
- `GET /api/insights/dashboard`: Fetch all 10 dashboard KPIs, chart datasets, and watchlists.
- `GET /api/insights/mentor-attention`: Fetch list of students flagged for attention with specific reasons.
- `GET /api/insights/compare?ids=id1,id2,id3`: Compare up to 3 students on non-sensitive parameters.
- `GET /api/insights/analytics`: Fetch college-wide readiness distributions and skill rankings.

### Reports & Auditing
- `GET /api/reports/export?type=students|academics|arrears|career|mentor-intervention`: Export downloadable CSV reports.
- `GET /api/audit-logs`: Admin-only queryable activity log.

---

## 8. Privacy & Security Rules

1. **Sensitive Family & Income Protection**:
   - Parent income is stored as an approximate range (`₹3–5 Lakhs`), not an exact figure.
   - Parent details, income, and emergency contact numbers are strictly restricted to the individual student profile and authorized mentors. They are **never** rendered on public dashboards, export lists, or student comparison tables.
2. **No Public Student Rankings**:
   - The application does not rank students publicly or use disparaging terminology. Neutral, supportive phrasing such as `"Mentor Attention Required"` is strictly maintained.
3. **Mandatory Consent**:
   - A mandatory consent declaration is enforced during student profile registration.
4. **Security Hardening**:
   - Passwords are encrypted using bcrypt with salt rounds.
   - Helmet CSP policies restrict script and resource loading.
   - Rate limiting prevents API brute-forcing.
   - Full audit logging records logins, additions, modifications, and deletions.

---

## 9. Automated Testing

To run the automated integration test suite:
```bash
npm run test:api
```
Tests all endpoints: Health check, Authentication, Dashboard KPIs, Filtering, Student CRUD, Semester additions, Arrear updates, Mentor interventions, Student comparison, CSV report generation, and Admin audit logging.
