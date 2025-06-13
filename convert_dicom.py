import os
import sys
import pydicom
from PIL import Image
import numpy as np

# Función para convertir el archivo DICOM
def convertir_dicom_a_imagen(dicom_path, output_dir):
    ds = pydicom.dcmread(dicom_path)
    
    image_2d = ds.pixel_array.astype(float)
    
    # Escalar la imagen
    image_2d_scaled = (np.maximum(image_2d, 0) / image_2d.max()) * 255.0
    image_2d_scaled = np.uint8(image_2d_scaled)
    
    # Convertir a imagen
    im = Image.fromarray(image_2d_scaled)
    
    # Obtener el nombre base del archivo DICOM sin extensión
    base_name = os.path.splitext(os.path.basename(dicom_path))[0]
    
    # Guardar la imagen con el mismo nombre pero con extensión .jpg
    im.save(os.path.join(output_dir, f"{base_name}.jpg"))

# Obtener las carpetas de entrada y salida desde los argumentos
if len(sys.argv) < 3:
    print("Uso: python convert_dicom.py <input_dir> <output_dir>")
    sys.exit(1)

input_dir = sys.argv[1]  # Carpeta de entrada
output_dir = sys.argv[2]  # Carpeta de salida

os.makedirs(output_dir, exist_ok=True)

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
            convertir_dicom_a_imagen(dicom_path, folder_output_dir)

print("Conversión completada")
