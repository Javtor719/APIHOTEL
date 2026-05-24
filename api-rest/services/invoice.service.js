const Counter = require('../models/counter');
const HOTEL_TIME_ZONE = 'Europe/Madrid';

function formatHotelDate(date = new Date()) {
    return new Intl.DateTimeFormat('es-ES', { timeZone: HOTEL_TIME_ZONE }).format(date);
}

function padSeq(seq, width) {
    return String(seq).padStart(width, '0');
}

/**
 * Default format: 0_{YYYY}{MM}_{SEQ:5}
 * Supported tokens: {YYYY}, {MM}, {DD}, {SEQ:N}
 */
async function getNextInvoiceNumber(format) {
    format = format || process.env.INVOICE_FORMAT || '0_{YYYY}{MM}_{SEQ:5}';
    const key = 'invoice';

    const counter = await Counter.findOneAndUpdate(
        { key },
        { $inc: { seq: 1 } },
        { returnDocument: 'after', upsert: true }
    );

    const seq = counter.seq;
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');

    let out = format.replace('{YYYY}', String(yyyy)).replace('{MM}', mm).replace('{DD}', dd);

  // replace {SEQ:N}
    const seqMatch = out.match(/\{SEQ:(\d+)\}/);
    if (seqMatch) {
        const width = parseInt(seqMatch[1], 10);
        out = out.replace(seqMatch[0], padSeq(seq, width));
    } else {
        out = out.replace('{SEQ}', String(seq));
    }

    return out;
}

module.exports = {
    HOTEL_TIME_ZONE,
    formatHotelDate,
    getNextInvoiceNumber,
};
