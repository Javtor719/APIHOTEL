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

if (!MONGO_URI) {
  console.error("Falta MONGO_URI en el .env");
  process.exit(1);
}

mongoose
  .connect(MONGO_URI)
  .then(() => console.log('Conectado a MongoDB'))
  .catch((err) => {
    console.error('Error MongoDB', err);
    process.exit(1);
  });

app.listen(PORT,'0.0.0.0', () => {
  console.log(`Servidor escuchando en http://'0.0.0.0':${PORT}`);
});