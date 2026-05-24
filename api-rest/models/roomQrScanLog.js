const mongoose = require('mongoose');

const roomQrScanLogSchema = new mongoose.Schema({
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', default: null },
    numRoom: { type: Number, default: null },
    actorId: { type: String, default: null },
    actorRole: { type: String, default: null },
    result: {
        type: String,
        enum: ['success', 'invalid', 'revoked', 'room_not_found'],
        required: true
    },
    message: { type: String, default: '' },
    codeHash: { type: String, required: true },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    scannedAt: { type: Date, default: Date.now }
});

const RoomQrScanLog = mongoose.model('RoomQrScanLog', roomQrScanLogSchema);
module.exports = RoomQrScanLog;
