const express = require('express');
const router = express.Router();
const bookingAuditLogController =  require('../controller/bookingAuditLogController');



router.get('/booking/:id/audit', bookingAuditLogController.getBookingAuditLog);

module.exports = router;