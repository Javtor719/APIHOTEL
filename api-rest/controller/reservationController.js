const Reservation = require('../models/reservation');
const mongoose = require('mongoose');
const path = require('path');
const Room = require('../models/rooms');
const { userDatabaseModel } = require('../models/user');
const BookingAuditLog = require('../models/bookingAuditLog');
const PDFDocument = require('pdfkit');
const { getNextInvoiceNumber } = require('../services/invoice.service');
const { sendMail } = require('../services/email.service');

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

async function addReservationStatusAuditLog(reservation, actorUser, comentario) {
  const { actorId, actorType, roomsSnapshot } = await buildAuditData(reservation, actorUser);
  const previousLog = await BookingAuditLog.findOne({ bookingId: reservation.id }).sort({ timestamp: -1 });

  await BookingAuditLog.create({
    bookingId: reservation.id,
    action: reservation.status,
    actorId,
    actorType,
    previousState: previousLog ? previousLog.newState : null,
    newState: {
      rooms: roomsSnapshot,
      comentario,
      checkIn: reservation.checkIn,
      checkOut: reservation.checkOut,
      guest: reservation.numGuests,
      status: reservation.status
    },
  });
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
      .sort({ reservationNumber: -1 })
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
    if (reservation.status !== 'confirmada') {
      return res.status(400).json({ error: 'Solo se pueden cancelar reservas confirmadas' });
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

    // Asignar invoiceNumber si no existe y actualizar estado a checkOut
    let invoiceNumber = reservation.invoiceNumber;
    if (!invoiceNumber) {
      invoiceNumber = await getNextInvoiceNumber();
    }

    const updatedReservation = await Reservation.findByIdAndUpdate(
      id,
      { status: 'checkOut', invoiceNumber: invoiceNumber },
      { new: true, runValidators: false }
    );

    const targetReservation = updatedReservation || Object.assign(reservation, { status: 'checkOut', invoiceNumber: invoiceNumber });

    // Preparar datos para auditoría
    req.audit = await buildAuditData(targetReservation, req.user);

    next();
  } catch (err) {
    console.error('Error al hacer check-out:', err);
    res.status(500).json({ error: 'Error al hacer check-out' });
  }
}
function drawCell(doc, x, y, w, h, label, value) {
  doc.rect(x, y, w, h).stroke();

  doc.fontSize(7)
    .text(label, x + 2, y + 2);

  doc.fontSize(8)
    .text(value, x + 2, y + 12);
}

/**
 * GET /reservations/:id/invoice-data
 * Retorna los datos necesarios para generar una factura (sin generar PDF)
 */
async function getInvoiceData(req, res) {
  const reservation = await Reservation.findById(req.params.id).populate('roomIds');
  const user = await userDatabaseModel.findById(reservation.userId);

  res.json({
    hotel: {
      name: process.env.HOTEL_NAME || 'PERE MARIA',
      address: process.env.HOTEL_ADDRESS || 'Calle Alcala 123, 03503 Benidorm\nAlicante España',
      taxId: process.env.HOTEL_TAX_ID || '78524188A',
      phone: process.env.HOTEL_PHONE || '961234567',
      email: process.env.HOTEL_EMAIL || 'reservas@hotelperemaria.com'
    },
    client: {
      name: user ? `${user.firstName || ''} ${user.lastName || ''}` : '',
      email: user?.email || '',
      city: user?.cityName || '',
      address: user?.address || '',
      dni: user?.dni || ''
    }
  });
}

/**
 * GET /bookings/:id/invoice
 * Genera un PDF al vuelo con la factura completa
 */
async function getInvoicePDF(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const reservation = await Reservation.findById(id).populate('roomIds');
    if (!reservation) return res.status(404).json({ error: 'Reserva no encontrada' });

    if (!['checkIn', 'facturada'].includes(reservation.status)) {
      return res.status(400).json({ error: 'Solo se puede facturar una reserva con check-in realizado' });
    }

    const shouldCreateInvoiceAudit = reservation.status !== 'facturada';

    // Asegurar invoiceNumber y marcar como facturada
    if (!reservation.invoiceNumber) {
      const inv = await getNextInvoiceNumber();
      reservation.invoiceNumber = inv;
    }

    if (shouldCreateInvoiceAudit) {
      reservation.status = 'facturada';
      await reservation.save();
      await addReservationStatusAuditLog(reservation, req.user, 'Reserva se ha facturado');
    } else if (reservation.isModified()) {
      await reservation.save();
    }

    const overrides = req.body || {};

    const user = await userDatabaseModel.findById(reservation.userId);

    // Datos hotel (configurables vía env)
    const hotel = {
      name: overrides.hotel?.name || process.env.HOTEL_NAME || 'PERE MARIA',
      address: overrides.hotel?.address || process.env.HOTEL_ADDRESS || 'Calle Alcala 123, 03503 Benidorm\nAlicante España',
      taxId: overrides.hotel?.taxId || process.env.HOTEL_TAX_ID || '78524188A',
      phone: overrides.hotel?.phone || process.env.HOTEL_PHONE || '961234567',
      email: overrides.hotel?.email || process.env.HOTEL_EMAIL || 'reservas@hotelperemaria.com',
    };

    const client = {
      name: overrides.client?.name || `${user.firstName || ''} ${user.lastName || ''}`,
      email: overrides.client?.email || user.email || '',
      city: overrides.client?.city || user.cityName || '',
      address: overrides.client?.address || user.address || '',
      dni: overrides.client?.dni || user.dni || '',
    };

    const room = reservation.roomIds && reservation.roomIds.length ? reservation.roomIds[0] : {};
    const roomSummary = reservation.roomIds
      .map(r => `Hab.${r.numRoom || ''} ${r.roomType || ''}`)
      .filter(Boolean)
      .join(', ');
    const roomSummaryNumber = reservation.roomIds
      .map(r => `${r.numRoom || ''}`)
      .filter(Boolean)
      .join(', ');

    // Calcular noches
    const diffInMs = reservation.checkOut.getTime() - reservation.checkIn.getTime();
    const nights = Math.ceil(diffInMs / (1000 * 60 * 60 * 24));
    const checkInText = reservation.checkIn ? reservation.checkIn.toLocaleDateString() : '';
    const checkOutText = reservation.checkOut ? reservation.checkOut.toLocaleDateString() : '';
    const taxes = parseFloat(process.env.DEFAULT_TAX || '0.21');
    const extras = 0;
    
    const hasVipDiscount = user && user.vipStatus === true;
    const vipDiscountRate = 0.20;

    let base = reservation.totalPrice;
    let discounts = 0;

    if (hasVipDiscount) {
      const originalBase = reservation.totalPrice / (1 - vipDiscountRate);
      discounts = originalBase * vipDiscountRate;
      base = originalBase;
    }

    const subtotal = base + extras - discounts;
    const taxesAmount = subtotal * taxes;
    const total = subtotal + taxesAmount

    // Crear PDF
    res.setHeader('Content-Type', 'application/pdf');
    const invoiceFileName = reservation.invoiceNumber ? reservation.invoiceNumber : `temp-${Date.now()}`;
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoiceFileName}.pdf"`);
    
    const invoiceLogoPath = path.resolve(__dirname, '../uploads/images/icono_proyecto.png');
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.pipe(res);

    try {
      doc.image(invoiceLogoPath, 70, 70, { scale: 0.15 });
    } catch (imageErr) {
      console.warn('No se pudo cargar el logo de la factura:', imageErr.message);
    }

    doc.fontSize(22).font("Helvetica-Bold").text(hotel.name, 50, 160);

    doc.fontSize(11).font("Times-Roman").text(`${hotel.address}`, 0, 190, { width: 230, align: 'center' });
    if (hotel.taxId) doc.font("Times-Roman").text(`CIF: ${hotel.taxId}`, 70, 218);
    if (hotel.phone) doc.font("Times-Roman").text(`Tel: ${hotel.phone}`, 70, 230);
    if (hotel.email) doc.font("Times-Roman").text(`Email: ${hotel.email}`, 40, 240);

    doc.roundedRect(300, 70, 250, 120, 10).stroke();
    
    doc.fontSize(15).font("Times-Bold").text('CLIENTE:', 320, 80);
    doc.fontSize(8).text(client.name, 320, 100);
    doc.fontSize(8).text(`Email: ${client.email}`, 320, 120);
    doc.fontSize(8).text(`Ciudad: ${client.city}`, 320, 140);
    doc.fontSize(8).text(`Direccion: ${client.address}`, 320, 160);
    doc.fontSize(8).text(`DNI: ${client.dni}`, 320, 180);

    drawCell(doc, 305, 200, 60, 30, 'N.HAB',roomSummaryNumber || '');
    drawCell(doc, 365, 200, 60, 30, 'Personas', reservation.numGuests);
    drawCell(doc, 425, 200, 60, 30, 'Nº de reserva', reservation.reservationNumber);

    drawCell(doc, 305, 250, 60, 30, 'F. Entrada',checkInText);
    drawCell(doc, 365, 250, 60, 30, 'F. Salida', checkOutText);
    drawCell(doc, 425, 250, 80, 30, 'Nº de factura', reservation.invoiceNumber || '');
    drawCell(doc, 505, 250, 70, 30, 'F. factura', new Date().toLocaleDateString());

    doc.rect(50, 320, 500, 25).stroke();

    doc.text('FECHAS', 60, 328);
    doc.text('DESCRIPCIÓN', 180, 328);
    doc.text('CARGOS', 380, 328);
    doc.text('ABONOS', 470, 328);

    doc.fontSize(9).text(
      `${checkInText} - ${checkOutText}`,
      50,
      360
    );

    doc.text(
      roomSummary || `Hab.${room.numRoom || ''} ${room.roomType || ''}`,
      180,
      360
    );

    doc.text(
      `${reservation.totalPrice.toFixed(2)/nights} € x ${nights} Días`,
      380,
      360
    );

    if (discounts > 0) {
      doc.text(
        `DTO VIP 20%: -${discounts.toFixed(2)} €`,
        470,
        360
      );
    }

    doc.roundedRect(40, 640, 510, 80, 10).stroke();

    doc.text(`BASE: ${base.toFixed(2)} €`, 60, 670);

    if (discounts > 0) {
      doc.text(`DTO VIP: -${discounts.toFixed(2)} €`, 60, 685);
    }

    doc.text(`IVA (${taxes * 100}%): ${taxesAmount.toFixed(2)} €`, 220, 670);

    doc.fontSize(16)
      .text(`TOTAL FACTURA: ${total.toFixed(2)} €`, 380, 670);

    const legalText =
  'En cumplimiento de lo previsto en la Ley Orgánica 15/1999, de 13 de diciembre, ' +
  'de Protección de Datos de Carácter Personal, le informamos de que los datos personales ' +
  'que pudieran figurar en esta factura serán incorporados y tratados en un fichero ' +
  'titularidad de TUREST, S.L., con la finalidad de gestionar la relación comercial y administrativa ' +
  'derivada de los servicios prestados. Asimismo, podrá ejercer sus derechos de acceso, rectificación, ' +
  'cancelación y oposición mediante escrito dirigido a TUREST, S.L., Avda. Foietes nº 6, ' + hotel.address;

    doc.fontSize(8)
    .text(
      legalText,
      50,
      740,
      { width: 500 }
    );

    doc.end();
  } catch (err) {
    console.error('Error generando factura PDF:', err); 
    res.status(500).json({ error: 'Error generando factura' });
  }
}

/**
 * GET /invoices?userId=
 * Retorna historial de facturas de un usuario
 */
async function getInvoicesByUser(req, res) {
  try {
    const { userId } = req.query;
    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ error: 'userId inválido' });
    }

    // Authorization: el propio usuario o Admin/Trabajador
    if (!req.user) return res.status(401).json({ error: 'No autenticado' });
    const allowedRoles = ['Admin', 'Trabajador'];
    if (req.user.id !== userId && !allowedRoles.includes(req.user.rol)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const invoices = await Reservation.find({ userId, status: 'facturada' }).sort({ invoiceNumber: -1 });
    res.status(200).json(invoices);
  } catch (err) {
    console.error('Error consultando facturas:', err);
    res.status(500).json({ error: 'Error consultando facturas' });
  }
}

function buildInvoiceEmailPdf({ reservation, user, roomSummary, checkInText, checkOutText, hotelName, overrides = {} }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const hotel = {
      name: overrides.hotel?.name || hotelName,
      address: overrides.hotel?.address || process.env.HOTEL_ADDRESS || 'Calle Alcala 123, 03503 Benidorm\nAlicante España',
      taxId: overrides.hotel?.taxId || process.env.HOTEL_TAX_ID || '78524188A',
      phone: overrides.hotel?.phone || process.env.HOTEL_PHONE || '961234567',
      email: overrides.hotel?.email || process.env.HOTEL_EMAIL || 'reservas@hotelperemaria.com',
    };

    const client = {
      name: overrides.client?.name || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      email: overrides.client?.email || user.email || '',
      city: overrides.client?.city || user.cityName || '',
      address: overrides.client?.address || user.address || '',
      dni: overrides.client?.dni || user.dni || '',
    };

    const room = reservation.roomIds && reservation.roomIds.length ? reservation.roomIds[0] : {};
    const roomSummaryNumber = reservation.roomIds
      .map(r => `${r.numRoom || ''}`)
      .filter(Boolean)
      .join(', ');

    const diffInMs = reservation.checkOut.getTime() - reservation.checkIn.getTime();
    const nights = Math.ceil(diffInMs / (1000 * 60 * 60 * 24));
    const taxes = parseFloat(process.env.DEFAULT_TAX || '0.21');
    const extras = 0;
    const hasVipDiscount = user && user.vipStatus === true;
    const vipDiscountRate = 0.20;

    let base = reservation.totalPrice;
    let discounts = 0;

    if (hasVipDiscount) {
      const originalBase = reservation.totalPrice / (1 - vipDiscountRate);
      discounts = originalBase * vipDiscountRate;
      base = originalBase;
    }

    const subtotal = base + extras - discounts;
    const taxesAmount = subtotal * taxes;
    const total = subtotal + taxesAmount;
    const invoiceLogoPath = path.resolve(__dirname, '../uploads/images/icono_proyecto.png');

    try {
      doc.image(invoiceLogoPath, 70, 70, { scale: 0.15 });
    } catch (imageErr) {
      console.warn('No se pudo cargar el logo de la factura:', imageErr.message);
    }

    doc.fontSize(22).font("Helvetica-Bold").text(hotel.name, 50, 160);

    doc.fontSize(11).font("Times-Roman").text(`${hotel.address}`, 0, 190, { width: 230, align: 'center' });
    if (hotel.taxId) doc.font("Times-Roman").text(`CIF: ${hotel.taxId}`, 70, 218);
    if (hotel.phone) doc.font("Times-Roman").text(`Tel: ${hotel.phone}`, 70, 230);
    if (hotel.email) doc.font("Times-Roman").text(`Email: ${hotel.email}`, 40, 240);

    doc.roundedRect(300, 70, 250, 120, 10).stroke();

    doc.fontSize(15).font("Times-Bold").text('CLIENTE:', 320, 80);
    doc.fontSize(8).text(client.name, 320, 100);
    doc.fontSize(8).text(`Email: ${client.email}`, 320, 120);
    doc.fontSize(8).text(`Ciudad: ${client.city}`, 320, 140);
    doc.fontSize(8).text(`Direccion: ${client.address}`, 320, 160);
    doc.fontSize(8).text(`DNI: ${client.dni}`, 320, 180);

    drawCell(doc, 305, 200, 60, 30, 'N.HAB', roomSummaryNumber || '');
    drawCell(doc, 365, 200, 60, 30, 'Personas', reservation.numGuests);
    drawCell(doc, 425, 200, 60, 30, 'Nº de reserva', reservation.reservationNumber);

    drawCell(doc, 305, 250, 60, 30, 'F. Entrada', checkInText);
    drawCell(doc, 365, 250, 60, 30, 'F. Salida', checkOutText);
    drawCell(doc, 425, 250, 80, 30, 'Nº de factura', reservation.invoiceNumber || '');
    drawCell(doc, 505, 250, 70, 30, 'F. factura', new Date().toLocaleDateString());

    doc.rect(50, 320, 500, 25).stroke();

    doc.text('FECHAS', 60, 328);
    doc.text('DESCRIPCIÓN', 180, 328);
    doc.text('CARGOS', 380, 328);
    doc.text('ABONOS', 470, 328);

    doc.fontSize(9).text(
      `${checkInText} - ${checkOutText}`,
      50,
      360
    );

    doc.text(
      roomSummary || `Hab.${room.numRoom || ''} ${room.roomType || ''}`,
      180,
      360
    );

    doc.text(
      `${reservation.totalPrice.toFixed(2) / nights} € x ${nights} Días`,
      380,
      360
    );

    if (discounts > 0) {
      doc.text(
        `DTO VIP 20%: -${discounts.toFixed(2)} €`,
        470,
        360
      );
    }

    doc.roundedRect(40, 640, 510, 80, 10).stroke();

    doc.text(`BASE: ${base.toFixed(2)} €`, 60, 670);

    if (discounts > 0) {
      doc.text(`DTO VIP: -${discounts.toFixed(2)} €`, 60, 685);
    }

    doc.text(`IVA (${taxes * 100}%): ${taxesAmount.toFixed(2)} €`, 220, 670);

    doc.fontSize(16)
      .text(`TOTAL FACTURA: ${total.toFixed(2)} €`, 380, 670);

    const legalText =
  'En cumplimiento de lo previsto en la Ley Orgánica 15/1999, de 13 de diciembre, ' +
  'de Protección de Datos de Carácter Personal, le informamos de que los datos personales ' +
  'que pudieran figurar en esta factura serán incorporados y tratados en un fichero ' +
  'titularidad de TUREST, S.L., con la finalidad de gestionar la relación comercial y administrativa ' +
  'derivada de los servicios prestados. Asimismo, podrá ejercer sus derechos de acceso, rectificación, ' +
  'cancelación y oposición mediante escrito dirigido a TUREST, S.L., Avda. Foietes nº 6, ' + hotel.address;

    doc.fontSize(8)
      .text(
        legalText,
        50,
        740,
        { width: 500 }
      );

    doc.end();
  });
}

/**
 * POST /reservations/:id/invoice-email
 * Envia la factura al email del cliente o al indicado en req.body.email
 */
async function sendInvoiceEmail(req, res) {
  try {
    const { id } = req.params;
    const overrides = req.body || {};

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'ID invalido' });
    }

    const reservation = await Reservation.findById(id).populate('roomIds');
    if (!reservation) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    const user = await userDatabaseModel.findById(reservation.userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario de la reserva no encontrado' });
    }

    const recipientEmail = req.body?.email || overrides.client?.email || user.email;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipientEmail)) {
      return res.status(400).json({ error: 'Email invalido' });
    }

    if (!reservation.invoiceNumber) {
      reservation.invoiceNumber = await getNextInvoiceNumber();
      await reservation.save();
    }

    const roomSummary = reservation.roomIds
      .map(room => `Hab.${room.numRoom || ''} ${room.roomType || ''}`.trim())
      .filter(Boolean)
      .join(', ');

    const checkInText = reservation.checkIn ? reservation.checkIn.toLocaleDateString() : '';
    const checkOutText = reservation.checkOut ? reservation.checkOut.toLocaleDateString() : '';
    const clientName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    const hotelName = process.env.HOTEL_NAME || 'PERE MARIA';
    const invoicePdf = await buildInvoiceEmailPdf({
      reservation,
      user,
      roomSummary,
      checkInText,
      checkOutText,
      hotelName,
      overrides
      });

    await sendMail({
      to: recipientEmail,
      subject: `Factura ${reservation.invoiceNumber} - ${hotelName}`,
      text:
        `Hola ${clientName || 'cliente'},\n\n` +
        `Factura: ${reservation.invoiceNumber}\n` +
        `Reserva: ${reservation.reservationNumber}\n` +
        `Habitaciones: ${roomSummary}\n` +
        `Entrada: ${checkInText}\n` +
        `Salida: ${checkOutText}\n` +
        `Total: ${reservation.totalPrice.toFixed(2)} EUR\n\n` +
        `Gracias por confiar en ${hotelName}.`,
      html: `
        <h2>Factura ${reservation.invoiceNumber}</h2>
        <p>Hola ${clientName || 'cliente'},</p>
        <p>Te enviamos el resumen de tu factura de ${hotelName}.</p>
        <ul>
          <li><strong>Reserva:</strong> ${reservation.reservationNumber}</li>
          <li><strong>Habitaciones:</strong> ${roomSummary}</li>
          <li><strong>Entrada:</strong> ${checkInText}</li>
          <li><strong>Salida:</strong> ${checkOutText}</li>
          <li><strong>Total:</strong> ${reservation.totalPrice.toFixed(2)} EUR</li>
        </ul>
      `,
      attachments: [
        {
          filename: `invoice-${reservation.invoiceNumber}.pdf`,
          content: invoicePdf,
          contentType: 'application/pdf',
        },
      ],
    });

    return res.status(200).json({ message: 'Factura enviada por email correctamente' });
  } catch (err) {
    console.error('Error enviando factura por email:', err);

    if (err.message && err.message.startsWith('Falta SMTP_')) {
      return res.status(500).json({ error: err.message });
    }

    return res.status(500).json({ error: 'Error enviando factura por email' });
  }
}

/**
 * DELETE /reservations/:id
 * Elimina una reserva cancelada (hard delete)
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

    if (reservation.status !== 'cancelada') {
      return res.status(400).json({ error: 'Solo se pueden eliminar reservas canceladas' });
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
  getInvoicePDF,
  getInvoicesByUser,
  sendInvoiceEmail,
  deleteReservation,
  getInvoiceData
};
