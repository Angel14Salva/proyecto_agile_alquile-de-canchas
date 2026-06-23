'use strict';

const checkInService = require('../services/checkInService');

class RecepcionController {
  async buscarCheckIn(req, res) {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'Ingrese al menos 2 caracteres para buscar' });
    }
    try {
      const resultados = await checkInService.buscar(q);
      if (resultados.length === 0) return res.status(404).json({ error: 'No se encontraron reservas' });
      res.json(resultados);
    } catch (err) {
      res.status(500).json({ error: 'Error en busqueda' });
    }
  }

  async confirmarIngreso(req, res) {
    try {
      const resultado = await checkInService.confirmarIngreso(
        parseInt(req.params.id, 10),
        req.user.userId
      );
      if (!resultado.ok) return res.status(resultado.status).json({ error: resultado.error });
      res.json(resultado);
    } catch (err) {
      res.status(500).json({ error: 'Error al confirmar ingreso' });
    }
  }
}

module.exports = new RecepcionController();
