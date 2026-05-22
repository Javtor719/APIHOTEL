const express = require('express');
const router = express.Router();
const reservationController = require('../controller/reservationController');
const { verifyToken ,authorizeRoles } = require('../middleware/authMiddleware.js');
const { addBookingAuditLog, updateBookingAuditLog } = require('../middleware/bookingAuditLogMiddleware.js');    

//Add reservation (emp, admin, usuario)
router.post('/add', verifyToken, reservationController.createReservation, addBookingAuditLog);

//Delete reservation (emp,admin)
router.delete('/delete/:id', verifyToken, reservationController.deleteReservation);

//Cancelar reserva
router.patch('/cancel/:id', verifyToken, reservationController.cancelReservation, updateBookingAuditLog);

//List reservation (emp,admin)
router.get('/',reservationController.listReservations);

// Obtener reservas de un user
router.get('/my-reservations', verifyToken, authorizeRoles(['Usuario']), reservationController.getUserReservations);

// Generar / descargar factura PDF
router.get('/:id/invoice', verifyToken, reservationController.getInvoicePDF);

// Obtener datos para factura (sin generar PDF)
router.get('/:id/invoice-data', verifyToken, reservationController.getInvoiceData);

// Generar / descargar factura PDF (POST para enviar datos adicionales si es necesario)
router.post('/:id/invoice', verifyToken, reservationController.getInvoicePDF);

// Historial de facturas por userId
router.get('/invoices', verifyToken, reservationController.getInvoicesByUser);

// Obtener reserva por ID
router.get('/:id', reservationController.getReservation);

// Enviar factura por email
router.post('/:id/invoice-email', verifyToken, reservationController.sendInvoiceEmail);

// Check-in
router.patch('/:id/checkin', verifyToken, reservationController.checkIn, updateBookingAuditLog);

// Check-out
router.patch('/:id/checkout', verifyToken, reservationController.checkOut, updateBookingAuditLog);

module.exports = router;