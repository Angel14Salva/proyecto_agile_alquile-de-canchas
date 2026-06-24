const https = require('https');

async function enviarEmail(to, subject, html) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      sender: { name: 'Pacific Sport Center', email: 'salvadorluis290@gmail.com' },
      to: [{ email: to }],
      subject,
      htmlContent: html
    });
    const options = {
      hostname: 'api.brevo.com',
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY
      }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(body);
        else reject(new Error('Brevo error: ' + body));
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function enviarConfirmacionReserva(email, datos) {
  const { nombre, codigo, cancha, fecha, horaInicio, horaFin, monto } = datos;
  await enviarEmail(email, 'Reserva confirmada - ' + codigo,
    '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><div style="background:#2d6a4f;padding:24px;border-radius:12px 12px 0 0;text-align:center"><h1 style="color:#fff;margin:0">Pacific Sport Center</h1><p style="color:#b7e4c7;margin:6px 0 0">Confirmacion de reserva</p></div><div style="background:#f8f9fa;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e0e0e0"><p>Hola <strong>' + nombre + '</strong>,</p><p>Tu reserva ha sido registrada exitosamente:</p><table style="width:100%;border-collapse:collapse"><tr><td style="padding:8px 0;color:#666">Codigo</td><td style="font-weight:700">' + codigo + '</td></tr><tr><td style="padding:8px 0;color:#666">Cancha</td><td>' + cancha + '</td></tr><tr><td style="padding:8px 0;color:#666">Fecha</td><td>' + fecha + '</td></tr><tr><td style="padding:8px 0;color:#666">Horario</td><td>' + horaInicio + ' - ' + horaFin + '</td></tr><tr><td style="padding:8px 0;color:#666">Monto</td><td style="font-weight:700;color:#2d6a4f">S/ ' + monto + '</td></tr></table><p style="font-size:13px;color:#666;margin-top:16px">Puedes cancelar o modificar con al menos 2 horas de anticipacion.</p><p style="font-size:12px;color:#999">Pacific Sport Center - Trujillo, Peru</p></div></div>'
  );
}

async function enviarCancelacionReserva(email, datos) {
  const { nombre, codigo, cancha, fecha, horaInicio, horaFin } = datos;
  await enviarEmail(email, 'Reserva cancelada - ' + codigo,
    '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><div style="background:#c0392b;padding:24px;border-radius:12px 12px 0 0;text-align:center"><h1 style="color:#fff;margin:0">Pacific Sport Center</h1><p style="color:#fadbd8;margin:6px 0 0">Cancelacion de reserva</p></div><div style="background:#f8f9fa;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e0e0e0"><p>Hola <strong>' + nombre + '</strong>,</p><p>Tu reserva ha sido cancelada:</p><table style="width:100%;border-collapse:collapse"><tr><td style="padding:8px 0;color:#666">Codigo</td><td style="font-weight:700">' + codigo + '</td></tr><tr><td style="padding:8px 0;color:#666">Cancha</td><td>' + cancha + '</td></tr><tr><td style="padding:8px 0;color:#666">Fecha</td><td>' + fecha + '</td></tr><tr><td style="padding:8px 0;color:#666">Horario</td><td>' + horaInicio + ' - ' + horaFin + '</td></tr></table><p style="font-size:12px;color:#999;margin-top:16px">Pacific Sport Center - Trujillo, Peru</p></div></div>'
  );
}

async function enviarRecuperacionPassword(email, datos) {
  const { nombre, resetUrl } = datos;
  await enviarEmail(email, 'Recuperar contrasena - Pacific Sport Center',
    '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><div style="background:#2d6a4f;padding:24px;border-radius:12px 12px 0 0;text-align:center"><h1 style="color:#fff;margin:0">Pacific Sport Center</h1><p style="color:#b7e4c7;margin:6px 0 0">Recuperacion de contrasena</p></div><div style="background:#f8f9fa;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e0e0e0"><p>Hola <strong>' + nombre + '</strong>,</p><p>Recibimos una solicitud para restablecer tu contrasena. Haz click en el boton de abajo:</p><div style="text-align:center;margin:24px 0"><a href="' + resetUrl + '" style="background:#2d6a4f;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600">Restablecer contrasena</a></div><p style="font-size:13px;color:#666">Este enlace expira en 30 minutos. Si no solicitaste esto, ignora este correo.</p><p style="font-size:12px;color:#999">Pacific Sport Center - Trujillo, Peru</p></div></div>'
  );
}

async function enviarConfirmacionPago(email, datos) {
  const { nombre, codigo, monto, tipo_pago, comprobante } = datos;
  const tipoLabel = tipo_pago === 'adelanto' ? 'Adelanto (50%)' : 'Pago completo';
  await enviarEmail(email, 'Pago confirmado - ' + codigo,
    '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><div style="background:#2d6a4f;padding:24px;border-radius:12px 12px 0 0;text-align:center"><h1 style="color:#fff;margin:0">Pacific Sport Center</h1><p style="color:#b7e4c7;margin:6px 0 0">Confirmacion de pago</p></div><div style="background:#f8f9fa;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e0e0e0"><p>Hola <strong>' + nombre + '</strong>,</p><p>Se registro tu pago:</p><table style="width:100%;border-collapse:collapse"><tr><td style="padding:8px 0;color:#666">Reserva</td><td style="font-weight:700">' + codigo + '</td></tr><tr><td style="padding:8px 0;color:#666">Tipo</td><td>' + tipoLabel + '</td></tr><tr><td style="padding:8px 0;color:#666">Monto</td><td style="font-weight:700;color:#2d6a4f">S/ ' + monto + '</td></tr><tr><td style="padding:8px 0;color:#666">Comprobante</td><td>' + comprobante + '</td></tr></table><p style="font-size:12px;color:#999;margin-top:16px">Pacific Sport Center - Trujillo, Peru</p></div></div>'
  );
}

async function enviarCancelacionLinea(email, datos) {
  const { nombre, codigo, monto, exito, mensaje } = datos;
  const titulo = exito ? 'Cancelacion confirmada' : 'Cancelacion en revision';
  const color = exito ? '#2d6a4f' : '#d97706';
  await enviarEmail(email, titulo + ' - ' + codigo,
    '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><div style="background:' + color + ';padding:24px;border-radius:12px 12px 0 0;text-align:center"><h1 style="color:#fff;margin:0">Pacific Sport Center</h1></div><div style="background:#f8f9fa;padding:24px;border:1px solid #e0e0e0;border-radius:0 0 12px 12px"><p>Hola <strong>' + nombre + '</strong>,</p><p>' + mensaje + '</p><p><strong>Reserva:</strong> ' + codigo + '<br><strong>Reembolso:</strong> S/ ' + monto + '</p></div></div>'
  );
}


async function enviarBoletaVenta(email, datos) {
  const { nombre, codigo, cancha, fecha, horaInicio, horaFin, monto, metodo, referencia, comprobante, numeroComprobante } = datos;
  const ahora = new Date();
  const fechaEmision = ahora.toLocaleDateString('es-PE', { year:'numeric', month:'long', day:'numeric' });
  const horaEmision = ahora.toLocaleTimeString('es-PE', { hour:'2-digit', minute:'2-digit' });
  const metodosLabel = { efectivo:'Efectivo', yape:'Yape', plin:'Plin', transferencia:'Transferencia bancaria', tarjeta:'Tarjeta de credito/debito' };
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f0f0;font-family:Arial,sans-serif">
<div style="max-width:600px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1)">
  <!-- Header -->
  <div style="background:linear-gradient(135deg,#1b4332,#2d6a4f);padding:32px 40px;text-align:center">
    <div style="font-size:36px;margin-bottom:8px">⚽</div>
    <h1 style="color:#fff;margin:0;font-size:24px;letter-spacing:1px">PACIFIC SPORT CENTER</h1>
    <p style="color:#b7e4c7;margin:4px 0 0;font-size:13px">Complejo Deportivo — Trujillo, Perú</p>
  </div>
  <!-- Titulo comprobante -->
  <div style="background:#52b788;padding:12px 40px;text-align:center">
    <p style="margin:0;color:#fff;font-weight:700;font-size:15px;letter-spacing:2px">${comprobante === 'factura' ? 'FACTURA DE VENTA' : 'BOLETA DE VENTA'} ELECTRÓNICA</p>
    <p style="margin:4px 0 0;color:#d8f3dc;font-size:12px">N° ${numeroComprobante || 'PSC-' + Date.now().toString().slice(-6)}</p>
  </div>
  <!-- Datos emisor/receptor -->
  <div style="display:flex;padding:24px 40px;gap:20px;border-bottom:1px solid #e0e0e0">
    <div style="flex:1">
      <p style="margin:0 0 4px;font-size:11px;color:#888;text-transform:uppercase;font-weight:700">Emisor</p>
      <p style="margin:0;font-weight:700;color:#1b4332">Pacific Sport Center S.A.C.</p>
      <p style="margin:2px 0;font-size:12px;color:#555">RUC: 20601234567</p>
      <p style="margin:2px 0;font-size:12px;color:#555">Av. Deportiva 123, Trujillo</p>
    </div>
    <div style="flex:1">
      <p style="margin:0 0 4px;font-size:11px;color:#888;text-transform:uppercase;font-weight:700">Cliente</p>
      <p style="margin:0;font-weight:700;color:#333">${nombre}</p>
      <p style="margin:2px 0;font-size:12px;color:#555">Fecha emisión: ${fechaEmision}</p>
      <p style="margin:2px 0;font-size:12px;color:#555">Hora: ${horaEmision}</p>
    </div>
  </div>
  <!-- Detalle -->
  <div style="padding:24px 40px">
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>
        <tr style="background:#f8f9fa">
          <th style="padding:10px;text-align:left;border-bottom:2px solid #2d6a4f;color:#1b4332">Descripción</th>
          <th style="padding:10px;text-align:center;border-bottom:2px solid #2d6a4f;color:#1b4332">Fecha</th>
          <th style="padding:10px;text-align:center;border-bottom:2px solid #2d6a4f;color:#1b4332">Horario</th>
          <th style="padding:10px;text-align:right;border-bottom:2px solid #2d6a4f;color:#1b4332">Importe</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:12px 10px;color:#333">${cancha}</td>
          <td style="padding:12px 10px;text-align:center;color:#555">${fecha}</td>
          <td style="padding:12px 10px;text-align:center;color:#555">${horaInicio} – ${horaFin}</td>
          <td style="padding:12px 10px;text-align:right;font-weight:700">S/ ${parseFloat(monto).toFixed(2)}</td>
        </tr>
      </tbody>
      <tfoot>
        <tr style="background:#f8f9fa">
          <td colspan="3" style="padding:10px;text-align:right;font-size:12px;color:#888">Subtotal (sin IGV)</td>
          <td style="padding:10px;text-align:right;font-size:12px">S/ ${(parseFloat(monto)/1.18).toFixed(2)}</td>
        </tr>
        <tr style="background:#f8f9fa">
          <td colspan="3" style="padding:10px;text-align:right;font-size:12px;color:#888">IGV (18%)</td>
          <td style="padding:10px;text-align:right;font-size:12px">S/ ${(parseFloat(monto) - parseFloat(monto)/1.18).toFixed(2)}</td>
        </tr>
        <tr style="background:#2d6a4f">
          <td colspan="3" style="padding:12px 10px;text-align:right;color:#fff;font-weight:700">TOTAL</td>
          <td style="padding:12px 10px;text-align:right;color:#fff;font-weight:700;font-size:16px">S/ ${parseFloat(monto).toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>
  </div>
  <!-- Pago info -->
  <div style="padding:0 40px 24px">
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px">
      <p style="margin:0 0 8px;font-weight:700;color:#1b4332;font-size:13px">✅ Pago registrado</p>
      <p style="margin:2px 0;font-size:12px;color:#555">Método: <strong>${metodosLabel[metodo] || metodo}</strong></p>
      ${referencia ? '<p style="margin:2px 0;font-size:12px;color:#555">N° operación: <strong>' + referencia + '</strong></p>' : ''}
      <p style="margin:2px 0;font-size:12px;color:#555">Reserva: <strong>${codigo}</strong></p>
    </div>
  </div>
  <!-- Footer -->
  <div style="background:#1b4332;padding:20px 40px;text-align:center">
    <p style="margin:0;color:#b7e4c7;font-size:12px">¡Gracias por elegir Pacific Sport Center!</p>
    <p style="margin:4px 0 0;color:#74c69d;font-size:11px">Este documento es un comprobante electrónico válido</p>
  </div>
</div>
</body>
</html>`;
  await enviarEmail(email, (comprobante === 'factura' ? 'Factura' : 'Boleta') + ' de venta - ' + codigo, html);
}

module.exports = {
  enviarConfirmacionReserva, enviarCancelacionReserva, enviarRecuperacionPassword,
  enviarConfirmacionPago, enviarCancelacionLinea, enviarBoletaVenta
};
