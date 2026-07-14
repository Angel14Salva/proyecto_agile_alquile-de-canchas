'use strict';

const { horasHastaReserva } = require('../services/tiempoHelper');

const METODOS_REEMBOLSO = ['efectivo', 'transferencia'];

function validarCancelacionRecepcion({ reserva, infoPago, reembolsoExcepcional, motivoExcepcional }) {
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

    if (diffHoras <= 2) {
      if (!motivoExcepcional || motivoExcepcional.trim().length < 3) {
        return {
          valido: false,
          error: 'Debe seleccionar o ingresar el motivo excepcional de reembolso',
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
