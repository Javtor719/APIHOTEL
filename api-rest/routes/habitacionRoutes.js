const express = require('express');
const router = express.Router();
const roomController =  require('../controller/roomController');
const { verifyToken, optionalVerifyToken, authorizeRoles } = require('../middleware/authMiddleware');


// Rutas para habitaciones
router.get('/', roomController.getAllRooms);

// Ruta para obtener habitaciones disponibles
router.get("/available", roomController.getAvailableRooms);

// Ruta para obtener la siguiente habitación disponible en un piso específico
router.get('/nextRoom/:floor',roomController.nextRoom);

// Ruta para escanear el código QR de una habitación
router.get('/scan/:code', optionalVerifyToken, roomController.scanRoomQr);

// Rutas para la gestión de códigos QR de habitaciones
router.get('/:id/qr', verifyToken, authorizeRoles(['Admin', 'Trabajador']), roomController.getRoomQr);

// Ruta para regenerar el código QR de una habitación
router.post('/:id/qr/regenerate', verifyToken, authorizeRoles(['Admin', 'Trabajador']), roomController.regenerateRoomQr);

// Ruta para obtener los registros de escaneo del código QR de una habitación
router.get('/:id/qr/logs', verifyToken, authorizeRoles(['Admin', 'Trabajador']), roomController.getRoomQrScanLogs);

// Rutas para calendario visual y bloqueos manuales de habitaciones
router.get('/:id/calendar', roomController.getRoomCalendar);

router.post('/:id/blocks', verifyToken, authorizeRoles(['Admin', 'Trabajador']), roomController.createRoomBlock);

router.delete('/:id/blocks/:blockId', verifyToken, authorizeRoles(['Admin', 'Trabajador']), roomController.deleteRoomBlock);

// Rutas para la gestión de habitaciones
router.get('/:id', roomController.getRoomById);

// Rutas para la gestión de habitaciones (solo para Admin y Trabajador)
router.post('/add', roomController.addRoom );

// Ruta para actualizar la información de una habitación
router.patch('/modify/:id',roomController.updateRoom );

// Ruta para eliminar una habitación
router.delete('/delete/:id',roomController.deleteRoom );

// Rutas para la gestión de imágenes de habitaciones
router.post('/add/:id/images', roomController.uploadMany, roomController.uploadRoomImages);

// Ruta para eliminar una imagen de una habitación
router.delete('/delete/:id/images', roomController.deleteRoomImage);

module.exports = router;
