/*
 * =============================================
 * Author: Javier Orosco Torres
 * Create date: 14/02/2026
 * Description:
 *      Rutas de reviews de habitaciones.
 *      Lista valoraciones por habitacion y obtiene reviews concretas.
 *      Permite crear una review autenticada asociada a una reserva.
 *      Permite modificar, eliminar y consultar review por reserva.
 * =============================================
 */
const express = require('express');
const reviewController = require('../controller/reviewController');
const { verifyToken } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/room/:roomId', reviewController.getReviewsByRoom);
router.get('/by-reservation/:reservationId', verifyToken, reviewController.getReviewByReservation);
router.get('/:id', reviewController.getReviewById);
router.post('/add', verifyToken, reviewController.addReview);
router.patch('/modify/:id', reviewController.updateReview);
router.delete('/delete/:id', reviewController.deleteReview);

module.exports = router;
