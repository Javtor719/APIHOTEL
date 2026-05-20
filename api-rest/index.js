const express = require ('express');
const mongoose = require('mongoose');
require('dotenv').config();
const reservationRoutes = require ('./routes/reservationRoutes');
const usersRoutes = require ('./routes/userRoutes');
const habitacionRoutes = require ('./routes/habitacionRoutes');
const reviewRoutes = require ('./routes/reviewRoutes');
const  authRouter  = require('./routes/authRouter');
const  bookingAuditLogRoutes  = require('./routes/bookingAuditLogRoutes');


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
app.use('/bookingAuditLog',bookingAuditLogRoutes)

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("Falta MONGO_URI en el entorno");
  process.exit(1);
}

mongoose
  .connect(MONGO_URI)
  .then(() => console.log('Conectado a MongoDB Atlas'))
  .catch((err) => {
    console.error('Error MongoDB Atlas', err);
    process.exit(1);
  });

app.listen(PORT,'0.0.0.0', () => {
  console.log(`Servidor escuchando en puerto${PORT}`);
});