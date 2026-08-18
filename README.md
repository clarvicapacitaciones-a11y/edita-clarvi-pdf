# Editor PDF Clarvi

Editor de PDF que **funciona en tu computadora sin instalar nada**. Descargas la
carpeta, abres un archivo y ya está: escribes, corriges, dibujas, resaltas, unes
varios PDF y guardas el resultado.

No necesita internet, no necesita Node, no necesita Python y **ningún archivo
sale de tu equipo**: todo se procesa dentro de tu propio navegador.

---

## Cómo empezar

### 1. Descarga el proyecto

Con el botón verde **Code → Download ZIP** de GitHub, y descomprímelo donde
quieras. También sirve `git clone`.

> Descarga la carpeta **completa**. El archivo `index.html` necesita la carpeta
> `assets` que va a su lado.

### 2. Ábrelo

Tienes tres formas, todas sin instalar nada:

| Cómo | Qué hacer |
|---|---|
| **La más simple** | Doble clic en **`index.html`** |
| **Windows** | Doble clic en **`abrir.bat`** |
| **macOS** | Doble clic en **`abrir.command`** |
| **Linux** | Ejecuta **`./abrir.sh`** |

Los lanzadores buscan si ya tienes Python o Node en el equipo. Si los
encuentran, levantan un servidor local (`127.0.0.1`) que da la máxima fidelidad
de reproducción; si no los encuentran, abren el archivo directamente. **En los
dos casos funciona igual de bien** — la única diferencia es que, abriendo
`index.html` a pelo, los navegadores no permiten cargar las fuentes tipográficas
de reserva de pdf.js, así que un PDF que *no* lleve sus fuentes incrustadas se
verá con una fuente parecida del sistema en lugar de la original. El texto, las
medidas y el PDF guardado son idénticos.

### Navegadores

Chrome, Edge, Firefox, Brave u Opera recientes. También Safari 16 o superior.

---

## Qué puede hacer

### Editar contenido

- **Texto nuevo** — arrastra un cuadro y escribe. Fuente (Helvetica, Times o
  Courier), tamaño, color, negrita, cursiva, alineación e interlineado.
- **Editar el texto del PDF** — haz clic sobre un renglón: la app lo detecta, lo
  cubre con el color del propio fondo y te deja reescribirlo conservando el
  tamaño, el color y el tipo de letra aproximados.
- **Resaltar** — como un marcatextos. Arrastra sobre el texto, o haz un clic
  suelto y se resalta el renglón entero automáticamente.
- **Lápiz** — dibujo libre a mano alzada.
- **Línea, Flecha, Rectángulo, Elipse** — con color, grosor, relleno y opacidad.
  Con <kbd>Shift</kbd> se fuerzan ángulos rectos y proporciones cuadradas.
- **Tapar** — cubre lo que quieras con un rectángulo opaco (para censurar).
- **Borrador** — quita los objetos que hayas añadido.
- **Copiar** — activa la selección del texto original para copiarlo con
  <kbd>Ctrl</kbd>+<kbd>C</kbd>.

Todo se puede seleccionar, mover, redimensionar, reordenar (al frente / al
fondo), duplicar y borrar, con **deshacer y rehacer** ilimitados dentro de la
sesión.

### Organizar páginas

- **Unir PDF** — añade más archivos al final del documento.
- **Reordenar** — arrastra las miniaturas del panel izquierdo.
- **Girar** 90° a izquierda o derecha, **duplicar** y **eliminar**.
- **Extraer** — guarda sólo las páginas que marques en un PDF nuevo.

### Guardar

**Guardar PDF** descarga el documento con todas las ediciones incrustadas dentro
del contenido de la página, no como comentarios. Se ve igual en cualquier visor
y también al imprimir.

---

## Atajos de teclado

| Atajo | Acción |
|---|---|
| <kbd>Ctrl</kbd>+<kbd>O</kbd> | Abrir |
| <kbd>Ctrl</kbd>+<kbd>S</kbd> | Guardar |
| <kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Y</kbd> | Deshacer / rehacer |
| <kbd>Ctrl</kbd>+<kbd>D</kbd> | Duplicar el objeto seleccionado |
| <kbd>Supr</kbd> | Borrar el objeto seleccionado |
| <kbd>Intro</kbd> | Editar el texto seleccionado |
| Flechas | Mover 1 pt (con <kbd>Shift</kbd>, 10 pt) |
| <kbd>Ctrl</kbd> + rueda | Zoom |
| <kbd>Esc</kbd> | Cancelar y volver a «Mover» |
| <kbd>V T E H P L F R C W D</kbd> | Elegir herramienta |

---

## Lo que conviene saber

Estas son las limitaciones reales, dichas sin adornos:

- **La edición de texto es «tapar y reescribir».** Un PDF no guarda párrafos,
  guarda letras colocadas en coordenadas fijas. Al editar un renglón, la app lo
  cubre y escribe el texto nuevo encima. Funciona muy bien para corregir datos,
  nombres, fechas o importes; lo que **no** hace es recomponer el párrafo entero
  si el texto nuevo es mucho más largo. Reeditar un documento completo, párrafo a
  párrafo, no es lo suyo.
- **El texto original sigue dentro del archivo**, debajo del recuadro que lo
  tapa. Visualmente queda oculto, pero alguien podría recuperarlo copiando el
  texto. **No uses «Tapar» para ocultar información confidencial** si el archivo
  va a salir de tu control.
- **Fuentes**: el texto que escribas usa las fuentes estándar del PDF
  (Helvetica, Times y Courier). Cubren todo el español —acentos, eñes, signos de
  apertura, símbolos de moneda—, pero no alfabetos como el chino, el árabe o el
  cirílico, ni emojis. Si escribes algo así, se sustituye y la app te avisa.
- **PDF protegidos con contraseña**: se pide la contraseña para verlos. Guardar
  un PDF cifrado puede dar un resultado incorrecto; la app te avisa si detecta
  esa situación.
- **PDF escaneados**: se ven y se pueden anotar, pero como son imágenes no hay
  texto que detectar, así que la herramienta «Editar» no tiene nada que agarrar.
  La app no hace OCR.
- **No se guarda solo.** Al cerrar la pestaña se pierde el trabajo no guardado
  (el navegador te avisa antes). Guarda con <kbd>Ctrl</kbd>+<kbd>S</kbd>.

---

## Privacidad

Todo ocurre dentro del navegador. No hay servidor, no hay subidas, no hay
telemetría y no hay ninguna conexión de red: las librerías van dentro del propio
repositorio (`assets/vendor`). Puedes usarlo con el equipo desconectado.

---

## Si algo no va

| Síntoma | Qué mirar |
|---|---|
| Página en blanco al abrir | Falta la carpeta `assets`. Descarga el proyecto completo, no sólo `index.html`. |
| «No se cargaron las librerías» | Lo mismo: `assets/vendor` tiene que estar junto a `index.html`. |
| Un PDF muy grande va lento | Abre con `abrir.bat` / `abrir.command` / `abrir.sh`: así el proceso pesado se va a un hilo aparte y va bastante más fluido. |
| Las letras no se ven como en el original | Ese PDF no lleva sus fuentes incrustadas. Ábrelo con los lanzadores y se corrige. |
| `abrir.bat` se cierra al instante | No pasa nada: no tienes Python ni Node. Abre `index.html` con doble clic. |
| El texto reescrito no queda alineado | Ajusta tamaño e interlineado en el panel derecho, o mueve el cuadro con las flechas del teclado. |

---

## Cómo está hecho

Aplicación estática: HTML, CSS y JavaScript sin compilar, sin dependencias que
instalar y sin proceso de construcción.

```
index.html              La aplicación
abrir.bat / .command / .sh   Lanzadores opcionales
servidor.py / servidor.js    Servidor local mínimo (opcional)
assets/
  css/app.css
  js/
    arranque.js       Adapta pdf.js a file:// o http://
    util.js           Utilidades generales
    estado.js         Modelo de datos e historial deshacer/rehacer
    geometria.js      Conversiones página ↔ pantalla y giros
    anotaciones.js    Objetos dibujables y su pintado
    documentos.js     Abrir, unir y manipular páginas
    render.js         Render de páginas, capa de texto y miniaturas
    herramientas.js   Interacción con el ratón y edición de texto
    paneles.js        Panel de propiedades y de páginas
    exportar.js       Construcción del PDF final
    app.js            Arranque, botones y atajos
  vendor/             pdf.js y pdf-lib (incluidos a propósito)
```

Dos detalles técnicos que explican por qué funciona con un simple doble clic:

- **Sin módulos ES.** Los navegadores bloquean `<script type="module">` en
  `file://`, así que todo el código son scripts clásicos bajo el espacio de
  nombres `Clarvi`.
- **Sin Web Workers en `file://`.** Como tampoco se pueden crear, `arranque.js`
  carga `pdf.worker.js` con una etiqueta `<script>` normal: pdf.js lo detecta
  mediante `globalThis.pdfjsWorker` y trabaja en el hilo principal. Cuando hay
  un servidor detrás se usa el worker de verdad.

Las anotaciones se guardan en puntos del PDF sobre la página **sin girar**, que
es el mismo sistema de coordenadas en el que dibuja pdf-lib. Por eso girar,
reordenar o duplicar páginas no descoloca nada, y el ancho de las líneas de
texto se mide siempre con las métricas reales de pdf-lib: lo que ves en pantalla
es exactamente lo que sale en el PDF.

---

## Licencias

El código de este proyecto se publica bajo licencia MIT (ver `LICENSE`).

Incluye estas librerías de terceros, sin modificar:

- **[pdf.js](https://mozilla.github.io/pdf.js/)** de Mozilla — Apache 2.0 —
  `assets/vendor/pdfjs/LICENSE`
- **[pdf-lib](https://pdf-lib.js.org/)** — MIT —
  `assets/vendor/pdf-lib/LICENSE.md`
