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
    const fechaStr = r.fecha instanceof Date ? r.fecha.toISOString().substring(0,10) : String(r.fecha).substring(0,10);
    const dia = new Date(fechaStr + 'T12:00:00').getDay();
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

// 'movimientos' viene de pagos_movimientos: cada fila ya tiene el metodo REAL
// con el que se cobro ese tramo (nunca 'mixto'), asi que el efectivo vs
// digital sale exacto aunque una reserva se haya pagado combinando metodos.
// 'turnos' son los caja_turnos del rango, para sumar el fondo inicial y el
// total esperado de efectivo por recepcionista.
function controlCajaRecepcionistas(movimientos, turnos = []) {
  const map = {};
  const getOrCreate = (nombre) => {
    if (!map[nombre]) map[nombre] = { efectivo: 0, digital: 0, total: 0, count: 0, monto_inicial: 0, total_esperado: 0 };
    return map[nombre];
  };

  movimientos.forEach(p => {
    const d = getOrCreate(p.recepcionista_nombre || 'En linea');
    const m = parseFloat(p.monto || 0);
    if (p.metodo === 'efectivo') d.efectivo += m;
    else d.digital += m;
    d.total += m;
    d.count++;
  });

  turnos.forEach(t => {
    const d = getOrCreate(t.recepcionista_nombre || 'Sin asignar');
    d.monto_inicial += parseFloat(t.monto_inicial || 0);
    d.total_esperado += parseFloat(t.efectivo_esperado || 0);
  });

  return Object.entries(map).map(([nombre, d]) => ({
    nombre,
    efectivo: Math.round(d.efectivo * 100) / 100,
    digital: Math.round(d.digital * 100) / 100,
    total: Math.round(d.total * 100) / 100,
    cobros: d.count,
    monto_inicial: Math.round(d.monto_inicial * 100) / 100,
    total_esperado: Math.round(d.total_esperado * 100) / 100
  }));
}

function generarNombreArchivo(desde, hasta, ext) {
  return `Informe_${desde}_a_${hasta}.${ext}`;
}

module.exports = {
  validarRangoFechas, calcularOcupacion, agruparPorDiaSemana, rankingCanchas,
  ingresosPorCancha, controlCajaRecepcionistas, generarNombreArchivo, DIAS
};
