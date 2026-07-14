'use strict';

const { horasHastaReserva } = require('../services/tiempoHelper');

const METODOS_REEMBOLSO = ['efectivo', 'transferencia'];

function validarCancelacionRecepcion({ reserva, infoPago, reembolsoConfirmado, reembolsoMetodo, reembolsoExcepcional, motivoExcepcional }) {
  if (!reserva) {
    return { valido: false, error: 'Reserva no encontrada', status: 404 };
  }

  if (reserva.estado === 'cancelada') {
    return { valido: false, error: 'La reserva ya esta cancelada', status: 400 };
  }

  if (reserva.estado === 'completada') {
    return { valido: false, error: 'No se puede cancelar una reserva completada', status: 400 };
  }

  if (infoPago.requiereReembolso) {
    const diffHoras = horasHastaReserva(reserva.fecha, reserva.hora_inicio);

    if (diffHoras > 2) {
      if (reembolsoExcepcional) {
        return {
          valido: false,
          error: 'No se puede aplicar un reembolso excepcional si la reserva tiene más de 2 horas de anticipación',
          status: 400
        };
      }
      if (!reembolsoConfirmado) {
        return {
          valido: false,
          error: 'Debe confirmar que el reembolso fue entregado al cliente antes de cancelar',
          status: 400
        };
      }
      if (!reembolsoMetodo || !METODOS_REEMBOLSO.includes(reembolsoMetodo)) {
        return {
          valido: false,
          error: 'Seleccione el metodo de reembolso: efectivo o transferencia',
          status: 400
        };
      }
    } else {
      // Menos de 2 horas
      if (!reembolsoExcepcional) {
        return {
          valido: false,
          error: 'El reembolso directo está bloqueado para cancelaciones con 2 horas o menos de anticipación. Debe marcar Reembolso Excepcional.',
          status: 400
        };
      }
      if (!motivoExcepcional || motivoExcepcional.trim().length < 15) {
        return {
          valido: false,
          error: 'El motivo del reembolso excepcional es obligatorio y debe tener al menos 15 caracteres',
          status: 400
        };
      }
    }
  }

  return { valido: true };
}

function validarBusquedaCancelacion(q) {
  const termino = (q || '').trim();
  if (!termino) {
    return { valido: false, error: 'Ingrese ID, codigo, nombre, DNI o email para buscar', status: 400 };
  }
  if (termino.length < 2) {
    return { valido: false, error: 'Ingrese al menos 2 caracteres para buscar', status: 400 };
  }
  return { valido: true, termino };
}

module.exports = {
  validarCancelacionRecepcion,
  validarBusquedaCancelacion,
  METODOS_REEMBOLSO
};
