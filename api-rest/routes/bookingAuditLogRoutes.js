/*
 * =============================================
 * Author:Javier Orosco Torres
 * Create date: 21/05/2026
 * Description:
 *      Rutas de consulta de auditoria de reservas.
 *      Protege el acceso mediante JWT.
 *      Permite obtener el historial de cambios de una reserva concreta.
 * =============================================
 */
const express = require('express');
const bookingAuditLogController = require('../controller/bookingAuditLogController');
const { verifyToken } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/:id/audit', verifyToken, bookingAuditLogController.getBookingAuditLog);

module.exports = router;
