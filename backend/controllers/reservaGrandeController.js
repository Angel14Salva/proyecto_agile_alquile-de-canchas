'use strict';
const db = require('../db/connection');
const { enviarConfirmacionReserva } = require('../services/emailService');

class ReservaGrandeController {

  async create(req, res) {
    const { nombre_org, ruc, fecha, turno, cancha_ids, notas, origen } = req.body;
    const usuario_id = req.user.userId;

    if (!nombre_org || !fecha || !turno || !cancha_ids || cancha_ids.length < 3)
      return res.status(400).json({ error: 'Se requiere organización, fecha, turno y mínimo 3 canchas' });

    // Validar 7 días de anticipación
    const fechaEvento = new Date(fecha + 'T00:00:00');
    const ahora = new Date();
    const diffDias = (fechaEvento - ahora) / (1000 * 60 * 60 * 24);
    if (diffDias < 7)
      return res.status(400).json({ error: 'Las reservas grandes requieren mínimo 7 días de anticipación' });

    // Horarios según turno
    const turnos = {
      manana:       { inicio: '07:00:00', fin: '13:00:00' },
      tarde:        { inicio: '13:00:00', fin: '23:00:00' },
      dia_completo: { inicio: '07:00:00', fin: '23:00:00' }
    };
    const { inicio, fin } = turnos[turno];

    try {
      // Verificar disponibilidad en reservas normales Y grandes
      for (const cancha_id of cancha_ids) {
        const [ocupado] = await db.query(
          `SELECT id FROM reservas WHERE cancha_id = ? AND fecha = ? AND estado != 'cancelada'
           AND ((hora_inicio >= ? AND hora_inicio < ?) OR (hora_fin > ? AND hora_fin <= ?) OR (hora_inicio <= ? AND hora_fin >= ?))`,
          [cancha_id, fecha, inicio, fin, inicio, fin, inicio, fin]
        );
        if (ocupado.length > 0)
          return res.status(409).json({ error: `La cancha ${cancha_id} no está disponible en ese turno (reserva normal)` });

        const [ocupadoGrande] = await db.query(
          `SELECT rgc.id FROM reservas_grandes_canchas rgc
           JOIN reservas_grandes rg ON rgc.reserva_grande_id = rg.id
           WHERE rgc.cancha_id = ? AND rg.fecha = ? AND rg.estado != 'cancelada'
           AND ((rg.hora_inicio >= ? AND rg.hora_inicio < ?) OR (rg.hora_fin > ? AND rg.hora_fin <= ?) OR (rg.hora_inicio <= ? AND rg.hora_fin >= ?))`,
          [cancha_id, fecha, inicio, fin, inicio, fin, inicio, fin]
        );
        if (ocupadoGrande.length > 0)
          return res.status(409).json({ error: `La cancha ${cancha_id} ya tiene una reserva grande en ese turno` });
      }

      // Calcular precio total
      const [canchas] = await db.query('SELECT id, precio_hora FROM canchas WHERE id IN (?)', [cancha_ids]);
      const horas = { manana: 6, tarde: 10, dia_completo: 16 };
      const descuento = { manana: 0, tarde: 0.10, dia_completo: 0.20 };
      const h = horas[turno];
      const desc = descuento[turno];
      const precioBase = canchas.reduce((sum, c) => sum + parseFloat(c.precio_hora) * h, 0);
      const precioTotal = precioBase * (1 - desc);

      // Generar código
      const anio = new Date().getFullYear();
      const [crows] = await db.query('SELECT COUNT(*) as total FROM reservas_grandes WHERE YEAR(created_at) = ?', [anio]);
      const num = String(crows[0].total + 1).padStart(3, '0');
      const codigo = `RGR-${anio}-${num}`;

      // Insertar reserva grande
      const [result] = await db.query(
        `INSERT INTO reservas_grandes (codigo, usuario_id, nombre_org, ruc, fecha, turno, hora_inicio, hora_fin, num_canchas, precio_total, estado, origen, notas)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', ?, ?)`,
        [codigo, usuario_id, nombre_org, ruc || null, fecha, turno, inicio, fin, cancha_ids.length, precioTotal, origen || 'linea', notas || null]
      );

      // Insertar canchas seleccionadas
      for (const cancha_id of cancha_ids) {
        await db.query('INSERT INTO reservas_grandes_canchas (reserva_grande_id, cancha_id) VALUES (?, ?)', [result.insertId, cancha_id]);
      }

      // Enviar correo
      try {
        const [urows] = await db.query('SELECT nombre, email FROM usuarios WHERE id = ?', [usuario_id]);
        if (urows.length > 0) {
          await enviarConfirmacionReserva(urows[0].email, {
            nombre: urows[0].nombre,
            codigo,
            cancha: `${cancha_ids.length} canchas (${turno.replace('_',' ')})`,
            fecha,
            horaInicio: inicio.substring(0,5),
            horaFin: fin.substring(0,5),
            monto: precioTotal.toFixed(2)
          });
        }
      } catch(mailErr) { console.error('Error correo reserva grande:', mailErr.message); }

      res.status(201).json({ message: 'Reserva grande creada', reserva_id: result.insertId, codigo, precio_total: precioTotal });

    } catch(err) {
      console.error('Error en create reserva grande:', err);
      res.status(500).json({ error: 'Error al crear reserva grande' });
    }
  }

  async getAll(req, res) {
    try {
      const { userId, rol } = req.user;
      let query = `SELECT rg.*, u.nombre as cliente_nombre, u.email as cliente_email
                   FROM reservas_grandes rg
                   JOIN usuarios u ON rg.usuario_id = u.id WHERE 1=1`;
      const params = [];
      if (rol === 'cliente') { query += ' AND rg.usuario_id = ?'; params.push(userId); }
      query += ' ORDER BY rg.fecha ASC';
      const [reservas] = await db.query(query, params);
      // Agregar canchas a cada reserva
      for (const r of reservas) {
        const [canchas] = await db.query(
          `SELECT c.id, c.nombre, c.deporte FROM canchas c
            JOIN reservas_grandes_canchas rgc ON rgc.cancha_id = c.id
            WHERE rgc.reserva_grande_id = ?`, [r.id]
        );
        r.canchas = canchas;
      }
      res.json(reservas);
    } catch(err) {
      res.status(500).json({ error: 'Error al obtener reservas grandes' });
    }
  }

  async disponibilidad(req, res) {
    const { fecha, turno } = req.query;
    if (!fecha || !turno) return res.status(400).json({ error: 'Fecha y turno requeridos' });
    const turnos = { manana: { inicio: '07:00:00', fin: '13:00:00' }, tarde: { inicio: '13:00:00', fin: '23:00:00' }, dia_completo: { inicio: '07:00:00', fin: '23:00:00' } };
    const { inicio, fin } = turnos[turno] || turnos.dia_completo;
    try {
      const [canchasOcupadasNormal] = await db.query(
        `SELECT DISTINCT cancha_id as id FROM reservas WHERE fecha = ? AND estado != 'cancelada'
         AND ((hora_inicio >= ? AND hora_inicio < ?) OR (hora_fin > ? AND hora_fin <= ?) OR (hora_inicio <= ? AND hora_fin >= ?))`,
        [fecha, inicio, fin, inicio, fin, inicio, fin]
      );
      const [canchasOcupadasGrande] = await db.query(
        `SELECT DISTINCT rgc.cancha_id as id FROM reservas_grandes_canchas rgc
         JOIN reservas_grandes rg ON rgc.reserva_grande_id = rg.id
         WHERE rg.fecha = ? AND rg.estado != 'cancelada'
         AND ((rg.hora_inicio >= ? AND rg.hora_inicio < ?) OR (rg.hora_fin > ? AND rg.hora_fin <= ?) OR (rg.hora_inicio <= ? AND rg.hora_fin >= ?))`,
        [fecha, inicio, fin, inicio, fin, inicio, fin]
      );
      const ocupadas = [...new Set([...canchasOcupadasNormal, ...canchasOcupadasGrande].map(r => r.id))];
      res.json({ ocupadas });
    } catch(err) {
      res.status(500).json({ error: 'Error al verificar disponibilidad' });
    }
  }

  async cancel(req, res) {
    const { id } = req.params;
    try {
      const [rows] = await db.query('SELECT * FROM reservas_grandes WHERE id = ?', [id]);
      if (rows.length === 0) return res.status(404).json({ error: 'Reserva no encontrada' });
      if (rows[0].estado === 'cancelada') return res.status(400).json({ error: 'Ya está cancelada' });
      await db.query('UPDATE reservas_grandes SET estado = "cancelada" WHERE id = ?', [id]);
      res.json({ message: 'Reserva grande cancelada' });
    } catch(err) {
      res.status(500).json({ error: 'Error al cancelar' });
    }
  }
}

module.exports = new ReservaGrandeController();