const express = require('express');
const router = express.Router();

router.get('/', (req, res) => res.json({ msg: "Ruta de habitacion lista" }));

module.exports = router;