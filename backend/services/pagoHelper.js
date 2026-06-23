'use strict';

/**
 * Clasifica el estado de pago según monto pagado vs precio total de la cancha.
 * @param {number|null} montoPagado
 * @param {number} precioHora
 * @param {string|null} tipoPago - 'completo' | 'adelanto' | null
 * @returns {{ tipo: string, montoPagado: number, montoReembolsar: number, requiereReembolso: boolean }}
 */
function clasificarPago(montoPagado, precioHora, tipoPago = null) {
  const total = parseFloat(precioHora) || 0;
  const pagado = parseFloat(montoPagado) || 0;

  if (pagado <= 0) {
    return { tipo: 'sin_pago', montoPagado: 0, montoReembolsar: 0, requiereReembolso: false };
  }

  if (tipoPago === 'adelanto') {
    return { tipo: 'adelanto', montoPagado: pagado, montoReembolsar: pagado, requiereReembolso: true };
  }

  if (tipoPago === 'completo' || pagado >= total) {
    return { tipo: 'completo', montoPagado: pagado, montoReembolsar: pagado, requiereReembolso: true };
  }

  const minimoAdelanto = total * 0.5;
  if (pagado >= minimoAdelanto) {
    return { tipo: 'adelanto', montoPagado: pagado, montoReembolsar: pagado, requiereReembolso: true };
  }

  return { tipo: 'parcial', montoPagado: pagado, montoReembolsar: pagado, requiereReembolso: true };
}

function tienePagoRegistrado(pagoEstado, montoPagado) {
  return pagoEstado === 'pagado' && parseFloat(montoPagado) > 0;
}

module.exports = { clasificarPago, tienePagoRegistrado };
