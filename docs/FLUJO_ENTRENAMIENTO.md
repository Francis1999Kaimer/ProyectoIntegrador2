# Flujo de entrenamiento (pasos 0 a 6)

Este documento reemplaza el flujo descrito en `HITO8_RECONOCIMIENTO_CARACTERES.md`. El entrenamiento es el mismo para los seis tipos de proyecto y para los tres roles (alumno, docente y administrador). Todo el cálculo se hace con TensorFlow.js en el navegador, con una CNN creada desde cero; no se usan modelos preentrenados.

| Paso | Ruta | Qué hace |
|---|---|---|
| 0 · Proyecto | `/crear` | Nombre, salón opcional y tipo. Crea el borrador (sin cambios). |
| 1 · Datos | `/crear/datos` | Valida y guarda el ZIP. Se puede reemplazar hasta pasar al paso 2. |
| 2 · Preparación | `/crear/preparacion` | Conteo por categoría, bloqueo si faltan ejemplos, vista antes/después y división entrenamiento/prueba. |
| 3 · Configuración | `/crear/configuracion` | Épocas, learning rate, batch size y tamaño de la CNN, con valores recomendados según el hardware detectado. |
| 4 · Entrenar | `/crear/entrenar` | Un botón para entrenar; muestra métricas por época y la configuración usada, y guarda el resultado. |
| 5 · Evaluar | `/crear/evaluar` | Accuracy y loss de prueba, accuracy por categoría, matriz de confusión, ejemplos mal clasificados, diagnóstico e historial. |
| 6 · Probar | `/crear/probar` | Predicción con un ejemplo nuevo y descarga del modelo. |

Al abrir un proyecto (inicio o detalle) se usa `/crear/continuar`, que lleva al último paso alcanzado. Las rutas del flujo anterior (`/dataset`, `/preparacion`, `/modelo`, `/entrenamiento`, `/evaluacion`, `/prediccion`) redirigen ahí.

## Reglas

- **Reemplazo del ZIP:** permitido mientras el dataset no se haya confirmado con «Siguiente · Paso 2». Al confirmar, el dataset queda fijo. La única excepción es que no alcance para entrenar: entonces el paso 2 ofrece «Reemplazar ZIP», y al reemplazarlo se vuelve al paso 1.
- **Mínimo para entrenar:** 10 ejemplos por categoría (el paso 1 sigue aceptando desde 2). Con menos, el paso 2 bloquea el avance, y el backend rechaza la preparación, la configuración y el entrenamiento (409). Se recomiendan 20 o más.
- **División:** 10, 20 (recomendado) o 30 % de prueba por categoría, con `max(1, round(n × p / 100))` ejemplos. Se elige al azar con una semilla guardada, así que el conjunto de prueba siempre es el mismo. Queda fija con el primer entrenamiento.
- **Permisos:** solo el propietario carga, confirma, configura y entrena. El docente del salón y el administrador consultan en solo lectura. Un proyecto archivado, o de un salón archivado, es de solo lectura.
- **Tareas:** un proyecto del salón se puede entregar en una tarea; ver [SALONES_Y_TAREAS.md](SALONES_Y_TAREAS.md).
- **Historial:** cada entrenamiento se guarda con su configuración, hardware, métricas por época y resultados de prueba. Solo se conserva el modelo del último entrenamiento.

## Preparación por tipo

| Tipos | Entrada de la CNN | Preparación |
|---|---|---|
| Caracteres, dibujos simples | 28×28×1 | Fondo blanco, imagen completa a 28 × 28 en gris (0,299 R + 0,587 G + 0,114 B), valores 0–1; se invierte si el fondo es claro. |
| Imágenes, gestos de la mano, posturas corporales | 64×64×3 | Fondo blanco, recorte cuadrado central a 64 × 64 en color, valores 0–1. |
| Sonidos cortos | 64×64×1 | Mono, 16 kHz y 1 segundo: se elige el segundo con más energía (paso de 10 ms) y, si el audio es más corto, se completa con silencio. Se normaliza al pico y se calcula la STFT (512 muestras, paso 256, Hann). El espectrograma logarítmico se lleva a 64 × 64 con valores 0–1. |

**Por qué 1 segundo de audio.** Es el formato del dataset Speech Commands (clips de 1 s, 16 kHz, mono) y la ventana que usa el reconocedor de audio de TensorFlow.js. Alcanza para palmadas, silbidos y palabras cortas. Datasets de sonidos ambientales como ESC-50 (5 s) o UrbanSound8K (hasta 4 s) usan clips más largos, pero están pensados para eventos largos. Para no perder el sonido cuando la grabación dura más, se toma el segundo con más energía en vez del inicio.

## CNN

`Conv2D(f1, 3×3, ReLU) → MaxPooling 2×2 → Conv2D(f2, 3×3, ReLU) → [MaxPooling 2×2 si la entrada es 64×64] → Flatten → Dense(d, ReLU) → Dense(categorías, softmax)`, con optimizador Adam, pérdida categorical crossentropy y métrica accuracy.

| Tamaño | f1 / f2 | d |
|---|---|---|
| Pequeña | 4 / 8 | 16 |
| Mediana (la CNN del flujo anterior) | 8 / 16 | 32 |
| Grande | 16 / 32 | 64 |

**Valores recomendados:**
- Con WebGL: CNN mediana, 12 épocas, learning rate 0,001 y batch size 16.
- Con CPU: CNN pequeña y 8 épocas.

El tiempo por época se estima entrenando dos lotes con datos aleatorios en el propio equipo.

## API (backend)

| Método y ruta | Uso |
|---|---|
| `GET /projects/:id/training` | Estado completo: dataset (conteo, fijo, suficiente, se puede reemplazar), preparación, configuración, historial, modelo y paso alcanzado. |
| `POST /projects/:id/dataset` | Guardado inicial del ZIP; no sobrescribe (409). |
| `PUT /projects/:id/dataset` | Reemplazo; exige `expected_updated_at` y solo si no está fijo o no alcanza para entrenar. |
| `POST /projects/:id/dataset/lock` | Confirma el dataset al pasar al paso 2. |
| `GET /projects/:id/dataset/file` | Descarga el ZIP guardado. |
| `PUT /projects/:id/training/preparation` | `{ test_percent: 10 \| 20 \| 30 }`. |
| `PUT /projects/:id/training/config` | `{ epochs: 5–30, learning_rate: 0.0003 \| 0.001 \| 0.003, batch_size: 8 \| 16 \| 32, model_size: small \| medium \| large }`. |
| `POST /projects/:id/training/runs` | Guarda un entrenamiento con su número correlativo, configuración (igual a la guardada), hardware, historial, métricas y ZIP del modelo. |
| `GET /projects/:id/training/model-file` | Descarga el modelo del último entrenamiento. |

El backend abre el ZIP del dataset y cuenta los ejemplos reales de cada categoría. Además comprueba la estructura `categoría/archivo`, las extensiones, los tamaños y las firmas PNG, JPG o WAV. El resumen que envía el navegador (categorías y cantidad) debe coincidir con el contenido. En cada entrenamiento verifica que la matriz de confusión corresponda a la división guardada. Lo que no puede garantizar es que cada ejemplo pertenezca semánticamente a su categoría. Se retiraron los endpoints `/projects/:id/character-lab/*` y `/projects/with-dataset`.

## Base de datos

La migración `20261105120000_training_flow` solo agrega columnas y una tabla.

- **`character_labs`** (conserva el nombre por compatibilidad) guarda el ZIP y el modelo del último entrenamiento, y suma:
  - `dataset_counts_json`
  - `dataset_locked_at`
  - `test_percent`
  - `split_seed`
  - `training_config_json`
- **`training_runs`** guarda un registro por entrenamiento: configuración, hardware, historial, métricas y duración.

Los proyectos de caracteres que ya tenían un entrenamiento del flujo anterior quedan con el dataset fijo, y ese entrenamiento pasa a ser el número 1 del historial (sin resultados por categoría).

## Modelo exportado

El ZIP descargado contiene:
- `model.json` y `weights.bin`, en formato de capas de TensorFlow.js.
- `metadata.json`, con el tipo de proyecto, las categorías en orden, la forma de entrada, la preparación aplicada, la configuración, la división, las métricas, la fecha y la versión de TensorFlow.js.

## Límites conocidos

- Sin modelos preentrenados, en imágenes, gestos y posturas con pocas fotos la accuracy será modesta. Conviene usar fondos parecidos y 20 a 30 ejemplos por categoría.
- No hay botón para detener. Si se cierra o recarga la pestaña durante el entrenamiento, ese entrenamiento no se guarda.
- El nombre de la GPU y la memoria aproximada dependen de lo que informe el navegador.
