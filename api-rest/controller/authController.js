const { SignJWT } = require ('jose');
const { comparePassword } =  require("../services/password.service.js");
const { userDatabaseModel } = require('../models/user.js');
const { JWT_SECRET } = require('../middleware/authMiddleware');

async function login(req, res) {
  try {
    const { email, password } = req.body;

    const user = await userDatabaseModel
      .findOne({ email })
      .select('+password');

    if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

    const ok = await comparePassword(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });

    const token = await new SignJWT({
      id: String(user._id),
      rol: user.rol,
      vipStatus: user.vipStatus
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(JWT_SECRET);

    res.json({ token, rol: user.rol });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
}


module.exports ={
    login
}