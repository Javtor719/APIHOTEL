const express = require ('express');
const mongoose = require('mongoose');
const reservationRoutes = require ('./routes/reservationRoutes');
const usuarioRoutes = require ('./routes/usuarioRoutes');
const habitacionRoutes = require ('./routes/habitacionRoutes');

const app = express();

app.use('/reservation',reservationRoutes);
app.use('/usuario',usuarioRoutes);
app.use('/habitacion',habitacionRoutes);


mongoose.connect('mongodb://localhost:27017/hotel_pere_maria')
  .then(() => console.log('Conectado a MongoDB'))
  .catch(err => console.error('Error MongoDB', err));

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});