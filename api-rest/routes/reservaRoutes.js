const express = require('express');
const router = express.Router();

router.get('/', (req, res) => res.json({ msg: "Ruta de Reservas lista" }));

module.exports = router;