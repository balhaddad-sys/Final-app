/**
 * Login Page
 */
import { Auth } from '../../services/firebase.auth.js';
import { EventBus, Events } from '../../core/events.js';
import { Router } from '../../core/router.js';

export function renderLogin(container) {
  container.innerHTML = `
    <div class="page-login">
      <div class="login-card">
        <div class="login-brand">
          <div class="login-brand-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
            </svg>
          </div>
          <h1>MedWard Pro</h1>
          <p>Clinical Ward Management</p>
        </div>

        <form class="login-form" id="login-form">
          <div class="input-group">
            <label class="input-label" for="login-email">Email</label>
            <input
              type="email"
              class="input"
              id="login-email"
              name="email"
              placeholder="doctor@hospital.com"
              required
              autocomplete="email"
            >
          </div>

          <div class="input-group">
            <label class="input-label" for="login-password">Password</label>
            <input
              type="password"
              class="input"
              id="login-password"
              name="password"
              placeholder="Enter your password"
              required
              autocomplete="current-password"
            >
          </div>

          <button type="submit" class="btn btn-primary btn-lg" id="login-submit" style="width: 100%;">
            Sign In
          </button>

          <div class="login-error hidden" id="login-error" style="color: var(--danger); font-size: var(--text-sm); text-align: center;"></div>
        </form>

        <div class="login-divider">or</div>

        <button class="google-btn" id="google-login">
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>
      </div>
    </div>
  `;

  // Form submission
  const form = container.querySelector('#login-form');
  const errorEl = container.querySelector('#login-error');
  const submitBtn = container.querySelector('#login-submit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.add('hidden');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';

    const email = form.querySelector('#login-email').value.trim();
    const password = form.querySelector('#login-password').value;

    const result = await Auth.login(email, password);

    if (result.success) {
      Router.navigate('/units');
    } else {
      errorEl.textContent = result.error;
      errorEl.classList.remove('hidden');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
    }
  });

  // Google login
  container.querySelector('#google-login').addEventListener('click', async () => {
    const result = await Auth.loginWithGoogle();

    if (result.success) {
      Router.navigate('/units');
    } else {
      errorEl.textContent = result.error;
      errorEl.classList.remove('hidden');
    }
  });
}
