const express = require('express');
const { getOneUserByIdOrDni, getAllUsers, getUsersByRol, register} = require('../controller/userController.js');
const { verifyToken ,authorizeRoles } = require('../middleware/authMiddleware.js');    
const router = express.Router();

router.get('/', verifyToken, authorizeRoles(["Admin", "Trabajador"]), getAllUsers);
router.get('/rol/:rol', verifyToken, authorizeRoles(["Admin", "Trabajador"]), getUsersByRol);
router.get('/getOne', verifyToken, authorizeRoles(["Admin", "Trabajador"]), getOneUserByIdOrDni);

router.post('/registerApp', register);
router.post('/registerEsc', verifyToken, authorizeRoles(["Admin", "Trabajador"]), register);

/*usersRouter.put('/update', verifyToken, updateUser);
usersRouter.delete('/delete/:id', verifyToken, authorizeRoles(["Admin", "Trabajador"]), deleteUserById);*/

module.exports = router;