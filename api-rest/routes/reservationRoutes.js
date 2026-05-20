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

// Obtener reserva por ID
router.get('/:id', reservationController.getReservation);

// Check-in
router.patch('/:id/checkin', verifyToken, reservationController.checkIn, updateBookingAuditLog);

// Check-out
router.patch('/:id/checkout', verifyToken, reservationController.checkOut, updateBookingAuditLog);

module.exports = router;