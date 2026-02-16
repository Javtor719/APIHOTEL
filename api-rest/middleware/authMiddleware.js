const { jwtVerify } = require('jose');
const { TextEncoder } = require('util');

/**
 * 🔐 Clave JWT GLOBAL
 * (en producción esto va a .env)
 */
const JWT_SECRET = new TextEncoder().encode('prueba');

/**
 * Verifica JWT
 */
async function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      console.log(authHeader);
      return res.status(401).json({ error: "Token requerido" });
    }

    const [scheme, token] = authHeader.split(" ");
    if (scheme !== "Bearer" || !token)
      return res.status(401).json({ error: "Formato de token inválido" });

    const { payload } = await jwtVerify(token.trim(), JWT_SECRET, {
      algorithms: ['HS256'],
    });

    req.user = payload;
    next();
  } catch (err) {
    console.error('JWT ERROR:', err.code, err.message);
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
}

/**
 * Autorización por roles
 */
function authorizeRoles(roles = []) {
  return (req, res, next) => {
    if (!req.user)
      return res.status(401).json({ error: "No autenticado" });

    if (!roles.includes(req.user.rol))
      return res.status(403).json({ error: "No autorizado" });

    next();
  };
}

module.exports = {
  verifyToken,
  authorizeRoles,
  JWT_SECRET
};
