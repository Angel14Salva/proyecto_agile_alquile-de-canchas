'use strict';

const METODOS_CAJA = ['efectivo', 'yape', 'plin', 'transferencia'];
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

module.exports = {
  METODOS_CAJA, METODOS_CON_REFERENCIA, TIPOS_COMPROBANTE,
  calcularRangoPago, clasificarMonto, validarRegistroPago
};
