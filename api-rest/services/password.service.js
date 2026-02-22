const bcrypt = require('bcryptjs');
const SALT_ROUNDS = 12;
/**
 * Hasheado de la contraseña
 * 
 * @async
 * @function hashPassword
 * 
 * @param {string} password
 * @description
 * Recibe la contraseña y realiza validaciones
 * Si pasa las validaciones encripta la contraseña y la devuelve 
 */
async function hashPassword(password) {
    if (typeof password !== 'string' || password.trim().length === 0) throw new Error('Contraseña no puede estar vacia.');
    return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Comparación de contraseñas
 * 
 * @function comparePassword
 * @async
 * 
 * @description
 * Recibe una contraseña en texto plano y un hash
 * Compara la contraseña con el hash y devuelve true si coinciden o false si no
 * 
 * @param {string} plain 
 * @param {string} hash 
 * @returns 
 */
async function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

module.exports = {
  hashPassword,
  comparePassword
};