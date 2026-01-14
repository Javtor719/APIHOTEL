const express = require('express');
const router = express.Router();

router.get('/room', roomController.getRoom);
router.get('/room/:id', roomController.getRoomId);
router.post('/room', roomController.addRoom );
router.patch('/room/:id',roomController.updateEspecificRoom );
router.delete('/room/:id',roomController.deleteRoom );
module.exports = router;