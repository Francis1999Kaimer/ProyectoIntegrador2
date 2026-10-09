# Hito 8 — Laboratorio de reconocimiento de caracteres

El sistema ofrece un único tipo de proyecto: `character_recognition`. Cada proyecto entrena una CNN pequeña en el navegador con TensorFlow.js; no hay modelos genéricos ni resultados simulados en la interfaz.

## Dataset admitido

El usuario carga un archivo ZIP con una carpeta por etiqueta y una imagen PNG o JPG por archivo:

```text
dataset.zip
├── 0/001.png
├── 0/002.png
├── A/001.png
└── A/002.png
```

Se requieren al menos dos etiquetas, dos imágenes por etiqueta y doce imágenes en total. Cada imagen se convierte a escala de grises de 28 × 28 píxeles y se normaliza antes del entrenamiento.

## Flujo

1. Crear un proyecto de reconocimiento de caracteres.
2. Cargar el ZIP etiquetado.
3. Revisar la preparación automática y la CNN fija.
4. Entrenar 12 épocas localmente.
5. Consultar accuracy y loss sobre la partición de prueba.
6. Subir una imagen nueva para obtener etiqueta y confianza.

El dataset, las métricas y el modelo se almacenan con IndexedDB en el navegador actual. Por tanto, no se sincronizan entre equipos y las imágenes no se envían al backend. El backend persiste el proyecto, aplica permisos y rechaza la creación de tipos distintos de `character_recognition`.
