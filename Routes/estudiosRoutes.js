import express from 'express';
import { crearEstudio, agregarEstudioDetalle, obtenerEstudios, obtenerDetallesDeEstudio, obtenerTiposEstudios, actualizarDescripcion, actualizarEstudio, agregarTipoEstudio } from '../Controller/estudiosController.js';
import { checkToken } from '../Controller/userController.js';

const router = express.Router();

router.post('/crear', crearEstudio);
router.post('/agregarDetalle', agregarEstudioDetalle);
router.post('/obtener', obtenerEstudios);
router.post('/detalles', checkToken,obtenerDetallesDeEstudio);
router.get('/tipos', obtenerTiposEstudios);
router.post('/actualizarDescripcion', checkToken, actualizarDescripcion);
router.post('/actualizarEstudio', checkToken, actualizarEstudio);
router.post('/agregarTipoEstudio', agregarTipoEstudio);



export default router;
