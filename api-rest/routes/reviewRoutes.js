const express = require('express');
const router = express.Router();
const reviewController =  require('../controller/reviewController');


router.get('/room/:roomId', reviewController.getReviewsByRoom);
router.get('/:id', reviewController.getReviewById);
router.post('/add', reviewController.addReview );
router.patch('/modify/:id',reviewController.updateReview );
router.delete('/delete/:id',reviewController.deleteReview );
module.exports = router;