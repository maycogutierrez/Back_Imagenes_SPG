import express from 'express';
import multer from 'multer';
import { checkToken, getRoles, loginUser, registerUser, todosLosUsuarios, updateUser, usuarioPorId,changePassword, usuarioPorDNI } from '../Controller/userController.js';

const router = express.Router();

// Configuración de multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/firmas/'); // Carpeta donde se guardarán las firmas
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

router.post('/todoslosUsuarios', todosLosUsuarios);
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/roles', getRoles);
router.put('/update/:id', upload.single('firma'), updateUser);
router.post('/porId/:id', usuarioPorId);
router.post('/porDNI/:dni', usuarioPorDNI);
router.post('/cambiar-password', changePassword); 


export default router;
