'use strict';

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];

function validarRangoFechas(desde, hasta, maxMeses = 12) {
  if (!desde || !hasta) return { valido: false, error: 'Desde y hasta son requeridos' };
  const d1 = new Date(desde);
  const d2 = new Date(hasta);
  if (d2 < d1) return { valido: false, error: 'La fecha hasta debe ser posterior a desde' };
  const diffMeses = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
  if (diffMeses > maxMeses) return { valido: false, error: `El rango maximo es de ${maxMeses} meses` };
  return { valido: true };
}

function calcularOcupacion(reservasConfirmadas, canchasActivas, diasEnRango) {
  const horasDisponibles = canchasActivas * 16 * diasEnRango;
  const horasReservadas = reservasConfirmadas.length;
  if (horasDisponibles === 0) return 0;
  return Math.round((horasReservadas / horasDisponibles) * 10000) / 100;
}

function agruparPorDiaSemana(reservas) {
  const conteo = [0, 0, 0, 0, 0, 0, 0];
  reservas.forEach(r => {
    const dia = new Date(String(r.fecha).substring(0, 10) + 'T12:00:00').getDay();
    conteo[dia]++;
  });
  return DIAS.map((nombre, i) => ({ dia: nombre, total: conteo[i] }));
}

function rankingCanchas(reservas) {
  const map = {};
  reservas.forEach(r => {
    const key = r.cancha_nombre || r.cancha_id;
    map[key] = (map[key] || 0) + 1;
  });
  return Object.entries(map).map(([nombre, total]) => ({ nombre, total }))
    .sort((a, b) => b.total - a.total);
}

function ingresosPorCancha(reservas) {
  const map = {};
  reservas.forEach(r => {
    if (r.pago_estado !== 'pagado' && r.pago_estado !== 'reembolsado') return;
    if (r.estado === 'cancelada') return;
    const key = r.cancha_nombre || `Cancha ${r.cancha_id}`;
    if (!map[key]) map[key] = { reservas: 0, monto: 0 };
    map[key].reservas++;
    map[key].monto += parseFloat(r.pago_monto || r.precio_hora || 0);
  });
  return Object.entries(map).map(([cancha, d]) => ({
    cancha, reservas: d.reservas, monto: Math.round(d.monto * 100) / 100
  }));
}

function controlCajaRecepcionistas(pagos) {
  const map = {};
  pagos.forEach(p => {
    const nombre = p.recepcionista_nombre || 'En linea';
    if (!map[nombre]) map[nombre] = { efectivo: 0, digital: 0, total: 0, count: 0 };
    const m = parseFloat(p.monto || 0);
    if (p.metodo === 'efectivo') map[nombre].efectivo += m;
    else map[nombre].digital += m;
    map[nombre].total += m;
    map[nombre].count++;
  });
  return Object.entries(map).map(([nombre, d]) => ({
    nombre,
    efectivo: Math.round(d.efectivo * 100) / 100,
    digital: Math.round(d.digital * 100) / 100,
    total: Math.round(d.total * 100) / 100,
    cobros: d.count
  }));
}

function generarNombreArchivo(desde, hasta, ext) {
  return `Informe_${desde}_a_${hasta}.${ext}`;
}

module.exports = {
  validarRangoFechas, calcularOcupacion, agruparPorDiaSemana, rankingCanchas,
  ingresosPorCancha, controlCajaRecepcionistas, generarNombreArchivo, DIAS
};
