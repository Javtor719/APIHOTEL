/*
 * =============================================
 * Author: Miguel Ángel Águila Morillas y Javier Orosco Torres
 * Create date: 14/02/2026
 * Description:
 *      Modelo Mongoose y clases de validacion para usuarios.
 *      Define datos personales, credenciales, rol, imagen y estado VIP.
 *      Centraliza validaciones de alta y actualizacion antes de crear
 *      documentos o payloads de MongoDB.
 *      Protege el campo password para que no se devuelva en consultas
 *      salvo cuando se solicite expresamente.
 * =============================================
 */
const { Schema, default: mongoose } = require('mongoose');

/**
 * @typedef {Object} User
 * 
 * @property {import('mongoose').Types.ObjectId} _id - Identificador único creado por MongoDB
 * @property {string} firstName - Nombre propio del usuario
 * @property {string} lastName - Apellido/s del usuario
 * @property {string} email - Correo del usuario
 * @property {string} password - Contraseña del usuario
 * @property {string} dni - Documento de identidad del usuario
 * @property {number} phoneNumber - Numero de telefono del usuario
 * @property {Date} birthDate - Fecha de nacimiento del usuario
 * @property {string} cityName - Ciudad de vivienda fiscal
 * @property {string} address - Direccion de vivienda fiscal
 * @property {"Hombre" | "Mujer"} gender - Genero del usuario
 * @property {string} imageRoute - Ruta de la imagen del usuario
 * @property {"Admin" | "Trabajador" | "Usuario"} rol - Rol del usuario
 * @property {Boolean} vipStatus - Estado membresia VIP del usuario, "true" cuenta con membresia acctiva, "false" no cuenta con membresia
 * 
 * @description Documento correspondiente a los datos en MongoDB sobre el usuario
 */

/**
 * Schema de MongoDB para usuarios
 * @type {import('mongoose').Schema<User>}
 */
const userDatabaseSchema = new Schema({
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    lastName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    password: {
        type: String,
        required: true,
        select: false
    },
    dni: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    phoneNumber: {
        type: Number,
        trim: true
    },
    birthDate: {
        type: Date,
        required: true
    },
    cityName: {
        type: String,
        required: true,
        trim: true
    },
    address: {
        type: String,
        required: true,
        trim: true
    },
    gender: {
        type: String,
        enum: ["Hombre", "Mujer"],
        required: true
    },
    imageRoute: {
        type: String,
        required: false,
        default: null
    },
    rol: {
        type: String,
        enum: ["Admin", "Trabajador", "Usuario"],
        default: "Usuario"
    },
    vipStatus: {
        type: Boolean,
        default: false
    }
});

/**
 * Modelo de Mongoose para usuarios
 * @type {import('mongoose').Model<User>}
 */
const userDatabaseModel = mongoose.model('user', userDatabaseSchema);

/**
 * Clase para la creación y validación de nuevos usuarios
 */
class UserEntryData {
    constructor(firstName, lastName, email, password, dni, phoneNumber, birthDate, cityName, address, gender, imageRoute, rol, vipStatus) {
        this.firstName = firstName
        this.lastName = lastName
        this.email = email
        this.password = password
        this.dni = dni
        this.phoneNumber = phoneNumber
        this.birthDate = birthDate
        this.cityName = cityName
        this.address = address
        this.gender = gender
        this.imageRoute = imageRoute
        this.rol = rol || "Usuario"
        this.vipStatus = vipStatus || false
        
        this.ready = false
    }

    /**
     * Valida los datos del usuario
     * @throws {Error} Si algún dato no cumple con las condiciones establecidas
     * @description
     * - El nombre y apellido no pueden estar vacíos ni contener números
     * - La contraseña debe tener al menos 8 caracteres
     * - El usuario debe ser mayor de 16 años
     * - El DNI debe tener un formato correcto y una letra válida
     * - Establece la propiedad `ready` a `true` si todos los datos son válidos
     */
    validate() {
        if (!this.firstName || !this.lastName) throw new Error("Nombre y Apellido no pueden estar vacíos.");
        if(/\d/.test(this.firstName) || /\d/.test(this.lastName)) throw new Error("Nombre y Apellido no pueden contener números.");
        if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(this.email)) throw new Error("El correo tiene que tener un formato correcto.");
        if(this.password.length < 8) throw new Error("La contraseña tiene que contener al menos de 8 caracteres.");
        if(this.birthDate.getTime() > Date.now() - 504921600000) throw new Error("Tienes que ser mayor de 16 años.");
        if(!this.cityName) throw new Error("La ciudad no puede estar vacía.");
        if(!this.address) throw new Error("La dirección no puede estar vacía.");
        if(!["Hombre", "Mujer"].includes(this.gender)) throw new Error("Seleccione un Genero");
        if(!/^\d{8}[a-zA-Z]$/.test(this.dni)) throw new Error("DNI Incorrecto.");
        
        let letterNum = parseInt(this.dni.slice(0,8));
        const letterDni = ["T", "R", "W", "A", "G", "M", "Y", "F", "P", "D", "X", "B", "N", "J", "Z", "S", "Q", "V", "H", "L", "C", "K", "E"];
        if(this.dni[8] !== letterDni[letterNum%23]) throw new Error("DNI Incorrecto");
        
        this.ready = true
    }

    /**     
     * Convierte los datos validados en un documento de Mongoose
     * @returns {import('mongoose').Document} Documento de Mongoose listo para ser guardado
     */
    toDocument() {
        if(!this.ready) throw new Error("Completa la creación de usuario correctamente.")
        return new userDatabaseModel({
            firstName: this.firstName,
            lastName: this.lastName,
            email: this.email,
            password: this.password,
            dni: this.dni,
            phoneNumber: this.phoneNumber,
            birthDate: this.birthDate,
            cityName: this.cityName,
            address: this.address,
            gender: this.gender,
            imageRoute: this.imageRoute,
            rol: this.rol,
            vipStatus: this.vipStatus
        });
    }
}

class UserUpdateData {
    constructor(firstName, lastName, email, dni, phoneNumber, birthDate, cityName, address, gender, imageRoute) {
        this.firstName = firstName;
        this.lastName = lastName;
        this.email = email;
        this.dni = dni;
        this.phoneNumber = phoneNumber;
        this.birthDate = birthDate;
        this.cityName = cityName;
        this.address = address;
        this.gender = gender;
        this.imageRoute = imageRoute;
    
        this.ready = false;
    }

    validate() {
        if (!this.firstName || !this.lastName) throw new Error("Nombre y Apellido no pueden estar vacíos.");
        if (/\d/.test(this.firstName) || /\d/.test(this.lastName)) throw new Error("Nombre y Apellido no pueden contener números.");
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(this.email)) throw new Error("El correo tiene que tener un formato correcto.");

        if (!(this.birthDate instanceof Date) || Number.isNaN(this.birthDate.getTime())) throw new Error("Fecha de nacimiento inválida.");
        if (this.birthDate.getTime() > Date.now() - 504921600000) throw new Error("Tienes que ser mayor de 16 años.");
        if (!this.cityName) throw new Error("La ciudad no puede estar vacía.");
        if (!this.address) throw new Error("La dirección no puede estar vacía.");
        if (!["Hombre", "Mujer"].includes(this.gender)) throw new Error("Seleccione un Genero");
        if (!/^\d{8}[a-zA-Z]$/.test(this.dni)) throw new Error("DNI Incorrecto.");

        const letterNum = parseInt(this.dni.slice(0, 8), 10);
        const letterDni = ["T","R","W","A","G","M","Y","F","P","D","X","B","N","J","Z","S","Q","V","H","L","C","K","E"];
        if (this.dni[8].toUpperCase() !== letterDni[letterNum % 23]) throw new Error("DNI Incorrecto");

        this.ready = true;
    }

    toUpdateObject() {
        if (!this.ready) throw new Error("Completa la actualización correctamente.");
        return {
            firstName: this.firstName,
            lastName: this.lastName,
            email: this.email,
            dni: this.dni,
            phoneNumber: this.phoneNumber,
            birthDate: this.birthDate,
            cityName: this.cityName,
            address: this.address,
            gender: this.gender,
            imageRoute: this.imageRoute,
        };
    }
}

class UserAdminUpdateData extends UserUpdateData {
    constructor(firstName, lastName, email, dni, phoneNumber, birthDate, cityName, address, gender, imageRoute, rol, vipStatus) {
        super(firstName, lastName, email, dni, phoneNumber, birthDate, cityName, address, gender, imageRoute);
        this.rol = rol;
        this.vipStatus = vipStatus;
    }

    toUpdateObject() {
        const base = super.toUpdateObject();
        return { ...base, rol: this.rol, vipStatus: this.vipStatus };
    }
}

module.exports = {
    userDatabaseModel,
    UserEntryData,
    UserUpdateData,
    UserAdminUpdateData
  };
