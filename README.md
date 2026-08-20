# Editor PDF Clarvi

Editor de PDF que **funciona en tu computadora sin instalar nada**. Descargas la
carpeta, abres un archivo y ya está: escribes, corriges, dibujas, resaltas, unes
varios PDF y guardas el resultado.

No necesita internet, no necesita Node, no necesita Python y **ningún archivo
sale de tu equipo**: todo se procesa dentro de tu propio navegador.

---

> 📖 **[Manual completo de uso](MANUAL.md)** — todas las funciones explicadas
> paso a paso, con los atajos, la solución de problemas y los límites de la
> aplicación.

> 🔧 **[Arquitectura del código](ARQUITECTURA.md)** — para quien tenga que
> modificar el programa: cómo está construido por dentro, por qué está hecho
> así y dónde tocar cada cosa, sin leerse toda la base de código.

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
encuentran, levantan un servidor local (`127.0.0.1`); si no, abren el archivo
directamente. **En los dos casos funciona igual**: aunque los navegadores no
dejan descargar archivos desde `file://`, la aplicación le hace llegar a pdf.js
sus fuentes y tablas de caracteres por otra vía, así que la reproducción es la
misma con doble clic que servida.

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
- **Imagen** — inserta un PNG o JPG de tu equipo. Un clic lo coloca a su tamaño
  natural; arrastrando lo encajas donde quieras. Al cambiarle el tamaño por una
  esquina conserva la proporción (con <kbd>Shift</kbd> la liberas).
- **Firma** — la dibujas una vez, o **importas una foto de tu firma en papel y
  la app le quita el fondo** dejando sólo el trazo. Después la estampas en las
  páginas que necesites, y se recuerda para la próxima vez que abras la app.
- **Borrador** — quita los objetos que hayas añadido.
- **Copiar** — activa la selección del texto original para copiarlo con
  <kbd>Ctrl</kbd>+<kbd>C</kbd>.

**Puedes colocar las herramientas en el orden que te convenga**: arrástralas
dentro de la barra y se recordará para la próxima vez. Si te arrepientes,
aparece un botón al final de la barra para devolverlas a su sitio.

Todo se puede seleccionar, mover, redimensionar, reordenar (al frente / al
fondo), duplicar y borrar, con **deshacer y rehacer** ilimitados dentro de la
sesión.

### Sobre el documento completo

- **Numerar páginas** — con el formato que quieras (`1`, `Página 1`, `1 de 20`,
  `- 1 -`…), en cualquiera de las seis posiciones habituales, eligiendo margen,
  tipografía, tamaño, color, número inicial y rango. Puedes dejar la portada sin
  numerar. En una página girada el número **sigue saliendo derecho**. Se quita
  entero cuando quieras, sin tocar nada más.

- **Comparar dos PDF** — enfrenta el documento abierto con otro archivo y marca
  las diferencias sobre él: **verde** lo que sólo está aquí, y una **barra roja**
  donde el otro archivo tiene texto que aquí falta. Además muestra un informe
  con el recuento por página y el texto concreto que falta. Las marcas se
  guardan dentro del PDF si lo guardas, o se quitan de un clic.

- **Comprimir** — dos modos, y verás cuánto pesa el resultado **antes** de
  descargarlo:
  - *Optimizado*: recomprime las imágenes que van dentro y **deja el texto
    intacto**. El documento se sigue pudiendo buscar, copiar y editar. Es el
    que conviene casi siempre.
  - *Máximo*: convierte cada página en una fotografía. ⚠️ **El documento deja de
    tener texto**: no se podrá buscar, copiar ni editar después. Úsalo sólo para
    cumplir un límite de tamaño al enviar, y guarda siempre el original.

  Si el PDF es de puro texto ya viene comprimido de fábrica y apenas bajará; la
  app te lo dice en lugar de fingir una mejora.

### Organizar páginas

En el panel de la izquierda, arriba tienes la lista de **documentos abiertos** y
debajo las **miniaturas** de todas las páginas.

| Lo que haces | Lo que pasa |
|---|---|
| Clic en una miniatura | Vas a esa página (no la marca) |
| Clic en el recuadro de la esquina | Marcas o desmarcas esa página |
| Clic en otro recuadro | Se **suma** a lo marcado, sin pulsar teclas |
| <kbd>Shift</kbd> + clic en un recuadro | Marcas el rango entero |
| Arrastrar una miniatura | La cambias de sitio |
| Arrastrar un documento de la lista | Mueves **todas** sus páginas en bloque |

Las acciones (girar, duplicar, eliminar) aparecen al pie del panel en cuanto
marcas alguna página. Y según vas bajando por el documento, la lista de
miniaturas se mueve sola para que siempre veas dónde estás.

- **Unir PDF** — añade más archivos al final del documento.
- **Girar** 90° a izquierda o derecha, **duplicar** y **eliminar**.
- **Extraer** — guarda sólo las páginas que marques en un PDF nuevo.

> Si mueves un documento cuyas páginas has entremezclado a mano con las de otro,
> verás el aviso **mezclado** en su fila: al moverlo, sus páginas volverán a
> quedar juntas.

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
| <kbd>V T E H P L F R C W I S D</kbd> | Elegir herramienta |

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
- **Hay PDF que no llevan sus tipografías dentro.** Es muy común en documentos
  administrativos: el archivo dice «usa Courier New» y da por hecho que tu
  computadora la tiene. Si no la tiene, el texto puede verse con otra letra o
  incluso ilegible, y por eso el mismo PDF se ve bien en un equipo y mal en
  otro. La app trae el interruptor y el diagnóstico para resolverlo (botón
  **?**), pero el origen está en cómo se generó ese PDF.
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
- **Comparar funciona sobre el texto.** Si uno de los dos archivos está escaneado
  no hay palabras que enfrentar, y la app te lo dice en vez de marcarte el
  documento entero como distinto. Tampoco compara imágenes ni maquetación:
  compara lo que dice el documento.
- **Comprimir tiene un techo.** Lo que hace pesar un PDF son las imágenes. En un
  documento de texto y vectores no hay casi nada que recortar, y ningún programa
  puede hacer magia con eso.

---

## Lo que esta app no hace

Para que no pierdas tiempo buscándolo:

- **No convierte de Word a PDF ni al revés.** Hacerlo con fidelidad exige un
  motor de maquetación de Office; en el navegador sólo saldría una aproximación
  pobre. Para eso usa el propio Word (*Archivo → Guardar como → PDF*) o
  LibreOffice, que es gratuito.
- **No traduce.** Cualquier traductor decente implica mandar el contenido de tus
  documentos a un servicio externo, y eso choca de frente con el principio de
  que aquí nada sale de tu equipo.
- **No hace OCR.** Un PDF escaneado se ve y se puede anotar, pero la app no
  convierte esas imágenes en texto, así que ni «Editar» ni «Comparar» tienen
  nada a lo que agarrarse.

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
| **El texto sale ilegible, o se ve distinto en cada computadora** | Ese PDF no lleva sus tipografías dentro, así que cada equipo las resuelve con lo que tiene instalado. Pulsa **?** y marca **«Usar sólo las tipografías que trae el programa»**: a partir de ahí se verá igual en todos. En ese mismo sitio, **«Ver las tipografías de este PDF»** te dice cuáles faltan. |
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
    iconos.js         Juego de iconos SVG
    ordenar.js        Arrastrar para ordenar, con clic alternativo
    estado.js         Modelo de datos e historial deshacer/rehacer
    geometria.js      Conversiones página ↔ pantalla y giros
    anotaciones.js    Objetos dibujables y su pintado
    documentos.js     Abrir, unir y manipular páginas
    render.js         Render de páginas, capa de texto y miniaturas
    imagenes.js       Imágenes, firma y quitado de fondo
    numeracion.js     Numeración de páginas
    comparar.js       Comparación de dos PDF (diferencias por palabras)
    comprimir.js      Reducción del tamaño del archivo
    fuentes.js        Diagnóstico de tipografías y su origen
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
