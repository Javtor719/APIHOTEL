/*
 * =============================================
 * Author: Miguel Ángel Águila Morillas y Javier Orosco Torres
 * Create date: 14/02/2026
 * Description:
 *      Controlador de autenticacion.
 *      Busca el usuario por email incluyendo la contrasena hasheada.
 *      Compara la contrasena recibida con bcrypt.
 *      Genera un JWT con id, rol y estado VIP.
 *      Devuelve token y datos basicos para iniciar sesion en el cliente.
 * =============================================
 */
const { SignJWT } = require('jose');
const { comparePassword } = require('../services/password.service');
const { userDatabaseModel } = require('../models/user');
const { JWT_SECRET } = require('../middleware/authMiddleware');

async function login(req, res) {
  try {
    const { email, password } = req.body;
    const user = await userDatabaseModel.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    const ok = await comparePassword(password, user.password);
    if (!ok) {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    const token = await new SignJWT({
      id: String(user._id),
      rol: user.rol,
      vipStatus: user.vipStatus,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(JWT_SECRET);

    return res.json({
      token,
      rol: user.rol,
      userId: String(user._id),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error del servidor' });
  }
}

module.exports = {
  login,
};
