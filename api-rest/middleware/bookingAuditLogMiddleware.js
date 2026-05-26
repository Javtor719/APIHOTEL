/*
 * =============================================
 * Author:  Javier Orosco Torres
 * Create date: 21/05/2026
 * Description:
 *      Middleware de auditoria para reservas.
 *      Recibe en req.audit la reserva, actor y snapshot de habitaciones.
 *      Registra el estado inicial al crear una reserva.
 *      Registra cambios de estado como check-in, check-out, cancelacion
 *      o facturacion conservando el estado anterior.
 * =============================================
 */
const BookingAuditLog = require('../models/bookingAuditLog');

async function addBookingAuditLog(req, res) {
  try {
    const { reservation, actorId, actorType, roomsSnapshot } = req.audit;

    await BookingAuditLog.create({
      bookingId: reservation.id,
      action: reservation.status,
      actorId,
      actorType,
      previousState: null,
      newState: {
        rooms: roomsSnapshot,
        comentario: `Reserva No ${reservation.reservationNumber} se ha creado`,
        checkIn: reservation.checkIn,
        checkOut: reservation.checkOut,
        guest: reservation.numGuests,
        status: reservation.status,
      },
    });

    return res.status(201).json(reservation);
  } catch (err) {
    return res.status(500).json({
      error: 'Error al crear auditoria de reserva',
      detalle: err.message,
    });
  }
}

async function updateBookingAuditLog(req, res) {
  try {
    const { reservation, actorId, actorType, roomsSnapshot } = req.audit;
    const previousLog = await BookingAuditLog
      .findOne({ bookingId: reservation.id })
      .sort({ timestamp: -1 });

    let changes = `Reserva: ${reservation.status}`;
    if (reservation.status === 'checkIn') {
      changes = 'Reserva se ha registrado check-in';
    } else if (reservation.status === 'checkOut') {
      changes = 'Reserva se ha registrado check-out';
    } else if (reservation.status === 'cancelada') {
      changes = 'Reserva se ha cancelado';
    } else if (reservation.status === 'facturada') {
      changes = 'Reserva se ha facturado';
    }

    const createdLog = await BookingAuditLog.create({
      bookingId: reservation.id,
      action: reservation.status,
      actorId,
      actorType,
      previousState: previousLog ? previousLog.newState : null,
      newState: {
        rooms: roomsSnapshot,
        comentario: changes,
        checkIn: reservation.checkIn,
        checkOut: reservation.checkOut,
        guest: reservation.numGuests,
        status: reservation.status,
      },
    });

    return res.status(201).json(createdLog);
  } catch (err) {
    return res.status(500).json({
      error: 'Error al actualizar auditoria de reserva',
      detalle: err.message,
    });
  }
}

module.exports = {
  addBookingAuditLog,
  updateBookingAuditLog,
};
