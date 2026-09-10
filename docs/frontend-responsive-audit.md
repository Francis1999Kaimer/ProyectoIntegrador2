# Auditoría responsive — AI Blocks Studio

## Problemas encontrados

1. `styles.css` fijaba `body { min-width: 1180px }`.
2. `carbon-friendly.css` volvía a fijar `body { min-width: 1024px }`.
3. La aplicación solo tenía algunos breakpoints aislados en 1250, 1180, 1100 y 760 px.
4. El editor React Flow mantenía siempre tres columnas y una altura fija.
5. Header, stepper y tabs podían desbordar horizontalmente en tablet/móvil.
6. Métricas, evaluación, predicción y código generado no tenían una estrategia compacta consistente.
7. El wizard dinámico tenía responsive parcial, pero no cubría móviles estrechos.

## Solución

Se añade `Frontend/src/responsive.css` y se carga al final de la cascada. Esta capa:

- elimina `min-width` globales;
- evita overflow horizontal de página;
- usa scroll horizontal solo para navegación/tabs donde es correcto;
- apila grids complejos de forma progresiva;
- adapta React Flow a laptop, tablet y móvil;
- mejora targets táctiles;
- respeta `prefers-reduced-motion`;
- conserva la estética Carbon existente.

## Breakpoints de referencia

| Rango | Comportamiento |
| --- | --- |
| > 1280 px | Escritorio completo |
| 769–1280 px | Laptop / tablet horizontal |
| 481–768 px | Tablet / móvil |
| <= 480 px | Móvil compacto |

## Matriz manual recomendada

Validar como mínimo en DevTools:

- 1440 × 900 — laptop/escritorio.
- 1280 × 720 — laptop pequeña.
- 1024 × 768 — tablet horizontal.
- 768 × 1024 — tablet vertical.
- 430 × 932 — móvil moderno.
- 390 × 844 — móvil medio.
- 360 × 800 — móvil compacto.

## Pantallas que deben probarse

1. `/` — Inicio.
2. `/proyectos` — biblioteca de proyectos.
3. `/crear` — wizard dinámico.
4. `/dataset` — selección/carga de datos.
5. `/preparacion` — preparación específica por proyecto.
6. `/modelo` — selección de modelo.
7. `/editor` — React Flow, paleta e inspector.
8. `/entrenamiento` — métricas y gráfico.
9. `/evaluacion` — métricas, matriz de confusión y errores.
10. `/prediccion` — prueba y código generado.

## Criterios

- No debe existir scroll horizontal de página.
- Navegación, stepper y tabs pueden usar scroll horizontal interno cuando sea necesario.
- Ningún texto debe quedar cortado fuera de su contenedor.
- Los botones principales deben seguir accesibles a 360 px.
- El canvas de React Flow debe conservar un área útil en móvil.
- Tablas/matrices o código deben desplazarse dentro de su propio contenedor, no expandir el viewport.
- Targets táctiles principales deben aproximarse a 44 px de alto.
