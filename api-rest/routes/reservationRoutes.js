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
router.get('/:id', reservationController.getReservation);

// Check-in
router.patch('/:id/checkin', reservationController.checkIn);

// Check-out
router.patch('/:id/checkout', reservationController.checkOut);

module.exports = router;