import { insertEstudio, insertEstudioDetalle, getAllEstudios, getEstudioDetalles, getAllTiposEstudios, getAllEstudiosPorDni, actualizarDescripcionVieja, updateEstudio, agregarTipoDeEstudio } from "../Models/estudiosModel.js";

export const crearEstudio = async (req, res) => {
    const { dni_paciente, fecha_estudio, tipo_estudio_id, descripcion } = req.body;
    try {
        const estudioId = await insertEstudio(dni_paciente, fecha_estudio, tipo_estudio_id, descripcion);
        res.status(200).json({ message: "Estudio creado con éxito", estudioId });
    } catch (error) {
        res.status(500).json({ error: "Error al crear el estudio" });
    }
};

export const agregarEstudioDetalle = async (req, res) => {
    const { estudio_id, imagen_url, descripcion } = req.body;
    try {
        await insertEstudioDetalle(estudio_id, imagen_url, descripcion);
        res.status(200).json({ message: "Detalle de estudio agregado con éxito" });
    } catch (error) {
        res.status(500).json({ error: "Error al agregar el detalle del estudio" });
    }
};

export const obtenerEstudios = async (req, res) => {
    try {
        const { dni } = req.body;
        if (!dni) {
            return res.status(400).json({ error: "DNI es requerido" });
        }
        const estudios = await getAllEstudiosPorDni(dni);

        if (!estudios || estudios.length === 0) {
            return res.status(404).json({ error: "No se encontraron estudios para el DNI proporcionado" });
        }

        res.status(200).json({ estudios });
    } catch (error) {
        res.status(500).json({ error: "Error al obtener estudios" });
    }
};

export const obtenerDetallesDeEstudio = async (req, res) => {
    console.log(req.body)
    const { estudioId } = req.body;
    if (estudioId) {
        const detalles = await getEstudioDetalles(estudioId);
        console.log(detalles)
        res.status(200).json({ detalles });
    } else {
        res.status(500).json({ error: "Error al obtener detalles del estudio" });
    }
};

export const obtenerTiposEstudios = async (req, res) => {
    try {
        const tipos = await getAllTiposEstudios();
        res.status(200).json({ tipos });
    } catch (error) {
        res.status(500).json({ error: "Error al obtener tipos de estudios" });
    }
};

export const updateDetalleEstudio = async (req, res) => {
    const { id, descripcion } = req.body
    try {
        const detalles = await getEstudioDetalles(id);
        res.status(200).json({ detalles });
    } catch (error) {
        res.status(500).json({ error: "Error al obtener detalles del estudio" });
    }
}

export const actualizarDescripcion = async (req, res) => {
    const { estudio_id, descripcion_vieja, descripcion_nueva, dni } = req.body;
    console.log(req.body)

    try {
        // 1. Marcar la descripción vieja como inactiva
        await actualizarDescripcionVieja(estudio_id, descripcion_vieja);

        // 2. Insertar un nuevo detalle con la nueva descripción
        await insertEstudioDetalle(estudio_id, descripcion_nueva, dni);

        res.status(200).json({ message: 'Descripción actualizada correctamente' });
    } catch (error) {
        console.error('Error al actualizar la descripción:', error);
        res.status(500).json({ error: 'Error al actualizar la descripción' });
    }
};



export const actualizarEstudio = async (req, res) => {
    const { estudio_id, tipo_estudio_id, descripcion, estado } = req.body;
    console.log(estudio_id, tipo_estudio_id, descripcion, estado)

    try {

        const rowsAffected = await updateEstudio(estudio_id, tipo_estudio_id, descripcion, estado);

        if (rowsAffected > 0) {
            // Respuesta en el controlador del backend:
            res.status(200).json({
                success: true,
                message: 'Estudio actualizado correctamente'
            });

        } else {
            res.status(404).json({ message: 'Estudio no encontrado o no se realizaron cambios' });
        }
    } catch (error) {
        console.error('Error al actualizar estudio:', error);
        res.status(500).json({ message: 'Hubo un error al actualizar el estudio' });
    }
};


export const agregarTipoEstudio = async (req, res) => {
    const { nombreTipo } = req.body;
    console.log(req.body)
    try {
        await agregarTipoDeEstudio(nombreTipo);
        res.status(200).json({ message: "Tipo de Estudio agregado con éxito" });
    } catch (error) {
        res.status(500).json({ error: "Error al agregar el Tipi de Estudio" });
    }
};