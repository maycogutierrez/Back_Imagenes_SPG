import fs from 'fs';
import path from 'path';
import db from './config/db.js';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import crypto from 'crypto';

// Obtener el directorio actual con import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ruta al script de Python
const pythonScriptPath = join(__dirname, './convert_dicom.py');

const imagesFolder = '/home/gatti/images/';  // Carpeta de imágenes DICOM en la VPS Ubuntu
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
const createEmptyEstudioDetail = async (estudioId, dniPaciente) => {
    const today = new Date().toISOString().replace('T', ' ').split('.')[0];  // Formato: YYYY-MM-DD HH:MM:SS
    try {
        await db.query(
            `INSERT INTO estudio_detalles (estudio_id, descripcion, fecha_subida, estado, dni_detalle) VALUES (?, ?, ?, ?, ?)`,
            [estudioId, '', today, 1, dniPaciente]
        );
        console.log(`Detalle vacío registrado para el estudio ID ${estudioId}`);
    } catch (err) {
        console.error(`Error al crear detalle vacío para el estudio ${estudioId}:`, err.message);
    }
};

// Función para obtener las imágenes de las carpetas (solo extensiones comunes y DICOM)
const getImagesFromFolder = (folderPath) => {
    let files = [];
    const items = fs.readdirSync(folderPath);

    items.forEach((item) => {
        const itemPath = path.join(folderPath, item);
        const stats = fs.statSync(itemPath);

        if (stats.isDirectory()) {
            files = files.concat(getImagesFromFolder(itemPath));  // Obtener imágenes de subdirectorios
        } else if (stats.isFile() && item.match(/\.(dcm|dicom|jpg|jpeg|png|gif|bmp)$/i)) {  // Buscar archivos DICOM o convertidos
            files.push(itemPath);
        }
    });

    return files;
};

// Función para obtener sólo archivos DICOM (.dcm) en una carpeta y subcarpetas
const getDicomFilesFromFolder = (folderPath) => {
    let dicomFiles = [];
    const items = fs.readdirSync(folderPath);
    items.forEach(item => {
        const itemPath = path.join(folderPath, item);
        const stats = fs.statSync(itemPath);
        if (stats.isDirectory()) {
            dicomFiles = dicomFiles.concat(getDicomFilesFromFolder(itemPath));
        } else if (stats.isFile() && item.toLowerCase().endsWith('.dcm')) {
            dicomFiles.push(itemPath);
        }
    });
    return dicomFiles;
};

// Función para extraer el DNI del paciente desde el nombre de la subcarpeta
const extractEstudioIdFromPath = (folderPath) => {
    const dirName = path.basename(folderPath);  // Extrae el DNI de la subcarpeta
    console.log(`DNI extraído del path: ${dirName}`);
    return dirName;  // Asumiendo que el nombre de la subcarpeta es el DNI
};

// Nueva función para verificar si ya existe un estudio para DNI + fecha + tipo
const getExistingEstudio = async (dniPaciente, fecha, tipoEstudioId) => {
    const [rows] = await db.query(
        `SELECT id FROM estudios WHERE dni_paciente = ? AND fecha_estudio = ? AND tipo_estudio_id = ? LIMIT 1`,
        [dniPaciente, fecha, tipoEstudioId]
    );
    return rows.length > 0 ? rows[0].id : null;
};

// Función para crear un nuevo estudio
const createNewEstudio = async (dniPaciente, tipoEstudioId, fecha) => {
    try {
        const [result] = await db.query(
            `INSERT INTO estudios (dni_paciente, fecha_estudio, tipo_estudio_id, estado) VALUES (?, ?, ?, ?)`,
            [dniPaciente, fecha, tipoEstudioId, 0]
        );
        const estudioId = result.insertId;
        await createEmptyEstudioDetail(estudioId, dniPaciente);
        return estudioId;
    } catch (err) {
        console.error('Error al crear nuevo estudio:', err.message);
        throw err;
    }
};

// Función para ejecutar el script de Python
const runPythonScript = (inputDir, outputDir) => {
    return new Promise((resolve, reject) => {
        const command = `python3 "${pythonScriptPath}" "${inputDir}" "${outputDir}"`;
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

const getByDni = async (dni) => {
    const [rows] = await db.query('SELECT * FROM users WHERE dni = ?', [dni]);
    return rows;
};

const insertUser = async (dni, password, role_id) => {
    await db.query(
        `INSERT INTO users (dni, password, role_id) VALUES (?, ?, ?)`,
        [dni, password, role_id]
    );
};

// Función para procesar las imágenes de un paciente
const processImagesForPatient = async (patientFolderPath, fecha) => {
    // Buscamos solo archivos DICOM para validar existencia
    const dicomFiles = getDicomFilesFromFolder(patientFolderPath);

    if (dicomFiles.length === 0) {
        console.log(`No se encontraron archivos DICOM para el paciente ${path.basename(patientFolderPath)} en fecha ${fecha}, no se crea estudio.`);
        return;  // Salimos sin crear estudio ni registrar imágenes
    }

    // Si hay DICOMs, seguimos con el proceso
    const files = getImagesFromFolder(patientFolderPath);  // Usamos esta para buscar dcm + convertidos

    const dniPaciente = extractEstudioIdFromPath(patientFolderPath);
    console.log(`Procesando estudios para el paciente con DNI: ${dniPaciente}`);

    // Validar si el usuario ya existe
    const existingUser = await getByDni(dniPaciente);
    if (!existingUser || existingUser.length === 0) {
        const randomPassword = crypto.randomBytes(8).toString('hex');
        await insertUser(dniPaciente, randomPassword, 3);
        console.log(`Usuario creado automáticamente para DNI: ${dniPaciente}`);
    }

    const tipoEstudioId = 1;

    // Buscar estudio existente o crear uno nuevo
    let estudioId = await getExistingEstudio(dniPaciente, fecha, tipoEstudioId);
    if (!estudioId) {
        estudioId = await createNewEstudio(dniPaciente, tipoEstudioId, fecha);
    } else {
        console.log(`Estudio ya existente para DNI ${dniPaciente}, fecha ${fecha}`);
    }

    const fechaFolderPath = path.join(outputFolder, fecha);
    const pacienteFolderPath = path.join(fechaFolderPath, dniPaciente);

    if (!fs.existsSync(pacienteFolderPath)) {
        fs.mkdirSync(pacienteFolderPath, { recursive: true });
    }

    await runPythonScript(patientFolderPath, pacienteFolderPath);

    const convertedFiles = getImagesFromFolder(pacienteFolderPath);
    for (const jpgPath of convertedFiles) {
        const imagePath = `http://172.16.18.167/api/${path.relative(process.cwd(), jpgPath).replace(/\\/g, '/')}`;

        // Verificar si la imagen ya está registrada
        const [exists] = await db.query(
            'SELECT 1 FROM imagenes_estudios WHERE estudio_id = ? AND imagen_url = ? LIMIT 1',
            [estudioId, imagePath]
        );

        if (exists.length === 0) {
            await registerImage(estudioId, imagePath);
            console.log(`Registrando imagen: ${jpgPath} para el estudio ${estudioId}`);
        } else {
            console.log(`Imagen ya registrada: ${imagePath}`);
        }
    }
};

// Función para actualizar las imágenes
const updateImagesDicom = async () => {
    try {
        const lastRunTime = await getLastRunTime();
        const directories = fs.readdirSync(imagesFolder).filter(item => fs.statSync(path.join(imagesFolder, item)).isDirectory());

        for (const dir of directories) {
            const folderPath = path.join(imagesFolder, dir);
            const stats = fs.statSync(folderPath);

            if (stats.mtime.getTime() > lastRunTime.getTime()) {
                const fecha = dir;
                const subDirs = fs.readdirSync(folderPath).filter(item => fs.statSync(path.join(folderPath, item)).isDirectory());

                for (const subDir of subDirs) {
                    const patientFolderPath = path.join(folderPath, subDir);
                    await processImagesForPatient(patientFolderPath, fecha);
                }
            } else {
                console.log(`La carpeta de fecha ${dir} no ha sido modificada desde la última ejecución.`);
            }
        }

        await updateLastRunTime();
        console.log('Actualización completada. Próxima actualización en 10 minutos...');
    } catch (err) {
        console.error('Error al actualizar las imágenes:', err);
    }
};

// Ejecutar la función de actualización cada 10 minutos
//setInterval(updateImagesDicom, 600000);
console.log('Script iniciado. Actualizando imágenes cada 10 minutos...');

export default updateImagesDicom;
