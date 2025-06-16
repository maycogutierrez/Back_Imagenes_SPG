import fs from 'fs';
import path from 'path';
import db from './config/db.js';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Obtener el directorio actual con import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ruta al script de Python
const pythonScriptPath = join(__dirname, './convert_dicom.py');

const imagesFolder = '/home/gatti/images';  // Carpeta de imágenes DICOM en la VPS Ubuntu  // Carpeta de imágenes DICOM
/* 
Si el ordenador cliente tiene una dirección IP fija asignada en él, puede especificar la dirección IP 
manualmente incluyéndola en el nombre de ruta de la carpeta de destino. Por ejemplo, si la dirección IP es 
"192.168.1.191" y el nombre de la carpeta compartida es "usuario", introduzca "\\192.168.1.191\usuario" 
como ruta. 
const imagesFolder = path.join('\\\\192.168.1.191', 'images'); si esta en la carpta raiz queda asi
const imagesFolder = path.join('\\\\192.168.1.191', 'digitalizadora' , 'images'); si no esta en la carpta raiz queda asi,
hay que ir agregando las carptas entre comillas y separadas por ','
*/
const outputFolder = 'imgs';  // Carpeta de imágenes convertidas

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
const registerImage = async (estudioId, imagePath) => {
    try {
        await db.query(`INSERT INTO imagenes_estudios (estudio_id, imagen_url) VALUES (?, ?)`, [estudioId, imagePath]);
    } catch (err) {
        console.error(`Error al registrar la imagen para el estudio ${estudioId}:`, err.message);
    }
};

// Función para crear un detalle vacío para el estudio recién creado
const createEmptyEstudioDetail = async (estudioId) => {
    const today =new Date().toISOString().replace('T', ' ').split('.')[0];  // Formato: YYYY-MM-DD HH:MM:SS

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
        } else if (stats.isFile() && item.match(/\.(dcm|jpg|jpeg|png|gif|bmp)$/i)) {  // Buscar archivos DICOM o convertidos
            files.push(itemPath);
        }
    });

    return files;
};

// Función para extraer el DNI del paciente desde el nombre de la subcarpeta
const extractEstudioIdFromPath = (folderPath) => {
    const dirName = path.basename(folderPath);  // Extrae el DNI de la subcarpeta
    console.log(`DNI extraído del path: ${dirName}`);
    return dirName;  // Asumiendo que el nombre de la subcarpeta es el DNI
};

// Función para crear un nuevo estudio
const createNewEstudio = async (dniPaciente, tipoEstudioId, fecha) => {
    try {
        // Insertar un nuevo estudio con el DNI del paciente y el tipo de estudio
        const [result] = await db.query(
            `INSERT INTO estudios (dni_paciente, fecha_estudio, tipo_estudio_id, estado) VALUES (?, ?, ?, ?)`,
            [dniPaciente, fecha, tipoEstudioId, 0]
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

// Función para ejecutar el script de Python
const runPythonScript = (inputDir, outputDir) => {
    return new Promise((resolve, reject) => {
        const command = `python "${pythonScriptPath}" "${inputDir}" "${outputDir}"`;
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(`Error al ejecutar el script de Python: ${error.message}`);
            }
            if (stderr) {
                reject(`Error en stderr: ${stderr}`);
            }
            resolve(stdout);
        });
    });
};

// Función para procesar las imágenes de un paciente
const processImagesForPatient = async (patientFolderPath, fecha) => {
    const files = getImagesFromFolder(patientFolderPath);  // Obtener todas las imágenes de la carpeta del paciente

    if (files.length > 0) {
        const dniPaciente = extractEstudioIdFromPath(patientFolderPath);  // Extraer DNI del paciente desde la subcarpeta
        console.log(`Procesando estudios para el paciente con DNI: ${dniPaciente}`);

        const tipoEstudioId = 1;  // Ejemplo: Radiografía

        // Crear un nuevo estudio para el paciente (Asegura que se crea un estudio por paciente)
        const estudioId = await createNewEstudio(dniPaciente, tipoEstudioId, fecha);

        // Crear la estructura de carpetas en "imgs" para la fecha y DNI
        const fechaFolderPath = path.join(outputFolder, fecha);
        const pacienteFolderPath = path.join(fechaFolderPath, dniPaciente);

        // Asegurarse de que las carpetas existen
        if (!fs.existsSync(fechaFolderPath)) {
            fs.mkdirSync(fechaFolderPath, { recursive: true });
        }
        if (!fs.existsSync(pacienteFolderPath)) {
            fs.mkdirSync(pacienteFolderPath, { recursive: true });
        }

        // Ejecutar el script de Python para convertir los archivos DICOM a JPG
        await runPythonScript(patientFolderPath, pacienteFolderPath);

        // Buscar los archivos JPG generados en la carpeta de salida
        const convertedFiles = getImagesFromFolder(pacienteFolderPath);
        for (const jpgPath of convertedFiles) {
            const imagePath = `http://localhost:5000/${path.relative(process.cwd(), jpgPath).replace(/\\/g, '/')}`;
            await registerImage(estudioId, imagePath);
            console.log(`Registrando imagen: ${jpgPath} para el estudio ${estudioId} en ${imagePath}`);
        }
    } else {
        console.log(`No se encontraron imágenes DICOM o convertidas en la carpeta del paciente ${path.basename(patientFolderPath)}`);
    }
};

// Función para actualizar las imágenes
const updateImagesDicom = async () => {
    try {
        const lastRunTime = await getLastRunTime();
        const directories = fs.readdirSync(imagesFolder).filter(item => fs.statSync(path.join(imagesFolder, item)).isDirectory());

        // Recorre cada carpeta (que corresponde a una fecha)
        for (const dir of directories) {
            const folderPath = path.join(imagesFolder, dir);
            const stats = fs.statSync(folderPath);

            // Comprobar si la carpeta de fecha fue modificada después de la última ejecución
            if (stats.mtime.getTime() > lastRunTime.getTime()) {
                const fecha = dir;  // Usar el nombre de la carpeta como fecha
                // Ahora dentro de cada carpeta de fecha, recorrer las subcarpetas (que representan los DNIs)
                const subDirs = fs.readdirSync(folderPath).filter(item => fs.statSync(path.join(folderPath, item)).isDirectory());

                for (const subDir of subDirs) {
                    const patientFolderPath = path.join(folderPath, subDir);
                    await processImagesForPatient(patientFolderPath, fecha);  // Procesar imágenes de cada paciente
                }
            } else {
                console.log(`La carpeta de fecha ${dir} no ha sido modificada desde la última ejecución.`);
            }
        }

        await updateLastRunTime();
        console.log('Actualización completada. Próxima actualización en 30 minutos...');
    } catch (err) {
        console.error('Error al actualizar las imágenes:', err);
    }
};
// Ejecutar la función de actualización cada 30 minutos
setInterval(updateImagesDicom, 600000);  // Ejecutar cada 30 minutos (1800000 ms), 20 minutos (1200000 ms), 10 minutos (600000 ms) 
console.log('Script iniciado. Actualizando imágenes cada 10 minutos...');

export default updateImagesDicom;
