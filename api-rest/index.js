const express = require ('express');
const mongoose = require('mongoose');
const reservationRoutes = require ('./routes/reservationRoutes');
const usersRoutes = require ('./routes/userRoutes');
const habitacionRoutes = require ('./routes/habitacionRoutes');
const reviewRoutes = require ('./routes/reviewRoutes');
const  authRouter  = require('./routes/authRouter');


const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
//Ver imagenes por url
app.use('/uploads', express.static('uploads'));

app.use('/reservations',reservationRoutes);
app.use('/users',usersRoutes);
app.use('/rooms',habitacionRoutes);
app.use('/auth',authRouter)
app.use('/reviews',reviewRoutes)


mongoose.connect('mongodb://localhost:27017/HotelPereMaria')
  .then(() => console.log('Conectado a MongoDB'))
  .catch(err => console.error('Error MongoDB', err));

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});