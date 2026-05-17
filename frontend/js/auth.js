// auth.js — protege páginas que requieren login
function requireAuth() {
  if (!api.isLoggedIn()) {
    window.location.href = 'index.html';
  }
}

function requireRole(...roles) {
  requireAuth();
  const usuario = api.getUsuario();
  if (!roles.includes(usuario?.rol)) {
    window.location.href = 'dashboard.html';
  }
}
