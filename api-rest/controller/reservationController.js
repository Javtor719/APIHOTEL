const Reservation = require('../models/reservation');
const mongoose = require('mongoose');
const Room = require('../models/rooms');
const { userDatabaseModel } = require('../models/user');

/**
 * Convierte un valor a Date, retorna null si es inválido
 */
function parseDate(value) {
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Normaliza la fecha al inicio del día hotelero (12:00)
 */
function startOfHotelDay(date) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  return d;
}

/**
 * Obtiene las habitaciones y construye snapshot + datos de auditoría
 */
async function buildAuditData(reservation, actorUser) {
  const roomsFound = await Room.find({ _id: { $in: reservation.roomIds } });
  const reservationUser = await userDatabaseModel.findById(reservation.userId);

  const roomsSnapshot = roomsFound.map(room => ({
    roomId: room._id,
    numRoom: room.numRoom,
    roomType: room.roomType,
  }));

  return {
    reservation,
    actorId: actorUser ? actorUser.id : reservation.userId,
    actorType: actorUser ? actorUser.rol : reservationUser ? reservationUser.rol : undefined,
    roomsSnapshot,
  };
}

/**
 * Valida las fechas de check-in y check-out
 */
function validateDates(inDate, outDate) {
  if (!inDate || !outDate || inDate >= outDate) {
    return { valid: false, error: 'Fechas inválidas' };
  }

  const today = startOfHotelDay(new Date());
  if (inDate < today) {
    return { valid: false, error: 'La fecha de entrada no puede ser anterior a hoy.' };
  }

  if (outDate <= today) {
    return { valid: false, error: 'La fecha de salida debe ser posterior a hoy.' };
  }

  return { valid: true };
}

/**
 * Verifica disponibilidad de habitaciones en fechas dadas
 */
async function checkAvailability(roomIds, checkIn, checkOut, excludeReservationId = null) {
  const query = {
    status: { $ne: 'cancelada' },
    roomIds: { $in: roomIds },
    $or: [
      {
        checkIn: { $lt: checkOut },
        checkOut: { $gt: checkIn },
      },
    ],
  };

  if (excludeReservationId) {
    query._id = { $ne: excludeReservationId };
  }

  const overlap = await Reservation.findOne(query);
  return !overlap;
}

/**
 * Calcula el precio total considerando descuentos VIP
 */
async function calculatePrice(roomIds, checkIn, checkOut, userId) {
  const roomsFound = await Room.find({ _id: { $in: roomIds } });

  if (roomsFound.length !== roomIds.length) {
    return null;
  }

  const diffInMs = checkOut.getTime() - checkIn.getTime();
  const nights = Math.ceil(diffInMs / (1000 * 60 * 60 * 24));

  const pricePerNightTotal = roomsFound.reduce(
    (total, room) => total + (room.pricePerNight || 0),
    0
  );
  let finalPrice = pricePerNightTotal * nights;

  const user = await userDatabaseModel.findById(userId);
  if (user && user.vipStatus === true) {
    finalPrice = finalPrice * 0.8; // 20% descuento VIP
  }

  return finalPrice;
}

/**
 * Genera el siguiente número de reserva único (formato: 00001, 00002, etc.)
 */
async function generateReservationNumber() {
  try {
    // Buscar la reserva con el número más alto
    const lastReservation = await Reservation.findOne()
      .sort({ createdAt: -1 })
      .select('reservationNumber');
    
    if (!lastReservation || !lastReservation.reservationNumber) {
      return '00001';
    }

    const lastNumber = parseInt(lastReservation.reservationNumber, 10);
    const nextNumber = lastNumber + 1;
    
    // Formato con 5 dígitos (00001 a 99999)
    return String(nextNumber).padStart(5, '0');
  } catch (err) {
    console.error('Error generando número de reserva:', err);
    throw err;
  }
}

/**
 * POST /reservations/add
 * Crea una nueva reserva con validaciones de disponibilidad y precios
 */
async function createReservation(req, res, next) {
  try {
    const { userId, roomIds, checkIn, checkOut, numGuests } = req.body;
    //Validaciones básicas
    if (!userId || !roomIds || !Array.isArray(roomIds) || roomIds.length === 0) {
      return res.status(400).json({ error: 'Debes seleccionar al menos una habitación' });
    }

    // Parsear y normalizar fechas
    const inDateRaw = parseDate(checkIn);
    const outDateRaw = parseDate(checkOut);

    if (!inDateRaw || !outDateRaw) {
      return res.status(400).json({ error: 'Fechas inválidas' });
    }

    const inDate = startOfHotelDay(inDateRaw);
    const outDate = startOfHotelDay(outDateRaw);

    // Validar rango de fechas
    const dateValidation = validateDates(inDate, outDate);
    if (!dateValidation.valid) {
      return res.status(400).json({ error: dateValidation.error });
    }

    // Verificar disponibilidad
    const isAvailable = await checkAvailability(roomIds, inDate, outDate);
    if (!isAvailable) {
      return res.status(409).json({
        error: 'Una o más habitaciones no están disponibles en estas fechas.',
      });
    }

    // Calcular precio
    const finalPrice = await calculatePrice(roomIds, inDate, outDate, userId);
    if (finalPrice === null) {
      return res.status(404).json({ error: 'Una o más habitaciones no existen.' });
    }

    // Generar número de reserva único
    const reservationNumber = await generateReservationNumber();

    // Crear reserva
    const reservation = new Reservation({
      reservationNumber,
      userId,
      roomIds,
      checkIn: inDate,
      checkOut: outDate,
      totalPrice: finalPrice,
      numGuests,
    });

    await reservation.save();

    // Preparar datos para auditoría
    req.audit = await buildAuditData(reservation, req.user);

    next();
  } catch (err) {
    console.error('Error al crear reserva:', err);
    return res.status(500).json({ error: 'Error interno' });
  }
}


/**
 * GET /reservations
 * Retorna todas las reservas ordenadas por fecha de entrada
 */
async function listReservations(req, res) {
  try {
    const reservations = await Reservation.find().sort({ checkIn: 1 });
    res.status(200).json(reservations);
  } catch (err) {
    console.error('Error al listar reservas:', err);
    res.status(500).json({ error: 'Error al listar reservas' });
  }
}

/**
 * GET /reservations/:id
 * Retorna una reserva por ID
 */
async function getReservation(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const reservation = await Reservation.findById(id);
    if (!reservation) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    res.status(200).json(reservation);
  } catch (err) {
    console.error('Error al obtener reserva:', err);
    res.status(500).json({ error: 'Error al obtener reserva' });
  }
}

/**
 * GET /reservations/my-reservations
 * Retorna todas las reservas del usuario autenticado
 */
async function getUserReservations(req, res) {
  try {
    const userId = req.user.id;
    const myReservations = await Reservation.find({ userId }).populate('roomIds');

    res.status(200).json(myReservations);
  } catch (err) {
    console.error('Error al obtener reservas del usuario:', err);
    res.status(500).json({ error: 'Error al obtener tus reservas' });
  }
}

/**
 * PATCH /reservations/:id/cancel
 * Cambia el estado de una reserva a "cancelada"
 */
async function cancelReservation(req, res, next) {
  try {
    const { id } = req.params;

    // Validar ID
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    // Obtener reserva actual
    const reservation = await Reservation.findById(id);
    if (!reservation) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    // Validar estado
    if (reservation.status === 'cancelada') {
      return res.status(400).json({ error: 'La reserva ya está cancelada' });
    }

    // Actualizar estado
    const updatedReservation = await Reservation.findByIdAndUpdate(
      id,
      { status: 'cancelada' },
      { new: true, runValidators: false }
    );

    const targetReservation = updatedReservation || reservation;

    // Preparar datos para auditoría
    req.audit = await buildAuditData(targetReservation, req.user);

    next();
  } catch (err) {
    console.error('Error al cancelar reserva:', err);
    res.status(500).json({ error: 'Error al cancelar reserva' });
  }
}

/**
 * PATCH /reservations/:id/checkin
 * Registra el check-in de una reserva (confirmada -> checkIn)
 */
async function checkIn(req, res, next) {
  try {
    const { id } = req.params;

    // Validar ID
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    // Obtener reserva actual
    const reservation = await Reservation.findById(id);
    if (!reservation) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    // Validar estado
    if (reservation.status !== 'confirmada') {
      return res.status(400).json({
        error: 'Solo se puede hacer check-in a reservas confirmadas',
      });
    }

    // Actualizar estado
    const updatedReservation = await Reservation.findByIdAndUpdate(
      id,
      { status: 'checkIn' },
      { new: true, runValidators: false }
    );

    const targetReservation = updatedReservation || reservation;

    // Preparar datos para auditoría
    req.audit = await buildAuditData(targetReservation, req.user);

    next();
  } catch (err) {
    console.error('Error al hacer check-in:', err);
    res.status(500).json({ error: 'Error al hacer check-in' });
  }
}

/**
 * PATCH /reservations/:id/checkout
 * Registra el check-out de una reserva (checkIn -> checkOut)
 */
async function checkOut(req, res, next) {
  try {
    const { id } = req.params;

    // Validar ID
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    // Obtener reserva actual
    const reservation = await Reservation.findById(id);
    if (!reservation) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    // Actualizar estado
    const updatedReservation = await Reservation.findByIdAndUpdate(
      id,
      { status: 'checkOut' },
      { new: true, runValidators: false }
    );

    const targetReservation = updatedReservation || reservation;

    // Preparar datos para auditoría
    req.audit = await buildAuditData(targetReservation, req.user);

    next();
  } catch (err) {
    console.error('Error al hacer check-out:', err);
    res.status(500).json({ error: 'Error al hacer check-out' });
  }
}

/**
 * DELETE /reservations/:id
 * Elimina una reserva (hard delete)
 */
async function deleteReservation(req, res) {
  try {
    const { id } = req.params;

    // Validar ID
    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    // Obtener reserva
    const reservation = await Reservation.findById(id);
    if (!reservation) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    // Eliminar
    await Reservation.findByIdAndDelete(id);

    res.status(200).json({ message: 'Reserva eliminada correctamente' });
  } catch (err) {
    console.error('Error al eliminar reserva:', err);
    res.status(500).json({ error: 'Error al eliminar reserva' });
  }
}

module.exports = {
  parseDate,
  startOfHotelDay,
  createReservation,
  listReservations,
  getReservation,
  getUserReservations,
  cancelReservation,
  checkIn,
  checkOut,
  deleteReservation,
};
