// Login logic using Supabase. Username is mapped to an email for Supabase auth.
const ADMIN_USERNAME = 'admin';
const ADMIN_EMAIL = 'admin@example.com'; // Create this user in Supabase Users with password below
const ADMIN_PASSWORD = 'admin123';

function qs(id) { return document.getElementById(id); }

async function checkSessionAndRedirect() {
  try {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (session) {
      window.location.href = 'index.html';
    }
  } catch (e) {
    console.warn('Supabase session check failed', e);
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const username = qs('username').value.trim();
  const password = qs('password').value;
  const errorEl = qs('loginError');

  errorEl.style.display = 'none';
  errorEl.textContent = '';

  if (!username || !password) {
    errorEl.textContent = 'Isi username dan password.';
    errorEl.style.display = 'block';
    return;
  }

  // Basic app-level credential check
  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    errorEl.textContent = 'Username atau password salah.';
    errorEl.style.display = 'block';
    return;
  }

  // Supabase email/password login using mapped email
  try {
    const { data, error } = await window.supabaseClient.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    if (error) throw error;
    // Logged in, go to app
    window.location.href = 'index.html';
  } catch (err) {
    console.error('Login error:', err);
    const msg = (err && err.message) ? err.message : 'Tidak bisa login ke server.';
    let hint = '';
    if (/Invalid login credentials/i.test(msg) || /Email not found/i.test(msg)) {
      hint = ' Pastikan user admin sudah dibuat di Supabase (email: ' + ADMIN_EMAIL + ').';
    }
    errorEl.textContent = 'Gagal login.' + hint;
    errorEl.style.display = 'block';
  }
}

function setupUI() {
  const form = qs('loginForm');
  const toggle = qs('togglePwd');
  form.addEventListener('submit', handleLogin);
  toggle.addEventListener('click', () => {
    const pwd = qs('password');
    pwd.type = pwd.type === 'password' ? 'text' : 'password';
  });
}

// Initialize
(async function init() {
  await checkSessionAndRedirect();
  setupUI();
})();