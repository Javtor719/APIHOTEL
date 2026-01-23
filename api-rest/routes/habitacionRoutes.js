const express = require('express');
const router = express.Router();
const roomController =  require('../controller/roomController');

router.get('/', roomController.getAllRooms);
router.get('/:id', roomController.getRoomById);
router.post('/add', roomController.addRoom );
router.patch('/modify/:id',roomController.updateRoom );
router.delete('/delete/:id',roomController.deleteRoom );
router.get('/:id/reservations', roomController.getRoomReservations);
module.exports = router;