const express = require('express');
const router = express.Router();
const reservationController = require('../controller/reservationController');

//Add reservation (emp, admin)
router.post('/add', reservationController.createReservation);

//Delete reservation (emp,admin)
router.delete('/delete/:id', reservationController.cancelReservation);

//List reservation (emp,admin)
router.get('/',reservationController.listReservations);
// Obtener reserva por ID
router.get('/:id', getReservation);

// Check-in
router.patch('/reservations/:id/checkin', checkIn);

// Check-out
router.patch('/reservations/:id/checkout', checkOut);

module.exports = router;