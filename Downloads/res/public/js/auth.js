/**
 * Authentication Handler for Login Page
 */

document.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('sps_token') === 'local-frontend-preview') {
    localStorage.removeItem('sps_token');
    localStorage.removeItem('sps_user');
  }

  // If already logged in, redirect to dashboard
  if (localStorage.getItem('sps_token') && localStorage.getItem('sps_user')) {
    window.location.replace('dashboard.html');
    return;
  }

  const loginForm = document.getElementById('loginForm');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const togglePasswordBtn = document.getElementById('togglePasswordBtn');
  const togglePasswordIcon = document.getElementById('togglePasswordIcon');
  const loginBtn = document.getElementById('loginBtn');
  const loginBtnText = document.getElementById('loginBtnText');
  const loginSpinner = document.getElementById('loginSpinner');
  const loginAlert = document.getElementById('loginAlert');
  const loginAlertText = document.getElementById('loginAlertText');
  const passwordHelpBtn = document.getElementById('passwordHelpBtn');

  if (passwordHelpBtn) {
    passwordHelpBtn.addEventListener('click', () => {
      showError('Please contact your administrator to reset your password.');
    });
  }

  // Check if redirected after logout
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('logout') === 'true') {
    if (loginAlert && loginAlertText) {
      loginAlert.className = 'auth-alert';
      loginAlertText.textContent = 'You have logged out successfully.';
      loginAlert.classList.remove('d-none');
    }
  }

  // Toggle password visibility
  if (togglePasswordBtn) {
    togglePasswordBtn.addEventListener('click', () => {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      togglePasswordIcon.classList.toggle('bi-eye', !isPassword);
      togglePasswordIcon.classList.toggle('bi-eye-slash', isPassword);
    });
  }

  // Handle Form Submission
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      loginAlert.classList.add('d-none');

      // Validation
      const email = emailInput.value.trim();
      const password = passwordInput.value;

      if (!email || !password) {
        showError('Please enter both institutional email and password.');
        return;
      }

      setLoading(true);

      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        const responseText = await response.text();
        let data;
        try {
          data = responseText ? JSON.parse(responseText) : {};
        } catch (parseError) {
          throw new Error(
            response.ok
              ? 'The server returned an invalid response. Please check the deployment configuration.'
              : `Server error (${response.status}). Please check that the API is running.`
          );
        }

        if (!response.ok) {
          throw new Error(data.message || 'Login failed. Please check credentials.');
        }

        // Store session
        localStorage.setItem('sps_token', data.data.token);
        localStorage.setItem('sps_user', JSON.stringify(data.data.user));

        // Redirect based on user role
        let redirectUrl = localStorage.getItem('sps_redirect');
        const isStudent = normalizeClientRole(data.data.user.role) === 'STUDENT';
        if (!redirectUrl || (isStudent && (redirectUrl.includes('dashboard') || redirectUrl.includes('audit')))) {
          if (isStudent) {
            redirectUrl = data.data.user.studentProfileId
              ? `student-profile.html?id=${data.data.user.studentProfileId}`
              : 'student-dashboard.html';
          } else {
            redirectUrl = 'dashboard.html';
          }
        }
        localStorage.removeItem('sps_redirect');
        window.location.href = redirectUrl;
      } catch (err) {
        showError(err.message);
      } finally {
        setLoading(false);
      }
    });
  }

  function showError(msg) {
    if (loginAlert && loginAlertText) {
      loginAlert.className = 'auth-alert';
      loginAlertText.textContent = msg;
      loginAlert.classList.remove('d-none');
    }
  }

  function setLoading(isLoading) {
    if (loginBtn) {
      loginBtn.disabled = isLoading;
      loginSpinner.classList.toggle('d-none', !isLoading);
      loginBtnText.style.display = isLoading ? 'none' : 'inline-block';
    }
  }
});
