import fs from "fs";
import path from "path";
import db from "./config/db.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import bcrypt from "bcrypt";

// --- Configuración ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ecografoFolder = "/home/gatti/imagesExport/ecografo"; // Ruta para producción (Linux)
//const ecografoFolder = join(__dirname, "ecografo"); // Ruta para desarrollo (Windows)


// --- Diccionarios ---
const traducciones_modality = {
  US: 4, // Ecografía
};

// --- Funciones de Ayuda ---
const capitalizar = (str) => {
  if (!str) return "";
  return str.toLowerCase().replace(/(^|\s)\S/g, (l) => l.toUpperCase());
};

const formatStudyDate = (dateStr) => {
  if (!dateStr || dateStr.length !== 8) return null;
  const day = dateStr.substring(0, 2);
  const month = dateStr.substring(2, 4);
  const year = dateStr.substring(4, 8);
  return `${year}-${month}-${day}`;
};

const getImagesFromFolder = (folderPath) => {
  let imageFiles = [];
  const allowedExtensions = [".jpg", ".jpeg", ".png"];
  try {
    const items = fs.readdirSync(folderPath);
    for (const item of items) {
      const itemPath = path.join(folderPath, item);
      const stat = fs.statSync(itemPath);
      if (!stat.isDirectory() && allowedExtensions.includes(path.extname(item).toLowerCase())) {
        imageFiles.push(itemPath);
      }
    }
  } catch (error) {
    console.error(`Error leyendo la carpeta de imágenes ${folderPath}:`, error);
  }
  return imageFiles;
};

// --- Funciones de Base de Datos ---
const getByDni = async (dni) => {
  const [rows] = await db.query("SELECT id FROM users WHERE dni = ?", [dni]);
  return rows[0]?.id;
};

const insertUser = async (dni, role_id, nombre, apellido, genero, edad) => {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(dni.toString(), salt);
    const [result] = await db.query(
      "INSERT INTO users (dni, password, nombre, apellido, genero, edad, role_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [dni, hashedPassword, nombre, apellido, genero, edad, role_id]
    );
    return result.insertId;
  };

const getExistingEstudio = async (studyInstanceUID) => {
  const [rows] = await db.query(
    "SELECT id FROM estudios WHERE study_instance_uid = ?",
    [studyInstanceUID]
  );
  return rows[0]?.id;
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

// --- Lógica Principal de Procesamiento ---

const processPatientFolder = async (patientFolderPath) => {
  try {
    const folderName = path.basename(patientFolderPath);
    const parts = folderName.split("_");
    if (parts.length < 3) return; // Ignorar carpetas con formato incorrecto

    const dni = parts[0].replace(/\D/g, "");
    const apellido = capitalizar(parts[1]);
    const nombre = capitalizar(parts.slice(2, -1).join(" "));

    if (!dni) return; // No se pudo extraer el DNI

    let pacienteId = await getByDni(dni);
    if (!pacienteId) {
      const genero = "Otro"; // Valor por defecto
      const edad = '1980-01-01'; // Valor por defecto
      pacienteId = await insertUser(dni, 3, nombre, apellido, genero, edad);
      console.log(`Nuevo paciente creado: ${nombre} ${apellido} (DNI: ${dni})`);
    }

    const studyFolders = fs.readdirSync(patientFolderPath, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const studyFolder of studyFolders) {
      const studyFolderPath = path.join(patientFolderPath, studyFolder);
      const datePart = studyFolder.split("_")[0];
      const fechaEstudio = formatStudyDate(datePart);

      if (!fechaEstudio) continue; // Formato de fecha incorrecto

      // Crear un UID único para el estudio basado en la ruta
      const studyInstanceUID = `ECO.${dni}.${studyFolder}`;
      let estudioId = await getExistingEstudio(studyInstanceUID);

      if (!estudioId) {
        estudioId = await createNewEstudio(dni, traducciones_modality.US, fechaEstudio, "Ecografía", studyInstanceUID);
        await createEmptyEstudioDetail(estudioId);
        console.log(`Nuevo estudio de ecografía creado con ID: ${estudioId}`);
      }

      const imageFiles = getImagesFromFolder(studyFolderPath);
      for (const filePath of imageFiles) {
        const relativePath = path.relative(ecografoFolder, filePath).replace(/\\/g, "/");
        const imageUrl = `https://imagenes.sanatorioprivadogatti.com.ar/api/ecografo/${relativePath}`;

        const [exists] = await db.query(
          "SELECT 1 FROM imagenes_estudios WHERE estudio_id = ? AND imagen_url = ? LIMIT 1",
          [estudioId, imageUrl]
        );

        if (exists.length === 0) {
          await registerImage(estudioId, imageUrl);
          console.log(`Registrando imagen: ${path.basename(filePath)} para el estudio ${estudioId}`);
        }
      }
    }
  } catch (error) {
    console.error(`Error procesando la carpeta del paciente ${patientFolderPath}:`, error);
  }
};

let isUpdating = false;

const updateEcografoImages = async () => {
  if (isUpdating) {
    console.log("El proceso de actualización de ecografías ya está en ejecución.");
    return;
  }
  isUpdating = true;
  console.log("Iniciando proceso de actualización de imágenes de ecografo...");

  try {
    if (!fs.existsSync(ecografoFolder)) {
      console.error(`El directorio de ecografías no existe: ${ecografoFolder}`);
      return;
    }

    const patientFolders = fs.readdirSync(ecografoFolder, { withFileTypes: true })
      .filter(d => d.isDirectory() && !d.name.startsWith("export"))
      .map(d => path.join(ecografoFolder, d.name));

    for (const patientFolder of patientFolders) {
      await processPatientFolder(patientFolder);
    }

    console.log("Proceso de actualización de ecografías completado.");
  } catch (err) {
    console.error("Error durante la actualización de ecografías:", err);
  } finally {
    isUpdating = false;
  }
};

// --- Ejecución ---
setInterval(updateEcografoImages, 600000); // Cada 10 minutos
console.log("Script de Ecografía iniciado. Buscando nuevas imágenes cada 10 minutos...");

updateEcografoImages();

export default updateEcografoImages;
