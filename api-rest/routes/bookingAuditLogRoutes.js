const express = require('express');
const router = express.Router();
const bookingAuditLogController =  require('../controller/bookingAuditLogController');



router.get('/:id/audit', bookingAuditLogController.getBookingAuditLog);

module.exports = router;