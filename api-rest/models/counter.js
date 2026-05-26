/*
 * =============================================
 * Author: Javier Orosco Torres
 * Create date: 21/05/2026
 * Description:
 *      Modelo generico de contadores secuenciales.
 *      Mantiene una clave unica y el ultimo numero emitido.
 *      Se utiliza para generar numeraciones persistentes, como facturas.
 * =============================================
 */
const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    seq: { type: Number, default: 0 },
});

const Counter = mongoose.model('Counter', counterSchema);
module.exports = Counter;
