import os
import sys
import pydicom
from PIL import Image, ImageOps, ImageEnhance
import numpy as np
import json

def tiene_imagen(dicom_path):
    try:
        ds = pydicom.dcmread(dicom_path, stop_before_pixels=True)
        return hasattr(ds, "PixelData")
    except Exception:
        return False

# Función para convertir el archivo DICOM
def convertir_dicom_a_imagen(dicom_path, output_dir):
    ds = pydicom.dcmread(dicom_path)
    image_2d = ds.pixel_array.astype(float)

    # Escalar la imagen
    image_2d_scaled = (np.maximum(image_2d, 0) / image_2d.max()) * 255.0
    image_2d_scaled = np.uint8(image_2d_scaled)
    
    # Convertir a imagen
    im = Image.fromarray(image_2d_scaled).convert('L')
    
    # Invertir la imagen (fondo negro, cuerpo blanco)
    im = ImageOps.invert(im)
    
    # Aumentar el contraste
    enhancer = ImageEnhance.Contrast(im)
    factor = 2.0
    im = enhancer.enhance(factor)
    
    # Obtener el nombre base del archivo DICOM sin extensión
    base_name = os.path.splitext(os.path.basename(dicom_path))[0]
    
    # Guardar la imagen con el mismo nombre pero con extensión .jpg
    im.save(os.path.join(output_dir, f"{base_name}.jpg"))

def extraer_datos_dicom(dicom_path):
    ds = pydicom.dcmread(dicom_path, stop_before_pixels=True)
    datos = {
        "PatientID": str(ds.get("PatientID", "")),
        "PatientName": str(ds.get("PatientName", "")),
        "PatientSex": str(ds.get("PatientSex", "")),
        "PatientBirthDate": str(ds.get("PatientBirthDate", "")),
        "BodyPartExamined": str(ds.get("BodyPartExamined", "")),
        "Modality": str(ds.get("Modality", "")),
        "StudyDate": str(ds.get("StudyDate", "")),
        "StudyDescription": str(ds.get("StudyDescription", "")),
        "SeriesDescription": str(ds.get("SeriesDescription", "")),
        "ProtocolName": str(ds.get("ProtocolName", "")),
    }
    print(json.dumps(datos))

# Obtener las carpetas de entrada y salida desde los argumentos
if len(sys.argv) < 3:
    print("Uso: python convert_dicom.py <input_dir> <output_dir>")
    sys.exit(1)

input_dir = sys.argv[1]  # Carpeta de entrada
output_dir = sys.argv[2]  # Carpeta de salida

os.makedirs(output_dir, exist_ok=True)

first_dicom = None
# Recorrer todas las carpetas y subcarpetas dentro del directorio de entrada
for root, dirs, files in os.walk(input_dir):
    # Crear una subcarpeta correspondiente en el directorio de salida
    relative_path = os.path.relpath(root, input_dir)
    folder_output_dir = os.path.join(output_dir, relative_path)
    os.makedirs(folder_output_dir, exist_ok=True)

    # Buscar y procesar los archivos DICOM dentro de la carpeta actual
    for dicom_file in files:
        if dicom_file.endswith('.dcm'):
            dicom_path = os.path.join(root, dicom_file)
            if tiene_imagen(dicom_path):
                convertir_dicom_a_imagen(dicom_path, folder_output_dir)
                if not first_dicom:
                    first_dicom = dicom_path

if first_dicom:
    extraer_datos_dicom(first_dicom)
else:
    print(json.dumps({"NO_IMAGE": True}))  # Flag especial si no hay DICOM con imagen

print("Conversión completada")
