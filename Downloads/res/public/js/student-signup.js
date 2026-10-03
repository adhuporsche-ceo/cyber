const signupForm = document.getElementById('signupForm');
const signupAlert = document.getElementById('signupAlert');
const signupButton = document.getElementById('signupButton');

signupForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  signupAlert.classList.add('d-none');

  const formData = new FormData(signupForm);
  const password = formData.get('password');
  if (password !== formData.get('confirmPassword')) {
    showSignupError('Passwords do not match.');
    return;
  }

  signupButton.disabled = true;
  try {
    const response = await fetch('/api/auth/signup/student', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: formData.get('name'),
        email: formData.get('email'),
        registerNumber: formData.get('registerNumber'),
        department: formData.get('department'),
        password,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Could not create account.');

    localStorage.setItem('sps_token', result.data.token);
    localStorage.setItem('sps_user', JSON.stringify(result.data.user));
    window.location.replace('student-dashboard.html');
  } catch (error) {
    showSignupError(error.message);
    signupButton.disabled = false;
  }
});

function showSignupError(message) {
  signupAlert.textContent = message;
  signupAlert.className = 'alert alert-danger';
}