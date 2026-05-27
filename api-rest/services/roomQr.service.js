/*
 * =============================================
 * Author: Javier Orosco Torres
 * Create date: 21/05/2026
 * Description:
 *      Servicio de codigos QR firmados para habitaciones.
 *      Crea tokens JWT con el identificador de habitacion, numero y version QR.
 *      Verifica que el codigo recibido sea valido y pertenezca al tipo room-qr.
 *      Permite invalidar QR antiguos al comparar la version guardada en la habitacion.
 * =============================================
 */
const { SignJWT, jwtVerify } = require("jose");
const { TextEncoder } = require("util");
const mongoose = require("mongoose");

const QR_SECRET = new TextEncoder().encode(process.env.QR_SECRET || process.env.JWT_SECRET || "qr-secret-dev");

async function createRoomQrToken(room) {
    return new SignJWT({
        type: "room-qr",
        roomId: String(room._id),
        numRoom: room.numRoom,
        qrVersion: room.qrVersion || 1
    })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .sign(QR_SECRET);
}

async function verifyRoomQrToken(code) {
    const { payload } = await jwtVerify(code, QR_SECRET, {
        algorithms: ["HS256"],
    });

    if (
        payload.type !== "room-qr" ||
        !mongoose.isValidObjectId(payload.roomId) ||
        !Number.isInteger(Number(payload.qrVersion))
    ) {
        throw new Error("QR invalido");
    }

    return payload;
}

module.exports = {
    createRoomQrToken,
    verifyRoomQrToken
};
