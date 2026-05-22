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
