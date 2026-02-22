const express = require('express');
const router = express.Router();
const reviewController =  require('../controller/reviewController');
const { verifyToken  } = require('../middleware/authMiddleware.js');   


router.get('/room/:roomId', reviewController.getReviewsByRoom);
router.get('/:id', reviewController.getReviewById);
router.post('/add',verifyToken, reviewController.addReview );
router.patch('/modify/:id',reviewController.updateReview );
router.delete('/delete/:id',reviewController.deleteReview );
router.get('/by-reservation/:reservationId', verifyToken, reviewController.getReviewByReservation);
module.exports = router;