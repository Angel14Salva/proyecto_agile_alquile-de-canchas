// Cambia esta URL según el entorno:
// Desarrollo (Codespace): URL del puerto 3000 de tu Codespace
// Producción (Render):    https://tu-backend.onrender.com
const API_URL = 'http://localhost:3000';

const api = {
  // ─── Token helpers ───────────────────────────────────────
  getToken: () => localStorage.getItem('token'),
  setToken: (t) => localStorage.setItem('token', t),
  removeToken: () => localStorage.removeItem('token'),

  getUsuario: () => JSON.parse(localStorage.getItem('usuario') || 'null'),
  setUsuario: (u) => localStorage.setItem('usuario', JSON.stringify(u)),
  removeUsuario: () => localStorage.removeItem('usuario'),

  isLoggedIn: () => !!localStorage.getItem('token'),

  logout: () => {
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
};
