import express from 'express';
import { checkToken, getRoles, loginUser, registerUser, todosLosUsuarios, updateUser, usuarioPorId,changePassword } from '../Controller/userController.js';

const router = express.Router();

router.post('/todoslosUsuarios', checkToken, todosLosUsuarios);
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/roles', checkToken, getRoles);
router.put('/update/:id', checkToken, updateUser);
router.post('/porId/:id', checkToken, usuarioPorId);
router.post('/cambiar-password', changePassword); 


export default router;
