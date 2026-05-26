/*
 * =============================================
 * Author: Javier Orosco Torres
 * Create date: 21/05/2026
 * Description:
 *      Servicio de envio de correos mediante SMTP y Nodemailer.
 *      Lee la configuracion obligatoria desde variables de entorno.
 *      Crea el transporter bajo demanda para usar siempre la configuracion
 *      actual del proceso.
 *      Expone una funcion reutilizable para enviar HTML, texto y adjuntos.
 * =============================================
 */
const nodemailer = require('nodemailer');

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta ${name} en el entorno`);
  }
  return value;
}

function createTransporter() {
  const port = Number(process.env.SMTP_PORT || 587);

  return nodemailer.createTransport({
    host: getRequiredEnv('SMTP_HOST'),
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth: {
      user: getRequiredEnv('SMTP_USER'),
      pass: getRequiredEnv('SMTP_PASS'),
    },
  });
}

async function sendMail({ to, subject, html, text, attachments }) {
  const transporter = createTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  return transporter.sendMail({
    from,
    to,
    subject,
    html,
    text,
    attachments,
  });
}

module.exports = {
  sendMail,
};
