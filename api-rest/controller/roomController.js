const mongoose = require('mongoose');
const Room = require('../models/rooms');
const Reservation = require('../models/reservation');
const RoomBlock = require('../models/roomBlock');
const { parseDate, startOfHotelDay } = require("../controller/reservationController");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const QRCode = require("qrcode");
const { createRoomQrToken, verifyRoomQrToken } = require("../services/roomQr.service");
const RoomQrScanLog = require("../models/roomQrScanLog");
const crypto = require("crypto");

function hashQrCode(code = "") {
    return crypto.createHash("sha256").update(String(code)).digest("hex");
}

async function saveQrScanLog(req, { code, room = null, result, message = "" }) {
    await RoomQrScanLog.create({
        roomId: room ? room._id : null,
        numRoom: room ? room.numRoom : null,
        actorId: req.user ? String(req.user.id) : null,
        actorRole: req.user ? req.user.rol : null,
        result,
        message,
        codeHash: hashQrCode(code),
        ip: req.ip || "",
        userAgent: req.get("user-agent") || "",
    });
}
/**
 * Gestión de Habitaciones:
 * - Crear habitación
 * - Eliminar habitación
 * - Mostrar habitaciones disponibles para un rango de fechas
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
        let services = [];
        if (req.body.services) {
            try {
                services = JSON.parse(req.body.services);
                if (!Array.isArray(services)) services = [];
            } catch {
                services = [];
            }
}
        const numFloorRoom = numF * 100;
        const lastRoom= await Room.findOne({numRoom:{$gte:numFloorRoom,$lt:numFloorRoom+100}}).sort({numRoom:-1});

        let nextRoom=0;
        if(!lastRoom){
            nextRoom=numFloorRoom+1;
        }else{
            nextRoom=lastRoom.numRoom+1
        }

        if(nextRoom>=numFloorRoom+100){
            return res.status(400).json({ error: `No se pueden crear más habitaciones en la planta ${numF}` });
        }

        const newRoom = new Room({
            numRoom: nextRoom,
            numFloor:numF,
            roomType,
            description,
            image,
            pricePerNight: price,
            maxOccupancy: occ,
            availability,
            services
        });
        
        const saved = await newRoom.save();
        return res.status(201).json({
            message: 'Habitación creada correctamente',
            id: saved._id,
            numRoom: saved.numRoom,
            numFloor: saved.numFloor
        });
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
//Darme la siguiente habitación
async function nextRoom(req,res){
    try{
        const numF = Number(req.params.floor);
        if (!Number.isFinite(numF) || numF < 1 || numF > 7) {
            return res.status(400).json({ error: "El número de planta debe ser entre 1 y 7" });
        }
        
            const numFloorRoom = numF * 100;
            const lastRoom = await Room
            .findOne({ numRoom: { $gte: numFloorRoom, $lt: numFloorRoom + 100 } })
            .sort({ numRoom: -1 });

            let nextRoom=0;
            if(!lastRoom){
                nextRoom=numFloorRoom+1;
                }else{
                nextRoom=lastRoom.numRoom+1
                
            }
            if(nextRoom>=numFloorRoom+100){
                return res.status(400).json({ error: `No se pueden crear más habitaciones en la planta ${numF}` });
            }
            return res.status(200).json( nextRoom );
    }catch (err) {
        return res.status(500).json({ error: 'Error al visualizar nueva habitacion', detalle: err.message });
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
            status: { $in: ['confirmada'] }
        });

        if (active) {
            return res.status(400).json({
            error: 'No se puede borrar la habitación: tiene reservas activas'
        });
        }

        const room = await Room.findById(id).select("image");
        if (!room) return res.status(404).json({ error: 'Habitación no encontrada' });

        const images = room.image || [];
        for (const img of images) {
            const diskPath = path.join(__dirname, "..", img); 
            fs.unlink(diskPath, () => {});
        }


        const deleted = await Room.findByIdAndDelete(id);
        if (!deleted) return res.status(404).json({ error: 'Habitación no encontrada' });
        
        return res.status(200).json({ message: 'Habitación eliminada', deleted });
    } catch (err) {
        return res.status(500).json({ error: 'Error al eliminar habitación', detalle: err.message });
    }
}

//mostrar habitaciones disponibles para un rango de fechas
async function getAvailableRooms(req, res) {
    try {
        const { checkIn, checkOut, guests } = req.query;

        if (!checkIn || !checkOut || !guests) {
            return res.status(400).json({ error: "Faltan parámetros: checkIn, checkOut y guests son obligatorios" });
        }

        const numGuests = Number(guests);
        const inRaw = parseDate(checkIn);
        const outRaw = parseDate(checkOut);

        if (!inRaw || !outRaw || !Number.isFinite(numGuests) || numGuests < 1) {
            return res.status(400).json({ error: "Datos inválidos en la petición" });
        }   

        const inDate = startOfHotelDay(inRaw);
        const outDate = startOfHotelDay(outRaw);

        if (inDate >= outDate) {
            return res.status(400).json({ error: "La fecha de entrada debe ser anterior a la de salida" });
        }

        //Buscamos qué habitaciones están ocupadas en esas fechas
        const overlapping = await Reservation.find({
            status: { $ne: "cancelada" },
            checkIn: { $lt: outDate },
            checkOut: { $gt: inDate },
        }).select("roomIds");

        const occupiedIds = new Set();
        overlapping.forEach(r => (r.roomIds || []).forEach(id => occupiedIds.add(String(id))));

        const overlappingBlocks = await RoomBlock.find({
            startDate: { $lt: outDate },
            endDate: { $gt: inDate },
        }).select("roomId");

        overlappingBlocks.forEach(block => occupiedIds.add(String(block.roomId)));

        const allRooms = await Room.find({ availability: "available" }).sort({ numRoom: 1 });
        const availableRooms = allRooms.filter(room => !occupiedIds.has(String(room._id)));

        if (availableRooms.length === 0) {
            return res.status(200).json({
            code: "NO_ROOMS",
            message: "No hay habitaciones disponibles para esas fechas.",
            guests: numGuests,
            roomsNeeded: 0,
            rooms: []
            });
        }

        const totalCapacity = availableRooms.reduce((acc, r) => acc + (Number(r.maxOccupancy) || 0), 0);

        if (totalCapacity < numGuests) {
            return res.status(200).json({
                code: "CAPACITY_IMPOSSIBLE",
                message: `Aunque reserves todas las habitaciones disponibles, solo hay capacidad para ${totalCapacity} personas y sois ${numGuests}.`,
                guests: numGuests,
                roomsNeeded: null,
                rooms: availableRooms
        });
        }

        const sortedCaps = [...availableRooms]
            .map(r => Number(r.maxOccupancy) || 0)
            .sort((a, b) => b - a);

        let sum = 0;
        let roomsNeeded = 0;
        for (const cap of sortedCaps) {
            if (sum >= numGuests) break;
            if (cap <= 0) continue;
            sum += cap;
            roomsNeeded++;
        }
        
        if (sum < numGuests) {
            return res.status(200).json({
            code: "CAPACITY_IMPOSSIBLE",
            message: `No hay combinación de habitaciones disponibles para ${numGuests} personas.`,
            guests: numGuests,
            roomsNeeded: null,
            rooms: availableRooms
            });
        }

        if (roomsNeeded <= 1) {
                return res.status(200).json({
                    code: "SUCCESS",
                    message: "Habitaciones encontradas.",
                    guests: numGuests,
                    roomsNeeded,
                    rooms: availableRooms
            });
        }           

        return res.status(200).json({
            code: "MULTIROOM_REQUIRED",
            message: `Para ${numGuests} personas necesitas mínimo ${roomsNeeded} habitaciones según las capacidades disponibles.`,
            guests: numGuests,
            roomsNeeded,
            rooms: availableRooms
        });

    } catch (err) {
        console.error("getAvailableRooms error:", err);
        return res.status(500).json({ error: "Error interno del servidor" });
    }
}

function formatCalendarDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseMonth(value) {
    if (!/^\d{4}-\d{2}$/.test(String(value || ''))) return null;

    const [yearText, monthText] = value.split('-');
    const year = Number(yearText);
    const month = Number(monthText);

    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
        return null;
    }

    return {
        start: startOfHotelDay(new Date(year, month - 1, 1)),
        end: startOfHotelDay(new Date(year, month, 1)),
    };
}

function eachCalendarDay(start, end) {
    const days = [];
    const current = new Date(start);

    while (current < end) {
        days.push(new Date(current));
        current.setDate(current.getDate() + 1);
    }

    return days;
}

function dateRangeOverlapsDay(itemStart, itemEnd, dayStart) {
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    return itemStart < dayEnd && itemEnd > dayStart;
}

async function getRoomCalendar(req, res) {
    try {
        const { id } = req.params;
        const monthData = parseMonth(req.query.month);

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ error: 'ID de habitaciÃ³n no vÃ¡lido' });
        }

        if (!monthData) {
            return res.status(400).json({ error: 'El parÃ¡metro month debe tener formato YYYY-MM' });
        }

        const room = await Room.findById(id);
        if (!room) return res.status(404).json({ error: 'HabitaciÃ³n no encontrada' });

        const reservations = await Reservation.find({
            roomIds: id,
            status: { $in: ['confirmada', 'checkIn', 'facturada'] },
            checkIn: { $lt: monthData.end },
            checkOut: { $gt: monthData.start },
        }).select('reservationNumber checkIn checkOut status');

        const blocks = await RoomBlock.find({
            roomId: id,
            startDate: { $lt: monthData.end },
            endDate: { $gt: monthData.start },
        }).sort({ startDate: 1 });

        const calendar = {};
        for (const day of eachCalendarDay(monthData.start, monthData.end)) {
            const dayReservations = reservations.filter(reservation =>
                dateRangeOverlapsDay(reservation.checkIn, reservation.checkOut, day)
            );
            const dayBlocks = blocks.filter(block =>
                dateRangeOverlapsDay(block.startDate, block.endDate, day)
            );
            const availabilityBlocked = room.availability === 'block' || room.availability === 'unavailable';

            let status = 'free';
            if (availabilityBlocked || dayBlocks.length > 0) {
                status = 'blocked';
            } else if (dayReservations.length > 0) {
                status = 'booked';
            }

            calendar[formatCalendarDate(day)] = {
                status,
                reservations: dayReservations.map(reservation => ({
                    id: reservation._id,
                    reservationNumber: reservation.reservationNumber,
                    status: reservation.status,
                    checkIn: reservation.checkIn,
                    checkOut: reservation.checkOut,
                })),
                blocks: [
                    ...(availabilityBlocked
                        ? [{
                            type: 'roomAvailability',
                            reason: room.availability === 'block' ? 'HabitaciÃ³n bloqueada' : 'HabitaciÃ³n no disponible',
                        }]
                        : []),
                    ...dayBlocks.map(block => ({
                        id: block._id,
                        reason: block.reason,
                        startDate: block.startDate,
                        endDate: block.endDate,
                    })),
                ],
            };
        }

        return res.status(200).json({
            roomId: room._id,
            numRoom: room.numRoom,
            month: req.query.month,
            availability: room.availability,
            calendar,
        });
    } catch (err) {
        return res.status(500).json({ error: 'Error al obtener calendario de habitaciÃ³n', detalle: err.message });
    }
}

async function createRoomBlock(req, res) {
    try {
        const { id } = req.params;
        const { startDate, endDate, reason, motivo } = req.body;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ error: 'ID de habitaciÃ³n no vÃ¡lido' });
        }

        const startRaw = parseDate(startDate);
        const endRaw = parseDate(endDate);
        const blockReason = reason || motivo;

        if (!startRaw || !endRaw || !blockReason) {
            return res.status(400).json({ error: 'Faltan datos obligatorios: startDate, endDate y reason/motivo' });
        }

        const blockStart = startOfHotelDay(startRaw);
        const blockEnd = startOfHotelDay(endRaw);

        if (blockStart >= blockEnd) {
            return res.status(400).json({ error: 'La fecha de inicio debe ser anterior a la fecha final' });
        }

        const room = await Room.findById(id);
        if (!room) return res.status(404).json({ error: 'HabitaciÃ³n no encontrada' });

        const activeReservation = await Reservation.findOne({
            roomIds: id,
            status: { $in: ['confirmada', 'checkIn', 'facturada'] },
            checkIn: { $lt: blockEnd },
            checkOut: { $gt: blockStart },
        }).select('reservationNumber checkIn checkOut status');

        if (activeReservation) {
            return res.status(409).json({
                error: 'No se puede bloquear: la habitaciÃ³n tiene una reserva activa en esas fechas',
                reservation: activeReservation,
            });
        }

        const existingBlock = await RoomBlock.findOne({
            roomId: id,
            startDate: { $lt: blockEnd },
            endDate: { $gt: blockStart },
        });

        if (existingBlock) {
            return res.status(409).json({
                error: 'Ya existe un bloqueo manual solapado para esas fechas',
                block: existingBlock,
            });
        }

        const block = await RoomBlock.create({
            roomId: id,
            startDate: blockStart,
            endDate: blockEnd,
            reason: blockReason,
            createdBy: req.user && req.user.id ? req.user.id : null,
        });

        return res.status(201).json({
            message: 'Bloqueo creado correctamente',
            block,
        });
    } catch (err) {
        if (err.name === 'ValidationError') {
            const errors = Object.values(err.errors).map(e => e.message);
            return res.status(400).json({ error: 'Error de validaciÃ³n', detalle: errors });
        }

        return res.status(500).json({ error: 'Error al crear bloqueo de habitaciÃ³n', detalle: err.message });
    }
}

async function deleteRoomBlock(req, res) {
    try {
        const { id, blockId } = req.params;

        if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(blockId)) {
            return res.status(400).json({ error: 'ID de habitaciÃ³n o bloqueo no vÃ¡lido' });
        }

        const deleted = await RoomBlock.findOneAndDelete({ _id: blockId, roomId: id });
        if (!deleted) return res.status(404).json({ error: 'Bloqueo no encontrado para esta habitaciÃ³n' });

        return res.status(200).json({ message: 'Bloqueo eliminado correctamente', deleted });
    } catch (err) {
        return res.status(500).json({ error: 'Error al eliminar bloqueo de habitaciÃ³n', detalle: err.message });
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

        let services = [];
        if (req.body.services) {
        try {
            services = JSON.parse(req.body.services);
            if (!Array.isArray(services)) services = [];
        } catch {
            services = [];
            }
        }

        const allowedFields = [
            'roomType',
            'description',
            'image',
            'pricePerNight',
            'maxOccupancy',
            'availability',
            'services'
        ];


        const allowUpdates = {};
        for (const key of Object.keys(updates)) {
            if (allowedFields.includes(key)) allowUpdates[key] = updates[key];
        }

        if (services !== undefined) {
            allowUpdates.services = services;
        }

        if (Object.keys(allowUpdates).length === 0) {
            return res.status(400).json({ error: 'No se han enviado campos permitidos para actualizar' });
        }

        if (allowUpdates.pricePerNight !== undefined) allowUpdates.pricePerNight = Number(allowUpdates.pricePerNight);
        if (allowUpdates.maxOccupancy !== undefined) allowUpdates.maxOccupancy = Number(allowUpdates.maxOccupancy);

        const updated = await Room.findByIdAndUpdate(id, allowUpdates, {
            returnDocument: 'after',
            runValidators: true 
        });

        if (!updated) return res.status(404).json({ error: 'Habitación no encontrada' });

        return res.status(200).json(updated);
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

        return res.status(200).json(room);
    } catch (err) {
        return res.status(500).json({ error: 'Error al obtener habitación', detalle: err.message });
    }
}

async function getRoomQr(req, res) {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ error: "ID de habitacion no valido" });
        }

        const room = await Room.findById(id);
        if (!room) return res.status(404).json({ error: "Habitacion no encontrada" });

        const code = await createRoomQrToken(room);
        const baseUrl = process.env.QR_ROOM_BASE_URL || `${req.protocol}://${req.get("host")}/rooms/scan`;
        const qrUrl = `${baseUrl}/${encodeURIComponent(code)}`;
        const png = await QRCode.toBuffer(qrUrl, {
            type: "png",
            errorCorrectionLevel: "M",
            margin: 2,
            width: 320,
        });

        res.setHeader("Content-Type", "image/png");
        res.setHeader("Content-Disposition", `inline; filename="room-${room.numRoom}-qr.png"`);
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).send(png);
    } catch (err) {
        console.error("Error generando QR de habitacion:", err);
        return res.status(500).json({ error: "Error generando QR de habitacion" });
    }
}

async function scanRoomQr(req, res) {
    const { code } = req.params;

    try {
        const payload = await verifyRoomQrToken(code);

        const room = await Room.findById(payload.roomId);
        if (!room) {
            await saveQrScanLog(req, {
                code,
                result: "room_not_found",
                message: "La habitacion del QR no existe"
            });
            return res.status(404).json({ error: "Habitacion no encontrada" });
        }

        if (Number(payload.qrVersion) !== Number(room.qrVersion || 1)) {
            await saveQrScanLog(req, {
                code,
                room,
                result: "revoked",
                message: "El QR fue regenerado y este codigo ya no es valido"
            });
            return res.status(410).json({ error: "QR invalidado. Genera o escanea el QR nuevo." });
        }

        await saveQrScanLog(req, {
            code,
            room,
            result: "success",
            message: "QR escaneado correctamente"
        });

        return res.status(200).json({
            code,
            room,
        });
    } catch (err) {
        await saveQrScanLog(req, {
            code,
            result: "invalid",
            message: "QR invalido o manipulado"
        });
        return res.status(400).json({ error: "QR invalido o manipulado" });
    }
}

async function regenerateRoomQr(req, res) {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ error: "ID de habitacion no valido" });
        }

        const room = await Room.findByIdAndUpdate(
            id,
            { $inc: { qrVersion: 1 } },
            { returnDocument: 'after' }
        );

        if (!room) return res.status(404).json({ error: "Habitacion no encontrada" });

        const code = await createRoomQrToken(room);
        const baseUrl = process.env.QR_ROOM_BASE_URL || `${req.protocol}://${req.get("host")}/rooms/scan`;
        const qrUrl = `${baseUrl}/${encodeURIComponent(code)}`;

        return res.status(200).json({
            message: "QR regenerado correctamente. Los QR anteriores quedan invalidados.",
            roomId: room._id,
            numRoom: room.numRoom,
            qrVersion: room.qrVersion,
            code,
            qrUrl,
            qrImageUrl: `${req.protocol}://${req.get("host")}/rooms/${room._id}/qr`
        });
    } catch (err) {
        console.error("Error regenerando QR de habitacion:", err);
        return res.status(500).json({ error: "Error regenerando QR de habitacion" });
    }
}

async function getRoomQrScanLogs(req, res) {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ error: "ID de habitacion no valido" });
        }

        const limit = Math.min(Number(req.query.limit) || 100, 500);
        const logs = await RoomQrScanLog.find({ roomId: id })
            .sort({ scannedAt: -1 })
            .limit(limit);

        return res.status(200).json(logs);
    } catch (err) {
        console.error("Error obteniendo logs de QR:", err);
        return res.status(500).json({ error: "Error obteniendo logs de QR" });
    }
}
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads/rooms"),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const name = Date.now() + "-" + Math.round(Math.random() * 1e9) + ext;
        cb(null, name);
    }
});
const fileFilter = (req, file, cb) => {
    const ok = ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
    cb(ok ? null : new Error("Formato no permitido"), ok);
};

const upload = multer({ storage, fileFilter });
const uploadMany = upload.array("images", 10);


async function uploadRoomImages(req, res) {
    try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ error: "ID de habitación no válido" });
    }

    const files = req.files || [];
    if (files.length === 0) return res.status(400).json({ error: "No has enviado imágenes" });

    const paths = files.map(f => `/uploads/rooms/${f.filename}`);

    const updated = await Room.findByIdAndUpdate(
        id,
        { $push: { image: { $each: paths } } },
        { returnDocument: 'after' }
    );

    if (!updated) return res.status(404).json({ error: "Habitación no encontrada" });
    return res.status(200).json(updated);

    } catch (err) {
    return res.status(400).json({ error: "Error subiendo imágenes", detalle: err.message });
    }
}


async function deleteRoomImage(req, res) {
    try {
        const { id } = req.params;
        const { image } = req.body;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ error: "ID de habitación no válido" });
        }
        if (!image) return res.status(400).json({ error: "Falta image en el body" });

        const updated = await Room.findByIdAndUpdate(
            id,
            { $pull: { image: image } },
            { returnDocument: 'after' }
        );

        if (!updated) return res.status(404).json({ error: "Habitación no encontrada" });

        // best effort para borrar la imagen del disco, esto hará que no se para el proceso si por alguna razón no se borra la imagen del disco.
        const diskPath = path.join(__dirname, "..", image); 
        fs.unlink(diskPath, () => {});

        return res.status(200).json(updated);

    } catch (err) {
        return res.status(400).json({ error: "Error borrando imagen", detalle: err.message });
    }
}


module.exports = {
    addRoom,
    deleteRoom,
    updateRoom,
    getAllRooms,
    getRoomById,
    nextRoom,
    uploadMany,
    uploadRoomImages,
    deleteRoomImage,
    getAvailableRooms,
    getRoomCalendar,
    createRoomBlock,
    deleteRoomBlock,
    getRoomQr,
    scanRoomQr,
    regenerateRoomQr,
    getRoomQrScanLogs,
};
