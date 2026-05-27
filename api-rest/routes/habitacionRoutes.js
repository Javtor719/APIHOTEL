/*
 * =============================================
 * Author:Javier Orosco Torres
 * Create date: 21/05/2026
 * Description:
 *      Rutas de habitaciones.
 *      Gestiona listado, detalle, disponibilidad, calendario y bloqueos.
 *      Permite crear, modificar, eliminar y subir imagenes de habitaciones.
 *      Expone generacion, regeneracion, escaneo y logs de codigos QR.
 *      Protege las operaciones QR y bloqueos con JWT y roles Admin/Trabajador.
 * =============================================
 */
const express = require('express');
const roomController = require('../controller/roomController');
const { verifyToken, optionalVerifyToken, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();
const staffOnly = [verifyToken, authorizeRoles(['Admin', 'Trabajador'])];

router.get('/', roomController.getAllRooms);
router.get('/available', roomController.getAvailableRooms);
router.get('/nextRoom/:floor', roomController.nextRoom);
router.get('/scan/:code', optionalVerifyToken, roomController.scanRoomQr);
router.get('/:id/qr', staffOnly, roomController.getRoomQr);
router.post('/:id/qr/regenerate', staffOnly, roomController.regenerateRoomQr);
router.get('/:id/qr/logs', staffOnly, roomController.getRoomQrScanLogs);
router.get('/:id/calendar', roomController.getRoomCalendar);
router.post('/:id/blocks', staffOnly, roomController.createRoomBlock);
router.delete('/:id/blocks/:blockId', staffOnly, roomController.deleteRoomBlock);
router.get('/:id', roomController.getRoomById);
router.post('/add', roomController.addRoom);
router.patch('/modify/:id', roomController.updateRoom);
router.delete('/delete/:id', roomController.deleteRoom);
router.post('/add/:id/images', roomController.uploadMany, roomController.uploadRoomImages);
router.delete('/delete/:id/images', roomController.deleteRoomImage);

module.exports = router;
