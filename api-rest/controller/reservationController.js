const Reservation = require('../models/reservation');
const mongoose = require('mongoose');
const Room = require('../models/rooms'); 

function parseDate(value) {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
}

function startOfHotelDay(date) {
    const d = new Date(date);
    d.setHours(12, 0, 0, 0); // 12:00 del día hotelero
    return d;
}

async function createReservation(req, res) {
  try {
    const { userId, roomIds, checkIn, checkOut, numGuests } = req.body;
    //Validaciones básicas
    if (!userId || !roomIds || !Array.isArray(roomIds) || roomIds.length === 0) {
      return res.status(400).json({ error: 'Debes seleccionar al menos una habitación' });
    }

    const inDateRaw = parseDate(checkIn);
    const outDateRaw = parseDate(checkOut);

    if (!inDateRaw || !outDateRaw) {
      return res.status(400).json({ error: 'Fechas inválidas' });
    }

    const inDate = startOfHotelDay(inDateRaw);
    const outDate = startOfHotelDay(outDateRaw);

    if (!inDate || !outDate || inDate >= outDate) {
      return res.status(400).json({ error: 'Fechas inválidas' });
    }

    //Buscamos colisiones
    const overlap = await Reservation.findOne({
      status: { $ne: 'cancelada' },
      roomIds: { $in: roomIds }, 
      $or: [
        { checkIn: { $lt: outDate, $gte: inDate } },
        { checkOut: { $gt: inDate, $lte: outDate } },
        { checkIn: { $lte: inDate }, checkOut: { $gte: outDate } }
      ]
    });

    if (overlap) {
      return res.status(409).json({
        error: 'Una o más habitaciones no están disponibles en estas fechas.'
      });
    }

    //---Cálculo del Precio---
    // Obtenemos los documentos de las habitaciones para traer sus precios
    const roomsFound = await Room.find({ _id: { $in: roomIds } });
    
    if (roomsFound.length !== roomIds.length) {
      return res.status(404).json({ error: 'Una o más habitaciones no existen.' });
    }

    // Calcular número de noches
    const diffInMs = outDate.getTime() - inDate.getTime();
    const nights = Math.ceil(diffInMs / (1000 * 60 * 60 * 24));

    // Sumar el precio por noche de todas las habitaciones seleccionadas
    const pricePerNightTotal = roomsFound.reduce((total, room) => total + (room.pricePerNight || 0), 0);
    const finalPrice = pricePerNightTotal * nights;

    // 3. Crear la reserva (añadiendo totalPrice)
    const reservation = new Reservation({
      userId,
      roomIds, 
      checkIn: inDate,
      checkOut: outDate,
      totalPrice: finalPrice,
      numGuests: numGuests 
    });

    await reservation.save();
    return res.status(201).json(reservation);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno' });
  }
}


  async function listReservations(req, res) {
    const reservations = await Reservation
      .find()
      .sort({ checkIn: 1 });
  
    res.json(reservations);
  }
  
  async function getReservation(req, res) {
    const { id } = req.params;
  
    const reservation = await Reservation.findById(id);
    if (!reservation) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }
  
    res.json(reservation);
  }

  async function getUserReservations(req, res) {
    try {
        
        const userId = req.user.id; 
        const myReservations = await Reservation.find({ userId: userId })
                                                .populate('roomIds');
        res.status(200).json(myReservations);
    } catch (err) {
        res.status(500).json({ error: "Error al obtener tus reservas" });
    }
}
    
 async function cancelReservation(req, res) {
    const { id } = req.params;

    // Buscamos la reserva primero para validar su estado actual
    const reservation = await Reservation.findById(id);
    if (!reservation) {
        return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    if (reservation.status === 'cancelada') {
        return res.status(400).json({ error: 'La reserva ya está cancelada' });
    }

    // Usamos findByIdAndUpdate para evitar que la falta de numGuests en registros viejos bloquee el guardado
    const updatedReservation = await Reservation.findByIdAndUpdate(
        id,
        { status: 'cancelada' },
        { new: true, runValidators: false } 
    );

    res.json(updatedReservation);
}

async function checkIn(req, res) {
    const { id } = req.params;

    const reservation = await Reservation.findById(id);
    if (!reservation) {
        return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    if (reservation.status !== 'confirmada') {
        return res.status(400).json({
            error: 'Solo se puede hacer check-in a reservas confirmadas'
        });
    }

    // Actualización directa para saltar validaciones de campos obligatorios faltantes
    const updatedReservation = await Reservation.findByIdAndUpdate(
        id,
        { status: 'terminada' },
        { new: true, runValidators: false }
    );

    res.json(updatedReservation);
}

async function checkOut(req, res) {
    const { id } = req.params;

    const reservation = await Reservation.findById(id);
    if (!reservation) {
        return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    // Actualización directa
    const updatedReservation = await Reservation.findByIdAndUpdate(
        id,
        { status: 'terminada' },
        { new: true, runValidators: false }
    );

    res.json(updatedReservation);
}

  async function deleteReservation(req, res) {
    try {
      const { id } = req.params;
  
      if (!id || !mongoose.isValidObjectId(id)) {
        return res.status(400).json({ error: 'ID inválido' });
      }
  
      const reservation = await Reservation.findById(id);
  
      if (!reservation) {
        return res.status(404).json({ error: 'Reserva no encontrada' });
      }
  
      await Reservation.findByIdAndDelete(id);
  
      return res.status(200).json({ message: 'Reserva eliminada correctamente' });
    } catch (err) {
      console.error('Error al eliminar reserva:', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
  

  module.exports = {
    createReservation,
    listReservations,
    getReservation,
    getUserReservations,
    cancelReservation,
    checkIn,
    checkOut,
    deleteReservation,
    parseDate,
    startOfHotelDay
  };
  
  
