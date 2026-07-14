const db = require('../db/connection');

async function cancelarReservasPendientes() {
  try {
    const ahora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
    const limite = new Date(ahora.getTime() + 2 * 60 * 60 * 1000);
    const fechaLimite = limite.toISOString().split('T')[0];
    const horaLimite = limite.toTimeString().substring(0, 5);

    const [reservas] = await db.query(
      `SELECT r.id, r.codigo, u.email, u.nombre as cliente_nombre
       FROM reservas r
       JOIN usuarios u ON r.usuario_id = u.id
       LEFT JOIN pagos p ON p.reserva_id = r.id
       WHERE r.estado = 'pendiente'
       AND p.id IS NULL
       AND (r.fecha < ? OR (r.fecha = ? AND r.hora_inicio <= ?))`,
      [fechaLimite, fechaLimite, horaLimite]
    );

    if (reservas.length > 0) {
      for (const r of reservas) {
        await db.query("UPDATE reservas SET estado = 'cancelada' WHERE id = ?", [r.id]);
        console.log('[AutoCancel] Reserva ' + r.codigo + ' cancelada por falta de pago');
      }
      console.log('[AutoCancel] ' + reservas.length + ' reservas canceladas');
    }

    // Intentos de pago por pasarela que el cliente abandonó (nunca pagó y nunca volvió).
    // No bloquean ningún horario (la reserva nunca se creó), solo se marcan para
    // no dejarlos como "pendiente" indefinidamente.
    const [expirados] = await db.query(
      `UPDATE reservas_pendientes_pago
       SET estado = 'expirado'
       WHERE estado = 'pendiente' AND created_at < DATE_SUB(NOW(), INTERVAL 30 MINUTE)`
    );
    if (expirados.affectedRows > 0) {
      console.log('[AutoCancel] ' + expirados.affectedRows + ' intentos de pago Flow expirados');
    }
  } catch (e) {
    console.error('[AutoCancel] Error:', e.message);
  }
}

function iniciarJobCancelacion() {
  setInterval(cancelarReservasPendientes, 15 * 60 * 1000);
  cancelarReservasPendientes();
  console.log('[AutoCancel] Job iniciado (cada 15 min)');
}

module.exports = { iniciarJobCancelacion };
