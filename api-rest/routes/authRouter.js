/*
 * =============================================
 * Author: Miguel Ángel Águila Morillas y Javier Orosco Torres
 * Create date: 14/02/2026
 * Description:
 *      Rutas de autenticacion.
 *      Expone el endpoint de login para validar credenciales.
 *      Devuelve al cliente el JWT y datos basicos del usuario autenticado.
 * =============================================
 */
const express = require('express');
const { login } = require('../controller/authController');

const router = express.Router();

router.post('/login', login);

module.exports = router;
