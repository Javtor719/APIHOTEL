const Reservation = require('../models/reservation');

function parseDate(value) {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  function startOfHotelDay(date) {
    const d = new Date(date);
    d.setHours(12, 0, 0, 0); // 12:00 del día actual
    return d;
  }

  

  async function createReservation(req, res) {
    try {
      const { userId, roomId, checkIn, checkOut } = req.body;
  
      if (!userId || !roomId || !checkIn || !checkOut) {
        return res.status(400).json({ error: 'Faltan datos obligatorios' });
      }
  
      const inDate = parseDate(checkIn);
      const outDate = parseDate(checkOut);
  
      if (!inDate || !outDate) {
        return res.status(400).json({ error: 'Formato de fecha inválido' });
      }

      const now = new Date();
      const hotelDayStart = startOfHotelDay(now);
      
      if (inDate < hotelDayStart) {
        return res.status(400).json({ error: 'La fecha de check-in ya no es válida según el día hotelero'});
      }

  
      if (inDate >= outDate) {
        return res.status(400).json({
          error: 'La fecha de check-out debe ser posterior al check-in'
        });
      }
        const overlap = await Reservation.findOne({
        roomId,
        status: { $ne: 'cancelada' },
        checkIn: { $lt: outDate },
        checkOut: { $gt: inDate }
      });
  
      if (overlap) {
        return res.status(409).json({
          error: 'La habitación no está disponible en esas fechas'
        });
      }
  
      const reservation = new Reservation({
        userId,
        roomId,
        checkIn: inDate,
        checkOut: outDate
      });
  
      await reservation.save();
      res.status(201).json(reservation);
  
    } catch (err) {
      res.status(500).json({
        error: 'Error al crear la reserva',
        detalle: err.message
      });
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
  
    reservation.status = 'checkout';
    await reservation.save();
  
    res.json(reservation);
  }

  module.exports = {
    createReservation,
    listReservations,
    getReservation,
    cancelReservation,
    checkIn,
    checkOut
  };
  
  
