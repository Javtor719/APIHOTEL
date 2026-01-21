const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const RoomSchema = new Schema({
    numRoom:{type: Number, unique: true, required: true,min:100,max:799},
    numFloor:{type:Number, required:true,min:1,max:7},
    roomType:{type:String,enum: ['single', 'double', 'triple','fourfold'], required: true},
    description:{type: String,trim: true},
    image:[{type: String}],
    pricePerNight:{type: Number, min:1, required: true},
    reviews:[{type:String}],
    maxOccupancy:{type: Number, min:1, max:4,required: true},
    availability:{type:String,enum: ['available', 'unavailable','block'], required: true}
});

const Room = mongoose.model('Room', RoomSchema);
module.exports = Room;