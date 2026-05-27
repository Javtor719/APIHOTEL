/*
 * =============================================
 * Author: Miguel Ángel Águila Morillas y Javier Orosco Torres
 * Create date: 21/05/2026
 * Description:
 *      Rutas de reservas y facturacion.
 *      Permite crear, listar, consultar, cancelar y eliminar reservas.
 *      Gestiona check-in, check-out y check-in mediante QR.
 *      Genera facturas PDF, datos de factura, historial y envio por email.
 *      Encadena middleware de auditoria en altas y cambios de estado.
 * =============================================
 */
const express = require('express');
const reservationController = require('../controller/reservationController');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');
const { addBookingAuditLog, updateBookingAuditLog } = require('../middleware/bookingAuditLogMiddleware');

const router = express.Router();

router.post('/add', verifyToken, reservationController.createReservation, addBookingAuditLog);
router.post('/qr-checkin', verifyToken, authorizeRoles(['Usuario']), reservationController.qrCheckIn);
router.delete('/delete/:id', verifyToken, reservationController.deleteReservation);
router.patch('/cancel/:id', verifyToken, reservationController.cancelReservation, updateBookingAuditLog);
router.get('/', reservationController.listReservations);
router.get('/dashboardStats', verifyToken, authorizeRoles(['Admin', 'Trabajador']), reservationController.getDashboardStats);
router.get('/my-reservations', verifyToken, authorizeRoles(['Usuario']), reservationController.getUserReservations);
router.get('/invoices', verifyToken, reservationController.getInvoicesByUser);
router.get('/:id/invoice', verifyToken, reservationController.getInvoicePDF);
router.get('/:id/invoice-data', verifyToken, reservationController.getInvoiceData);
router.post('/:id/invoice', verifyToken, reservationController.getInvoicePDF);
router.post('/:id/invoice-email', verifyToken, reservationController.sendInvoiceEmail);
router.patch('/:id/checkin', verifyToken, reservationController.checkIn, updateBookingAuditLog);
router.patch('/:id/checkout', verifyToken, reservationController.checkOut, updateBookingAuditLog);
router.get('/:id', reservationController.getReservation);

module.exports = router;
