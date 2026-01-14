const Reservation = require('../models/reservation');

async function addReservation(req,res){
    try{
        const {userId,roomId,checkIn,checkOut} = req.body;
        if(!userId || !roomId || !checkIn|| !checkOut){
            return res.status(400).json({error: 'Faltan datos'});
        }
        

    }catch(err){
        res.status(500).json({ error: 'Error al añadir reserva', detalle: err.message });

    }
}
