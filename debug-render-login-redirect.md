# Debug Session: render-login-redirect

Status: OPEN - FIX APPLIED, PENDING USER VERIFICATION

## Problema
- La URL desplegada `https://pacific-sport-frontend.onrender.com/landing` muestra cambios recientes.
- Desde esa página no ocurre la redirección esperada hacia `https://pacific-sport-frontend.onrender.com/login.html`.

## Hipótesis iniciales
1. `login.html` no existe realmente en el directorio publicado por Render y la URL esperada apunta a un archivo inexistente.
2. La landing usa enlaces o rutas distintas a `login.html` y por eso nunca intenta navegar a esa URL exacta.
3. La configuración de Render publica un subdirectorio diferente al que contiene el archivo objetivo, generando rutas válidas para `/landing` pero no para `/login.html`.
4. Algún script o estructura HTML en la landing intercepta el click o rompe la navegación antes de ejecutar la redirección.
5. Existe conflicto entre rutas amigables tipo `/landing` y archivos `.html` debido a reglas del servidor estático o reescrituras.

## Plan de verificación
- Revisar estructura completa del proyecto y archivos frontend relevantes.
- Localizar `landing.html`, `login.html`, `index.html` y configuraciones de despliegue.
- Buscar referencias a navegación, formularios, enlaces y eventos.
- Verificar rutas relativas/absolutas y compatibilidad con hosting estático en Render.
- Validar existencia real del archivo objetivo en código y en el despliegue accesible.

## Evidencia recolectada
- En el repositorio existen `frontend/landing.html`, `frontend/login.html` y `frontend/index.html`.
- El despliegue remoto confirma que `https://pacific-sport-frontend.onrender.com/landing` sirve la landing simplificada actual.
- El despliegue remoto confirma que `https://pacific-sport-frontend.onrender.com/login.html` existe y muestra el formulario de login.
- El despliegue remoto confirma que `https://pacific-sport-frontend.onrender.com/index.html` no es el login: sirve una landing distinta.
- `frontend/landing.html` apuntaba a `index.html` en los CTA principales, no a `login.html`.
- La búsqueda global no encontró `onclick`, `window.location` ni formularios asociados a esos CTA de `landing.html`; son enlaces `<a>` normales.
- No existe archivo de configuración de Render dentro del repo (`render.yaml`, etc.); la configuración documentada está en `README.md` con `Root Directory: frontend` y `Publish Directory: .`.
- La ruta amigable `/landing` funciona en Render y `login.html` también existe como archivo publicado, por lo que no hay evidencia de conflicto de publicación para ese archivo.

## Estado de hipótesis
| ID | Hipótesis | Estado | Evidencia |
|----|-----------|--------|-----------|
| 1 | `login.html` no existe en el directorio publicado | Rechazada | Existe en `frontend/login.html` y responde en producción. |
| 2 | La landing no apunta a `login.html` | Confirmada | `frontend/landing.html` usaba `href="index.html"` en todos los CTA principales. |
| 3 | Render publica un directorio incorrecto | Rechazada | `README.md` y el despliegue remoto son consistentes con publicación desde `frontend/`. |
| 4 | Un script bloquea el click o rompe la navegación | Rechazada | La landing actual no tiene lógica de navegación sobre esos CTA, solo enlaces `<a>` y un toggle de menú. |
| 5 | Hay conflicto entre rutas amigables y `.html` | Parcial | `/landing` funciona como ruta amigable, pero el problema real no es esa ruta: es que `index.html` y `login.html` tienen roles distintos e inconsistentes. |

## Corrección aplicada
- `frontend/landing.html`: los CTA principales ahora apuntan a `/login.html`.
- `frontend/index.html`: ahora redirige de forma explícita a `/login.html` para eliminar la ambigüedad y preservar enlaces antiguos o accesos directos a `/` e `/index.html`.

## Verificación pendiente
- Desplegar estos cambios en Render.
- Verificar:
  - `https://pacific-sport-frontend.onrender.com/landing` -> botón `Iniciar sesión` lleva a `/login.html`
  - `https://pacific-sport-frontend.onrender.com/landing` -> botón `Reservar ahora` lleva a `/login.html`
  - `https://pacific-sport-frontend.onrender.com/` -> redirige a `/login.html`
  - `https://pacific-sport-frontend.onrender.com/index.html` -> redirige a `/login.html`
