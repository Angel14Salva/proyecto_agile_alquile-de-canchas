'use strict';

class ComprobanteService {
  /**
   * Crea comprobante (boleta/factura) al registrar un pago.
   */
  async crearComprobante(conn, { pagoId, reservaId, tipo = 'boleta' }) {
    const pref = tipo === 'factura' ? 'FAC' : 'BOL';
    const anio = new Date().getFullYear();
    const numero = `${pref}-${anio}-${String(pagoId).padStart(5, '0')}`;
    const [result] = await conn.query(
      'INSERT INTO comprobantes (pago_id, reserva_id, tipo, numero) VALUES (?, ?, ?, ?)',
      [pagoId, reservaId, tipo, numero]
    );
    return { id: result.insertId, numero, tipo };
  }

  /**
   * Obtiene el comprobante original del pago o genera uno retroactivo si no existe.
   */
  async obtenerComprobanteOriginal(conn, pagoId, reservaId) {
    const [existentes] = await conn.query(
      'SELECT id, numero, tipo FROM comprobantes WHERE pago_id = ? LIMIT 1',
      [pagoId]
    );
    if (existentes.length > 0) return existentes[0];

    const anio = new Date().getFullYear();
    const numero = `BOL-${anio}-${String(pagoId).padStart(5, '0')}`;
    const [result] = await conn.query(
      'INSERT INTO comprobantes (pago_id, reserva_id, tipo, numero) VALUES (?, ?, "boleta", ?)',
      [pagoId, reservaId, numero]
    );
    return { id: result.insertId, numero, tipo: 'boleta' };
  }

  /**
   * Genera una nota de crédito referenciando el comprobante original.
   */
  async generarNotaCredito(conn, { comprobanteId, reservaId, monto, canceladoPor }) {
    const anio = new Date().getFullYear();
    const [countRows] = await conn.query(
      'SELECT COUNT(*) AS total FROM notas_credito WHERE YEAR(created_at) = ?',
      [anio]
    );
    const secuencia = String(countRows[0].total + 1).padStart(4, '0');
    const numero = `NC-${anio}-${secuencia}`;

    const [result] = await conn.query(
      `INSERT INTO notas_credito (comprobante_id, reserva_id, numero, monto, cancelado_por)
       VALUES (?, ?, ?, ?, ?)`,
      [comprobanteId, reservaId, numero, monto, canceladoPor]
    );

    return {
      id: result.insertId,
      numero,
      monto: parseFloat(monto),
      comprobante_id: comprobanteId
    };
  }
}

module.exports = new ComprobanteService();
