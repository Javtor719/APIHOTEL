const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
    userId:{type:String, unique:true, required:true},
    roomId: {type:String,unique:true, required:true},
    checkIn:{type:Date,required: true},
    checkOut: {type:Date,required:true},
    cancelationDate: {type:Date}
});

const Reservation = mongoose.model('Reservation',reservationSchema);
module.exports = Reservation;
