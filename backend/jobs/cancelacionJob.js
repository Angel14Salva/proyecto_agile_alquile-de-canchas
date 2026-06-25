const db = require('../db');

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

    if (reservas.length === 0) return;

    for (const r of reservas) {
      await db.query("UPDATE reservas SET estado = 'cancelada' WHERE id = ?", [r.id]);
      console.log('[AutoCancel] Reserva ' + r.codigo + ' cancelada por falta de pago');
    }
    console.log('[AutoCancel] ' + reservas.length + ' reservas canceladas');
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
