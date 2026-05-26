/*
 * =============================================
 * Author: Miguel Ángel Águila Morillas y Javier Orosco Torres
 * Create date: 14/02/2026
 * Description:
 *      Controlador de usuarios.
 *      Registra usuarios publicos y usuarios creados por personal autorizado.
 *      Valida permisos para asignar rol y estado VIP.
 *      Permite consultar usuarios por ID, DNI, rol o listado completo.
 *      Actualiza y elimina usuarios cuando las rutas correspondientes se activen.
 * =============================================
 */
const mongoose = require('mongoose');
const {
  userDatabaseModel,
  UserEntryData,
  UserUpdateData,
  UserAdminUpdateData,
} = require('../models/user');
const { hashPassword } = require('../services/password.service');

function buildBaseUserData(req, hashedPassword) {
  const {
    firstName,
    lastName,
    email,
    dni,
    phoneNumber,
    birthDate,
    cityName,
    address,
    direccion,
    gender,
  } = req.body;

  return {
    firstName,
    lastName,
    email,
    password: hashedPassword,
    dni,
    phoneNumber,
    birthDate: new Date(birthDate),
    cityName,
    address: address || direccion,
    gender,
  };
}

function validateRequiredUserFields(data, hasPassword = true) {
  if (hasPassword && !data.password) return 'La contrasena no puede estar vacia.';
  if (!data.firstName) return 'El nombre no puede estar vacio.';
  if (!data.lastName) return 'El apellido no puede estar vacio.';
  if (!data.email) return 'El correo no puede estar vacio.';
  if (!data.dni) return 'El dni no puede estar vacio.';
  if (Number.isNaN(data.birthDate.getTime())) return 'La fecha no puede estar vacia.';
  if (!data.cityName) return 'La ciudad no puede estar vacia.';
  if (!data.address) return 'La direccion no puede estar vacia.';
  if (!data.gender) return 'Tienes que seleccionar un genero.';
  return null;
}

async function register(req, res) {
  try {
    const isPublic = !req.user;
    const password = isPublic ? req.body.password : 'Password123!';
    const baseData = buildBaseUserData(req, await hashPassword(password || ''));
    const missingFieldError = validateRequiredUserFields(baseData, true);

    if (missingFieldError) {
      return res.status(400).json({ error: missingFieldError });
    }

    const userEntry = isPublic
      ? new UserEntryData(
        baseData.firstName,
        baseData.lastName,
        baseData.email,
        baseData.password,
        baseData.dni,
        baseData.phoneNumber,
        baseData.birthDate,
        baseData.cityName,
        baseData.address,
        baseData.gender,
        null
      )
      : createBy(req, baseData, {
        rol: req.body.rol,
        vipStatus: req.body.vipStatus,
      });

    userEntry.validate();
    await userEntry.toDocument().save();

    return res.status(200).json({ message: 'Usuario creado.' });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese email o dni.' });
    }

    return res.status(400).json({ error: error.message || 'Error al registrar al usuario' });
  }
}

function createBy(req, baseData, { rol, vipStatus }) {
  const actorRol = req.user.rol;

  if (actorRol === 'Trabajador' && rol !== 'Usuario') {
    throw new Error('Solamente puedes crear Usuarios.');
  }

  if (actorRol === 'Admin' && rol !== 'Usuario' && rol !== 'Trabajador') {
    throw new Error('Un Admin solo puede crear Usuario o Trabajador.');
  }

  if (!['Admin', 'Trabajador'].includes(actorRol)) {
    throw new Error('No tienes permisos para crear usuarios con rol y estado VIP.');
  }

  return new UserEntryData(
    baseData.firstName,
    baseData.lastName,
    baseData.email,
    baseData.password,
    baseData.dni,
    baseData.phoneNumber,
    baseData.birthDate,
    baseData.cityName,
    baseData.address,
    baseData.gender,
    null,
    rol,
    vipStatus
  );
}

async function getOneUserByIdOrDni(req, res) {
  try {
    const { searchData, searchProperty } = req.body;
    if (!searchData) {
      return res.status(400).json({ error: 'Se requiere el parametro de busqueda del usuario' });
    }

    let user;
    if (searchProperty && searchProperty.includes('id')) {
      if (!mongoose.isValidObjectId(searchData)) {
        return res.status(400).json({ error: 'No es un ID valido' });
      }
      user = await userDatabaseModel.findById(searchData);
    } else {
      user = await userDatabaseModel.findOne({ dni: searchData });
    }

    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    return res.status(200).json(user);
  } catch (error) {
    console.error('Error al obtener el usuario:', error);
    return res.status(500).json({ error: 'Error del servidor' });
  }
}

async function getAllUsers(req, res) {
  try {
    const users = await userDatabaseModel.find();
    return res.status(200).json(users);
  } catch (error) {
    console.error('Error al obtener los usuarios:', error);
    return res.status(500).json({ error: 'Error del servidor' });
  }
}

async function getUsersByRol(req, res) {
  try {
    const { rol } = req.params;

    if (!['Admin', 'Trabajador', 'Usuario'].includes(rol)) {
      return res.status(400).json({ error: 'Rol no valido' });
    }

    const users = await userDatabaseModel.find({ rol });
    return res.status(200).json(users);
  } catch (error) {
    console.error('Error al obtener los usuarios por rol:', error);
    return res.status(500).json({ error: 'Error del servidor' });
  }
}

async function updateUser(req, res) {
  try {
    const userAddress = req.body.address || req.body.direccion;
    const birthDate = new Date(req.body.birthDate);
    const baseData = {
      ...req.body,
      address: userAddress,
      birthDate,
    };
    const missingFieldError = validateRequiredUserFields(baseData, false);

    if (missingFieldError) {
      return res.status(400).json({ error: missingFieldError });
    }

    if (!mongoose.isValidObjectId(req.body.id)) {
      return res.status(400).json({ error: 'No es un ID valido' });
    }

    const foundUser = await userDatabaseModel.findById(req.body.id);
    if (!foundUser) {
      return res.status(404).json({ error: 'No existe ningun usuario con ese id.' });
    }

    let updateEntry;
    if (req.user.rol === 'Usuario' || req.user.id === req.body.id) {
      updateEntry = new UserUpdateData(
        req.body.firstName,
        req.body.lastName,
        req.body.email,
        req.body.dni,
        req.body.phoneNumber,
        birthDate,
        req.body.cityName,
        userAddress,
        req.body.gender,
        req.body.imageRoute
      );
    } else {
      if (req.user.rol === 'Trabajador' && req.body.rol !== 'Usuario') {
        return res.status(400).json({ error: 'Solamente puedes editar a Usuarios.' });
      }

      updateEntry = new UserAdminUpdateData(
        req.body.firstName,
        req.body.lastName,
        req.body.email,
        req.body.dni,
        req.body.phoneNumber,
        birthDate,
        req.body.cityName,
        userAddress,
        req.body.gender,
        req.body.imageRoute,
        req.body.rol,
        req.body.vipStatus
      );
    }

    updateEntry.validate();
    const updated = await userDatabaseModel.findByIdAndUpdate(
      req.body.id,
      updateEntry.toUpdateObject(),
      { returnDocument: 'after' }
    );

    return res.status(200).json({ message: 'Usuario actualizado.', user: updated });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese email o dni.' });
    }

    return res.status(400).json({ error: error.message || 'Error al actualizar el usuario' });
  }
}

async function deleteUserById(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'ID de usuario no valido' });
    }

    const deleted = await userDatabaseModel.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    return res.status(200).json({ message: 'Usuario eliminado', id: deleted._id });
  } catch (err) {
    console.error('Error al borrar:', err);
    return res.status(500).json({ error: 'Error del servidor' });
  }
}

module.exports = {
  register,
  getAllUsers,
  getOneUserByIdOrDni,
  getUsersByRol,
  updateUser,
  deleteUserById,
};
