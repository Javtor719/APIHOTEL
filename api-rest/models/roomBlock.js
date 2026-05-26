/*
 * =============================================
 * Author:Javier Orosco Torres
 * Create date: 21/05/2026
 * Description:
 *      Modelo Mongoose para bloqueos manuales de habitaciones.
 *      Guarda rango de fechas, motivo y usuario creador del bloqueo.
 *      Indexa habitacion y fechas para consultar solapes rapidamente.
 * =============================================
 */
const mongoose = require('mongoose');

const roomBlockSchema = new mongoose.Schema({
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    reason: { type: String, trim: true, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, {
    timestamps: true
});

roomBlockSchema.index({ roomId: 1, startDate: 1, endDate: 1 });

const RoomBlock = mongoose.model('RoomBlock', roomBlockSchema);
module.exports = RoomBlock;
