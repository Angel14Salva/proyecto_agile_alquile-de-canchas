// auth.js — protege páginas que requieren login y valida roles

function requireAuth() {
  if (!api.isLoggedIn()) {
    window.location.href = 'login.html';
  }
}

function requireRole(...roles) {
  requireAuth();
  const usuario = api.getUsuario();
  if (!roles.includes(usuario?.rol)) {
    mostrarAccesoDenegado(roles);
  }
}

function mostrarAccesoDenegado(rolesRequeridos) {
  const rolLabel = { admin: 'Gerente', recepcionista: 'Recepcionista', cliente: 'Cliente' };
  const requeridos = rolesRequeridos.map(r => rolLabel[r] || r).join(' o ');
  const usuario = api.getUsuario();
  const actual  = rolLabel[usuario?.rol] || usuario?.rol || 'Desconocido';

  document.body.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f5f5f5;font-family:sans-serif">
      <div style="background:#fff;border-radius:12px;padding:40px 32px;max-width:420px;width:100%;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.08)">
        <div style="font-size:48px;margin-bottom:16px">🚫</div>
        <div style="font-size:20px;font-weight:700;color:#1a1a1a;margin-bottom:8px">Acceso denegado</div>
        <p style="color:#666;font-size:14px;margin-bottom:4px">Tu rol actual es <strong>${actual}</strong>.</p>
        <p style="color:#666;font-size:14px;margin-bottom:24px">Esta página requiere el rol: <strong>${requeridos}</strong>.</p>
        <a href="dashboard.html" style="display:inline-block;background:#22c55e;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">← Volver al Dashboard</a>
      </div>
    </div>`;

  // Detener ejecución del script de la página
  throw new Error('Acceso denegado');
}
