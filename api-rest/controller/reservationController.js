const Reservation = require('../models/reservation');
const mongoose = require('mongoose');

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
    console.log('BODY RECIBIDO:', req.body);
    const { userId, roomIds, checkIn, checkOut } = req.body;

    // 1. Validaciones básicas
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

    // 2. Buscamos colisiones para TODAS las habitaciones a la vez
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

    // 3. Crear la reserva
    const reservation = new Reservation({
      userId,
      roomIds, 
      checkIn: inDate,
      checkOut: outDate
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
    
  async function cancelReservation(req, res) {
    const { id } = req.params;
  
    const reservation = await Reservation.findById(id);
    if (!reservation) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }
  
    if (reservation.status === 'cancelada') {
      return res.status(400).json({ error: 'La reserva ya está cancelada' });
    }
  
    reservation.status = 'cancelada';
    await reservation.save();
  
    res.json(reservation);
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
  
    reservation.status = 'checkin';
    await reservation.save();
  
    res.json(reservation);
  }

  async function checkOut(req, res) {
    const { id } = req.params;
  
    const reservation = await Reservation.findById(id);
    if (!reservation) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }
  
    if (reservation.status !== 'checkin') {
      return res.status(400).json({
        error: 'Solo se puede hacer check-out a una reserva en check-in'
      });
    }
  
    reservation.status = 'terminada';
    await reservation.save();
  
    res.json(reservation);
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
    cancelReservation,
    checkIn,
    checkOut,
    deleteReservation,
    parseDate,
    startOfHotelDay
  };
  
  
