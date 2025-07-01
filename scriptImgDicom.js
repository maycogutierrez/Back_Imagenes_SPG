import fs from "fs";
import path from "path";
import db from "./config/db.js";
import { exec } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import crypto from "crypto";
import bcrypt from "bcrypt";

// Diccionarios de traducción
const traducciones_body_part = {
  ABDOMEN: "Abdomen",
  "ABDOMEN PEDIATRIC": "Abdomen Pediátrico",
  ANKLE: "Tobillo",
  CALCANEUS: "Calcáneo",
  "THORAX" : "Tórax",
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

// Obtener el directorio actual con import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ruta al script de Python
const pythonScriptPath = join(__dirname, "./convert_dicom.py");
//const imagesFolder = path.join(process.cwd(), "images");
const imagesFolder = "/home/gatti/images"; // Carpeta de imágenes
const outputFolder = "imgs"; // Carpeta de imágenes convertidas

// Función para ejecutar el script de Python y extraer datos DICOM
const runPythonScript = (inputDir, outputDir) => {
  return new Promise((resolve, reject) => {
    const command = `python3 "${pythonScriptPath}" "${inputDir}" "${outputDir}"`;
    exec(command, (error, stdout, stderr) => {
      if (error)
        return reject(
          `Error al ejecutar el script de Python: ${error.message}`
        );
      let datosDicom = {};
      try {
        const lines = stdout.trim().split("\n");
        for (let i = lines.length - 1; i >= 0; i--) {
          try {
            datosDicom = JSON.parse(lines[i]);
            break;
          } catch {}
        }
      } catch (e) {
        console.error("No se pudo parsear la salida JSON del script de Python");
      }
      resolve(datosDicom);
    });
  });
};

// Función para obtener sólo archivos DICOM (.dcm) en una carpeta y subcarpetas
const getDicomFilesFromFolder = (folderPath) => {
  let dicomFiles = [];
  const items = fs.readdirSync(folderPath);
  items.forEach((item) => {
    const itemPath = path.join(folderPath, item);
    const stats = fs.statSync(itemPath);
    if (stats.isDirectory()) {
      dicomFiles = dicomFiles.concat(getDicomFilesFromFolder(itemPath));
    } else if (stats.isFile() && item.toLowerCase().endsWith(".dcm")) {
      dicomFiles.push(itemPath);
    }
  });
  return dicomFiles;
};

// Función para obtener las imágenes de las carpetas (solo extensiones comunes y DICOM)
const getImagesFromFolder = (folderPath) => {
  let files = [];
  const items = fs.readdirSync(folderPath);

  items.forEach((item) => {
    const itemPath = path.join(folderPath, item);
    const stats = fs.statSync(itemPath);

    if (stats.isDirectory()) {
      files = files.concat(getImagesFromFolder(itemPath)); // Obtener imágenes de subdirectorios
    } else if (
      stats.isFile() &&
      item.match(/\.(dcm|dicom|jpg|jpeg|png|gif|bmp)$/i)
    ) {
      // Buscar archivos DICOM o convertidos
      files.push(itemPath);
    }
  });

  return files;
};

// Función para extraer el DNI del paciente desde el nombre de la subcarpeta
const extractEstudioIdFromPath = (folderPath) => {
  let dirName = path.basename(folderPath); // Extrae el DNI de la subcarpeta
  // Elimina puntos y espacios en blanco
  dirName = dirName.replace(/[.\s]/g, "");
  console.log(`DNI extraído del path: ${dirName}`);
  return dirName;
};

const getByDni = async (dni) => {
  const [rows] = await db.query("SELECT * FROM users WHERE dni = ?", [dni]);
  return rows;
};

// Ahora el usuario se crea con más datos si están disponibles

const insertUser = async (
  dni,
  password,
  role_id,
  apellidoFinal,
  nombre,
  sexo,
  nacimiento
) => {
  // Usar siempre la contraseña "Gatti2025" encriptada
  const hashedPassword = bcrypt.hashSync("Gatti2025", 10);
  await db.query(
    `INSERT INTO users (dni, password, role_id, nombre, apellido, genero, edad) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [dni, hashedPassword, role_id, nombre, apellidoFinal, sexo, nacimiento]
  );
};

// Nueva función para verificar si ya existe un estudio para DNI + fecha + tipo
const getExistingEstudio = async (dniPaciente, fecha, tipoEstudioId) => {
  const [rows] = await db.query(
    `SELECT id FROM estudios WHERE dni_paciente = ? AND fecha_estudio = ? AND tipo_estudio_id = ? LIMIT 1`,
    [dniPaciente, fecha, tipoEstudioId]
  );
  return rows.length > 0 ? rows[0].id : null;
};

// Ahora el estudio se crea con más datos si están disponibles
const createNewEstudio = async (
  dniPaciente,
  tipoEstudioId,
  fecha,
  part_cuerpo
) => {
  const [result] = await db.query(
    `INSERT INTO estudios (dni_paciente, fecha_estudio, tipo_estudio_id, part_cuerpo) VALUES (?, ?, ?, ?)`,
    [dniPaciente, fecha, tipoEstudioId, part_cuerpo]
  );
  return result.insertId;
};

const registerImage = async (estudioId, imagePath) => {
  try {
    await db.query(
      `INSERT INTO imagenes_estudios (estudio_id, imagen_url) VALUES (?, ?)`,
      [estudioId, imagePath]
    );
  } catch (err) {
    console.error(
      `Error al registrar la imagen para el estudio ${estudioId}:`,
      err.message
    );
  }
};

// Función para crear un detalle vacío para el estudio recién creado
const createEmptyEstudioDetail = async (estudioId) => {
  const today = new Date().toISOString().replace("T", " ").split(".")[0]; // Formato: YYYY-MM-DD HH:MM:SS
  try {
    await db.query(
      `INSERT INTO estudio_detalles (estudio_id, descripcion, fecha_subida, estado, dni_detalle) VALUES (?, ?, ?, ?, ?)`,
      [estudioId, "", today, 1, "000000000"]
    );
    console.log(`Detalle vacío registrado para el estudio ID ${estudioId}`);
  } catch (err) {
    console.error(
      `Error al crear detalle vacío para el estudio ${estudioId}:`,
      err.message
    );
  }
};
function capitalizar(str) {
  return str.toLowerCase().replace(/(^|\s)\S/g, (l) => l.toUpperCase());
}

// Función para procesar las imágenes de un paciente
const processImagesForPatient = async (patientFolderPath, fecha) => {
  // Buscamos solo archivos DICOM para validar existencia
  const dicomFiles = getDicomFilesFromFolder(patientFolderPath);

  if (dicomFiles.length === 0) {
    console.log(
      `No se encontraron archivos DICOM para el paciente ${path.basename(
        patientFolderPath
      )} en fecha ${fecha}, no se crea estudio.`
    );
    return; // Salimos sin crear estudio ni registrar imágenes ni usuario
  }

  // Limpiar DNI
  const dniPaciente = extractEstudioIdFromPath(patientFolderPath);
  const fechaFolderPath = path.join(outputFolder, fecha);
  const pacienteFolderPath = path.join(fechaFolderPath, dniPaciente);
  if (!fs.existsSync(pacienteFolderPath)) {
    fs.mkdirSync(pacienteFolderPath, { recursive: true });
  }

  // Ejecutar el script de Python y obtener los datos DICOM
  const datosDicom = await runPythonScript(
    patientFolderPath,
    pacienteFolderPath
  );

  // Traducciones y valores por defecto
  const nombreDicom = datosDicom.PatientName || "";
  const partes = nombreDicom.split("^");
  const apellidoFinal = capitalizar(partes[0] || "");
  const nombresFinal = capitalizar(partes.slice(1).filter(Boolean).join(" "));
  const sexo =
    traducciones_sexo[(datosDicom.PatientSex || "").toUpperCase()] || "";
  const nacimiento = datosDicom.PatientBirthDate || null;
  const part_cuerpo =
    traducciones_body_part[(datosDicom.BodyPartExamined || "").toUpperCase()] ||
    datosDicom.BodyPartExamined ||
    "";
  const tipoEstudioId =
    traducciones_modality[(datosDicom.Modality || "").toUpperCase()] || 1;

  // Registrar usuario si no existe
  const existingUser = await getByDni(dniPaciente);
  if (!existingUser || existingUser.length === 0) {
    const randomPassword = crypto.randomBytes(8).toString("hex");
    await insertUser(
      dniPaciente,
      randomPassword,
      3,
      apellidoFinal,
      nombresFinal,
      sexo,
      nacimiento
    );
    console.log(`Usuario creado automáticamente para DNI: ${dniPaciente}`);
  }

  // Buscar estudio existente o crear uno nuevo
  let estudioId = await getExistingEstudio(dniPaciente, fecha, tipoEstudioId);
  if (!estudioId) {
    estudioId = await createNewEstudio(
      dniPaciente,
      tipoEstudioId,
      fecha,
      part_cuerpo
    );
    await createEmptyEstudioDetail(estudioId, dniPaciente);
  } else {
    console.log(`Estudio ya existente para DNI ${dniPaciente}, fecha ${fecha}`);
  }

  // Registrar imágenes convertidas
  const convertedFiles = getImagesFromFolder(pacienteFolderPath);
  for (const jpgPath of convertedFiles) {
    const imagePath = `https://imagenes.sanatorioprivadogatti.com.ar/api/${path
      .relative(process.cwd(), jpgPath)
      .replace(/\\/g, "/")}`;

    // Verificar si la imagen ya está registrada
    const [exists] = await db.query(
      "SELECT 1 FROM imagenes_estudios WHERE estudio_id = ? AND imagen_url = ? LIMIT 1",
      [estudioId, imagePath]
    );

    if (exists.length === 0) {
      await registerImage(estudioId, imagePath);
      console.log(
        `Registrando imagen: ${jpgPath} para el estudio ${estudioId}`
      );
    } else {
      console.log(`Imagen ya registrada: ${imagePath}`);
    }
  }
};

// Función para obtener el último tiempo de ejecución
const getLastRunTime = async () => {
  const [rows] = await db.query(
    'SELECT value FROM config WHERE id = "last_run_time"'
  );
  return rows.length > 0 ? new Date(rows[0].value) : new Date(0);
};

// Función para actualizar el tiempo de la última ejecución
const updateLastRunTime = async () => {
  await db.query(`UPDATE config SET value = ? WHERE id = 'last_run_time'`, [
    new Date(),
  ]);
};

// Función para actualizar las imágenes
const updateImagesDicom = async () => {
  try {
    const lastRunTime = await getLastRunTime();
    const directories = fs
      .readdirSync(imagesFolder)
      .filter((item) =>
        fs.statSync(path.join(imagesFolder, item)).isDirectory()
      );

    for (const dir of directories) {
      const folderPath = path.join(imagesFolder, dir);
      const stats = fs.statSync(folderPath);

      if (stats.mtime.getTime() > lastRunTime.getTime()) {
        const fecha = dir;
        const subDirs = fs
          .readdirSync(folderPath)
          .filter((item) =>
            fs.statSync(path.join(folderPath, item)).isDirectory()
          );

        for (const subDir of subDirs) {
          const patientFolderPath = path.join(folderPath, subDir);
          await processImagesForPatient(patientFolderPath, fecha);
        }
      } else {
        console.log(
          `La carpeta de fecha ${dir} no ha sido modificada desde la última ejecución.`
        );
      }
    }

    await updateLastRunTime();
    console.log("Actualización completada. Próxima actualización en 1 hora...");
  } catch (err) {
    console.error("Error al actualizar las imágenes:", err);
  }
};

// Ejecutar la función de actualización cada 10 minutos
setInterval(updateImagesDicom, 3600000); // 3600000 ms = 1 hora
console.log("Script iniciado. Actualizando imágenes cada 1 hora...");

export default updateImagesDicom;
