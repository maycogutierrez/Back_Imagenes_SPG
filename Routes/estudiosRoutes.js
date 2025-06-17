import express from 'express';
import { crearEstudio, agregarEstudioDetalle, obtenerEstudios, obtenerDetallesDeEstudio, obtenerTiposEstudios, actualizarDescripcion, actualizarEstudio, agregarTipoEstudio } from '../Controller/estudiosController.js';


const router = express.Router();

router.post('/crear', crearEstudio);
router.post('/agregarDetalle', agregarEstudioDetalle);
router.post('/obtener', obtenerEstudios);
router.post('/detalles', obtenerDetallesDeEstudio);
router.get('/tipos', obtenerTiposEstudios);
router.post('/actualizarDescripcion',  actualizarDescripcion);
router.post('/actualizarEstudio',  actualizarEstudio);
router.post('/agregarTipoEstudio', agregarTipoEstudio);



export default router;
