import db from "../config/db.js";

export const insertEstudio = async (dni_paciente, fecha_estudio, tipo_estudio_id, part_cuerpo) => {
    const query = 'INSERT INTO estudios (dni_paciente, fecha_estudio, tipo_estudio_id, part_cuerpo) VALUES (?, ?, ?, ?)';
    const [result] = await db.query(query, [dni_paciente, fecha_estudio, tipo_estudio_id, part_cuerpo]); // Estado inicial 0
    return result.insertId;
};


export const insertEstudioDetalle = async (estudio_id, descripcion,dni) => {
    const query = 'INSERT INTO estudio_detalles (estudio_id, descripcion, estado,dni_detalle) VALUES (?, ?, ?, ?)';
    await db.query(query, [estudio_id, descripcion, 1, dni]); 
};


export const actualizarDescripcionVieja = async (estudio_id, descripcion_vieja) => {
    const query = 'UPDATE estudio_detalles SET estado = 0 WHERE estudio_id = ? AND descripcion = ?';
    await db.query(query, [estudio_id, descripcion_vieja]);
};

export const getAllEstudios = async () => {
    const query = 'SELECT * FROM estudios';
    const [rows] = await db.query(query);
    return rows;
};
export const getAllEstudiosConDescripcionPorDni = async (dni) => {
    const query = `
        SELECT e.*, ed.descripcion
        FROM estudios e
        LEFT JOIN (
            SELECT t1.estudio_id, t1.descripcion
            FROM estudio_detalles t1
            INNER JOIN (
                SELECT estudio_id, MIN(id) as min_id
                FROM estudio_detalles
                WHERE estado = 1
                GROUP BY estudio_id
            ) t2 ON t1.estudio_id = t2.estudio_id AND t1.id = t2.min_id
        ) ed ON e.id = ed.estudio_id
        WHERE e.dni_paciente = ?
    `;
    const [rows] = await db.query(query, [dni]);
    return rows;
};


export const getEstudioDetalles = async (estudio_id) => {
    const query = `SELECT 
        ed.estudio_id, 
        ed.descripcion, 
        ed.fecha_subida, 
        ed.estado,
        ed.dni_detalle,
        GROUP_CONCAT(ie.id, '|', ie.imagen_url SEPARATOR ',') AS imagenes 
    FROM estudio_detalles ed 
    LEFT JOIN imagenes_estudios ie 
        ON ed.estudio_id = ie.estudio_id 
    WHERE ed.estudio_id = ? AND ed.estado = 1
    GROUP BY ed.estudio_id, ed.descripcion, ed.fecha_subida, ed.estado, ed.dni_detalle
    `;
    const [rows] = await db.query(query, [estudio_id]);
    const detalle = rows.map(row => ({
        estudio_id: row.estudio_id,
        descripcion: row.descripcion,
        fecha_subida: row.fecha_subida,
        estado: row.estado,
        dni_detalle: row.dni_detalle,
        imagenes: row.imagenes ? row.imagenes.split(',').map(img => {
            const [id, url] = img.split('|');
            return { id: parseInt(id, 10), imagen_url: url };
        }) : []
    }));
    return detalle;
};



export const getAllTiposEstudios = async () => {
    const query = 'SELECT * FROM tipo_estudio';
    const [rows] = await db.query(query);
    return rows;
};

export const updateEstudio = async (estudio_id, tipo_estudio_id, estado) => {
    const query = 'UPDATE estudios SET tipo_estudio_id = ? WHERE id = ?';
    const [result] = await db.query(query, [tipo_estudio_id, descripcion, estado,estudio_id]);
    return result.affectedRows; // Retorna cuántas filas fueron afectadas
};

export const agregarTipoDeEstudio = async (nombreTipo)=>{
    const query ='INSERT INTO tipo_estudio (nombre) VALUES (?)';
    await db.query(query, [nombreTipo]); 
}