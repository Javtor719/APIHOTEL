const mongoose = require('mongoose');
const BookingAuditLog = require('../models/bookingAuditLog');

/**
 * Gestión de Habitaciones:
 * - Mostar log por reserva
 * @Javtor719
 * 
 */


async function getBookingAuditLog(req, res) {
    try{
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
                    return res.status(400).json({ error: "ID de reserva no válido" });
                }
        const booking = await BookingAuditLog.findById(id);
        if (!booking) return res.status(404).json({ error: 'reserva no encontrada' });
        
        return res.status(200).json(booking);
    }catch (err) {
        return res.status(500).json({ error: 'Error al obtener reserva', detalle: err.message });
    }
}

module.exports = {
    getBookingAuditLog,
};