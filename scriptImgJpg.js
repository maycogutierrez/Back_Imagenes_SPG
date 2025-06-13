import fs from 'fs';
import path from 'path';
import db from './config/db.js';

const imagesFolder = path.join(process.cwd(), 'images');

// Función para obtener el último tiempo de ejecución
const getLastRunTime = async () => {
    const [rows] = await db.query('SELECT value FROM config WHERE id = "last_run_time"');
    return rows.length > 0 ? new Date(rows[0].value) : new Date(0);
};

// Función para actualizar el tiempo de la última ejecución
const updateLastRunTime = async () => {
    await db.query(`UPDATE config SET value = ? WHERE id = 'last_run_time'`, [new Date()]);
};

// Función para registrar una nueva imagen en la base de datos
const registerImage = async (idEstudio, imagePath) => {
    try {
        await db.query(`INSERT INTO imagenes_estudios (estudio_id, imagen_url) VALUES (?, ?)`, [idEstudio, imagePath]);
    } catch (err) {
        console.error(`Error al registrar la imagen para el estudio ${idEstudio}:`, err.message);
    }
};

// Función para crear un detalle vacío para el estudio recién creado
const createEmptyEstudioDetail = async (estudioId) => {
    const today = new Date().toISOString().split('T')[0];  // Fecha en formato YYYY-MM-DD

    try {
        await db.query(
            `INSERT INTO estudio_detalles (estudio_id, descripcion, fecha_subida, estado) VALUES (?, ?, ?, ?)`,
            [estudioId, '', today, 1]
        );
        console.log(`Detalle vacío registrado para el estudio ID ${estudioId}`);
    } catch (err) {
        console.error(`Error al crear detalle vacío para el estudio ${estudioId}:`, err.message);
    }
};

// Función para obtener las imágenes de las carpetas
const getImagesFromFolder = (folderPath) => {
    let files = [];
    const items = fs.readdirSync(folderPath);

    items.forEach((item) => {
        const itemPath = path.join(folderPath, item);
        const stats = fs.statSync(itemPath);

        if (stats.isDirectory()) {
            files = files.concat(getImagesFromFolder(itemPath));  // Obtener imágenes de subdirectorios
        } else if (stats.isFile() && item.match(/\.(jpg|jpeg|png|gif|bmp)$/)) {
            files.push(itemPath);  // Solo archivos de imagen
        }
    });

    return files;
};

// Función para extraer el DNI del paciente desde el nombre de la subcarpeta
const extractEstudioIdFromPath = (filePath) => {
    const dirName = path.basename(path.dirname(filePath)); // Extraemos el DNI desde la subcarpeta
    console.log(`DNI extraído del path: ${dirName}`);
    return dirName; // Asumiendo que el nombre de la subcarpeta es el DNI
};

// Función para extraer la fecha de la carpeta principal
const extractDateFromPath = (folderPath) => {
    const baseName = path.basename(folderPath);
    console.log(`Fecha extraída del path: ${baseName}`);
    return baseName;  // Asumiendo que el nombre de la carpeta principal es la fecha
};

// Función para crear un nuevo estudio
const createNewEstudio = async (dniPaciente, tipoEstudioId) => {
    const today = new Date().toISOString();  

    try {
        // Insertar un nuevo estudio con el DNI del paciente y el tipo de estudio
        const [result] = await db.query(
            `INSERT INTO estudios (dni_paciente, fecha_estudio, tipo_estudio_id, estado) VALUES (?, ?, ?, ?)`,
            [dniPaciente, today, tipoEstudioId, 0]
        );
        const estudioId = result.insertId;  // Devuelve el ID auto-generado
        // Crear un detalle vacío para este estudio
        await createEmptyEstudioDetail(estudioId);
        return estudioId;
    } catch (err) {
        console.error('Error al crear nuevo estudio:', err.message);
        throw err;
    }
};

// Función para actualizar las imágenes (busca nuevas imágenes cada vez que se ejecute)
const updateImages = async () => {
    try {
        const lastRunTime = await getLastRunTime();
        const directories = fs.readdirSync(imagesFolder).filter(item => fs.statSync(path.join(imagesFolder, item)).isDirectory());

        // Recorre cada carpeta (que corresponde a una fecha)
        for (const dir of directories) {
            const folderPath = path.join(imagesFolder, dir);
            const stats = fs.statSync(folderPath);

            // Comprobar si la carpeta de fecha fue modificada después de la última ejecución
            if (stats.mtime.getTime() > lastRunTime.getTime()) {
                const fecha = extractDateFromPath(folderPath);  // Usar el nombre de la carpeta como fecha
                console.log(`Procesando la carpeta de fecha: ${fecha}`);

                // Ahora dentro de cada carpeta de fecha, recorrer las subcarpetas (que representan los DNIs)
                const subDirs = fs.readdirSync(folderPath).filter(item => fs.statSync(path.join(folderPath, item)).isDirectory());

                for (const subDir of subDirs) {
                    const patientFolderPath = path.join(folderPath, subDir);
                    const dniPaciente = extractEstudioIdFromPath(patientFolderPath);  // Extraer DNI del paciente desde la subcarpeta

                    console.log(`DNI del paciente: ${dniPaciente}`);

                    if (dniPaciente) {
                        // Obtener el tipo de estudio. En este ejemplo, usamos un tipo fijo, pero puedes ajustarlo
                        const tipoEstudioId = 1; // Por ejemplo: Radiografía

                        // Crear un nuevo estudio para el paciente (si no existe ya un estudio para este paciente)
                        const estudioId = await createNewEstudio(dniPaciente, tipoEstudioId);

                        // Obtener todas las imágenes de la carpeta del paciente
                        const files = getImagesFromFolder(patientFolderPath);

                        for (const filePath of files) {
                            // Generar la URL de la imagen para registrarla
                            const imagePath = `http://localhost:5000/${path.relative(process.cwd(), filePath).replace(/\\/g, '/')}`;
                            
                            // Registrar la imagen en la base de datos
                            await registerImage(estudioId, imagePath);
                            console.log(`Registrando imagen: ${path.basename(filePath)} para el estudio ${estudioId} en ${imagePath}`);
                        }
                    } else {
                        console.log(`No se pudo extraer el DNI del paciente para la imagen en ${subDir}`);
                    }
                }
            } else {
                console.log(`La carpeta de fecha ${dir} no ha sido modificada desde la última ejecución.`);
            }
        }

        await updateLastRunTime();
        console.log('Actualización completada. Próxima actualización en 30 minutos...');
    } catch (err) {
        console.error('Error al actualizar las imágenes:', err.message);
    }
};


// Ejecutar la función de actualización cada 30 minutos
setInterval(updateImages, 1800000);  // Ejecutar cada 30 minutos (1800000 ms)
console.log('Script iniciado. Actualizando imágenes cada 30 minutos...');
