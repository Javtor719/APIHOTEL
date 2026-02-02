const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, required: true },
    status: {
      type: String,
      enum: ['confirmada', 'terminada','cancelada', 'checkin'],
      default: 'confirmada'
    }
  });

const Reservation = mongoose.model('Reservations',reservationSchema);
module.exports = Reservation;
