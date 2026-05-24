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
