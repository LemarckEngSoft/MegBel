const form = document.querySelector('#login-form');
const errorMessage = document.querySelector('#login-error');

async function checkSession() {
  try {
    const response = await fetch('/api/auth/me', { credentials: 'include' });
    if (response.ok) window.location.href = '/app.html';
  } catch {}
}

async function readResponse(response) {
  const body = await response.text();
  if (!body) return {};
  try { return JSON.parse(body); } catch { return { error: 'O servidor retornou uma resposta inválida.' }; }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorMessage.hidden = true;
  const button = form.querySelector('button');
  button.disabled = true;
  button.textContent = 'Entrando...';
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ email: form.email.value, password: form.password.value })
    });
    const data = await readResponse(response);
    if (!response.ok) throw new Error(data.error || 'Nao foi possivel entrar.');
    window.location.href = '/app.html';
  } catch (error) {
    errorMessage.textContent = error.message;
    errorMessage.hidden = false;
    button.disabled = false;
    button.innerHTML = 'Entrar <span aria-hidden="true">&rarr;</span>';
  }
});

checkSession();
