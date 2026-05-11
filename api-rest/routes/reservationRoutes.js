const express = require('express');
const router = express.Router();
const reservationController = require('../controller/reservationController');
const { verifyToken ,authorizeRoles } = require('../middleware/authMiddleware.js');
const { addBookingAuditLog, updateBookingAuditLog } = require('../middleware/bookingAuditLogMiddleware.js');    

//Add reservation (emp, admin)
router.post('/add', reservationController.createReservation, addBookingAuditLog);

//Delete reservation (emp,admin)
router.delete('/delete/:id',reservationController.deleteReservation);

//Cancelar reserva
router.patch ('/cancel/:id', reservationController.cancelReservation, updateBookingAuditLog);

//List reservation (emp,admin)
router.get('/',reservationController.listReservations);

// Obtener reservas de un user
router.get('/my-reservations', verifyToken, authorizeRoles(['Usuario']), reservationController.getUserReservations);

// Obtener reserva por ID
router.get('/:id', reservationController.getReservation);

// Check-in
router.patch('/:id/checkin', reservationController.checkIn, updateBookingAuditLog);

// Check-out
router.patch('/:id/checkout',  reservationController.checkOut, updateBookingAuditLog);

module.exports = router;