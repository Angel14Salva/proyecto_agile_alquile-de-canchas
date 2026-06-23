// Cambia esta URL según el entorno:
// Desarrollo (Codespace): URL del puerto 3000 de tu Codespace
// Producción (Render):    https://tu-backend.onrender.com
const API_URL = 'https://proyecto-agile-alquile-de-canchas.onrender.com';

const api = {
  // ─── Token helpers ───────────────────────────────────────
  getToken: () => localStorage.getItem('token'),
  setToken: (t) => localStorage.setItem('token', t),
  removeToken: () => localStorage.removeItem('token'),

  getUsuario: () => JSON.parse(localStorage.getItem('usuario') || 'null'),
  setUsuario: (u) => localStorage.setItem('usuario', JSON.stringify(u)),
  removeUsuario: () => localStorage.removeItem('usuario'),

  isLoggedIn: () => !!localStorage.getItem('token'),

  logout: async () => {
    try {
      const token = api.getToken();
      if (token) {
        await fetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
      }
    } catch { /* si falla el endpoint, seguimos limpiando la sesión local */ }
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    window.location.href = 'index.html';
  },

  // ─── Fetch wrapper ────────────────────────────────────────
  request: async (method, path, body = null, auth = true) => {
    const headers = { 'Content-Type': 'application/json' };
    if (auth) headers['Authorization'] = `Bearer ${api.getToken()}`;

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(`${API_URL}${path}`, options);
    const data = await res.json();

    if (res.status === 401) {
      api.logout();
      return;
    }

    if (!res.ok) throw new Error(data.error || 'Error en la solicitud');
    return data;
  },

  get:    (path, auth = true)        => api.request('GET',    path, null, auth),
  post:   (path, body, auth = true)  => api.request('POST',   path, body, auth),
  put:    (path, body, auth = true)  => api.request('PUT',    path, body, auth),
  delete: (path, auth = true)        => api.request('DELETE', path, null, auth),

  download: async (path) => {
    const res = await fetch(`${API_URL}${path}`, {
      headers: { Authorization: `Bearer ${api.getToken()}` }
    });
    if (res.status === 401) { api.logout(); return; }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Error en la descarga');
    }
    const blob = await res.blob();
    const disp = res.headers.get('Content-Disposition') || '';
    const match = disp.match(/filename="([^"]+)"/);
    const filename = match ? match[1] : 'informe';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  },
};
