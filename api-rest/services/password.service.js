/*
 * =============================================
 * Author: Miguel Ángel Águila Morillas y Javier Orosco Torres
 * Create date: 11/02/2026
 * Description:
 *      Servicio de seguridad para contrasenas.
 *      Valida que la contrasena recibida no este vacia.
 *      Genera hashes con bcryptjs usando un coste fijo.
 *      Compara contrasenas en texto plano contra hashes almacenados.
 * =============================================
 */
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

async function hashPassword(password) {
  if (typeof password !== 'string' || password.trim().length === 0) {
    throw new Error('Contrasena no puede estar vacia.');
  }

  return bcrypt.hash(password, SALT_ROUNDS);
}

async function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

module.exports = {
  hashPassword,
  comparePassword,
};
