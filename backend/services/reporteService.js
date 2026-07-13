'use strict';

const db = require('../db/connection');
const reporteHelper = require('./reporteHelper');

class ReporteService {
  async obtenerReservasRango(desde, hasta) {
    const [rows] = await db.query(
      `SELECT r.*, c.nombre AS cancha_nombre, c.precio_hora,
              p.estado AS pago_estado, p.monto AS pago_monto, p.metodo AS pago_metodo,
              p.tipo_pago, ur.nombre AS recepcionista_nombre
       FROM reservas r
       JOIN canchas c ON r.cancha_id = c.id
       LEFT JOIN pagos p ON p.reserva_id = r.id
       LEFT JOIN usuarios ur ON p.registrado_por = ur.id
       WHERE r.fecha BETWEEN ? AND ? AND r.estado != 'cancelada'
       ORDER BY r.fecha ASC`,
      [desde, hasta]
    );
    return rows;
  }

  async dashboard(desde, hasta) {
    const validacion = reporteHelper.validarRangoFechas(desde, hasta);
    if (!validacion.valido) return { ok: false, error: validacion.error, status: 400 };

    const reservas = await this.obtenerReservasRango(desde, hasta);
    const pagadas = reservas.filter(r => r.pago_estado === 'pagado');
    const ingresos = pagadas.reduce((s, r) => s + parseFloat(r.pago_monto || r.precio_hora || 0), 0);
    const [canchasRows] = await db.query('SELECT COUNT(*) AS total FROM canchas WHERE activo = TRUE');
    const dias = Math.max(1, Math.ceil((new Date(hasta) - new Date(desde)) / (86400000)) + 1);

    const [cajaRows] = await db.query(
      'SELECT monto_inicial FROM caja_mensual WHERE anio = ? AND mes = ?',
      [parseInt(desde.substring(0, 4), 10), parseInt(desde.substring(5, 7), 10)]
    );

    return {
      ok: true,
      metricas: {
        reservas_totales: reservas.length,
        ingresos: Math.round(ingresos * 100) / 100,
        tasa_ocupacion: reporteHelper.calcularOcupacion(
          reservas.filter(r => r.estado === 'confirmada' || r.estado === 'completada'),
          canchasRows[0].total,
          dias
        ),
        pendientes_pago: reservas.filter(r => !r.pago_estado || r.pago_estado === 'pendiente').length,
        monto_inicial_caja: cajaRows[0]?.monto_inicial || 0
      },
      por_dia_semana: reporteHelper.agruparPorDiaSemana(reservas),
      ranking_canchas: reporteHelper.rankingCanchas(reservas),
      por_cancha: reporteHelper.ingresosPorCancha(reservas)
    };
  }

  async controlCaja(desde, hasta, recepcionistaId = null) {
    let sqlMov = `
      SELECT pm.metodo, pm.monto, ur.nombre AS recepcionista_nombre
      FROM pagos_movimientos pm
      JOIN pagos p ON pm.pago_id = p.id
      JOIN reservas r ON p.reserva_id = r.id
      LEFT JOIN usuarios ur ON pm.registrado_por = ur.id
      WHERE p.estado = 'pagado' AND r.fecha BETWEEN ? AND ?`;
    const paramsMov = [desde, hasta];
    if (recepcionistaId) { sqlMov += ' AND pm.registrado_por = ?'; paramsMov.push(recepcionistaId); }
    const [movimientos] = await db.query(sqlMov, paramsMov);

    let sqlTurnos = `
      SELECT ct.id, ct.estado, ct.monto_inicial, ct.detalle_metodos, ur.nombre AS recepcionista_nombre
      FROM caja_turnos ct
      JOIN usuarios ur ON ct.abierta_por = ur.id
      WHERE DATE(ct.abierta_at) BETWEEN ? AND ?`;
    const paramsTurnos = [desde, hasta];
    if (recepcionistaId) { sqlTurnos += ' AND ct.abierta_por = ?'; paramsTurnos.push(recepcionistaId); }
    const [turnosRaw] = await db.query(sqlTurnos, paramsTurnos);

    const METODOS = ['efectivo', 'yape', 'plin', 'transferencia', 'tarjeta'];
    const turnos = [];

    for (const t of turnosRaw) {
      let detalle;
      if (t.estado === 'cerrada' && t.detalle_metodos) {
        detalle = typeof t.detalle_metodos === 'string' ? JSON.parse(t.detalle_metodos) : t.detalle_metodos;
      } else {
        // Turno aun abierto: no hay nada "verificado" todavia (recien se
        // ingresa al cerrar), se estima solo el esperado en vivo.
        detalle = {};
        for (const m of METODOS) {
          const [rows] = await db.query(
            `SELECT COALESCE(SUM(monto),0) AS total FROM pagos_movimientos WHERE caja_turno_id = ? AND metodo = ?`,
            [t.id, m]
          );
          const cobrado = parseFloat(rows[0].total);
          const esperado = m === 'efectivo' ? parseFloat(t.monto_inicial) + cobrado : cobrado;
          detalle[m] = { esperado, contado: null };
        }
      }

      let totalEsperado = 0, totalVerificado = 0;
      for (const m of METODOS) {
        totalEsperado += detalle[m]?.esperado || 0;
        totalVerificado += detalle[m]?.contado ?? 0;
      }

      turnos.push({
        recepcionista_nombre: t.recepcionista_nombre,
        monto_inicial: t.monto_inicial,
        total_esperado: totalEsperado,
        total_verificado: totalVerificado
      });
    }

    return reporteHelper.controlCajaRecepcionistas(movimientos, turnos);
  }

  async registrarCajaInicial(anio, mes, monto) {
    const m = parseFloat(monto);
    if (Number.isNaN(m) || m < 0) return { ok: false, error: 'Monto inicial invalido', status: 400 };
    await db.query(
      `INSERT INTO caja_mensual (anio, mes, monto_inicial) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE monto_inicial = VALUES(monto_inicial)`,
      [anio, mes, m]
    );
    return { ok: true, message: 'Monto inicial registrado' };
  }

  async generarDatosExportacion(desde, hasta) {
    const validacion = reporteHelper.validarRangoFechas(desde, hasta);
    if (!validacion.valido) return { ok: false, error: validacion.error, status: 400 };
    const reservas = await this.obtenerReservasRango(desde, hasta);
    const porCancha = reporteHelper.ingresosPorCancha(reservas);
    const total = porCancha.reduce((s, c) => s + c.monto, 0);
    if (porCancha.length === 0) return { ok: false, error: 'No hay datos para exportar en ese rango', status: 404 };
    return { ok: true, por_cancha: porCancha, total: Math.round(total * 100) / 100, reservas };
  }

  async guardarHistorial({ nombre, formato, desde, hasta, generadoPor }) {
    await db.query(
      'INSERT INTO informes_exportados (nombre, formato, desde, hasta, generado_por) VALUES (?, ?, ?, ?, ?)',
      [nombre, formato, desde, hasta, generadoPor]
    );
    const [rows] = await db.query('SELECT id FROM informes_exportados ORDER BY id DESC LIMIT 11');
    if (rows.length > 10) {
      const ids = rows.slice(10).map(r => r.id);
      await db.query(`DELETE FROM informes_exportados WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
    }
  }

  async historial() {
    const [rows] = await db.query(
      `SELECT i.*, u.nombre AS generado_por_nombre FROM informes_exportados i
       LEFT JOIN usuarios u ON i.generado_por = u.id
       ORDER BY i.created_at DESC LIMIT 10`
    );
    return rows;
  }
}

module.exports = new ReporteService();
