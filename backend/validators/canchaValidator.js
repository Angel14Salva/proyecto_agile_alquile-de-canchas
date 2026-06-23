'use strict';

function validarPrecio(precio) {
  const n = parseFloat(precio);
  if (Number.isNaN(n) || n <= 0) {
    return { valido: false, error: 'El precio debe ser un valor numerico positivo' };
  }
  return { valido: true, valor: n };
}

function validarHorario(apertura, cierre) {
  if (!apertura || !cierre) return { valido: true };
  const a = apertura.substring(0, 5);
  const c = cierre.substring(0, 5);
  if (a >= c) {
    return { valido: false, error: 'La hora de apertura debe ser anterior a la hora de cierre' };
  }
  return { valido: true };
}

function validarCanchaPayload(body, parcial = false) {
  const errores = [];
  if (!parcial || body.nombre !== undefined) {
    if (!body.nombre || !body.nombre.trim()) errores.push('El nombre es requerido');
  }
  if (!parcial || body.precio_hora !== undefined) {
    const p = validarPrecio(body.precio_hora);
    if (!p.valido) errores.push(p.error);
  }
  if (body.hora_apertura || body.hora_cierre) {
    const h = validarHorario(body.hora_apertura, body.hora_cierre);
    if (!h.valido) errores.push(h.error);
  }
  if (errores.length) return { valido: false, error: errores[0] };
  return { valido: true };
}

module.exports = { validarPrecio, validarHorario, validarCanchaPayload };
