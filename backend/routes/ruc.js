const express = require('express');
const router  = express.Router();

router.get('/:numero', async (req, res) => {
  const { numero } = req.params;
  if (!/^20\d{9}$/.test(numero)) {
    return res.status(400).json({ ok: false, mensaje: 'RUC de empresa debe tener 11 dígitos y empezar con 20' });
  }
  try {
    const resp = await fetch(`https://api.factiliza.com/v1/ruc/info/${numero}`, {
      headers: { 'Authorization': `Bearer ${process.env.FACTILIZA_TOKEN}` }
    });
    const data = await resp.json();
    if (!data.success) return res.status(404).json({ ok: false, mensaje: 'RUC no encontrado' });
    res.json({ ok: true, razon_social: data.data.nombre_o_razon_social, estado: data.data.estado });
  } catch (e) {
    res.status(500).json({ ok: false, mensaje: 'Error consultando SUNAT' });
  }
});

module.exports = router;
