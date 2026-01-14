const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, required: true },
    status: {
      type: String,
      enum: ['confirmada', 'cancelada', 'checkin', 'checkout'],
      default: 'confirmada'
    }
  });

const Reservation = mongoose.model('Reservation',reservationSchema);
module.exports = Reservation;
