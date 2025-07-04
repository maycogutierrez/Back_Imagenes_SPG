import fs from "fs";
import path from "path";
import db from "./config/db.js";
import { exec } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import bcrypt from "bcrypt";


// --- Diccionarios de Traducción ---
const traducciones_body_part = {
  ABDOMEN: "Abdomen",
  "ABDOMEN PEDIATRIC": "Abdomen Pediátrico",
  ANKLE: "Tobillo",
  CALCANEUS: "Calcáneo",
  THORAX: "Tórax",
  CHEST: "Tórax",
  "CHEST PORTABLE": "Tórax Portátil",
  "CHEST PEDIATRIC": "Tórax Pediátrico",
  CLAVICLE: "Clavícula",
  COCCYX: "Cóccix",
  "CERVICAL SPINE": "Columna Cervical",
  "THORACIC SPINE": "Columna Torácica",
  "LUMBAR SPINE": "Columna Lumbar",
  "THORACOLUMBAR SPINE": "Columna Toracolumbar",
  SACRUM: "Sacro",
  ELBOW: "Codo",
  FEMUR: "Fémur",
  FINGER: "Dedo de la Mano",
  FOOT: "Pie",
  FOREARM: "Antebrazo",
  HAND: "Mano",
  HIP: "Cadera",
  HUMERUS: "Húmero",
  "INTRAVENOUS PYELOGRAM": "Pielograma Intravenoso",
  KNEE: "Rodilla",
  "KNEE PATELLA": "Rótula",
  LEG: "Pierna",
  MANDIBLE: "Mandíbula",
  "MASTOID PROCESS": "Apófisis Mastoides",
  "NASAL BONES": "Huesos Nasales",
  "PANORAMIC DENTAL": "Panorámica Dental",
  PELVIS: "Pelvis",
  "RIBS LOWER": "Costillas Inferiores",
  "RIBS UPPER": "Costillas Superiores",
  SCAPULA: "Escápula",
  SHOULDER: "Hombro",
  SINUSES: "Senos Paranasales",
  SKULL: "Cráneo",
  "SKULL SINUS": "Cráneo - Senos",
  "SKULL ZYGOMA": "Cráneo - Cigoma",
  "SKULL FACIAL": "Cráneo - Facial",
  "SKULL NASAL": "Cráneo - Nasal",
  "SKULL MANDIBLE": "Cráneo - Mandíbula",
  SPINE: "Columna Vertebral",
  "SPINE LUMBAR": "Columna Lumbar",
  STERNUM: "Esternón",
  "TIBIA FIBULA": "Tibia y Peroné",
  TOE: "Dedo del Pie",
  "VERTICAL LLI": "Pierna Vertical LLI",
  "SUPINE LLI": "Pierna Supina LLI",
  WRIST: "Muñeca",
  HYSTEROSALPINGOGRAPHY: "Histerosalpingografía",
  CHOLECYSTOGRAPHY: "Colecistografía",
  ESOPHAGUS: "Esófago",
  "BARIUM ENEMA": "Enema Opaco",
  BREAST: "Mama / Seno",
  "BREAST IMPLANT": "Implante Mamario",
  "BREAST BIOPSY": "Muestra de Mama",
  "DENSE BREAST": "Seno Denso",
  "FATTY BREAST": "Seno Adiposo",
  "HOMOGENEOUS BREAST": "Seno Homogéneo",
  "HETEROGENEOUS BREAST": "Seno Heterogéneo",
  "DENTAL CEPHALOMETRY": "Cefalometría Dental",
  "BONE DENSITOMETRY HAND": "Densitometría Ósea de Mano",
  "PROSTHESIS HIP": "Prótesis de Cadera",
  "PROSTHESIS FEMUR": "Prótesis de Fémur",
  "PROSTHESIS SHOULDER": "Prótesis de Hombro",
  "PROSTHESIS PELVIS": "Prótesis de Pelvis",
  "PROSTHESIS KNEE": "Prótesis de Rodilla",
  "PROSTHESIS SMALL BONES": "Prótesis de Huesos Pequeños",
  "PROSTHESIS TORSO": "Prótesis de Torso",
  "NOT SPECIFIED": "No Especificado",
};
const traducciones_modality = {
  CR: 1,
  CT: 2,
  MR: 3,
  US: 4,
  NM: 5,
  XA: 6,
  MG: 7,
  DX: 8,
  PT: 9,
  RF: 10,
  OT: 11,
};
const traducciones_sexo = {
  M: "Masculino",
  F: "Femenino",
  O: "Otro",
  "": "",
};

// --- Configuración ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pythonScriptPath = join(__dirname, "./convert_dicom.py");
// IMPORTANTE: Asegúrate de que esta ruta sea la correcta para tu sistema.
//const imagesFolder = path.join(process.cwd(), "images");
const imagesFolder = "/home/gatti/imagesExport";
const outputFolder = "imgs";

// --- Funciones de Ayuda ---
const capitalizar = (str) => {
  if (!str) return "";
  return str.toLowerCase().replace(/(^|\s)\S/g, (l) => l.toUpperCase());
};

const formatStudyDate = (dateStr) => {
  if (!dateStr || dateStr.length !== 8) return dateStr;
  return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
};

const getImagesFromFolder = (folderPath) => {
  let imageFiles = [];
  const allowedExtensions = [".jpg", ".jpeg", ".png"];
  try {
    const items = fs.readdirSync(folderPath);
    for (const item of items) {
      const itemPath = path.join(folderPath, item);
      const stat = fs.statSync(itemPath);
      if (stat.isDirectory()) {
        imageFiles = imageFiles.concat(getImagesFromFolder(itemPath));
      } else if (allowedExtensions.includes(path.extname(item).toLowerCase())) {
        imageFiles.push(itemPath);
      }
    }
  } catch (error) {
    console.error(`Error leyendo imágenes de ${folderPath}:`, error);
  }
  return imageFiles;
};

const runPythonScript = (inputDir, outputDir) => {
  return new Promise((resolve, reject) => {
    // Usar 'py' en lugar de 'python' para mayor compatibilidad en Windows.
    const command = `python3 "${pythonScriptPath}" "${inputDir}" "${outputDir}"`;

    // Log para depuración: muestra el comando que se va a ejecutar.
    console.log(`Ejecutando comando: ${command}`);

    exec(command, (error, stdout, stderr) => {
      // Si hay un error en la ejecución del script (ej: no encontrado, error de sintaxis)
      if (error) {
        console.error(`Error al ejecutar el script de Python: ${error.message}`);
        // stderr puede contener información valiosa sobre el error.
        if (stderr) {
          console.error(`Stderr: ${stderr}`);
        }
        return reject(`Error ejecutando el script de Python: ${error.message}`);
      }

      // Si el script se ejecuta pero devuelve un error (ej: carpeta no encontrada)
      if (stderr) {
        console.warn(`Advertencia (stderr) del script de Python: ${stderr}`);
      }

      let datosDicom = {};
      try {
        const lines = stdout.trim().split("\n");
        for (let i = lines.length - 1; i >= 0; i--) {
          try {
            // Intentar parsear cada línea como JSON.
            const parsedLine = JSON.parse(lines[i]);
            // Asumimos que la última línea JSON válida contiene los datos.
            datosDicom = parsedLine;
            break; // Salir del bucle una vez que se encuentra un JSON válido.
          } catch (e) {
            // Ignorar líneas que no son JSON válido, es esperado.
          }
        }

        if (Object.keys(datosDicom).length === 0) {
          console.log(
            "No se pudo extraer datos DICOM. La salida del script de Python puede estar vacía o no ser un JSON válido."
          );
          console.log("Salida (stdout):", stdout);
        }

        resolve(datosDicom);
      } catch (e) {
        console.error(
          "Error al parsear la salida JSON del script de Python:",
          e.message
        );
        console.error("Salida recibida (stdout):", stdout);
        reject(`Error parseando la salida del script de Python: ${e.message}`);
      }
    });
  });
};

// --- Funciones de Base de Datos ---
const getByDni = async (dni) => {
  const [rows] = await db.query("SELECT * FROM users WHERE dni = ?", [dni]);
  return rows;
};

const insertUser = async (dni, role_id, apellido, nombre, genero, edad) => {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(dni.toString(), salt);
  const [result] = await db.query(
    "INSERT INTO users (dni, password, nombre, apellido, genero, edad, role_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [dni, hashedPassword, nombre, apellido, genero, edad, role_id]
  );
  return result.insertId;
};

const getExistingEstudio = async (studyInstanceUID) => {
  if (!studyInstanceUID) return null;
  const [rows] = await db.query(
    "SELECT id FROM estudios WHERE study_instance_uid = ?",
    [studyInstanceUID]
  );
  return rows.length > 0 ? rows[0].id : null;
};

const createNewEstudio = async (
  dniPaciente,
  tipoEstudioId,
  fecha,
  part_cuerpo,
  studyInstanceUID
) => {
  const [result] = await db.query(
    "INSERT INTO estudios (dni_paciente, fecha_estudio, tipo_estudio_id, part_cuerpo, study_instance_uid) VALUES (?, ?, ?, ?, ?)",
    [dniPaciente, fecha, tipoEstudioId, part_cuerpo, studyInstanceUID]
  );
  return result.insertId;
};

const registerImage = async (estudioId, imagePath) => {
  await db.query(
    "INSERT INTO imagenes_estudios (estudio_id, imagen_url) VALUES (?, ?)",
    [estudioId, imagePath]
  );
};

const createEmptyEstudioDetail = async (estudioId) => {
  const today = new Date().toISOString().slice(0, 19).replace('T', ' ');
  try {
    await db.query(
      "INSERT INTO estudio_detalles (estudio_id, descripcion, fecha_subida, estado, dni_detalle) VALUES (?, ?, ?, ?, ?)",
      [estudioId, "", today, 1, 0]
    );
    console.log(`Detalle vacío registrado para el estudio ID ${estudioId}`);
  } catch (err) {
    console.error(`Error al crear detalle vacío para el estudio ${estudioId}:`, err.message);
  }
};

// --- Funciones Principales de Procesamiento ---
const processImagesForPatient = async (patientFolderPath) => {
  try {
    // 1. Define a temporary output path based on the input folder.
    const patientFolder = path.basename(patientFolderPath);
    const tempOutputPatientPath = path.join(
      process.cwd(),
      outputFolder,
      `temp_${path.basename(path.dirname(patientFolderPath))}_${patientFolder}`
    );

    // 2. Run Python script to convert images to the temp path and get metadata.
    const datosDicom = await runPythonScript(patientFolderPath, tempOutputPatientPath);

    if (!datosDicom || Object.keys(datosDicom).length === 0) {
      console.error(`No se pudo extraer datos DICOM para ${patientFolderPath}.`);
      if (fs.existsSync(tempOutputPatientPath)) fs.rmSync(tempOutputPatientPath, { recursive: true, force: true });
      return;
    }

    const studyInstanceUID = datosDicom.StudyInstanceUID;
    if (!studyInstanceUID) {
      console.error(`StudyInstanceUID no encontrado para ${patientFolderPath}. Se omite el estudio.`);
      if (fs.existsSync(tempOutputPatientPath)) fs.rmSync(tempOutputPatientPath, { recursive: true, force: true });
      return;
    }

    // 3. Define the final, canonical output path based on the StudyInstanceUID.
    const finalOutputPatientPath = path.join(process.cwd(), outputFolder, studyInstanceUID);
    if (!fs.existsSync(finalOutputPatientPath)) {
      fs.mkdirSync(finalOutputPatientPath, { recursive: true });
    }

    // 4. Move converted images from the temporary path to the final canonical path.
    if (fs.existsSync(tempOutputPatientPath)) {
        const tempFiles = fs.readdirSync(tempOutputPatientPath);
        for (const file of tempFiles) {
            const oldPath = path.join(tempOutputPatientPath, file);
            const newPath = path.join(finalOutputPatientPath, file);
            if (!fs.existsSync(newPath)) {
                fs.renameSync(oldPath, newPath);
            }
        }
        fs.rmSync(tempOutputPatientPath, { recursive: true, force: true });
    }

    const dniPaciente = datosDicom.PatientID;
    if (!dniPaciente) {
      console.log(`No se pudo obtener el DNI para ${patientFolderPath}, se omite.`);
      return;
    }

    let user = await getByDni(dniPaciente);
    if (!user) {
      const nombreCapitalizado = capitalizar((datosDicom.PatientName || "").split(",")[0]);
      const apellidoCapitalizado = capitalizar((datosDicom.PatientName || "").split(",")[1] || "");
      const sexoTraducido = traducciones_sexo[datosDicom.PatientSex] || "No especificado";
      await insertUser(dniPaciente, 1, apellidoCapitalizado, nombreCapitalizado, sexoTraducido, datosDicom.PatientBirthDate);
      console.log(`Nuevo usuario creado para DNI: ${dniPaciente}`);
    }

    const part_cuerpo = traducciones_body_part[datosDicom.BodyPartExamined.toUpperCase()] || capitalizar(datosDicom.BodyPartExamined) || "No Especificado";
    const tipoEstudioId = traducciones_modality[datosDicom.Modality.toUpperCase()] || 11;
    const fechaEstudioReal = formatStudyDate(datosDicom.StudyDate);

    // 5. Find or create the study record in the database.
    let estudioId = await getExistingEstudio(studyInstanceUID);
    if (!estudioId) {
      estudioId = await createNewEstudio(dniPaciente, tipoEstudioId, fechaEstudioReal, part_cuerpo, studyInstanceUID);
      await createEmptyEstudioDetail(estudioId);
      console.log(`Nuevo estudio creado con ID: ${estudioId} (UID: ${studyInstanceUID})`);
    } else {
      console.log(`Estudio con UID ${studyInstanceUID} ya existe. ID: ${estudioId}. Buscando nuevas imágenes...`);
    }

    // 6. Register any new images found in the canonical folder.
    const convertedFiles = getImagesFromFolder(finalOutputPatientPath);
    for (const jpgPath of convertedFiles) {
      const imagePath = `https://imagenes.sanatorioprivadogatti.com.ar/api/${path.relative(process.cwd(), jpgPath).replace(/\\/g, "/")}`;

      const [exists] = await db.query(
        "SELECT 1 FROM imagenes_estudios WHERE estudio_id = ? AND imagen_url = ? LIMIT 1",
        [estudioId, imagePath]
      );

      if (exists.length === 0) {
        await registerImage(estudioId, imagePath);
        console.log(`Registrando NUEVA imagen: ${path.basename(jpgPath)} para el estudio ${estudioId}`);
      }
    }

  } catch (error) {
    console.error(`Error procesando la carpeta del paciente ${patientFolderPath}:`, error);
  }
};

// Variable de bloqueo para evitar ejecuciones concurrentes
let isUpdating = false;

const updateImagesDicom = async () => {
  if (isUpdating) {
    console.log("El proceso de actualización ya está en ejecución. Se omite esta llamada.");
    return;
  }

  isUpdating = true;
  console.log("Iniciando proceso de actualización de imágenes...");

  try {
    if (!fs.existsSync(imagesFolder)) {
      console.error(`El directorio de imágenes no existe: ${imagesFolder}`);
      return;
    }
    const today = new Date();
    const year = today.getFullYear().toString().slice(-2);
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    const datePrefix = `${year}${month}${day}`;

    const allDirs = fs.readdirSync(imagesFolder, { withFileTypes: true });
    const todayDirs = allDirs
      .filter(
        (dirent) =>
          dirent.isDirectory() &&
          dirent.name.startsWith(datePrefix) &&
          !dirent.name.startsWith("$")
      )
      .map((dirent) => dirent.name);

    if (todayDirs.length === 0) {
      console.log(
        `No se encontraron directorios para el prefijo de fecha de hoy: ${datePrefix}`
      );
      return;
    }

    console.log(
      `Se encontraron ${todayDirs.length} directorios para hoy:`,
      todayDirs
    );

    for (const dir of todayDirs) {
      const dateFolderPath = path.join(imagesFolder, dir);
      const patientDirs = fs.readdirSync(dateFolderPath, { withFileTypes: true })
        .filter(
          (dirent) =>
            dirent.isDirectory() && dirent.name.toUpperCase().startsWith("PID")
        )
        .map((dirent) => dirent.name);

      for (const patientDir of patientDirs) {
        const patientFolderPath = path.join(dateFolderPath, patientDir);
        await processImagesForPatient(patientFolderPath);
      }
    }

    console.log("Proceso de actualización de imágenes completado.");
  } catch (err) {
    console.error("Error durante la actualización de imágenes:", err);
  } finally {
    isUpdating = false;
    console.log("El proceso de actualización ha finalizado y el bloqueo ha sido liberado.");
  }
};

// --- Ejecución ---
// Ejecutar la función de actualización cada 10 minutos
setInterval(updateImagesDicom, 600000);
console.log("Script iniciado. Buscando nuevas imágenes cada 10 minutos...");

// Ejecución inicial al arrancar
updateImagesDicom();

export default updateImagesDicom;
