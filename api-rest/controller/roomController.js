const mongoose = require('mongoose');
const Room = require('../models/rooms');
const Reservation = require('../models/reservation'); 
/**
 * Gestión de Habitaciones:
 * - Crear habitación
 * - Eliminar habitación
 * - Listar reservas de una habitación por ID
 * - Modificar habitación
 * - Listar todas las habitaciones con filtros
 * - Obtener habitación por ID
 * @Javtor719
 */
//Crear habitación
async function addRoom(req, res) {
    try {
        const {
            numFloor,
            roomType,
            description,
            image,
            pricePerNight,
            reviews,
            maxOccupancy,
            availability
        } = req.body;

        if (
            numFloor===undefined||
            !roomType ||
            pricePerNight === undefined ||
            maxOccupancy === undefined ||
            !availability
        ) {
            return res.status(400).json({ error: 'Faltan datos obligatorios para crear la habitación' });
        }
        
        const numF=Number(numFloor);
        const price = Number(pricePerNight);
        const occ = Number(maxOccupancy);

        if (!Number.isFinite(numF) || numF < 1||numF>7) {
            return res.status(400).json({ error: 'El número de planta debe ser un número entre 1 y 7 ' });
        }
        if (!Number.isFinite(price) || price < 1) {
            return res.status(400).json({ error: 'El precio por noche debe ser un mayor a 0' });
        }
        if (!Number.isFinite(occ) || occ < 1 || occ > 4) {
            return res.status(400).json({ error: 'Debe de haber entre 1 y 4 huespedes' });
        }
        
        const numFloorRoom = numF * 100;
        const lastRoom= await Room.findOne({numRoom:{$gte:numFloorRoom,$lt:numFloorRoom+100}}).sort({numRoom:-1});

        let nextRoom=0;
        if(!lastRoom){
            nextRoom=numFloorRoom+1;
        }else{
            nextRoom=lastRoom.numRoom+1
            if(nextRoom>=numFloorRoom+100){
                return res.status(400).json({ error: `No se pueden crear más habitaciones en la planta ${numF}` });
            }
        }
        const newRoom = new Room({
            numRoom: nextRoom,
            numFloor:numF,
            roomType,
            description,
            image,
            pricePerNight: price,
            reviews,
            maxOccupancy: occ,
            availability
        });

        const saved = await newRoom.save();
        return res.status(201).json(saved);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ error: 'La habitación ya existe (numRoom duplicado)', key: err.keyValue });
        }

        if (err.name === 'ValidationError') {
            const errors = Object.values(err.errors).map(e => e.message);
            return res.status(400).json({ error: 'Error de validación', detalle: errors });
        }

        return res.status(500).json({ error: 'Error al crear habitación', detalle: err.message });
    }
}

//Eliminar habitación por ID
async function deleteRoom(req, res) {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ error: 'ID de habitación no válido' });
        }

        const active = await Reservation.findOne({
            roomId: id,
            status: { $in: ['confirmada', 'checkin'] }
        });

        if (active) {
            return res.status(400).json({
            error: 'No se puede borrar la habitación: tiene reservas activas'
        });
        }

        const deleted = await Room.findByIdAndDelete(id);
        if (!deleted) return res.status(404).json({ error: 'Habitación no encontrada' });

        return res.json({ message: 'Habitación eliminada', deleted });
    } catch (err) {
        return res.status(500).json({ error: 'Error al eliminar habitación', detalle: err.message });
    }
}

//Listar reservas de una habitación por ID
async function getRoomReservations(req, res) {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ error: 'ID de habitación no válido' });
        }

        const room = await Room.findById(id).select('_id numRoom roomType');
        if (!room) return res.status(404).json({ error: 'Habitación no encontrada' });

        const reservations = await Reservation.find({ roomId: id })
            .sort({ checkIn: -1 })
            .populate('userId', 'user_name email role')
            .populate('roomId', 'numRoom roomType pricePerNight');

        return res.json({
            room,
            reservations
    });
    } catch (err) {
        return res.status(500).json({ error: 'Error al listar reservas de la habitación', detalle: err.message });
    }
}

//Modificar habitación
async function updateRoom(req, res) {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ error: 'ID de habitación no válido' });
        }

        const updates = req.body;
        if (!updates || Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No hay campos para actualizar' });
        }

        const allowedFields = [
            'roomType',
            'description',
            'image',
            'pricePerNight',
            'reviews',
            'maxOccupancy',
            'availability'
        ];

        const allowUpdates = {};
        for (const key of Object.keys(updates)) {
            if (allowedFields.includes(key)) allowUpdates[key] = updates[key];
        }

        if (Object.keys(allowUpdates).length === 0) {
            return res.status(400).json({ error: 'No se han enviado campos permitidos para actualizar' });
        }

        if (allowUpdates.pricePerNight !== undefined) allowUpdates.pricePerNight = Number(allowUpdates.pricePerNight);
        if (allowUpdates.maxOccupancy !== undefined) allowUpdates.maxOccupancy = Number(allowUpdates.maxOccupancy);

        const updated = await Room.findByIdAndUpdate(id, allowUpdates, {
            new: true,
            runValidators: true 
        });

        if (!updated) return res.status(404).json({ error: 'Habitación no encontrada' });

        return res.json(updated);
    } catch (err) {
        if (err.code === 11000) {
        return res.status(409).json({ error: 'numRoom duplicado', key: err.keyValue });
        }

        if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(e => e.message);
        return res.status(400).json({ error: 'Error de validación', detalle: errors });
        }

        return res.status(500).json({ error: 'Error al actualizar habitación', detalle: err.message });
    }
}
//Obtener todas las habitaciones aplicando filtros en el query
async function getAllRooms(req, res) {
    try {
        const { roomType, availability, minPrice, maxPrice } = req.query;

        const filter = {};

        if (roomType) filter.roomType = roomType;
        if (availability) filter.availability = availability;

        if (minPrice !== undefined || maxPrice !== undefined) {
            filter.pricePerNight = {};
            if (minPrice !== undefined) filter.pricePerNight.$gte = Number(minPrice);
            if (maxPrice !== undefined) filter.pricePerNight.$lte = Number(maxPrice);
        }

        const rooms = await Room.find(filter).sort({ numRoom: 1 });
        return res.json(rooms);
    } catch (err) {
        return res.status(500).json({ error: 'Error al listar habitaciones', detalle: err.message });
    }
}

// Obtener una habitación por id
async function getRoomById(req, res) {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ error: 'ID de habitación no válido' });
        }

        const room = await Room.findById(id);
        if (!room) return res.status(404).json({ error: 'Habitación no encontrada' });

        return res.json(room);
    } catch (err) {
        return res.status(500).json({ error: 'Error al obtener habitación', detalle: err.message });
    }
}
module.exports = {
    addRoom,
    deleteRoom,
    getRoomReservations,
    updateRoom,
    getAllRooms,
    getRoomById
};
