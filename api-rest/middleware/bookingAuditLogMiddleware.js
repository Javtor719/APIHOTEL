const mongoose = require('mongoose');
const BookingAuditLog = require('../models/bookingAuditLog');
async function addBookingAuditLog(req,res){
    try{
        
        const {reservation,actorId,actorType,roomsSnapshot} = req.audit;

        await BookingAuditLog.create({
            bookingId: reservation.id,
            action: reservation.status,
            actorId,
            actorType,
            previousState: null,
            newState:
            {
                rooms:roomsSnapshot,
                comentario: `Reserva Nº ${reservation.reservationNumber} se ha creado`,
                checkIn: reservation.checkIn,
                checkOut: reservation.checkOut,
                guest: reservation.numGuests,
                status: reservation.status
            },
        });

        return res.status(201).json(reservation);
    }catch (err) {
        return res.status(500).json({ error: 'Error al crear audotoría de  reserva', detalle: err.message });
    }
}

async function updateBookingAuditLog(req,res){
    try{
            let changes = ""
            const {reservation,actorId,actorType,numGuests,roomsSnapshot} = req.audit;

            const preBookingAuditLog = await BookingAuditLog.findOne({ bookingId: reservation.id }).sort({ createdAt: -1 });

            if (reservation.status === 'checkIn') {
                changes = "Reserva se ha registrado check-In";
            } else if (reservation.status === 'checkOut') {
                changes = "Reserva se ha registrado check-Out";
            } else if (reservation.status === 'cancelada') {
                changes = "Reserva se ha cancelado";
            } else {
                changes = "Reserva: " + reservation.status;
            }

            const createdLog = await BookingAuditLog.create({
            bookingId: reservation.id,
            action: reservation.status,
            actorId,
            actorType,
            previousState: preBookingAuditLog ? preBookingAuditLog.newState : null,
            newState: 
                {
                    rooms:roomsSnapshot,
                    comentario: changes,
                    checkIn: reservation.checkIn,
                    checkOut: reservation.checkOut,
                    guest: reservation.numGuests,
                    status: reservation.status
                },
            });

            return res.status(201).json(createdLog);
        
    }catch (err) {
        return res.status(500).json({ error: 'Error al actualizar audotoría de reserva', detalle: err.message });
    }
}

module.exports = {
    addBookingAuditLog,
    updateBookingAuditLog
};