/*
 * =============================================
 * Author:Javier Orosco Torres
 * Create date: 14/02/2026
 * Description:
 *      Rutas de usuarios.
 *      Permite registro publico desde la app y registro interno por personal.
 *      Protege las consultas administrativas con JWT y roles Admin/Trabajador.
 *      Expone busqueda por ID/DNI, listado general y listado por rol.
 * =============================================
 */
const express = require('express');
const {
  getOneUserByIdOrDni,
  getAllUsers,
  getUsersByRol,
  register,
} = require('../controller/userController');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();
const staffOnly = [verifyToken, authorizeRoles(['Admin', 'Trabajador'])];

router.get('/', staffOnly, getAllUsers);
router.get('/rol/:rol', staffOnly, getUsersByRol);
router.post('/getOne', staffOnly, getOneUserByIdOrDni);
router.post('/registerApp', register);
router.post('/registerEsc', staffOnly, register);

module.exports = router;
