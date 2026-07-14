'use strict';

const METODOS_CAJA = ['efectivo', 'yape', 'plin', 'transferencia', 'tarjeta'];
const METODOS_CON_REFERENCIA = ['yape', 'plin', 'transferencia'];
const TIPOS_COMPROBANTE = ['boleta', 'factura'];

function calcularRangoPago(precioTotal) {
  const total = parseFloat(precioTotal);
  const minimo = Math.round(total * 0.5 * 100) / 100;
  return { total, minimo, adelantoExacto: minimo, completoExacto: total };
}

function clasificarMonto(monto, precioTotal) {
  const { total, minimo } = calcularRangoPago(precioTotal);
  const m = Math.round(parseFloat(monto) * 100) / 100;
  if (Number.isNaN(m) || m < minimo - 0.01 || m > total + 0.01) {
    return {
      valido: false,
      error: `El monto debe estar entre S/ ${minimo.toFixed(2)} (50%) y S/ ${total.toFixed(2)} (100%)`
    };
  }
  const tipo = Math.abs(m - total) < 0.01 ? 'completo' : 'adelanto';
  return { valido: true, monto: m, tipo_pago: tipo };
}

function validarRegistroPago(body, precioTotal, saldoPendiente = null) {
  const { metodo, referencia, monto, tipo_comprobante, notas } = body;
  if (!metodo || !METODOS_CAJA.includes(metodo)) {
    return { valido: false, error: 'Seleccione un metodo de pago valido' };
  }
  if (METODOS_CON_REFERENCIA.includes(metodo) && (!referencia || !/^\d+$/.test(String(referencia).trim()))) {
    return { valido: false, error: 'Yape/Plin/transferencia requieren numero de operacion numerico' };
  }
  if (tipo_comprobante && !TIPOS_COMPROBANTE.includes(tipo_comprobante)) {
    return { valido: false, error: 'Tipo de comprobante invalido' };
  }

  const montoEsperado = saldoPendiente !== null ? saldoPendiente : precioTotal;
  const montoIngresado = monto !== undefined && monto !== null ? monto : montoEsperado;

  if (saldoPendiente !== null) {
    const m = Math.round(parseFloat(montoIngresado) * 100) / 100;
    if (Math.abs(m - saldoPendiente) > 0.01) {
      return { valido: false, error: `El monto debe ser exactamente S/ ${saldoPendiente.toFixed(2)} (saldo pendiente)` };
    }
    return { valido: true, monto: m, tipo_pago: 'completo', metodo, referencia: referencia || null, tipo_comprobante: tipo_comprobante || 'boleta', notas: notas || null };
  }

  const c = clasificarMonto(montoIngresado, precioTotal);
  if (!c.valido) return c;
  return { ...c, metodo, referencia: referencia || null, tipo_comprobante: tipo_comprobante || 'boleta', notas: notas || null };
}

// Pago (posiblemente hibrido) al crear una reserva desde recepcion: una o mas
// lineas de metodo+monto que deben sumar EXACTAMENTE el precio total. Ya no
// se acepta adelanto/pago parcial: la reserva nace pagada por completo.
function validarPagosHibridos(pagos, precioTotal) {
  if (!Array.isArray(pagos) || pagos.length === 0) {
    return { valido: false, error: 'Debe registrar al menos una forma de pago' };
  }
  if (pagos.length > 4) {
    return { valido: false, error: 'No se pueden combinar mas de 4 formas de pago' };
  }

  const total = Math.round(parseFloat(precioTotal) * 100) / 100;
  const lineas = [];
  let suma = 0;

  for (const p of pagos) {
    const { metodo, monto, referencia } = p || {};
    if (!metodo || !METODOS_CAJA.includes(metodo)) {
      return { valido: false, error: 'Seleccione un metodo de pago valido en cada linea' };
    }
    const m = Math.round(parseFloat(monto) * 100) / 100;
    if (Number.isNaN(m) || m <= 0) {
      return { valido: false, error: 'Cada linea de pago debe tener un monto mayor a 0' };
    }
    if (METODOS_CON_REFERENCIA.includes(metodo) && (!referencia || !/^\d+$/.test(String(referencia).trim()))) {
      return { valido: false, error: `${metodo} requiere numero de operacion numerico` };
    }
    lineas.push({ metodo, monto: m, referencia: referencia ? String(referencia).trim() : null });
    suma = Math.round((suma + m) * 100) / 100;
  }

  if (Math.abs(suma - total) > 0.01) {
    return { valido: false, error: `Las formas de pago deben sumar exactamente el total: S/ ${total.toFixed(2)} (ingresado: S/ ${suma.toFixed(2)})` };
  }

  const metodosDistintos = new Set(lineas.map(l => l.metodo));
  const metodoConsolidado = metodosDistintos.size > 1 ? 'mixto' : lineas[0].metodo;

  return { valido: true, lineas, monto: total, metodoConsolidado };
}

module.exports = {
  METODOS_CAJA, METODOS_CON_REFERENCIA, TIPOS_COMPROBANTE,
  calcularRangoPago, clasificarMonto, validarRegistroPago, validarPagosHibridos
};
