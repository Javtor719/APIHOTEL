/*
 * =============================================
 * Author:  Javier Orosco Torres
 * Create date: 21/05/2026
 * Description:
 *      Controlador de consulta de auditoria de reservas.
 *      Valida el identificador de reserva recibido por parametro.
 *      Busca los logs asociados y los ordena del mas reciente al mas antiguo.
 *      Devuelve error controlado si no existen registros o el ID no es valido.
 * =============================================
 */
const mongoose = require('mongoose');
const BookingAuditLog = require('../models/bookingAuditLog');

async function getBookingAuditLog(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'ID de reserva no valido' });
    }

    const auditLogs = await BookingAuditLog.find({ bookingId: id }).sort({ timestamp: -1 });
    if (!auditLogs || auditLogs.length === 0) {
      return res.status(404).json({ error: 'No se encontraron logs de auditoria para esa reserva' });
    }

    return res.status(200).json(auditLogs);
  } catch (err) {
    return res.status(500).json({
      error: 'Error al obtener logs de auditoria',
      detalle: err.message,
    });
  }
}

module.exports = {
  getBookingAuditLog,
};
