/*
 * =============================================
 * Author:Javier Orosco Torres
 * Create date: 21/05/2026
 * Description:
 *      Modelo Mongoose para habitaciones del hotel.
 *      Define numero de habitacion, planta, tipo, descripcion, imagenes,
 *      precio, ocupacion maxima, disponibilidad y servicios incluidos.
 *      Guarda la version del QR para poder invalidar codigos antiguos.
 * =============================================
 */
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const RoomSchema = new Schema({
  numRoom: { type: Number, unique: true, required: true, min: 101, max: 799 },
  numFloor: { type: Number, required: true, min: 1, max: 7 },
  roomType: { type: String, enum: ['single', 'double', 'triple', 'fourfold'], required: true },
  description: { type: String, trim: true },
  image: [{ type: String }],
  pricePerNight: { type: Number, min: 1, required: true },
  maxOccupancy: { type: Number, min: 1, max: 4, required: true },
  availability: { type: String, enum: ['available', 'unavailable', 'block'], required: true },
  qrVersion: { type: Number, default: 1, min: 1 },
  services: {
    type: [String],
    enum: ['wifi', 'parking', 'gym', 'towels', 'smoke', 'crib'],
    default: [],
  },
});

const Room = mongoose.model('Room', RoomSchema);
module.exports = Room;
