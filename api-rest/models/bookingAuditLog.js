/*
 * =============================================
 * Author: Javier Orosco Torres
 * Create date: 21/05/2026
 * Description:
 *      Modelo Mongoose para la auditoria de reservas.
 *      Guarda la reserva afectada, accion realizada, actor responsable
 *      y el estado anterior/nuevo de la operacion.
 *      Permite reconstruir el historial de cambios de una reserva.
 * =============================================
 */
const mongoose = require('mongoose');

const bookingAuditLogSchema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reservations', required: true },
  action: {
    type: String,
    enum: ['confirmada', 'checkIn', 'checkOut', 'cancelada', 'facturada'],
    required: true,
  },
  actorId: { type: mongoose.Schema.Types.ObjectId, required: true },
  actorType: { type: String, enum: ['Admin', 'Trabajador', 'Usuario'], required: true },
  previousState: { type: Object },
  newState: { type: Object },
  timestamp: { type: Date, default: Date.now },
});

const BookingAuditLog = mongoose.model('BookingAuditLog', bookingAuditLogSchema);
module.exports = BookingAuditLog;
