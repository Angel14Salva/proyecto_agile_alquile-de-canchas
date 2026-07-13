'use strict';
const db = require('../db/connection');

class CajaService {
  async obtenerAbierta() {
    const [rows] = await db.query(
      `SELECT ct.*, u.nombre AS abierta_por_nombre
       FROM caja_turnos ct JOIN usuarios u ON ct.abierta_por = u.id
       WHERE ct.estado = 'abierta' LIMIT 1`
    );
    return rows[0] || null;
  }

  async totalesTurno(cajaTurnoId) {
    const [rows] = await db.query(
      `SELECT metodo, COALESCE(SUM(monto),0) AS total, COUNT(*) AS cantidad
       FROM pagos_movimientos WHERE caja_turno_id = ? GROUP BY metodo`,
      [cajaTurnoId]
    );
    const totales = { efectivo: 0, yape: 0, plin: 0, transferencia: 0, tarjeta: 0 };
    let cantidadTotal = 0;
    for (const r of rows) {
      totales[r.metodo] = parseFloat(r.total);
      cantidadTotal += r.cantidad;
    }
    return { totales, cantidadMovimientos: cantidadTotal };
  }

  async abrir({ montoInicial, usuarioId }) {
    const abierta = await this.obtenerAbierta();
    if (abierta) return { ok: false, error: 'Ya hay una caja abierta desde ' + abierta.abierta_at, status: 409 };

    const monto = Math.round(parseFloat(montoInicial) * 100) / 100;
    if (Number.isNaN(monto) || monto < 0) return { ok: false, error: 'Monto inicial inválido', status: 400 };

    const [ins] = await db.query(
      'INSERT INTO caja_turnos (estado, monto_inicial, abierta_por) VALUES ("abierta", ?, ?)',
      [monto, usuarioId]
    );
    return { ok: true, caja_turno_id: ins.insertId };
  }

  async cerrar({ contados, notas, usuarioId }) {
    const abierta = await this.obtenerAbierta();
    if (!abierta) return { ok: false, error: 'No hay ninguna caja abierta', status: 400 };

    const { totales } = await this.totalesTurno(abierta.id);
    const METODOS = ['efectivo', 'yape', 'plin', 'transferencia', 'tarjeta'];
    const detalle = {};

    for (const m of METODOS) {
      // El efectivo arranca con el fondo inicial de caja; los demas metodos
      // no tienen fondo fisico, solo se verifica lo cobrado por ese medio.
      const esperado = m === 'efectivo'
        ? Math.round((parseFloat(abierta.monto_inicial) + totales.efectivo) * 100) / 100
        : Math.round((totales[m] || 0) * 100) / 100;

      const crudo = contados ? contados[m] : undefined;
      const contado = (crudo !== undefined && crudo !== null && crudo !== '')
        ? Math.round(parseFloat(crudo) * 100) / 100
        : null;

      if (contado !== null && Number.isNaN(contado)) {
        return { ok: false, error: `El monto contado de ${m} es inválido`, status: 400 };
      }

      detalle[m] = {
        esperado,
        contado,
        diferencia: contado !== null ? Math.round((contado - esperado) * 100) / 100 : null
      };
    }

    if (detalle.efectivo.contado === null) {
      return { ok: false, error: 'El efectivo contado físicamente es obligatorio', status: 400 };
    }

    await db.query(
      `UPDATE caja_turnos SET estado='cerrada', cerrada_por=?, cerrada_at=NOW(),
       efectivo_esperado=?, efectivo_contado=?, diferencia=?, notas_cierre=?, detalle_metodos=? WHERE id=?`,
      [usuarioId, detalle.efectivo.esperado, detalle.efectivo.contado, detalle.efectivo.diferencia,
       notas || null, JSON.stringify(detalle), abierta.id]
    );

    return {
      ok: true,
      resumen: {
        monto_inicial: parseFloat(abierta.monto_inicial),
        detalle
      }
    };
  }

  async estadoActual() {
    const abierta = await this.obtenerAbierta();
    if (!abierta) return { abierta: false };
    const { totales, cantidadMovimientos } = await this.totalesTurno(abierta.id);
    const efectivoEnCaja = Math.round((parseFloat(abierta.monto_inicial) + totales.efectivo) * 100) / 100;
    return {
      abierta: true,
      caja: {
        id: abierta.id,
        monto_inicial: parseFloat(abierta.monto_inicial),
        abierta_por: abierta.abierta_por_nombre,
        abierta_at: abierta.abierta_at,
        efectivo_en_caja: efectivoEnCaja,
        totales,
        cantidad_movimientos: cantidadMovimientos
      }
    };
  }

  async historial(limite = 30) {
    const [rows] = await db.query(
      `SELECT ct.*, ua.nombre AS abierta_por_nombre, uc.nombre AS cerrada_por_nombre
       FROM caja_turnos ct
       JOIN usuarios ua ON ct.abierta_por = ua.id
       LEFT JOIN usuarios uc ON ct.cerrada_por = uc.id
       WHERE ct.estado = 'cerrada'
       ORDER BY ct.cerrada_at DESC LIMIT ?`,
      [limite]
    );
    return rows;
  }
}

module.exports = new CajaService();
