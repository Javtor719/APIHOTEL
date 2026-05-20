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

        const auditLogs = await BookingAuditLog.find({ bookingId: id }).sort({ createdAt: -1 });
        if (!auditLogs || auditLogs.length === 0) {
            return res.status(404).json({ error: 'No se encontraron logs de auditoría para esa reserva' });
        }

        return res.status(200).json(auditLogs);
    }catch (err) {
        return res.status(500).json({ error: 'Error al obtener logs de auditoría', detalle: err.message });
    }
}

module.exports = {
    getBookingAuditLog,
};