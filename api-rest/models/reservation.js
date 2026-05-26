/*
 * =============================================
 * Author: Miguel Ángel Águila Morillas y Javier Orosco Torres
 * Create date: 21/05/2026
 * Description:
 *      Modelo Mongoose de reservas del hotel.
 *      Relaciona usuario, habitaciones, fechas, numero de reserva,
 *      numero de factura, precio total y numero de huespedes.
 *      Controla el ciclo de vida de la reserva mediante estados validados.
 * =============================================
 */
const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
  reservationNumber: {
    type: String,
    unique: true,
    required: true,
    sparse: true,
  },
  invoiceNumber: {
    type: String,
    unique: true,
    sparse: true,
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  roomIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true }],
  checkIn: { type: Date, required: true },
  checkOut: { type: Date, required: true },
  totalPrice: { type: Number, required: true },
  numGuests: { type: Number, required: true, min: 1 },
  status: {
    type: String,
    enum: ['confirmada', 'checkIn', 'checkOut', 'eliminada', 'cancelada', 'facturada'],
    default: 'confirmada',
  },
});

const Reservation = mongoose.model('Reservations', reservationSchema);
module.exports = Reservation;
