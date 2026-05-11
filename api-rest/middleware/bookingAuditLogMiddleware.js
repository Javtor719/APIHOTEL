const mongoose = require('mongoose');
const BookingAuditLog = require('../models/bookingAuditLog');
async function addBookingAuditLog(req,res,next){
    try{
        
        const reservation = req.audit.reservation;

        await BookingAuditLog.create({
            bookingId: reservation.id,
            action: "confirmada",
            actorId: req.user.id,
            actorType: req.user.rol,
            previousState: null,
            newState: reservation.toObject()                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   ,
        });

        return res.status(201).json(reservation);
    }catch (err) {
        return res.status(500).json({ error: 'Error al crear audotoría de  reserva', detalle: err.message });
    }
}

async function updateBookingAuditLog(req,res, next){
    try{
            const updatedReservation = req.audit.reservation;
            if(updatedReservation.req.status !== 'checkIn')
            {
                await BookingAuditLog.create({
                bookingid: reservation.id,
                action: "checkIn",
                actorId: req.user.id,
                actorType: req.user.rol,
                previousTtate: updatedReservation.req.new_state,
                newState: updatedReservation.toObject()
                });
            }else if (updatedReservation.req.status !== 'checkOut'){
                await BookingAuditLog.create({
                bookingId: reservation.id,
                action: "checkOut",
                actorId: req.user.id,
                actorType: req.user.rol,
                previousState: updatedReservation.req.new_state,
                newState: updatedReservation.toObject()
                });
            } else{
                await BookingAuditLog.create({
                bookingId: reservation.id,
                action: "cancelada",
                actorId: req.user.id,
                actorType: req.user.rol,
                previousState: updatedReservation.req.new_state,
                newState: updatedReservation.toObject()
                });
            }                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           

            return res.status(201).json(updatedReservation);
        
    }catch (err) {
        return res.status(500).json({ error: 'Error al actualizar audotoría de reserva', detalle: err.message });
    }
}

module.exports = {
    addBookingAuditLog,
    updateBookingAuditLog
};