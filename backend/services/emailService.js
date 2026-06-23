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

module.exports = {
  enviarConfirmacionReserva, enviarCancelacionReserva, enviarRecuperacionPassword,
  enviarConfirmacionPago, enviarCancelacionLinea
};
