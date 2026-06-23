# 🏟️ Pacific Sport Center — Sistema de Reservas

Sistema web de reservas de canchas deportivas para el **Pacific Sport Center** de Trujillo, Perú.  
Proyecto universitario real con usuarios reales — desarrollado con metodología Agile/Scrum.

---

## 🛠️ Stack tecnológico

| Capa | Tecnología |
|---|---|
| Backend | Node.js + Express (API REST) |
| Frontend | HTML5 + CSS3 + JavaScript vanilla |
| Base de datos | MySQL — TiDB Cloud (free tier, SSL) |
| Autenticación | JWT (JSON Web Tokens) |
| Deploy backend | Render.com (Web Service) |
| Deploy frontend | Render.com (Static Site) |
| Repositorio | GitHub (monorepo) |

---

## 📁 Estructura del repositorio

```
├── backend/
│   ├── controllers/
│   │   ├── authController.js       → Login, registro, recuperar contraseña
│   │   ├── canchaController.js     → CRUD canchas + disponibilidad
│   │   ├── reservaController.js    → Crear, modificar, cancelar reservas
│   │   ├── pagoController.js       → Registrar y consultar pagos
│   │   └── usuarioController.js    → Gestión de usuarios
│   ├── routes/
│   │   ├── auth.js                 → /api/auth
│   │   ├── canchas.js              → /api/canchas
│   │   ├── reservas.js             → /api/reservas
│   │   ├── pagos.js                → /api/pagos
│   │   └── usuarios.js             → /api/usuarios
│   ├── middleware/
│   │   ├── verifyToken.js          → Validación JWT
│   │   ├── checkRole.js            → Autorización por rol
│   │   └── rateLimiter.js          → Rate limiting (anti fuerza bruta)
│   ├── db/
│   │   └── connection.js           → Pool de conexiones mysql2 + SSL
│   ├── app.js                      → Entry point Express
│   └── package.json
├── frontend/
│   ├── css/
│   │   └── main.css                → Estilos globales (tema verde Pacific Sport Center)
│   ├── js/
│   │   ├── api.js                  → Wrapper fetch con JWT automático
│   │   ├── auth.js                 → Guards de autenticación y roles
│   │   └── sidebar.js              → Sidebar dinámico por rol
│   ├── index.html                  → Login
│   ├── registro.html               → Registro de clientes
│   ├── dashboard.html              → Panel principal con métricas
│   ├── canchas.html                → Lista y filtro de canchas
│   ├── reservar.html               → Flujo completo de reserva y pago
│   ├── mis-reservas.html           → Historial del cliente
│   ├── reservas.html               → Gestión de reservas (admin/recepcionista)
│   ├── recepcion.html              → Panel de recepción y cobro en caja
│   ├── cancelar-reserva.html       → Cancelar reserva desde recepción (HU-10)
│   └── admin.html                  → Administración, usuarios y reportes
├── database/
│   └── init.sql                    → Schema completo + datos iniciales
├── .env.example                    → Variables de entorno requeridas
├── .gitignore
└── README.md
```

---

## ⚙️ Setup local

### 1. Clonar el repositorio
```bash
git clone https://github.com/Angel14Salva/proyecto_agile_alquile-de-canchas.git
cd proyecto_agile_alquile-de-canchas
```

### 2. Configurar variables de entorno
```bash
cp .env.example backend/.env
# Editar backend/.env con las credenciales reales de TiDB Cloud
```

### 3. Instalar dependencias del backend
```bash
cd backend
npm install
```

### 4. Inicializar la base de datos
- Crear cluster **Serverless (Starter)** en [TiDB Cloud](https://tidbcloud.com) — free tier
- En el **SQL Editor** de TiDB Cloud, ejecutar el contenido de `database/init.sql`
- Esto crea las 4 tablas, índices, 10 canchas y 3 usuarios de prueba

### 5. Correr el backend
```bash
cd backend
npm run dev
# ✅ Servidor en http://localhost:3000
# ✅ Health check: http://localhost:3000/health
# ✅ Frontend servido en: http://localhost:3000
```

### 6. Abrir el frontend
El backend sirve el frontend directamente. Abre:
```
http://localhost:3000
```

---

## 🔐 Variables de entorno

| Variable | Descripción | Ejemplo |
|---|---|---|
| `DB_HOST` | Host de TiDB Cloud | `gateway01.ap-southeast-1.prod.aws.tidbcloud.com` |
| `DB_PORT` | Puerto TiDB | `4000` |
| `DB_USER` | Usuario TiDB (con prefijo) | `xxxxxxxxx.root` |
| `DB_PASS` | Contraseña TiDB Cloud | `tu_password` |
| `DB_NAME` | Nombre de la BD | `canchas_db` |
| `JWT_SECRET` | Secret JWT (mín. 32 chars) | `openssl rand -hex 32` |
| `FRONTEND_URL` | URL del frontend para CORS | `https://tu-frontend.onrender.com` |
| `PORT` | Puerto del servidor | `3000` |
| `NODE_ENV` | Ambiente | `development` / `production` |

> ⚠️ **Nunca subas el archivo `.env` al repositorio.** Está en `.gitignore`.

---

## ⏳ Pendiente de configuración

Variables necesarias para activar integraciones que aún no están conectadas en producción:

| Variable | Dónde colocarla | Para qué sirve |
|---|---|---|
| `FLOW_API_KEY` | `backend/.env` | API Key de la pasarela Flow (pagos en línea) |
| `FLOW_SECRET_KEY` | `backend/.env` | Secret Key de Flow para firmar requests |
| `FLOW_API_URL` | `backend/.env` | URL base de la API Flow (ej. `https://www.flow.cl/api`) |
| `FLOW_URL_CONFIRMACION` | `backend/.env` | Webhook de confirmación de pago (`POST /api/pagos/flow/confirmar`) |
| `FLOW_URL_RETORNO` | `backend/.env` | URL de retorno del cliente tras pagar en Flow |
| `BREVO_API_KEY` | `backend/.env` | Envío de correos (confirmación, cancelación) vía Brevo |

**Reembolso automático vía pasarela (HU-11):** el adapter `backend/services/reembolsoPasarelaAdapter.js` queda preparado con el método `solicitarReembolso()`. Sin credenciales Flow activas, las cancelaciones en línea con pago vía pasarela quedan en estado `pendiente_reembolso` para revisión en recepción. HU-10 registra reembolsos **manuales** (efectivo/transferencia).

**Correo transaccional:** requiere `BREVO_API_KEY`. Sin ella, reservas/pagos/cancelaciones funcionan pero no se envían emails.

**Recuperación de contraseña:** fuera de alcance — no implementar ni activar sin credenciales de correo.

---

## 🗄️ Base de datos

**4 tablas principales:**

| Tabla | Descripción |
|---|---|
| `usuarios` | Clientes, recepcionistas y admins con JWT |
| `canchas` | 10 canchas (8 fútbol grass + basketball + volleyball) |
| `reservas` | Reservas con código único, estado y origen |
| `pagos` | Registro de pagos por reserva |

**Usuarios de prueba:**

| Email | Contraseña | Rol |
|---|---|---|
| `admin@canchas.com` | `Admin1234x` | Administrador |
| `recepcion@canchas.com` | `Admin1234x` | Recepcionista |
| `cliente@canchas.com` | `Admin1234x` | Cliente |

---

## 🌐 Endpoints principales de la API

| Método | Endpoint | Descripción | Auth |
|---|---|---|---|
| POST | `/api/auth/login` | Login con JWT | No |
| POST | `/api/auth/register` | Registro de cliente | No |
| GET | `/api/canchas` | Listar canchas | No |
| GET | `/api/canchas/:id/disponibilidad?fecha=` | Ver slots disponibles | No |
| POST | `/api/reservas` | Crear reserva | Sí |
| DELETE | `/api/reservas/:id` | Cancelar reserva (cliente) | Sí |
| GET | `/api/reservas/buscar-cancelacion?q=` | Buscar reserva para cancelar (recepción) | Admin/Recep |
| GET | `/api/recepcion/check-in?q=` | Check-in: buscar reserva y estado de pago | Admin/Recep |
| POST | `/api/recepcion/check-in/:id/confirmar` | Confirmar ingreso (pago completo) | Admin/Recep |
| GET | `/api/reportes/dashboard?desde=&hasta=` | Métricas gerente | Admin |
| GET | `/api/reportes/export/pdf?desde=&hasta=` | Exportar PDF | Admin |
| GET | `/api/reportes/export/excel?desde=&hasta=` | Exportar Excel | Admin |
| POST | `/api/reservas/:id/cancelar-linea` | Cancelar reserva cliente (reembolso pasarela) | Cliente |
| POST | `/api/pagos` | Registrar pago | Sí |
| GET | `/api/usuarios/buscar?q=` | Buscar por nombre/DNI | Admin/Recep |
| GET | `/health` | Health check | No |

---

## 🚀 Deploy en Render

### Backend (Web Service)
- **Repository:** `github.com/Angel14Salva/proyecto_agile_alquile-de-canchas`
- **Root Directory:** `backend`
- **Build Command:** `npm install`
- **Start Command:** `node app.js`
- **Variables de entorno:** configurar en Render Dashboard (nunca en el código)
- **Auto-Deploy:** activado en cada push a `main`

### Frontend (Static Site)
- **Root Directory:** `frontend`
- **Publish Directory:** `.`

> 💡 **Nota sobre cold start:** Render free duerme tras 15 min de inactividad. Configurar UptimeRobot para hacer ping a `/health` cada 14 minutos.

---

## 👥 Roles del sistema

| Rol | Acceso |
|---|---|
| `admin` | Dashboard, canchas, reservas, recepción, administración, reportes |
| `recepcionista` | Dashboard, canchas, reservas manuales, recepción, cobro en caja |
| `cliente` | Ver canchas, reservar, mis reservas, cancelar |

---

## 🔒 Seguridad implementada

- JWT con expiración de 8 horas
- Bcrypt para contraseñas (factor 10)
- Helmet.js para headers HTTP seguros
- CORS restringido al dominio del frontend
- Rate limiting: 10 intentos de login por 15 minutos
- SSL obligatorio en conexión a TiDB Cloud
- Queries parametrizadas (previene SQL injection)

---

## 🧪 Pruebas

Plan de pruebas en `PRO-41-Plan-de-Pruebas.docx` con 25 casos de prueba.  
Resultado: **21 PASS / 1 FAIL / 1 issue menor**

---

## 👨‍💻 Equipo — UPAO 2026

| Integrante | Rol en el proyecto |
|---|---|
| Brayan Sam. | Configuración de entorno + Depuración (PRO-36, PRO-42) |
| Darli Manu. | Diseño e implementación de BD (PRO-37, PRO-38) |
| Fernando D. | Diseño de interfaces + QA (PRO-39, PRO-41) |
| Luis Angel Sal. | Codificación + Deploy (PRO-40, PRO-43) |

---

*Pacific Sport Center — Trujillo, Perú*