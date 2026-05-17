# Sistema de Reservas de Canchas Deportivas

MVP universitario — Stack: Node.js + Express + MySQL (TiDB Cloud) + HTML/CSS/JS vanilla

## Estructura del repositorio

```
├── backend/          → API REST (Node.js + Express)
├── frontend/         → Interfaz web (HTML/CSS/JS)
├── database/         → Scripts SQL e inicialización
├── .env.example      → Variables de entorno requeridas
└── README.md
```

## Setup local

### 1. Clonar el repositorio
```bash
git clone https://github.com/Angel14Salva/proyecto_agile_alquile-de-canchas/tree/main
cd canchas-project
```

### 2. Configurar variables de entorno del backend
```bash
cd backend
cp ../.env.example .env
# Editar .env con tus credenciales reales
```

### 3. Instalar dependencias del backend
```bash
npm install
```

### 4. Inicializar la base de datos
- Crear un cluster en TiDB Cloud (free tier)
- Ejecutar `database/init.sql` desde el SQL Editor de TiDB Cloud

### 5. Correr el backend en desarrollo
```bash
npm run dev
# Servidor en http://localhost:3000
# Health check: http://localhost:3000/health
```

### 6. Correr el frontend
Abrir `frontend/index.html` con Live Server (VS Code) en el puerto 5500.

## Variables de entorno

| Variable | Descripción |
|---|---|
| `DB_HOST` | Host de TiDB Cloud |
| `DB_PORT` | Puerto TiDB (default: 4000) |
| `DB_USER` | Usuario de TiDB Cloud |
| `DB_PASS` | Contraseña de TiDB Cloud |
| `DB_NAME` | Nombre de la base de datos |
| `JWT_SECRET` | Secret para firmar JWT (mín. 32 chars) |
| `FRONTEND_URL` | URL del frontend para CORS |
| `PORT` | Puerto del servidor (Render lo asigna automáticamente) |

## Deploy en Render

### Backend (Web Service)
- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `node app.js`
- Variables de entorno: configurar en Render Dashboard

### Frontend (Static Site)
- Root Directory: `frontend`
- Publish Directory: `.`

## Roles del sistema
- `admin` — Dueño de cancha: gestión completa
- `recepcionista` — Gestión de reservas y pagos en caja
- `cliente` — Reservas en línea

## Equipo
- Brayan Sam. — Configuración + Depuración
- Darli Manu. — Base de datos
- Fernando D. — Interfaces + QA
- Luis Angel Sal. — Codificación + Deploy
