import os
import sys
import pydicom
from PIL import Image, ImageEnhance
import numpy as np
import json

# Función para convertir el archivo DICOM
def convertir_dicom_a_imagen(dicom_path, output_dir):
    try:
        ds = pydicom.dcmread(dicom_path)
        if 'PixelData' not in ds:
            return # No es un archivo de imagen, ignorar

        image_2d = ds.pixel_array.astype(float)

        # Windowing
        wc = float(ds.get("WindowCenter", image_2d.mean()))
        ww = float(ds.get("WindowWidth", image_2d.max() - image_2d.min()))
        img_min = wc - ww / 2
        img_max = wc + ww / 2
        image_2d = np.clip(image_2d, img_min, img_max)

        # Normalización usando percentiles
        p_low, p_high = np.percentile(image_2d, (1, 99))
        image_2d = np.clip(image_2d, p_low, p_high)
        image_2d_scaled = (image_2d - p_low) / (p_high - p_low) * 255.0
        image_2d_scaled = np.uint8(image_2d_scaled)

        # Convertir a imagen en escala de grises
        im = Image.fromarray(image_2d_scaled).convert('L')

        # Ajuste de contraste más suave
        enhancer = ImageEnhance.Contrast(im)
        im = enhancer.enhance(0.85)

        # Ajuste de brillo más suave
        enhancer_brightness = ImageEnhance.Brightness(im)
        im = enhancer_brightness.enhance(0.8)

        # Guardar la imagen convertida
        base_name = os.path.splitext(os.path.basename(dicom_path))[0]
        im.save(os.path.join(output_dir, f"{base_name}.jpg"))
    except Exception as e:
        # Ignorar archivos que no se pueden procesar como imagen
        pass

def extraer_datos_dicom(dicom_path):
    try:
        ds = pydicom.dcmread(dicom_path, stop_before_pixels=True)
        # Devuelve el diccionario de datos. Si falta PatientID, estará vacío.
        return {
            "PatientID": str(ds.get("PatientID", "")),
            "PatientName": str(ds.get("PatientName", "")),
            "PatientSex": str(ds.get("PatientSex", "")),
            "PatientBirthDate": str(ds.get("PatientBirthDate", "")),
            "BodyPartExamined": str(ds.get("BodyPartExamined", "")),
            "StudyDate": str(ds.get("StudyDate", "")),
            "ProtocolName": str(ds.get("ProtocolName", "")),
            "Modality": str(ds.get("Modality", "")),
            "StudyInstanceUID": str(ds.get("StudyInstanceUID", "")),
        }
    except Exception:
        # Si hay un error leyendo el archivo (corrupto, etc.), devolver diccionario vacío
        return {}

def parse_patient_txt(filepath):
    datos = {}
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            for line in f:
                if '=' in line:
                    key, value = line.strip().split('=', 1)
                    if key == 'PatientID':
                        datos['PatientID'] = value
                    elif key == 'PatientName':
                        datos['PatientName'] = value
                    elif key == 'PatientSex':
                        datos['PatientSex'] = value
    except FileNotFoundError:
        return {}
    return datos

def main(input_dir, output_dir):
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    archivos_dicom = sorted([os.path.join(input_dir, f) for f in os.listdir(input_dir) if f.lower().endswith('.dcm')])
    
    datos_finales = {}
    
    # Prioridad 1: Intentar obtener datos de archivos DICOM
    if archivos_dicom:
        for dicom_path in archivos_dicom:
            datos = extraer_datos_dicom(dicom_path)
            if datos.get("PatientID"):
                datos_finales = datos
                break 
    
    # Si no se encontró DNI en los DICOM, probar fallbacks
    if not datos_finales.get("PatientID"):
        # Prioridad 2: Intentar con PATIENT.txt
        patient_txt_path = os.path.join(input_dir, 'PATIENT.txt')
        if os.path.exists(patient_txt_path):
            datos_txt = parse_patient_txt(patient_txt_path)
            if datos_txt.get('PatientID'):
                datos_finales = datos_txt
        
        # Prioridad 3: Intentar con el nombre de la carpeta
        if not datos_finales.get("PatientID"):
            folder_name = os.path.basename(input_dir)
            if '_' in folder_name:
                patient_id = folder_name.split('_')[-1]
            else:
                numeric_part = ''.join(filter(str.isdigit, folder_name))
                if numeric_part:
                    patient_id = numeric_part
            if patient_id:
                datos_finales['PatientID'] = patient_id

    # Asegurar que todas las claves esperadas por Node.js existan, aunque estén vacías
    keys_to_ensure = [
        "PatientID", "PatientName", "PatientSex", "PatientBirthDate", 
        "BodyPartExamined", "StudyDate", "ProtocolName", "Modality", "StudyInstanceUID"
    ]
    for key in keys_to_ensure:
        datos_finales.setdefault(key, "")

    # Imprimir el JSON final para Node.js
    print(json.dumps(datos_finales))

    # Convertir todas las imágenes DICOM a JPG, si existen
    if archivos_dicom:
        for dicom_path in archivos_dicom:
            convertir_dicom_a_imagen(dicom_path, output_dir)

    print("Proceso de Python completado.", file=sys.stderr)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Uso: python convert_dicom.py <input_dir> <output_dir>", file=sys.stderr)
        sys.exit(1)

    input_dir = sys.argv[1]
    output_dir = sys.argv[2]
    main(input_dir, output_dir)
