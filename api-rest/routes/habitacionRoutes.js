const express = require('express');
const router = express.Router();
const roomController =  require('../controller/roomController');

router.get('/room', roomController.getAllRooms);
router.get('/room/:id', roomController.getRoomById);
router.post('/room', roomController.addRoom );
router.patch('/room/:id',roomController.updateRoom );
router.delete('/room/:id',roomController.deleteRoom );
router.get('/room/:id/reservations', roomController.getRoomReservations);
module.exports = router;