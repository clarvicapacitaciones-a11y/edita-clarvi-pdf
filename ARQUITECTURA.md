# Arquitectura del Editor PDF Clarvi

Documentación del código, para no tener que leerse los casi 8000 renglones.

Si vas a tocar algo, lee al menos las secciones **2** (las tres restricciones) y
**5** (el sistema de coordenadas). Casi todo lo que parece raro en este código se
explica en una de esas dos.

| | |
|---|---|
| **Qué es** | Editor de PDF que corre entero en el navegador, sin servidor |
| **Cómo se ejecuta** | Doble clic en `index.html`. Sin build, sin `npm install` |
| **Dependencias en tiempo de ejecución** | Ninguna: pdf.js y pdf-lib van dentro del repositorio |
| **Tamaño** | ~6800 líneas de JS, 800 de CSS, 420 de HTML |

---

## 1. Mapa rápido

```
index.html            Toda la interfaz. Carga los scripts en orden (importa: §3)
assets/css/app.css    Una sola hoja de estilos
assets/js/            16 módulos, todos bajo el espacio de nombres Clarvi
assets/vendor/        pdf.js 3.11.174 y pdf-lib 1.17.1, versionados a propósito
abrir.bat/.command/.sh + servidor.py/.js   Lanzadores opcionales
```

Cada módulo es un IIFE que cuelga su API de `window.Clarvi`. No hay clases, no
hay `import`, no hay estado global suelto fuera de `Clarvi.estado`.

---

## 2. Las tres restricciones que explican todo

El requisito de partida fue: *«que solo descargue el repo y funcione»*. Eso
significa abrir `index.html` con doble clic, o sea protocolo `file://`, donde el
navegador prohíbe tres cosas. Las tres condicionan el diseño entero:

### 2.1 Nada de módulos ES

`<script type="module">` está bloqueado por CORS en `file://`. Por eso todo son
scripts clásicos y el orden de carga de `index.html` es significativo (§3).

### 2.2 Nada de Web Workers

`new Worker(...)` también está prohibido. pdf.js normalmente descarga su worker,
y sin él no arranca.

**Solución** (`arranque.js`): en `file://` se inyecta `pdf.worker.js` como
`<script>` normal. El build UMD asigna `globalThis.pdfjsWorker`, y pdf.js
comprueba justo eso en `PDFWorker._mainThreadWorkerMessageHandler`; al
encontrarlo, trabaja en el hilo principal sin worker. Servido por `http://` se
usa el worker de verdad.

### 2.3 Nada de `fetch` ni XHR a archivos locales

pdf.js descarga bajo demanda sus **fuentes estándar** (para PDF que no incrustan
la tipografía) y sus **cmaps** (para alfabetos asiáticos). En `file://` no puede.

**Solución**: cada archivo de datos tiene al lado un `.js` que se asigna a
`window.CLARVI_DATOS`, y `arranque.js` define dos factorías propias
(`FabricaFuentes`, `FabricaCMaps`) que los cargan por `<script>` bajo demanda.
`getDocument()` acepta `StandardFontDataFactory` y `CMapReaderFactory`; basta con
exponer un método `fetch`.

Los 182 archivos de `assets/vendor/pdfjs/datos/` se generan desde
`standard_fonts/` y `cmaps/` en base64. Si actualizas pdf.js, hay que
regenerarlos.

---

## 3. Orden de carga: importa

`index.html` carga los scripts en este orden, y **no es arbitrario**:

```
arranque → util → iconos → ordenar → estado → geometria → anotaciones
        → documentos → render → imagenes → numeracion → comparar
        → comprimir → herramientas → paneles → exportar → app
```

Cada módulo captura sus dependencias **en el momento de cargarse**:

```js
var estado = Clarvi.estado;   // si estado.js aún no se cargó, esto es undefined
```

Ya hubo un fallo por esto: `comparar.js` estaba antes que `render.js` y se
quedaba con `render === undefined`, con lo que la comparación reventaba entera.
**Si añades un módulo, colócalo después de todos aquellos de los que toma
referencia al arrancar.** Las referencias que sólo se usan en tiempo de ejecución
(dentro de una función) no tienen este problema.

---

## 4. El modelo de datos: `Clarvi.estado`

Todo el estado vive aquí. `estado.js` (229 líneas).

```js
estado = {
  fuentes:  Map<id, Fuente>,   // los PDF abiertos, materia prima inmutable
  paginas:  [Pagina],          // el orden final del documento
  imagenes: Map<id, Imagen>,   // bytes de imágenes y firmas, aparte a propósito
  pendiente: Imagen|null,      // imagen elegida, a la espera de colocarse

  herramienta: 'seleccionar',
  seleccion:   { paginaId, anotId } | null,
  paginasSel:  Set<paginaId>,
  paginaActual: 0,
  zoom: 1,  modoZoom: '1' | 'ancho' | 'pagina',
  ajustes: { …colores, grosores, tipografía… },   // se recuerdan entre usos

  historial: [{ datos: string, desc }],  historialIdx: 0
}
```

### Fuente

```js
{ id, nombre, bytes: Uint8Array, doc: PDFDocumentProxy,
  numPaginas, docPdfLib: PDFDocument|null, protegido: bool }
```

`bytes` **nunca se modifica**: es el PDF original tal cual llegó. `doc` es de
pdf.js (leer y pintar); `docPdfLib` se carga perezosamente sólo al exportar.

### Página

```js
{ id, fuenteId, indice,      // de qué PDF y qué página suya
  giro, giroBase,            // giro del usuario + el que ya traía (/Rotate)
  ancho, alto,               // tamaño SIN girar, en puntos
  vista: [x0,y0,x1,y1],      // CropBox, para compensar MediaBox desplazados
  anots: [Anotacion] }
```

Una página del documento **no contiene** el PDF: apunta a `(fuenteId, indice)`.
Por eso duplicar una página es barato y unir archivos no copia nada.

### Historial

`estado.marcar(desc)` serializa `estado.paginas` a JSON y lo apila (máximo 80).
Deshacer y rehacer restauran esa instantánea, **reutilizando los objetos página
anteriores cuando el id coincide**, para no perder la caché de render.

Por eso las anotaciones tienen que ser **datos planos serializables**. Los bytes
de las imágenes viven en `estado.imagenes` y las anotaciones sólo guardan
`imgId`: si estuvieran dentro, cada paso del historial duplicaría megabytes.

### Eventos

`estado.al(evento, fn)` / `estado.emitir(evento, datos)`. Los que existen:

| Evento | Cuándo |
|---|---|
| `documento` | Cambió la lista de páginas: hay que reconstruir todo |
| `pagina` | Cambió el contenido de una página (repinta miniatura) |
| `seleccion` | Cambió el objeto seleccionado (refresca panel derecho) |
| `seleccionPaginas` | Cambiaron las páginas marcadas |
| `herramienta` | Cambió la herramienta activa |
| `historial` | Cambió deshacer/rehacer (habilita botones) |
| `aviso` / `progreso` | Mensajes para la barra inferior |
| `pedirImagen` | Una herramienta necesita que el usuario elija imagen |

---

## 5. El sistema de coordenadas

**La parte más delicada del proyecto.** Hay tres espacios y conviene tenerlos
claros antes de tocar render o exportación.

### Los tres espacios

| Espacio | Origen | Eje Y | Unidad |
|---|---|---|---|
| **Página** (donde viven las anotaciones) | Arriba-izquierda de la página **sin girar** | Hacia **abajo** | Puntos PDF |
| **Vista** (lo que se ve) | Arriba-izquierda de la página **girada** | Hacia abajo | Píxeles CSS |
| **PDF** (el archivo) | Abajo-izquierda del MediaBox | Hacia **arriba** | Puntos PDF |

**Las anotaciones se guardan siempre en espacio de página.** Ésta es *la*
decisión de diseño del proyecto: es el mismo espacio en el que dibuja pdf-lib, y
por eso girar, reordenar o duplicar páginas no descoloca nada.

### Página → vista

Con `r` = giro total, `w`/`h` = tamaño sin girar, `s` = escala
(`geometria.js:aVista`):

```
r=0     vx = x·s              vy = y·s
r=90    vx = (h − y)·s        vy = x·s
r=180   vx = (w − x)·s        vy = (h − y)·s
r=270   vx = y·s              vy = (w − x)·s
```

`aPagina()` es la inversa exacta, y se usa para convertir la posición del ratón.

Para dibujar no se convierte punto a punto: `aplicarTransformacion()` mete giro y
escala en una sola matriz del canvas, y a partir de ahí se dibuja en coordenadas
de página tal cual están guardadas.

### Página → PDF (al exportar)

```
x_pdf = pagina.vista[0] + x
y_pdf = pagina.vista[3] − y
```

`vista` es el CropBox que da pdf.js. Se usa en vez de `[0,0]` porque hay PDF con
MediaBox desplazado, y sin esto las anotaciones saldrían corridas.

Truco útil: `page.drawSvgPath(d, {x, y})` de pdf-lib aplica `translate(x,y)` y
`scale(1,−1)`. Pasando `x = vista[0]`, `y = vista[3]`, el path se puede escribir
**directamente en coordenadas de página**. Lo usan los trazos a mano alzada, la
punta de las flechas y el fondo de los cuadros de texto.

### Texto girado

El tipo `texto` acepta un `giro` opcional (0/90/180/270) para que los números de
página se lean derechos en páginas giradas.

- El texto vive en un marco local anclado en `(x, y)`, girado `giro` grados en
  sentido horario dentro del espacio de página.
- Para compensar el giro de la página: `giro = (360 − giroTotal) % 360`.
- Al exportar, el giro **se invierte**: `rotate: degrees(−giro)`, porque el
  espacio de página tiene la Y hacia abajo y el del PDF hacia arriba.

`anotaciones.js` expone `giroDe()`, `aPaginaLocal()` y `esquinasTexto()` para
esto.

---

## 6. Tipos de anotación

Todos son objetos planos con `id` y `tipo`. Definidos y dibujados en
`anotaciones.js`, exportados en `exportar.js`.

| Tipo | Campos propios |
|---|---|
| `rect` | `x, y, w, h, trazo, relleno, grosor, opacidad` |
| `elipse` | idem |
| `resaltado` | `x, y, w, h, relleno, opacidad` — se mezcla en *multiply* |
| `tapar` | `x, y, w, h, relleno` — opaco |
| `linea` | `x1, y1, x2, y2, trazo, grosor, opacidad` |
| `flecha` | idem + punta calculada en `puntaFlecha()` |
| `trazo` | `pts: [x,y,x,y,…], trazo, grosor, opacidad, resaltador` |
| `imagen` | `x, y, w, h, imgId, opacidad` |
| `texto` | `x, y, w, texto, tam, fuente, negrita, cursiva, color, alineado, interlineado, fondo, giro` |

Campo opcional `origen`: `'numeracion'` o `'comparacion'` marca las anotaciones
generadas automáticamente, para poder quitarlas todas de golpe sin tocar las del
usuario.

### Añadir un tipo nuevo

Hay que tocar cinco sitios de `anotaciones.js` y uno de `exportar.js`:

1. `caja()` — su rectángulo envolvente
2. `tocado()` — si el puntero lo toca (para seleccionar y borrar)
3. `dibujar()` — cómo se pinta en canvas
4. `mover()` — si no le vale el `x += dx` por defecto
5. `ajustarACaja()` — cómo se comporta al redimensionar
6. `exportar.js:pintar()` — cómo se escribe en el PDF

---

## 7. WYSIWYG del texto

Problema: el ancho de una cadena en canvas y en el PDF no coinciden, así que los
saltos de línea saldrían distintos.

Solución: al arrancar se crea un `PDFDocument` invisible con las 12 fuentes
estándar incrustadas (`anotaciones.js:prepararFuentes`). **Todas** las medidas
—salto de línea, alineación, alto de caja— salen de
`font.widthOfTextAtSize()` de pdf-lib, no del canvas.

Al pintar en pantalla, cada línea se escala horizontalmente para igualar el ancho
que tendrá en el PDF. Resultado: la vista previa y el archivo exportado coinciden
al 0,07 % de píxeles.

`lineas()` es la **única** función que parte el texto en renglones, y la usan
tanto el dibujo como la exportación. Si tocas una, tocas las dos.

---

## 8. Flujos principales

### Abrir un PDF
`app.js:cargar` → `docs.abrirArchivos` → `cargarPdf` (pdf.js) → `paginasDe`
(una entrada por página) → `estado.emitir('documento')` → `render.reconstruir`.

> ⚠ A pdf.js se le pasa **una copia** de los bytes (`bytes.slice(0)`), porque se
> queda con el búfer. Los originales hacen falta luego para pdf-lib.

### Pintar una página
`render.reconstruir` crea el DOM de cada página (3 capas: canvas del PDF, capa de
texto, canvas de anotaciones) y dimensiona. Un `IntersectionObserver` con 900 px
de margen dispara `renderizarPdf` sólo en las páginas cercanas a la ventana: por
eso un PDF de 400 páginas abre al instante.

### Dibujar
`herramientas.js` escucha el puntero sobre `#paginas`. Convierte a coordenadas de
página con `geo.aPagina`, crea la anotación en `alSubir`, y `estado.marcar()`
guarda el punto de deshacer.

### Guardar
`exportar.js:construir` → un `PDFDocument` nuevo → se agrupan las páginas por
fuente (una llamada a `copyPages` por archivo, conservando el orden de aparición,
porque las páginas pueden estar interleavadas o repetidas) → `setRotation` →
`pintar()` cada anotación → `save()`.

---

## 9. Decisiones que parecen raras pero tienen motivo

- **`bytes.slice(0)` al pasar a pdf.js.** pdf.js se queda con el búfer y lo
  detacha. Sin la copia, exportar después falla.
- **`[hidden] { display: none !important; }` en el CSS.** Las reglas de clase de
  la hoja pisan el `display:none` que el navegador aplica a `[hidden]`. Sin esa
  línea, ocultar elementos no surte efecto. Ya pasó.
- **El textarea de edición lleva `left:0; top:0` y se posiciona con
  `transform`.** Sin `left`/`top`, el navegador lo coloca al final del flujo y
  enfocarlo daba un salto de scroll de 900 px. También se enfoca con
  `preventScroll: true`.
- **Al comprimir, una imagen sólo se sustituye si el resultado pesa menos.** Y
  los formatos que no se saben tratar con seguridad (JPEG2000, fax, JBIG2,
  máscaras, paletas indexadas) se dejan intactos. Ante la duda, no tocar.
- **Las máscaras de transparencia (`/SMask`) no se recomprimen**, porque
  reencodarlas con pérdida deja halos alrededor de los recortes.
- **El PDF con el que se compara se abre con `docs.abrirSuelto`**, no con
  `cargarPdf`: si se registrara como fuente, cambiaría el nombre del archivo de
  salida y el recuento de «archivos unidos».
- **`ordenar.js` decide entre clic y arrastre por distancia (5 px).** Es lo que
  permite que «clic para ir a la página» y «arrastrar para moverla» convivan en
  el mismo gesto, y funciona con el dedo, cosa que el arrastre nativo de HTML no
  hacía.
- **Los iconos son SVG con `stroke="currentColor"`**, no emoji: heredan el color
  del botón y salen idénticos en los tres sistemas operativos.

---

## 10. Módulos, uno por uno

| Módulo | Líneas | Responsabilidad |
|---|---:|---|
| `arranque.js` | 117 | Adapta pdf.js a `file://` o `http://`. Worker y factorías de datos |
| `util.js` | 133 | `Clarvi.util`: DOM, colores, descarga, clonado, `aplazar` |
| `iconos.js` | 130 | `Clarvi.iconos`: 40 iconos SVG y su inyector |
| `ordenar.js` | 231 | `Clarvi.ordenar`: arrastrar-para-ordenar con clic alternativo |
| `estado.js` | 229 | `Clarvi.estado`: el modelo, el historial y los eventos |
| `geometria.js` | 190 | `Clarvi.geo`: conversiones, hit-testing, tiradores |
| `anotaciones.js` | 595 | `Clarvi.anots`: tipos, medidas de texto, dibujo en canvas |
| `documentos.js` | 340 | `Clarvi.docs`: abrir, unir, girar, reordenar, operaciones por documento |
| `render.js` | 660 | `Clarvi.render`: páginas, capa de texto, miniaturas, muestreo de color |
| `imagenes.js` | 405 | `Clarvi.imagenes`: almacén, diálogo de firma, quitado de fondo |
| `numeracion.js` | 275 | `Clarvi.numeracion`: numerar páginas |
| `comparar.js` | 451 | `Clarvi.comparar`: diff de Myers e informe |
| `comprimir.js` | 397 | `Clarvi.comprimir`: los dos modos de compresión |
| `fuentes.js` | 194 | `Clarvi.fuentes`: diagnóstico de tipografías y su interruptor |
| `herramientas.js` | 768 | `Clarvi.herramientas`: el puntero y la edición de texto |
| `paneles.js` | 731 | `Clarvi.paneles`: propiedades, miniaturas, documentos |
| `exportar.js` | 338 | `Clarvi.exportar`: construir el PDF final |
| `app.js` | 584 | Arranque, botones, atajos, arrastrar archivos |

### Los dos algoritmos con nombre

**Myers** (`comparar.js:caminoEdicion`) — diff de palabras. O(ND): rápido cuando
las diferencias son pocas, que es el caso real de dos versiones del mismo
documento. Si se pasa del límite devuelve `null` y se informa en vez de inventar
un resultado.

**Quitar el fondo de una firma** (`imagenes.js:quitarFondo`) — mide el brillo del
marco de la imagen (que es el papel) y da a cada píxel una transparencia
proporcional a lo oscuro que sea. Por eso el borde del trazo queda suavizado en
vez de dentado.

---

## 11. Cómo añadir cosas

### Una herramienta
1. Botón en `index.html` con `data-herr="…"` y `data-icono="…"`
2. Icono en `iconos.js` (si es nuevo)
3. Atajo en `app.js:TECLAS_HERR`
4. Gesto en `herramientas.js:alBajar` y, si crea algo arrastrando,
   `actualizarPrevia` y `terminarCreacion`
5. Ajustes en `paneles.js:propsDeHerramienta`
6. Cursor en `app.css` (`.lienzo[data-herr="…"]`)

### Un diálogo
Sigue el patrón de `numeracion.js`: un módulo con `iniciar()` que cachea
referencias del DOM y engancha eventos, `abrir()` y `cerrar()`; el HTML como
`.modal` en `index.html`; `Escape` en `app.js:alTeclado`; y la llamada a
`iniciar()` en el arranque de `app.js`.

### Un icono
Una entrada en `TRAZOS` de `iconos.js`: el contenido de un `<svg>` de 24×24, sin
relleno. `pintarTodos()` lo inyecta en cualquier `[data-icono]`.

---

## 12. Pruebas

No hay pruebas dentro del repositorio: se ejecutan con **Playwright y Chromium
de verdad**, abriendo la aplicación por `file://` y por `http://`, porque lo que
importa comprobar son justamente las restricciones del navegador, y eso no se
puede simular.

Cubren 223 comprobaciones repartidas en diez baterías: editor completo en los dos
protocolos, interacción con el ratón, robustez (PDF de 40 páginas, escaneado,
dañado), imagen y firma, numeración, comparación, compresión, interfaz,
tipografías, y una de **fidelidad** que reabre el PDF exportado en la propia
aplicación y lo compara píxel a píxel con la vista previa.

> Las pruebas viven fuera del repositorio, en el entorno donde se desarrollaron.
> Si quieres conservarlas, pídelo y se añaden en una carpeta aparte con sus
> instrucciones — la aplicación seguiría sin dependencias, sólo las pruebas
> necesitarían Playwright.

Comprobación mínima antes de tocar nada:

```bash
for f in assets/js/*.js; do node --check "$f"; done
```

---

## 13. Dependencias vendorizadas

| Librería | Versión | Para qué | Licencia |
|---|---|---|---|
| [pdf.js](https://mozilla.github.io/pdf.js/) | 3.11.174 *legacy/UMD* | Leer y pintar PDF, extraer texto | Apache 2.0 |
| [pdf-lib](https://pdf-lib.js.org/) | 1.17.1 *UMD* | Escribir el PDF final, métricas de fuentes | MIT |

Se usa la build **legacy/UMD** de pdf.js a propósito: la moderna es ESM y no
carga en `file://`.

Van dentro del repositorio para que la aplicación funcione sin conexión y sin
`npm install`. Al actualizarlas hay que regenerar `assets/vendor/pdfjs/datos/`
(§2.3) y volver a pasar las pruebas: la solución del worker depende de detalles
internos de pdf.js que podrían cambiar.
