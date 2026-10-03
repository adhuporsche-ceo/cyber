/**
 * Student Academic Personal and Career Profiling System
 * Shared Utilities, Authentication Guard, Layout Injector, and API Helpers
 */

const APP_CONFIG = {
  appName: 'Student Profiling System',
  fullAppName: 'Student Academic Personal and Career Profiling System',
  apiBase: '/api',
};

const ROLE_MENU_CONFIG = {
  SUPER_ADMIN: { canCreate: true, canEdit: true, canDelete: true, canImport: true, canAudit: true },
  PLACEMENT_COORDINATOR: { canCreate: true, canEdit: true, canDelete: false, canImport: true, canAudit: true },
  HOD: { canCreate: false, canEdit: false, canDelete: false, canImport: false, canAudit: true },
  FACULTY_MENTOR: { canCreate: false, canEdit: false, canDelete: false, canImport: false, canAudit: false },
  STUDENT: { canCreate: false, canEdit: false, canDelete: false, canImport: false, canAudit: false },
};

function normalizeClientRole(role) {
  return ({ admin: 'SUPER_ADMIN', faculty: 'FACULTY_MENTOR', student: 'STUDENT' }[role] || String(role || '').toUpperCase());
}

function getRoleConfig() {
  return ROLE_MENU_CONFIG[normalizeClientRole(getCurrentUser()?.role)] || ROLE_MENU_CONFIG.STUDENT;
}

function canClient(action) { return Boolean(getRoleConfig()[action]); }

function initRealtime() {
  if (window.spsRealtimeInitialized || !getAuthToken()) return;
  window.spsRealtimeInitialized = true;
  const connect = () => {
    if (!window.io) return;
    const socket = window.io({ auth: { token: getAuthToken() } });
    socket.on('student:created', () => { if (typeof window.loadStudents === 'function') window.loadStudents(); });
    socket.on('student:updated', () => { if (typeof window.loadStudents === 'function') window.loadStudents(); });
  };
  if (window.io) connect();
  else {
    const script = document.createElement('script');
    script.src = '/socket.io/socket.io.js';
    script.onload = connect;
    document.head.appendChild(script);
  }
}

function initTheme() {
  const savedTheme = localStorage.getItem('sps_theme') || 'light';
  document.documentElement.dataset.theme = savedTheme;
}

function toggleTheme() {
  const nextTheme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = nextTheme;
  localStorage.setItem('sps_theme', nextTheme);
  window.dispatchEvent(new Event('sps:themechange'));
  showToast(`${nextTheme === 'light' ? 'Light' : 'Dark'} theme enabled`, 'info');
}

initTheme();

// ---------------------------------------------------------------------------
// Authentication & Session Helpers
// ---------------------------------------------------------------------------

function getCurrentUser() {
  const userStr = localStorage.getItem('sps_user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch (e) {
    return null;
  }
}

function getAuthToken() {
  return localStorage.getItem('sps_token');
}

function checkAuth(requiredRole = null) {
  const token = getAuthToken();
  const user = getCurrentUser();

  if (!token || !user || token === 'local-frontend-preview') {
    localStorage.removeItem('sps_token');
    localStorage.removeItem('sps_user');
    window.location.replace('login.html');
    return false;
  }

  // If student tries to access admin or faculty-only pages
  const role = normalizeClientRole(user.role);
  if (role === 'STUDENT') {
    const facultyPages = ['dashboard.html', 'add-student.html', 'edit-student.html', 'students.html', 'analytics.html', 'mentor-attention.html', 'reports.html', 'audit-logs.html'];
    const currentPath = window.location.pathname.split('/').pop() || '';
    if (facultyPages.includes(currentPath)) {
      window.location.href = `student-profile.html?id=${user.studentProfileId || ''}`;
      return false;
    }
  }

  if (requiredRole && role !== normalizeClientRole(requiredRole)) {
    if (role === 'STUDENT') {
      window.location.href = `student-profile.html?id=${user.studentProfileId || ''}`;
      return false;
    }
    showToast('Not authorized for this page.', 'danger');
    window.location.href = 'dashboard.html';
    return false;
  }

  return true;
}

function handleLogout(e) {
  if (e && e.preventDefault) e.preventDefault();

  const token = getAuthToken();

  // 1. Immediately wipe client auth credentials to ensure session cannot persist
  try {
    localStorage.removeItem('sps_token');
    localStorage.removeItem('sps_user');
    localStorage.removeItem('sps_redirect');
    sessionStorage.clear();
  } catch (err) {
    console.error('Storage clear error:', err);
  }

  // 2. Notify backend asynchronously with keepalive to record security audit log
  if (token) {
    try {
      fetch(`${APP_CONFIG.apiBase}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        keepalive: true,
      }).catch(() => {});
    } catch (err) {
      // Ignore network errors on logout
    }
  }

  // 3. Redirect back to the dashboard for preview mode without sign-in
  window.location.replace('dashboard.html');
}

// Guarantee window-level global access for all event bindings
window.handleLogout = handleLogout;

// ---------------------------------------------------------------------------
// Standard API Wrapper
// ---------------------------------------------------------------------------

async function apiCall(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    config.body = JSON.stringify(options.body);
  }

  try {
    const res = await fetch(`${APP_CONFIG.apiBase}${endpoint}`, config);

    // If unauthorized, redirect to login
    if (res.status === 401) {
      localStorage.removeItem('sps_token');
      localStorage.removeItem('sps_user');
      window.location.href = 'login.html';
      throw new Error('Session expired. Please log in again.');
    }

    // Handle file downloads (e.g. CSV reports)
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('text/csv')) {
      return res;
    }

    const responseText = await res.text();
    let data;
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch (parseError) {
      throw new Error(
        res.ok
          ? 'The server returned an invalid response. Please check the deployment configuration.'
          : `Server error (${res.status}). Please check that the API is running.`
      );
    }
    if (!res.ok) {
      const errorMsg = data.message || (data.errors ? data.errors.join(', ') : 'Request failed');
      throw new Error(errorMsg);
    }

    return data;
  } catch (err) {
    console.error(`API Error on ${endpoint}:`, err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// UI Layout Injector (Sidebar + Topbar)
// ---------------------------------------------------------------------------

function initLayout(activeNavItem = 'dashboard') {
  const user = getCurrentUser();
  if (!user) return;

  const appWrapper = document.getElementById('app-wrapper');
  if (!appWrapper) return;

  const role = normalizeClientRole(user.role);
  const isStudent = role === 'STUDENT';
  const isPlacementOfficer = role === 'PLACEMENT_COORDINATOR';
  const isMentor = role === 'FACULTY_MENTOR' || role === 'HOD';
  const isAdmin = role === 'SUPER_ADMIN';
  const studentProfileId = user.studentProfileId || '';

  let navItemsHtml = '';

  if (isStudent) {
    navItemsHtml = `
      <li class="nav-item">
        <a href="student-dashboard.html" class="nav-link ${activeNavItem === 'student-dashboard' ? 'active' : ''}">
          <i class="bi bi-briefcase-fill text-primary"></i>
          <span>Placement Cockpit</span>
        </a>
      </li>
      <li class="nav-item">
        <a href="student-profile.html?id=${studentProfileId}" class="nav-link ${activeNavItem === 'students' || activeNavItem === 'profile' ? 'active' : ''}">
          <i class="bi bi-person-badge-fill"></i>
          <span>My Profile & Skills</span>
        </a>
      </li>
      <li class="nav-item">
        <a href="add-student.html" class="nav-link ${activeNavItem === 'add-student' ? 'active' : ''}">
          <i class="bi bi-file-earmark-person-fill"></i>
          <span>Profile Application</span>
        </a>
      </li>
      <li class="nav-item">
        <a href="settings.html" class="nav-link ${activeNavItem === 'settings' ? 'active' : ''}">
          <i class="bi bi-gear-fill"></i>
          <span>Account Settings</span>
        </a>
      </li>
    `;
  } else if (isPlacementOfficer) {
    navItemsHtml = `
      <li class="nav-item">
        <a href="placement-crm.html" class="nav-link ${activeNavItem === 'placement-crm' ? 'active' : ''}">
          <i class="bi bi-buildings-fill text-primary"></i>
          <span>Placement CRM & Drives</span>
        </a>
      </li>
      <li class="nav-item">
        <a href="dashboard.html" class="nav-link ${activeNavItem === 'dashboard' ? 'active' : ''}">
          <i class="bi bi-speedometer2"></i>
          <span>Placement Overview</span>
        </a>
      </li>
      <li class="nav-item">
        <a href="student-applications.html" class="nav-link ${activeNavItem === 'student-applications' ? 'active' : ''}">
          <i class="bi bi-inbox-fill"></i>
          <span>Application Review</span>
        </a>
      </li>
      <li class="nav-item">
        <a href="students.html" class="nav-link ${activeNavItem === 'students' ? 'active' : ''}">
          <i class="bi bi-people-fill"></i>
          <span>Student Directory</span>
        </a>
      </li>
      <li class="nav-item">
        <a href="reports.html" class="nav-link ${activeNavItem === 'reports' ? 'active' : ''}">
          <i class="bi bi-file-earmark-spreadsheet-fill"></i>
          <span>Export Reports</span>
        </a>
      </li>
      <li class="nav-item">
        <a href="analytics.html" class="nav-link ${activeNavItem === 'analytics' ? 'active' : ''}">
          <i class="bi bi-graph-up-arrow"></i>
          <span>Analytics & Charts</span>
        </a>
      </li>
      <li class="nav-item">
        <a href="settings.html" class="nav-link ${activeNavItem === 'settings' ? 'active' : ''}">
          <i class="bi bi-gear-fill"></i>
          <span>System Settings</span>
        </a>
      </li>
    `;
  } else if (isMentor) {
    navItemsHtml = `
      <li class="nav-item">
        <a href="mentor-dashboard.html" class="nav-link ${activeNavItem === 'mentor-dashboard' ? 'active' : ''}">
          <i class="bi bi-mortarboard-fill text-primary"></i>
          <span>Mentor Dashboard</span>
        </a>
      </li>
      <li class="nav-item">
        <a href="student-applications.html" class="nav-link ${activeNavItem === 'student-applications' ? 'active' : ''}">
          <i class="bi bi-inbox-fill"></i>
          <span>Review Applications</span>
        </a>
      </li>
      <li class="nav-item">
        <a href="students.html" class="nav-link ${activeNavItem === 'students' ? 'active' : ''}">
          <i class="bi bi-people-fill"></i>
          <span>Assigned Students</span>
        </a>
      </li>
      <li class="nav-item">
        <a href="mentor-attention.html" class="nav-link ${activeNavItem === 'mentor-attention' ? 'active' : ''}">
          <i class="bi bi-exclamation-diamond-fill text-warning"></i>
          <span>Attention & Counseling</span>
        </a>
      </li>
      <li class="nav-item">
        <a href="analytics.html" class="nav-link ${activeNavItem === 'analytics' ? 'active' : ''}">
          <i class="bi bi-graph-up-arrow"></i>
          <span>Analytics & Trends</span>
        </a>
      </li>
      <li class="nav-item">
        <a href="reports.html" class="nav-link ${activeNavItem === 'reports' ? 'active' : ''}">
          <i class="bi bi-file-earmark-spreadsheet-fill"></i>
          <span>Export Reports</span>
        </a>
      </li>
      <li class="nav-item">
        <a href="settings.html" class="nav-link ${activeNavItem === 'settings' ? 'active' : ''}">
          <i class="bi bi-gear-fill"></i>
          <span>Settings</span>
        </a>
      </li>
    `;
  } else {
    // Admin (Full Suite)
    navItemsHtml = `
      <li class="nav-item">
        <a href="dashboard.html" class="nav-link ${activeNavItem === 'dashboard' ? 'active' : ''}">
          <i class="bi bi-grid-1x2-fill"></i>
          <span>Executive Dashboard</span>
        </a>
      </li>
      <li class="nav-item">
        <a href="placement-crm.html" class="nav-link ${activeNavItem === 'placement-crm' ? 'active' : ''}">
          <i class="bi bi-buildings-fill text-primary"></i>
          <span>Placement CRM & Drives</span>
        </a>
      </li>
      <li class="nav-item">
        <a href="mentor-dashboard.html" class="nav-link ${activeNavItem === 'mentor-dashboard' ? 'active' : ''}">
          <i class="bi bi-mortarboard-fill"></i>
          <span>Mentor Portal</span>
        </a>
      </li>
      <li class="nav-item">
        <a href="students.html" class="nav-link ${activeNavItem === 'students' ? 'active' : ''}">
          <i class="bi bi-people-fill"></i>
          <span>Students Directory</span>
        </a>
      </li>
      <li class="nav-item">
        <a href="add-student.html" class="nav-link ${activeNavItem === 'add-student' ? 'active' : ''}">
          <i class="bi bi-person-plus-fill"></i>
          <span>Create Student Record</span>
        </a>
      </li>
      <li class="nav-item">
        <a href="student-applications.html" class="nav-link ${activeNavItem === 'student-applications' ? 'active' : ''}">
          <i class="bi bi-inbox-fill"></i>
          <span>Review Applications</span>
        </a>
      </li>
      <li class="nav-item">
        <a href="mentor-attention.html" class="nav-link ${activeNavItem === 'mentor-attention' ? 'active' : ''}">
          <i class="bi bi-shield-exclamation text-warning"></i>
          <span>Mentor Attention</span>
        </a>
      </li>
      <li class="nav-item">
        <a href="analytics.html" class="nav-link ${activeNavItem === 'analytics' ? 'active' : ''}">
          <i class="bi bi-bar-chart-line-fill"></i>
          <span>Analytics & Reports</span>
        </a>
      </li>
      <li class="nav-item">
        <a href="reports.html" class="nav-link ${activeNavItem === 'reports' ? 'active' : ''}">
          <i class="bi bi-file-earmark-spreadsheet-fill"></i>
          <span>Export Reports</span>
        </a>
      </li>
      <li class="nav-item">
        <a href="audit-logs.html" class="nav-link ${activeNavItem === 'audit-logs' ? 'active' : ''}">
          <i class="bi bi-shield-lock-fill"></i>
          <span>Audit Logs</span>
        </a>
      </li>
      <li class="nav-item">
        <a href="settings.html" class="nav-link ${activeNavItem === 'settings' ? 'active' : ''}">
          <i class="bi bi-gear-fill"></i>
          <span>System Settings</span>
        </a>
      </li>
    `;
  }

  // 1. Render Sidebar
  const sidebarHtml = `
    <nav id="sidebar">
      <a href="${isStudent ? 'student-dashboard.html' : isPlacementOfficer ? 'placement-crm.html' : isMentor ? 'mentor-dashboard.html' : 'dashboard.html'}" class="sidebar-brand">
        <i class="bi bi-mortarboard-fill"></i>
        <div>
          <div style="font-size: 1.05rem; font-weight: 700; color: #ffffff;">Placement CRM</div>
          <small style="font-size: 0.72rem; color: #94a3b8;">${isStudent ? 'Student Career Portal' : isPlacementOfficer ? 'Corporate Relations' : isMentor ? 'Faculty Mentoring' : 'Academic & Career Admin'}</small>
        </div>
      </a>

      <ul class="nav-list">
        ${navItemsHtml}
        <li class="nav-item mt-3 pt-2" style="border-top: 1px solid rgba(255, 255, 255, 0.1);">
          <a href="javascript:void(0)" onclick="handleLogout(event)" data-action="logout" class="nav-link text-danger d-flex align-items-center gap-2">
            <i class="bi bi-box-arrow-right text-danger"></i>
            <span class="fw-semibold">Sign Out / Logout</span>
          </a>
        </li>
      </ul>

      <div class="sidebar-footer d-flex align-items-center justify-content-between">
        <div class="text-truncate" style="max-width: 140px;">
          <div style="color: #94a3b8; font-size: 0.72rem; text-transform: uppercase; font-weight: 600;">Logged In</div>
          <div class="text-white fw-bold text-truncate" style="font-size: 0.85rem;">${user.name}</div>
        </div>
        <button type="button" class="btn btn-sm btn-outline-danger p-1 px-2" onclick="handleLogout(event)" data-action="logout" title="Sign Out">
          <i class="bi bi-box-arrow-right"></i>
        </button>
      </div>
    </nav>
    <div class="sidebar-backdrop" id="sidebarBackdrop" onclick="toggleSidebar()"></div>
  `;

  // 2. Render Topbar
  const topbarHtml = `
    <header id="top-navbar">
      <div class="d-flex align-items-center gap-3">
        <button class="btn btn-sm btn-outline-light d-lg-none" type="button" onclick="toggleSidebar()">
          <i class="bi bi-list fs-5"></i>
        </button>
        <div class="d-none d-md-block">
          <h6 class="mb-0 fw-bold d-flex align-items-center gap-2">
            <i class="bi bi-briefcase-fill text-primary"></i> Student Placement & Career Profiling CRM
            <span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2 py-0.5" style="font-size: 0.7rem;">Live Sync</span>
          </h6>
          <small class="text-muted" style="font-size: 0.75rem;">${isStudent ? 'Candidate Placement Cockpit' : isPlacementOfficer ? 'Placement & Corporate Officer Hub' : isMentor ? 'Faculty Mentor Dashboard' : 'Central Administrative Operations'}</small>
        </div>
      </div>

      <div class="d-flex align-items-center gap-3">
        ${
          !isStudent
            ? `
        <div class="search-input-group position-relative d-none d-sm-flex">
          <select id="globalSearchCategory" class="form-select form-select-sm" style="max-width: 105px;">
            <option value="all">All</option><option value="name">Name</option><option value="registerNumber">Reg No</option><option value="department">Dept</option>
          </select>
          <input
            type="text"
            id="globalSearchInput"
            class="form-control form-control-sm"
            placeholder="Search students, companies..."
            onkeydown="if(event.key === 'Enter') handleGlobalSearch()"
          />
        </div>
        `
            : ''
        }

        <a class="position-relative text-white p-2 text-decoration-none" href="mentor-attention.html" title="Real-time Notifications" aria-label="Notifications">
          <i class="bi bi-bell-fill fs-5"></i>
          <span id="attentionBadge" class="position-absolute top-1 start-100 translate-middle badge rounded-pill bg-danger">0</span>
        </a>

        <div class="user-profile-badge dropdown">
          <button type="button" class="btn btn-link p-0 text-decoration-none d-flex align-items-center gap-2 dropdown-toggle" data-bs-toggle="dropdown" id="userMenuDropdown" aria-expanded="false">
            <div class="user-avatar">${user.name.charAt(0)}</div>
            <div class="d-none d-lg-block text-start">
              <div class="fw-semibold text-white" style="font-size: 0.85rem; line-height: 1.1;">${user.name}</div>
              <span class="badge bg-secondary text-white" style="font-size: 0.65rem;">
                ${role}
              </span>
            </div>
          </button>
          <ul class="dropdown-menu dropdown-menu-end shadow-sm" aria-labelledby="userMenuDropdown">
            <li><h6 class="dropdown-header">Dept: ${user.department || 'CSE'} ${user.registerNumber ? `(${user.registerNumber})` : ''}</h6></li>
            <li><a class="dropdown-item" href="settings.html"><i class="bi bi-person-gear me-2"></i>My Profile & Settings</a></li>
            <li><hr class="dropdown-divider"></li>
            <li><button type="button" class="dropdown-item text-danger d-flex align-items-center gap-2" onclick="handleLogout(event)" data-action="logout"><i class="bi bi-box-arrow-right text-danger"></i><span>Sign Out / Logout</span></button></li>
          </ul>
        </div>

        <button type="button" class="btn btn-outline-danger btn-sm d-flex align-items-center gap-1 px-2.5 py-1" onclick="handleLogout(event)" data-action="logout" title="Sign Out">
          <i class="bi bi-box-arrow-right"></i>
          <span class="d-none d-sm-inline fw-semibold">Logout</span>
        </button>
      </div>
    </header>
  `;

  // Inject sidebar and topbar
  appWrapper.insertAdjacentHTML('afterbegin', sidebarHtml);

  const mainContent = document.getElementById('main-content');
  if (mainContent) {
    mainContent.insertAdjacentHTML('afterbegin', topbarHtml);
  }

  // Real-time attention badge & socket initialization
  apiCall('/insights/mentor-attention').then((result) => {
    const badge = document.getElementById('attentionBadge');
    if (badge && result.data) badge.textContent = result.data.totalAttentionCount || 0;
  }).catch(() => {});

  initRealtimeSocket();

  // Attach direct event listeners to all logout triggers
  setTimeout(() => {
    document.querySelectorAll('[data-action="logout"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        handleLogout(e);
      });
    });
  }, 50);

  // Inject toast notification container if not present
  if (!document.getElementById('toast-container')) {
    document.body.insertAdjacentHTML('beforeend', '<div id="toast-container" class="toast-container"></div>');
  }
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (sidebar) sidebar.classList.toggle('show');
  if (backdrop) backdrop.classList.toggle('show');
}

function handleGlobalSearch() {
  const input = document.getElementById('globalSearchInput');
  if (input && input.value.trim() !== '') {
    const category = document.getElementById('globalSearchCategory')?.value || 'all';
    window.location.href = `students.html?search=${encodeURIComponent(input.value.trim())}&searchType=${category}`;
  }
}

// ---------------------------------------------------------------------------
// Toast Notification
// ---------------------------------------------------------------------------

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const id = `toast-${Date.now()}`;
  const iconMap = {
    success: 'bi-check-circle-fill text-success',
    danger: 'bi-exclamation-triangle-fill text-danger',
    warning: 'bi-exclamation-circle-fill text-warning',
    info: 'bi-info-circle-fill text-info',
  };

  const toastHtml = `
    <div id="${id}" class="toast align-items-center shadow-lg border-0 mb-2" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="d-flex p-2">
        <div class="toast-body d-flex align-items-center gap-2" style="font-size: 0.9rem;">
          <i class="bi ${iconMap[type] || iconMap.info} fs-5"></i>
          <div>${message}</div>
        </div>
        <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    </div>
  `;

  container.insertAdjacentHTML('beforeend', toastHtml);
  const toastEl = document.getElementById(id);
  const toast = new bootstrap.Toast(toastEl, { delay: 4000 });
  toast.show();

  toastEl.addEventListener('hidden.bs.toast', () => {
    toastEl.remove();
  });
}

// ---------------------------------------------------------------------------
// UI Formatters & Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (e) {
    return dateStr;
  }
}

function getAcademicTrendBadge(trend) {
  if (!trend) return '<span class="badge bg-secondary">Insufficient Data</span>';
  if (typeof trend === 'object') trend = trend.trend || 'Stable';

  switch (trend) {
    case 'Improving':
      return '<span class="badge bg-success"><i class="bi bi-arrow-up-right me-1"></i>Improving Trend</span>';
    case 'Declining':
      return '<span class="badge bg-warning text-dark"><i class="bi bi-arrow-down-right me-1"></i>Declining Trend</span>';
    case 'Stable':
      return '<span class="badge bg-info text-dark"><i class="bi bi-arrow-right me-1"></i>Stable Trend</span>';
    default:
      return '<span class="badge bg-secondary">Insufficient Data</span>';
  }
}

function getArrearBadge(pendingCount) {
  const count = Number(pendingCount) || 0;
  if (count === 0) {
    return '<span class="badge badge-soft-success"><i class="bi bi-check2-circle me-1"></i>0 Arrears (All Clear)</span>';
  }
  return `<span class="badge badge-soft-danger"><i class="bi bi-exclamation-circle me-1"></i>${count} Pending Arrear${count > 1 ? 's' : ''}</span>`;
}

// ---------------------------------------------------------------------------
// Real-time Socket.IO Client Synchronizer
// ---------------------------------------------------------------------------
let realtimeSocket = null;

function initRealtimeSocket() {
  if (typeof io !== 'function') {
    // If socket.io is not on window, dynamically load it from server
    if (!document.getElementById('socket-io-script')) {
      const s = document.createElement('script');
      s.id = 'socket-io-script';
      s.src = '/socket.io/socket.io.js';
      s.onload = () => initRealtimeSocket();
      document.head.appendChild(s);
    }
    return;
  }

  const user = getCurrentUser();
  const token = getAuthToken();
  if (!user || !token) return;

  try {
    realtimeSocket = io({
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
    });

    realtimeSocket.on('connect', () => {
      const role = normalizeClientRole(user.role);
      realtimeSocket.emit('join', {
        userId: user.id || user._id,
        registerNumber: user.registerNumber,
        role,
      });
    });

    realtimeSocket.on('notification:new', (notif) => {
      showToast(notif.title + ': ' + notif.message, 'info');
      const badge = document.getElementById('attentionBadge');
      if (badge) {
        const curr = parseInt(badge.textContent, 10) || 0;
        badge.textContent = curr + 1;
      }
    });

    realtimeSocket.on('application:new', (app) => {
      showToast(`⚡ New Application: ${app.studentName} applied for ${app.companyName}!`, 'info');
      if (typeof window.reloadPlacementData === 'function') window.reloadPlacementData();
    });

    realtimeSocket.on('application:status_updated', (app) => {
      showToast(`⚡ Live Update: ${app.studentName} - ${app.companyName} is now ${app.status}!`, 'success');
      if (typeof window.reloadPlacementData === 'function') window.reloadPlacementData();
    });

    realtimeSocket.on('interview:scheduled', (app) => {
      showToast(`📅 Interview Scheduled: ${app.companyName} for ${app.studentName}!`, 'info');
      if (typeof window.reloadPlacementData === 'function') window.reloadPlacementData();
    });

    realtimeSocket.on('offer:released', (app) => {
      showToast(`🎉 Offer Letter Released: ${app.companyName} has issued an offer for ${app.studentName}!`, 'success');
      if (typeof window.reloadPlacementData === 'function') window.reloadPlacementData();
    });

    realtimeSocket.on('company:created', (comp) => {
      showToast(`🏢 New Placement Drive: ${comp.name} (${comp.role} - ${comp.package})!`, 'info');
      if (typeof window.reloadPlacementData === 'function') window.reloadPlacementData();
    });
  } catch (err) {
    console.warn('Socket init exception:', err.message);
  }
}

