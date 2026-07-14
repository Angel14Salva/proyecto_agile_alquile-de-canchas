'use strict';

const db = require('../db/connection');

class CuponService {
  /**
   * Genera un código alfanumérico único para el cupón, evitando caracteres ambiguos (O/0, I/1).
   * @param {object} [conn] - Conexión de base de datos opcional para la transacción
   * @returns {Promise<string>} Código de cupón único
   */
  async generarCodigo(conn = db) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let codigo = '';
    let existe = true;
    let intentos = 0;

    while (existe && intentos < 10) {
      codigo = 'CUP-';
      for (let i = 0; i < 6; i++) {
        codigo += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const [rows] = await conn.query('SELECT id FROM cupones WHERE codigo = ?', [codigo]);
      if (rows.length === 0) {
        existe = false;
      }
      intentos++;
    }

    if (existe) {
      throw new Error('No se pudo generar un código de cupón único después de varios intentos');
    }

    return codigo;
  }

  /**
   * Genera un nuevo cupón de reembolso.
   * @param {object} conn - Conexión a la base de datos (con transacción activa)
   * @param {object} datos - Datos del cupón
   * @returns {Promise<object>} Cupón creado
   */
  async generarCupon(conn, { monto, motivo, reservaOrigenId, generadoPor }) {
    const valor = parseFloat(monto);
    if (Number.isNaN(valor) || valor <= 0) {
      throw new Error('El monto del reembolso debe ser mayor a 0');
    }
    if (!motivo || motivo.trim().length < 15) {
      throw new Error('El motivo de reembolso excepcional debe tener al menos 15 caracteres');
    }

    const codigo = await this.generarCodigo(conn);

    const [result] = await conn.query(
      `INSERT INTO cupones (codigo, valor_inicial, saldo, motivo, reserva_origen_id, generado_por, estado)
       VALUES (?, ?, ?, ?, ?, ?, 'activo')`,
      [codigo, valor, valor, motivo.trim(), reservaOrigenId, generadoPor]
    );

    const cuponId = result.insertId;

    await conn.query(
      `INSERT INTO cupones_movimientos (cupon_id, reserva_id, monto, tipo, registrado_por)
       VALUES (?, NULL, ?, 'emision', ?)`,
      [cuponId, valor, generadoPor]
    );

    return {
      id: cuponId,
      codigo,
      valor_inicial: valor,
      saldo: valor,
      estado: 'activo'
    };
  }

  /**
   * Consulta el saldo y estado de un cupón.
   * @param {string} codigo - Código del cupón
   * @returns {Promise<object|null>} Datos del cupón o null si no existe
   */
  async consultarSaldo(codigo) {
    if (!codigo) return null;
    const formattedCodigo = codigo.trim().toUpperCase();
    const [rows] = await db.query(
      `SELECT id, codigo, valor_inicial, saldo, estado, motivo, created_at
       FROM cupones
       WHERE codigo = ?`,
      [formattedCodigo]
    );

    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      id: row.id,
      codigo: row.codigo,
      valor_inicial: parseFloat(row.valor_inicial),
      saldo: parseFloat(row.saldo),
      estado: row.estado,
      motivo: row.motivo,
      created_at: row.created_at
    };
  }

  /**
   * Aplica un cupón como pago, descontando su saldo.
   * @param {object} conn - Conexión de base de datos (con transacción activa)
   * @param {object} datos - Datos de la aplicación
   * @returns {Promise<object>} Detalles del descuento aplicado
   */
  async aplicarCupon(conn, { codigo, montoSolicitado, reservaId, registradoPor }) {
    const formattedCodigo = codigo.trim().toUpperCase();
    const monto = Math.round(parseFloat(montoSolicitado) * 100) / 100;

    if (Number.isNaN(monto) || monto <= 0) {
      throw new Error('El monto a aplicar debe ser mayor a 0');
    }

    const [rows] = await conn.query(
      `SELECT id, saldo, estado FROM cupones WHERE codigo = ? FOR UPDATE`,
      [formattedCodigo]
    );

    if (rows.length === 0) {
      throw new Error('El cupón ingresado no existe');
    }

    const cupon = rows[0];

    if (cupon.estado !== 'activo') {
      throw new Error(`El cupón no se puede canjear porque está ${cupon.estado}`);
    }

    const saldoActual = parseFloat(cupon.saldo);
    if (saldoActual <= 0) {
      throw new Error('El cupón no tiene saldo disponible');
    }

    if (monto > saldoActual + 0.01) {
      throw new Error(`El monto solicitado (S/ ${monto.toFixed(2)}) supera el saldo disponible del cupón (S/ ${saldoActual.toFixed(2)})`);
    }

    const nuevoSaldo = Math.max(0, Math.round((saldoActual - monto) * 100) / 100);
    const nuevoEstado = nuevoSaldo === 0 ? 'agotado' : 'activo';

    await conn.query(
      `UPDATE cupones
       SET saldo = ?, estado = ?
       WHERE id = ?`,
      [nuevoSaldo, nuevoEstado, cupon.id]
    );

    await conn.query(
      `INSERT INTO cupones_movimientos (cupon_id, reserva_id, monto, tipo, registrado_por)
       VALUES (?, ?, ?, 'canje', ?)`,
      [cupon.id, reservaId, -monto, registradoPor || null]
    );

    return {
      cuponId: cupon.id,
      codigo: formattedCodigo,
      montoAplicado: monto,
      nuevoSaldo,
      estado: nuevoEstado
    };
  }
}

module.exports = new CuponService();
