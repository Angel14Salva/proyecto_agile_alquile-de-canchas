'use strict';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NOMBRE_RE = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/;
const DNI_RE = /^\d{8}$/;
const TELEFONO_RE = /^\d+$/;

function validarEmail(email) {
  if (!email || !EMAIL_RE.test(email)) {
    return { valido: false, error: 'El email no tiene un formato valido' };
  }
  return { valido: true };
}

function validarNombre(nombre) {
  if (!nombre || !nombre.trim()) return { valido: false, error: 'El nombre es obligatorio' };
  if (!NOMBRE_RE.test(nombre.trim())) {
    return { valido: false, error: 'El nombre solo puede contener letras y espacios' };
  }
  return { valido: true };
}

function validarPassword(password) {
  if (!password || password.length < 8) {
    return { valido: false, error: 'La contrasena debe tener minimo 8 caracteres' };
  }
  return { valido: true };
}

function validarDni(dni) {
  if (!dni) return { valido: false, error: 'El DNI es obligatorio' };
  if (!DNI_RE.test(dni)) return { valido: false, error: 'El DNI debe tener 8 digitos numericos' };
  return { valido: true };
}

function validarTelefono(telefono) {
  if (!telefono) return { valido: false, error: 'El telefono es obligatorio' };
  if (!TELEFONO_RE.test(telefono)) {
    return { valido: false, error: 'El telefono solo puede contener digitos' };
  }
  return { valido: true };
}

function validarRol(rol) {
  if (!['admin', 'recepcionista', 'cliente'].includes(rol)) {
    return { valido: false, error: 'Rol invalido' };
  }
  return { valido: true };
}

function validarUsuarioCreate(body) {
  for (const fn of [() => validarNombre(body.nombre), () => validarEmail(body.email),
    () => validarPassword(body.password), () => validarRol(body.rol),
    () => validarTelefono(body.telefono), () => validarDni(body.dni)]) {
    const r = fn();
    if (!r.valido) return r;
  }
  return { valido: true };
}

module.exports = {
  validarEmail, validarNombre, validarPassword, validarDni, validarTelefono, validarRol, validarUsuarioCreate
};
