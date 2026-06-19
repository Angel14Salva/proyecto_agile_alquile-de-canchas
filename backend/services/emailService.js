const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.resend.com',
  port: 587,
  secure: false,
  auth: { user: 'resend', pass: process.env.RESEND_API_KEY }
});

async function enviarConfirmacionReserva(email, datos) {
  const { nombre, codigo, cancha, fecha, horaInicio, horaFin, monto } = datos;
  await transporter.sendMail({
    from: 'Pacific Sport Center <onboarding@resend.dev>',
    to: email,
    subject: 'Reserva confirmada - ' + codigo,
    html: '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><div style="background:#2d6a4f;padding:24px;border-radius:12px 12px 0 0;text-align:center"><h1 style="color:#fff;margin:0">Pacific Sport Center</h1><p style="color:#b7e4c7;margin:6px 0 0">Confirmacion de reserva</p></div><div style="background:#f8f9fa;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e0e0e0"><p>Hola <strong>' + nombre + '</strong>,</p><p>Tu reserva ha sido registrada exitosamente:</p><table style="width:100%;border-collapse:collapse"><tr><td style="padding:8px 0;color:#666">Codigo</td><td style="font-weight:700">' + codigo + '</td></tr><tr><td style="padding:8px 0;color:#666">Cancha</td><td>' + cancha + '</td></tr><tr><td style="padding:8px 0;color:#666">Fecha</td><td>' + fecha + '</td></tr><tr><td style="padding:8px 0;color:#666">Horario</td><td>' + horaInicio + ' - ' + horaFin + '</td></tr><tr><td style="padding:8px 0;color:#666">Monto</td><td style="font-weight:700;color:#2d6a4f">S/ ' + monto + '</td></tr></table><p style="font-size:13px;color:#666;margin-top:16px">Puedes cancelar o modificar con al menos 2 horas de anticipacion.</p><p style="font-size:12px;color:#999">Pacific Sport Center - Trujillo, Peru</p></div></div>'
  });
}

async function enviarCancelacionReserva(email, datos) {
  const { nombre, codigo, cancha, fecha, horaInicio, horaFin } = datos;
  await transporter.sendMail({
    from: 'Pacific Sport Center <onboarding@resend.dev>',
    to: email,
    subject: 'Reserva cancelada - ' + codigo,
    html: '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><div style="background:#c0392b;padding:24px;border-radius:12px 12px 0 0;text-align:center"><h1 style="color:#fff;margin:0">Pacific Sport Center</h1><p style="color:#fadbd8;margin:6px 0 0">Cancelacion de reserva</p></div><div style="background:#f8f9fa;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e0e0e0"><p>Hola <strong>' + nombre + '</strong>,</p><p>Tu reserva ha sido cancelada:</p><table style="width:100%;border-collapse:collapse"><tr><td style="padding:8px 0;color:#666">Codigo</td><td style="font-weight:700">' + codigo + '</td></tr><tr><td style="padding:8px 0;color:#666">Cancha</td><td>' + cancha + '</td></tr><tr><td style="padding:8px 0;color:#666">Fecha</td><td>' + fecha + '</td></tr><tr><td style="padding:8px 0;color:#666">Horario</td><td>' + horaInicio + ' - ' + horaFin + '</td></tr></table><p style="font-size:12px;color:#999;margin-top:16px">Pacific Sport Center - Trujillo, Peru</p></div></div>'
  });
}

module.exports = { enviarConfirmacionReserva, enviarCancelacionReserva };
