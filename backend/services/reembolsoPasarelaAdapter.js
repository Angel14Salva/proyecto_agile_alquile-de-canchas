'use strict';

/**
 * Adapter para reembolsos vía pasarela de pago (Flow).
 * HU-10 usa reembolso manual en recepción; este adapter queda listo para HU-11.
 */
class ReembolsoPasarelaAdapter {
  isConfigured() {
    return Boolean(
      process.env.FLOW_API_KEY &&
      process.env.FLOW_SECRET_KEY &&
      process.env.FLOW_API_URL
    );
  }

  /**
   * Solicita reembolso a la pasarela por el monto indicado.
   * @param {{ tokenPago: string, monto: number, reservaId: number, codigo: string }} params
   * @returns {Promise<{ exito: boolean, referencia?: string, error?: string, modo: string }>}
   */
  async solicitarReembolso({ tokenPago, monto, reservaId, codigo }) {
    if (!this.isConfigured()) {
      return {
        exito: false,
        error: 'Pasarela no configurada. Configure FLOW_API_KEY, FLOW_SECRET_KEY y FLOW_API_URL.',
        modo: 'stub'
      };
    }

    if (!tokenPago) {
      return {
        exito: false,
        error: 'No se encontró referencia de pago en pasarela para esta reserva.',
        modo: 'stub'
      };
    }

    // Punto de integración real con Flow (refund/create) cuando existan credenciales.
    return {
      exito: false,
      error: `Reembolso automático pendiente de implementar para reserva ${codigo} (ID ${reservaId}), monto S/ ${monto}.`,
      modo: 'pendiente_integracion'
    };
  }
}

module.exports = new ReembolsoPasarelaAdapter();
