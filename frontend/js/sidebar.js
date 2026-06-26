// sidebar.js — menú lateral dinámico según rol (HU-16)
function renderSidebar(activePage) {
  const usuario = api.getUsuario();
  const rol = usuario?.rol;
  const items = [
    // Cliente
    { page: 'dashboard',        href: 'dashboard.html',         icon: '🏠', label: 'Dashboard',           roles: ['cliente','recepcionista'] },
    { page: 'canchas',          href: 'canchas.html',           icon: '⚽', label: 'Canchas',              roles: ['cliente'] },
    { page: 'canchas',          href: 'admin.html#canchas',     icon: '⚽', label: 'Canchas',              roles: ['admin'] },
    { page: 'reservar',         href: 'reservar.html',          icon: '📅', label: 'Nueva reserva',        roles: ['cliente','recepcionista'] },
    { page: 'mis-reservas',     href: 'mis-reservas.html',      icon: '📋', label: 'Mis reservas',         roles: ['cliente'] },
    { page: 'reserva-grande',   href: '#',    icon: '🏟️', label: 'Reserva grande',      roles: ['cliente','recepcionista'], proximamente: true },
    { page: 'cancelar-reserva', href: 'cancelar-reserva.html',  icon: '❌', label: 'Cancelar reserva',     roles: ['recepcionista'] },
    // Recepcionista
    { page: 'reservas',         href: 'reservas.html',          icon: '📋', label: 'Todas las reservas',   roles: ['recepcionista'] },
    { page: 'recepcion',        href: 'recepcion.html',         icon: '🏢', label: 'Recepción',            roles: ['recepcionista'] },
    // Gerente
    { page: 'dashboard',        href: 'dashboard.html',         icon: '📊', label: 'Panel de informes',    roles: ['admin'] },
    { page: 'admin-export',     href: 'admin.html#informes',    icon: '📤', label: 'Exportar informes',    roles: ['admin'] },
    { page: 'admin-usuarios',   href: 'admin.html#usuarios',    icon: '👥', label: 'Gestión de usuarios',  roles: ['admin'] },
  ];
  const visibles = items.filter(i => i.roles.includes(rol));
  const sidebar  = document.getElementById('sidebar');
  if (!sidebar) return;
  const rolLabel = { admin: 'Gerente', recepcionista: 'Recepcionista', cliente: 'Cliente' };
  // Agregar boton hamburguesa al topbar si no existe
  const topbar = document.querySelector('.topbar-right') || document.querySelector('.topbar');
  if (topbar && !document.getElementById('menuHamburguesa')) {
    const btn = document.createElement('button');
    btn.id = 'menuHamburguesa';
    btn.className = 'topbar-menu-btn';
    btn.innerHTML = '☰';
    btn.onclick = () => {
      const isOpen = sidebar.classList.toggle('open');
      if (window.innerWidth <= 768) {
        overlay.style.display = isOpen ? 'block' : 'none';
      }
    };
    topbar.insertBefore(btn, topbar.firstChild);
  }

  // Overlay para cerrar sidebar al tocar fuera
  let overlay = document.getElementById('sidebarOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'sidebarOverlay';
    overlay.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:199';
    overlay.onclick = () => { sidebar.classList.remove('open'); overlay.style.display='none'; };
    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) { overlay.style.display='none'; sidebar.classList.remove('open'); }
    });
    document.body.appendChild(overlay);
  }

  sidebar.innerHTML = `
    <div class="sidebar-section">Menú</div>
    ${visibles.map(i => i.proximamente ? `
      <a href="#" class="sidebar-item" onclick="event.preventDefault();alert('🚧 Próximamente\n\nLas reservas grandes serán implementadas en una versión futura del sistema.')">
        <span class="icon">${i.icon}</span>${i.label} <span style="font-size:10px;background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:8px;margin-left:4px">Pronto</span>
      </a>
    ` : `
      <a href="${i.href}" class="sidebar-item ${activePage === i.page ? 'active' : ''}">
        <span class="icon">${i.icon}</span>${i.label}
      </a>
    `).join('')}
    <div class="sidebar-section" style="margin-top:auto">Sesión</div>
    <div style="padding:12px 16px;font-size:12px;color:var(--gray-muted)">
      ${usuario?.nombre}<br>
      <span style="font-size:11px;background:var(--green-light);color:var(--green);padding:2px 7px;border-radius:10px;margin-top:4px;display:inline-block">
        ${rolLabel[rol] || rol}
      </span>
    </div>
  `;
}
