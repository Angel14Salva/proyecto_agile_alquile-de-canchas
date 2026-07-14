'use strict';
const cajaService = require('../services/cajaService');

class CajaController {
  async estado(req, res) {
    try {
      const resultado = await cajaService.estadoActual();
      res.json(resultado);
    } catch (err) {
      console.error('Error estado caja:', err);
      res.status(500).json({ error: 'Error al consultar el estado de caja' });
    }
  }

  async abrir(req, res) {
    const { monto_inicial } = req.body;
    if (monto_inicial === undefined || monto_inicial === null)
      return res.status(400).json({ error: 'monto_inicial es requerido' });
    try {
      const resultado = await cajaService.abrir({ montoInicial: monto_inicial, usuarioId: req.user.userId });
      if (!resultado.ok) return res.status(resultado.status).json({ error: resultado.error });
      res.status(201).json(resultado);
    } catch (err) {
      console.error('Error al abrir caja:', err);
      res.status(500).json({ error: 'Error al abrir caja' });
    }
  }

  async cerrar(req, res) {
    const { efectivo_contado, notas } = req.body;
    if (efectivo_contado === undefined || efectivo_contado === null)
      return res.status(400).json({ error: 'efectivo_contado es requerido' });
    try {
      const resultado = await cajaService.cerrar({ efectivoContado: efectivo_contado, notas, usuarioId: req.user.userId });
      if (!resultado.ok) return res.status(resultado.status).json({ error: resultado.error });
      res.json(resultado);
    } catch (err) {
      console.error('Error al cerrar caja:', err);
      res.status(500).json({ error: 'Error al cerrar caja' });
    }
  }

  async historial(req, res) {
    try {
      const rows = await cajaService.historial(parseInt(req.query.limite, 10) || 30);
      res.json(rows);
    } catch (err) {
      console.error('Error historial caja:', err);
      res.status(500).json({ error: 'Error al obtener historial de caja' });
    }
  }
}

module.exports = new CajaController();
