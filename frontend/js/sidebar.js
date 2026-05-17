// sidebar.js — genera el sidebar según rol del usuario
function renderSidebar(activePage) {
  const usuario = api.getUsuario();
  const rol = usuario?.rol;

  const items = [
    { page: 'dashboard', href: 'dashboard.html', icon: '🏠', label: 'Dashboard', roles: ['admin','recepcionista','cliente'] },
    { page: 'canchas',   href: 'canchas.html',   icon: '⚽', label: 'Canchas',       roles: ['admin','recepcionista','cliente'] },
    { page: 'reservar',  href: 'reservar.html',  icon: '📅', label: 'Reservar',       roles: ['admin','recepcionista','cliente'] },
    { page: 'mis-reservas', href: 'mis-reservas.html', icon: '📋', label: 'Mis reservas', roles: ['cliente'] },
    { page: 'reservas',  href: 'reservas.html',  icon: '📋', label: 'Reservas',       roles: ['admin','recepcionista'] },
    { page: 'recepcion', href: 'recepcion.html', icon: '🏢', label: 'Recepción',      roles: ['admin','recepcionista'] },
    { page: 'admin',     href: 'admin.html',     icon: '⚙️', label: 'Administración', roles: ['admin'] },
  ];

  const visibles = items.filter(i => i.roles.includes(rol));
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  sidebar.innerHTML = `
    <div class="sidebar-section">Menú</div>
    ${visibles.map(i => `
      <a href="${i.href}" class="sidebar-item ${activePage === i.page ? 'active' : ''}">
        <span class="icon">${i.icon}</span>${i.label}
      </a>
    `).join('')}
    <div class="sidebar-section" style="margin-top:auto">Sesión</div>
    <div style="padding:12px 16px;font-size:12px;color:var(--gray-muted)">
      ${usuario?.nombre}<br>
      <span style="font-size:11px;background:var(--green-light);color:var(--green);padding:2px 7px;border-radius:10px;margin-top:4px;display:inline-block">${rol}</span>
    </div>
  `;
}
