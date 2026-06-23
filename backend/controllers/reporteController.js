'use strict';

const reporteService = require('../services/reporteService');
const reporteHelper = require('../services/reporteHelper');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

class ReporteController {
  async dashboard(req, res) {
    try {
      const { desde, hasta } = req.query;
      const resultado = await reporteService.dashboard(desde, hasta);
      if (!resultado.ok) return res.status(resultado.status).json({ error: resultado.error });
      res.json(resultado);
    } catch (err) {
      console.error('Error dashboard:', err);
      res.status(500).json({ error: 'Error al obtener reportes' });
    }
  }

  async controlCaja(req, res) {
    try {
      const { desde, hasta, recepcionista_id } = req.query;
      const caja = await reporteService.controlCaja(desde, hasta, recepcionista_id || null);
      res.json(caja);
    } catch (err) {
      res.status(500).json({ error: 'Error al obtener control de caja' });
    }
  }

  async cajaInicial(req, res) {
    const { anio, mes, monto } = req.body;
    const resultado = await reporteService.registrarCajaInicial(anio, mes, monto);
    if (!resultado.ok) return res.status(resultado.status).json({ error: resultado.error });
    res.json(resultado);
  }

  async historial(req, res) {
    try {
      const rows = await reporteService.historial();
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: 'Error al obtener historial' });
    }
  }

  async exportExcel(req, res) {
    try {
      const { desde, hasta } = req.query;
      const datos = await reporteService.generarDatosExportacion(desde, hasta);
      if (!datos.ok) return res.status(datos.status).json({ error: datos.error });

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Informe');
      ws.addRow(['Cancha', 'Reservas', 'Monto recaudado (S/)']);
      datos.por_cancha.forEach(c => ws.addRow([c.cancha, c.reservas, c.monto]));
      ws.addRow([]);
      ws.addRow(['TOTAL', datos.reservas.length, datos.total]);

      const nombre = reporteHelper.generarNombreArchivo(desde, hasta, 'xlsx');
      await reporteService.guardarHistorial({
        nombre, formato: 'excel', desde, hasta, generadoPor: req.user.userId
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
      await wb.xlsx.write(res);
      res.end();
    } catch (err) {
      console.error('Error export excel:', err);
      res.status(500).json({ error: 'Error al exportar Excel' });
    }
  }

  async exportPdf(req, res) {
    try {
      const { desde, hasta } = req.query;
      const datos = await reporteService.generarDatosExportacion(desde, hasta);
      if (!datos.ok) return res.status(datos.status).json({ error: datos.error });

      const nombre = reporteHelper.generarNombreArchivo(desde, hasta, 'pdf');
      await reporteService.guardarHistorial({
        nombre, formato: 'pdf', desde, hasta, generadoPor: req.user.userId
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);

      const doc = new PDFDocument({ margin: 50 });
      doc.pipe(res);
      doc.fontSize(16).text('Pacific Sport Center — Informe de ingresos', { align: 'center' });
      doc.moveDown();
      doc.fontSize(11).text(`Periodo: ${desde} al ${hasta}`);
      doc.moveDown();
      datos.por_cancha.forEach(c => {
        doc.text(`${c.cancha}: ${c.reservas} reservas — S/ ${c.monto.toFixed(2)}`);
      });
      doc.moveDown();
      doc.fontSize(12).text(`Total general: S/ ${datos.total.toFixed(2)}`, { underline: true });
      doc.end();
    } catch (err) {
      console.error('Error export pdf:', err);
      res.status(500).json({ error: 'Error al exportar PDF' });
    }
  }
}

module.exports = new ReporteController();
