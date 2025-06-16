import express from 'express';
import { checkToken, getRoles, loginUser, registerUser, todosLosUsuarios, updateUser, usuarioPorId,changePassword } from '../Controller/userController.js';

const router = express.Router();

router.post('/todoslosUsuarios', todosLosUsuarios);
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/roles', getRoles);
router.put('/update/:id', updateUser);
router.post('/porId/:id', usuarioPorId);
router.post('/cambiar-password', changePassword); 


export default router;
