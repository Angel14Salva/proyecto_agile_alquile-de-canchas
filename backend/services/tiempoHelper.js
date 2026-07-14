'use strict';

/**
 * Obtiene la diferencia en horas entre la fecha y hora de la reserva y el momento actual en America/Lima.
 * @param {Date|string} fecha - Fecha de la reserva
 * @param {string} hora_inicio - Hora de inicio de la reserva (ej: '18:00:00')
 * @returns {number} Diferencia en horas (puede ser decimal y negativa si ya pasó)
 */
function horasHastaReserva(fecha, hora_inicio) {
  let strFecha;
  if (fecha instanceof Date) {
    const yyyy = fecha.getFullYear();
    const mm = String(fecha.getMonth() + 1).padStart(2, '0');
    const dd = String(fecha.getDate()).padStart(2, '0');
    strFecha = `${yyyy}-${mm}-${dd}`;
  } else if (typeof fecha === 'string') {
    strFecha = fecha.includes('T') ? fecha.split('T')[0] : fecha.substring(0, 10);
  } else {
    strFecha = String(fecha).substring(0, 10);
  }

  const strHora = String(hora_inicio).substring(0, 8);
  const fechaReserva = new Date(`${strFecha}T${strHora}`);
  const ahora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));

  return (fechaReserva.getTime() - ahora.getTime()) / 1000 / 60 / 60;
}

module.exports = {
  horasHastaReserva
};
