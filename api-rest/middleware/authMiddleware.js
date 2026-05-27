/*
 * =============================================
 * Author: Miguel Ángel Águila Morillas y Javier Orosco Torres
 * Create date: 14/02/2026
 * Description:
 *      Middleware de autenticacion y autorizacion por JWT.
 *      Verifica tokens Bearer firmados con HS256 y adjunta el payload a req.user.
 *      Permite lectura opcional de token para endpoints publicos con contexto.
 *      Restringe rutas segun los roles permitidos por cada controlador.
 * =============================================
 */
const { jwtVerify } = require('jose');
const { TextEncoder } = require('util');

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'prueba');

async function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Token requerido' });
    }

    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'Formato de token invalido' });
    }

    const { payload } = await jwtVerify(token.trim(), JWT_SECRET, {
      algorithms: ['HS256'],
    });

    req.user = payload;
    return next();
  } catch (err) {
    console.error('JWT ERROR:', err.code, err.message);
    return res.status(401).json({ error: 'Token invalido o expirado' });
  }
}

async function optionalVerifyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return next();

    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) return next();

    const { payload } = await jwtVerify(token.trim(), JWT_SECRET, {
      algorithms: ['HS256'],
    });

    req.user = payload;
    return next();
  } catch {
    return next();
  }
}

function authorizeRoles(roles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    return next();
  };
}

module.exports = {
  verifyToken,
  optionalVerifyToken,
  authorizeRoles,
  JWT_SECRET,
};
