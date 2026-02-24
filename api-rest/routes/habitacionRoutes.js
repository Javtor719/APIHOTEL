const express = require('express');
const router = express.Router();
const roomController =  require('../controller/roomController');



router.get('/', roomController.getAllRooms);
router.get("/available", roomController.getAvailableRooms);
router.get('/nextRoom/:floor',roomController.nextRoom)
router.get('/:id', roomController.getRoomById);
router.post('/add', roomController.addRoom );
router.patch('/modify/:id',roomController.updateRoom );
router.delete('/delete/:id',roomController.deleteRoom );
router.post('/add/:id/images', roomController.uploadMany, roomController.uploadRoomImages);
router.delete('/delete/:id/images', roomController.deleteRoomImage);
module.exports = router;