const express = require ('express');
const mongoose = require('mongoose');

const app = express();

mongoose.connect('mongodb://localhost:27017/hotel_pere_maria')
  .then(() => console.log('Conectado a MongoDB'))
  .catch(err => console.error('Error MongoDB', err));

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});