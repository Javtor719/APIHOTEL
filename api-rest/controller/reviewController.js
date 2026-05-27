/*
 * =============================================
 * Author: Javier Orosco Torres
 * Create date: 21/05/2026
 * Description:
 *      Controlador de reviews de habitaciones.
 *      Permite consultar reviews por ID, habitacion o reserva.
 *      Valida que el usuario haya finalizado una estancia antes de valorar.
 *      Crea, modifica y elimina reviews evitando duplicados por reserva.
 *      Recalcula la puntuacion media de la habitacion tras cada cambio.
 * =============================================
 */
const mongoose = require('mongoose');
const Review = require('../models/reviews');
const Reservation = require('../models/reservation');
const Room = require('../models/rooms');

async function getReviewById(req, res) {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ error: 'ID de review no válido' });
        }

        const review = await Review.findById(id)
            .populate('userId', 'user_name email')
            .populate('roomId', 'numRoom roomType');

        if (!review) return res.status(404).json({ error: 'Review no encontrada' });

        return res.status(200).json(review);
    } catch (err) {
        return res.status(500).json({ error: 'Error al obtener review', detalle: err.message });
    }
}

async function getReviewsByRoom(req, res) {
    try {
        const { roomId } = req.params;

        if (!mongoose.isValidObjectId(roomId)) {
        return res.status(400).json({ error: 'ID de habitación no válido' });
        }

        const reviews = await Review.find({ roomId })
            .sort({ createdAt: -1 })
            .populate('userId', 'firstName lastName email');

        return res.status(200).json(reviews);
    } catch (err) {
        return res.status(500).json({ error: 'Error al listar reviews', detalle: err.message });
    }
}

async function addReview(req, res) {
    try {
        const userId = req.user.id;
        const { roomId, reservationId, rating, comment } = req.body;

        if (!roomId || !reservationId || rating === undefined) {
            return res.status(400).json({ error: 'Faltan datos obligatorios (roomId, reservationId, rating)' });
        }

        if (!mongoose.isValidObjectId(roomId) ||
            !mongoose.isValidObjectId(userId) ||
            !mongoose.isValidObjectId(reservationId)) {
            return res.status(400).json({ error: 'Algún ID no es válido' });
        }

        const r = Number(rating);
        if (!Number.isFinite(r) || r < 1 || r > 5) {
            return res.status(400).json({ error: 'rating debe ser un número entre 1 y 5' });
        }

        const room = await Room.findById(roomId);
        if (!room) return res.status(404).json({ error: 'Habitación no encontrada' });

        const reservation = await Reservation.findOne({
            _id: reservationId,
            userId: userId,
            roomIds: { $in: [roomId] },
        });

        if (!reservation) {
            console.log("RESERVA NO ENCONTRADA");
            return res.status(400).json({ error: 'Reserva no válida para ese usuario y habitación' });
        }

        const now = new Date();
        const ended = ['checkOut', 'facturada'].includes(reservation.status) || (reservation.checkOut && new Date(reservation.checkOut) < now);

        if (!ended) {
            return res.status(400).json({ error: 'No se puede valorar hasta finalizar la estancia (checkout)' });
        }

        const exists = await Review.findOne({ reservationId });
        if (exists) {
            return res.status(409).json({ error: 'Ya existe una review para esta reserva' });
        }

        const newReview = new Review({
            roomId,
            userId,
            reservationId,
            rating: r,
            comment: comment?.trim()
        });

        const saved = await newReview.save();

        const stats = await Review.aggregate([
            { $match: { roomId: new mongoose.Types.ObjectId(roomId) } },
            { $group: { _id: '$roomId', avg: { $avg: '$rating' }, count: { $sum: 1 } } }
        ]);

        if (stats.length > 0) {
            const avg = Math.round(stats[0].avg * 10) / 10; // 1 decimal
            await Room.findByIdAndUpdate(roomId, { $set: { rate: avg } }, { returnDocument: 'before' });
        }

        return res.status(201).json({ message: 'Review creada', review: saved });
    } catch (err) {
        if (err.code === 11000) {
        return res.status(409).json({ error: 'Duplicado (probablemente reservationId único)' });
    }

    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(e => e.message);
        return res.status(400).json({ error: 'Error de validación', detalle: errors });
    }

    return res.status(500).json({ error: 'Error al crear review', detalle: err.message });
    }
}

async function updateReview(req, res) {
    try {
        const { id } = req.params;
        const { rating, comment } = req.body;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ error: 'ID de review no válido' });
        }

        const updates = {};
        if (rating !== undefined) {
            const r = Number(rating);
            if (!Number.isFinite(r) || r < 1 || r > 5) {
                return res.status(400).json({ error: 'rating debe ser un número entre 1 y 5' });
            }
            updates.rating = r;
        }
        if (comment !== undefined) updates.comment = String(comment).trim();

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    const updated = await Review.findByIdAndUpdate(id, updates, { returnDocument: 'after', runValidators: true });
    if (!updated) return res.status(404).json({ error: 'Review no encontrada' });

    if (updates.rating !== undefined) {
        const stats = await Review.aggregate([
            { $match: { roomId: updated.roomId } },
            { $group: { _id: '$roomId', avg: { $avg: '$rating' } } }
        ]);
        const avg = stats.length ? Math.round(stats[0].avg * 10) / 10 : 0;
        await Room.findByIdAndUpdate(updated.roomId, { $set: { rate: avg } });
    }

        return res.status(200).json(updated);
    } catch (err) {
        return res.status(500).json({ error: 'Error al actualizar review', detalle: err.message });
    }
}


async function getReviewByReservation(req, res) {
    try {
        const { reservationId } = req.params;

        if (!mongoose.isValidObjectId(reservationId)) {
            return res.status(400).json({ error: 'reservationId no válido' });
        }

        const review = await Review.findOne({ reservationId })
            .populate('userId', 'firstName lastName email')
            .populate('roomId', 'numRoom roomType');

        if (!review) return res.status(404).json({ error: 'No hay review para esta reserva' });

            return res.status(200).json(review);
    } catch (err) {
        return res.status(500).json({ error: 'Error', detalle: err.message });
    }
}


async function deleteReview(req, res) {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ error: 'ID de review no válido' });
        }

        const deleted = await Review.findByIdAndDelete(id);
        if (!deleted) return res.status(404).json({ error: 'Review no encontrada' });

        const stats = await Review.aggregate([
            { $match: { roomId: deleted.roomId } },
            { $group: { _id: '$roomId', avg: { $avg: '$rating' } } }
        ]);
        const avg = stats.length ? Math.round(stats[0].avg * 10) / 10 : 0;
        await Room.findByIdAndUpdate(deleted.roomId, { $set: { rate: avg } });

        return res.status(200).json({ message: 'Review eliminada', deleted });
    } catch (err) {
        return res.status(500).json({ error: 'Error al eliminar review', detalle: err.message });
    }
}

module.exports = {
    getReviewById,
    getReviewsByRoom,
    addReview,
    updateReview,
    deleteReview,
    getReviewByReservation
};
