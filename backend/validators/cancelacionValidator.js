'use strict';

const METODOS_REEMBOLSO = ['efectivo', 'transferencia'];

function validarCancelacionRecepcion({ reserva, infoPago, reembolsoConfirmado, reembolsoMetodo }) {
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
