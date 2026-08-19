# Manual del Editor PDF Clarvi

Edita, une, organiza, compara y comprime PDF desde tu propia computadora. Sin
instalar nada y sin que ningún archivo salga de tu equipo.

> Este manual también está publicado como página web, más cómoda de consultar.
> Pídele el enlace a quien te pasó el programa.

---

## Índice

**Empezar** · [Cómo se abre](#1-cómo-se-abre) · [La pantalla](#2-la-pantalla)
**El documento** · [Abrir y unir](#3-abrir-y-unir) · [Guardar y extraer](#4-guardar-y-extraer) · [Organizar páginas](#5-organizar-páginas)
**Editar** · [Las 14 herramientas](#6-las-14-herramientas) · [Corregir el texto](#7-corregir-el-texto) · [Firma e imágenes](#8-firma-e-imágenes) · [Mover y ajustar](#9-mover-y-ajustar-lo-que-añadiste)
**Documento completo** · [Numerar](#10-numerar-páginas) · [Comparar](#11-comparar-dos-pdf) · [Comprimir](#12-comprimir)
**Referencia** · [Atajos](#13-atajos-de-teclado) · [Si algo no va](#14-si-algo-no-va) · [Lo que no hace](#15-lo-que-la-aplicación-no-hace) · [Privacidad](#16-privacidad)

---

## 1. Cómo se abre

Descarga la carpeta del proyecto y descomprímela donde quieras. Después,
**doble clic en `index.html`**. Eso es todo: se abre en tu navegador y ya puedes
trabajar.

En la misma carpeta hay tres accesos alternativos que hacen lo mismo con un
clic: `abrir.bat` en Windows, `abrir.command` en Mac y `abrir.sh` en Linux. Si tu
equipo ya tiene Python o Node instalados, estos levantan un servidor local; si
no, abren el archivo directamente. El resultado es el mismo en los dos casos.

> **Descarga la carpeta completa.** `index.html` necesita la carpeta `assets`
> que va a su lado. Si copias sólo el archivo suelto, verás una página en blanco.

**Navegadores:** Chrome, Edge, Firefox, Brave u Opera recientes. También
Safari 16 o superior.

## 2. La pantalla

Cinco zonas, y cada una manda sobre una cosa distinta:

| Zona | Qué contiene |
|---|---|
| **Barra superior** | Abrir · Unir · Deshacer · Numerar · Comparar · Comprimir · Extraer · Guardar |
| **Panel de páginas** (izquierda) | Documentos abiertos, miniaturas y, al pie, girar / duplicar / eliminar |
| **Barra de herramientas** | Las 14 herramientas; se pueden reordenar |
| **Lienzo** (centro) | El documento, con todo lo que le vas añadiendo |
| **Panel de propiedades** (derecha) | Ajustes de la herramienta activa o del objeto seleccionado |
| **Barra inferior** | Mensajes · Página actual · Zoom |

El panel de propiedades es contextual: si no hay nada seleccionado muestra los
ajustes de la herramienta activa (color, grosor, tamaño de letra); si
seleccionas algo que dibujaste, muestra los de ese objeto.

## 3. Abrir y unir

### Abrir

Pulsa **Abrir**, usa `Ctrl+O`, o arrastra los archivos a la ventana. Puedes
seleccionar varios PDF de golpe: se cargan uno detrás de otro en el orden en que
los elijas. Si un PDF está protegido con contraseña, se te pide antes de abrirlo.

### Unir

**Unir PDF** añade más archivos **al final** de lo que ya tienes abierto.
Arrastrar archivos con un documento ya abierto hace lo mismo.

Arriba del panel izquierdo aparece la lista de **documentos abiertos**, con el
nombre de cada archivo y cuántas páginas aporta. Desde ahí puedes:

- Hacer clic en uno para saltar a su primera página.
- **Arrastrarlo** para moverlo de sitio: se llevan todas sus páginas en bloque,
  conservando el orden entre ellas.
- Quitarlo entero con la **×**.

> **La etiqueta «mezclado».** Si mueves páginas a mano y acabas intercalando las
> de un archivo con las de otro, ese documento aparece marcado como *mezclado*.
> Es un aviso: si lo arrastras, sus páginas volverán a juntarse. Así lo sabes
> antes, no después.

## 4. Guardar y extraer

### Guardar

**Guardar PDF** o `Ctrl+S` descarga el documento con todas tus ediciones
**incrustadas dentro del contenido** de cada página, no como comentarios. Se ve
igual en cualquier visor y al imprimir. El archivo sale como
`nombre-editado.pdf`.

### Extraer

Marca las páginas que quieras (ver [Organizar páginas](#5-organizar-páginas)) y
pulsa **Extraer**: se descarga un PDF nuevo sólo con esas, como
`nombre-extraido.pdf`. El documento que tienes abierto no se toca.

> **No se guarda solo.** Al cerrar la pestaña se pierde lo que no hayas
> guardado. El navegador te avisa antes, pero acostúmbrate a `Ctrl+S`.

## 5. Organizar páginas

Todo ocurre en el panel izquierdo. Hay dos gestos distintos y conviene no
confundirlos:

| Lo que haces | Lo que pasa |
|---|---|
| Clic en la miniatura | Vas a esa página. **No la marca.** |
| Clic en el recuadro de la esquina | Marcas o desmarcas esa página |
| Clic en otro recuadro | Se **suma** a lo ya marcado, sin pulsar teclas |
| `Shift` + clic en un recuadro | Marcas el rango entero desde la última |
| Arrastrar la miniatura | Cambias esa página de sitio |
| El botón ☑ de la cabecera | Marcas o desmarcas todas de golpe |

En cuanto marcas algo, **al pie del panel** aparecen las acciones: girar 90° a la
izquierda, girar 90° a la derecha, duplicar y eliminar. Actúan sobre todo lo que
tengas marcado.

Girar sirve para enderezar páginas escaneadas de lado: pasa una hoja de vertical
a horizontal y al revés. El giro se guarda dentro del PDF.

**La lista te sigue:** según bajas por el documento, el panel se desplaza solo
para que la miniatura de la página que estás mirando quede siempre a la vista.

No se puede eliminar todo: la aplicación no te deja quedarte sin páginas.

## 6. Las 14 herramientas

Están en la columna izquierda del lienzo. La letra entre paréntesis es su atajo.
Sus ajustes salen en el panel derecho al elegirlas, y se recuerdan.

| Herramienta | Para qué sirve |
|---|---|
| **Mover** (V) | Selecciona, mueve y cambia el tamaño de lo que hayas añadido |
| **Texto** (T) | Arrastra un cuadro y escribe. Helvetica, Times o Courier; tamaño, color, negrita, cursiva, alineación e interlineado |
| **Editar** (E) | Corrige un texto que **ya está en el PDF** — ver [§7](#7-corregir-el-texto) |
| **Resaltar** (H) | Marcatextos. Arrastra sobre el texto, o haz un **clic suelto** y se resalta el renglón entero solo. Seis colores e intensidad regulable |
| **Lápiz** (P) | Dibujo libre a mano alzada |
| **Línea** (L) | Línea recta. Con `Shift`, ángulos de 45° |
| **Flecha** (F) | Como la línea, con punta |
| **Rect.** (R) | Rectángulo con borde y relleno independientes. Con `Shift`, cuadrado |
| **Elipse** (C) | Elipse u óvalo. Con `Shift`, círculo |
| **Tapar** (W) | Cubre con un rectángulo opaco, para censurar — **lee el aviso** |
| **Imagen** (I) | Inserta un PNG o JPG — ver [§8](#8-firma-e-imágenes) |
| **Firma** (S) | Tu firma, dibujada o importada de una foto — ver [§8](#8-firma-e-imágenes) |
| **Borrar** (D) | Quita objetos que hayas añadido. **No borra el contenido original** |
| **Copiar** | Activa la selección del texto original del PDF para copiarlo con `Ctrl+C` |

> **⚠ «Tapar» no es lo mismo que borrar.** El texto original sigue dentro del
> archivo, debajo del recuadro. Visualmente queda oculto, pero alguien podría
> recuperarlo copiando el texto. **No uses «Tapar» para ocultar información
> confidencial** en un archivo que va a salir de tu control.

**Colócalas a tu gusto:** arrastra las herramientas dentro de la barra para
ponerlas en el orden que te convenga. Se recuerda entre sesiones, y aparece un
botón **Orden** al final de la barra para devolverlas a su sitio original.

## 7. Corregir el texto

Con la herramienta **Editar**, haz clic sobre un renglón del PDF. La aplicación
lo detecta, lo cubre con un recuadro **del color del propio fondo** y te deja un
cuadro con el texto original ya escrito para que lo modifiques. Conserva el
tamaño, el tipo de letra y el color aproximados.

Escribe lo que quieras y pulsa `Ctrl+Intro`, o haz clic fuera. Con `Esc`
cancelas. Para volver a editar un texto tuyo, doble clic encima.

> **Cómo funciona de verdad, para que no te sorprenda.** Un PDF no guarda
> párrafos: guarda letras colocadas en coordenadas fijas. Por eso esto es
> **tapar y reescribir**, no una edición como la de Word. Funciona muy bien para
> corregir un nombre, una fecha, un importe o un renglón suelto. Lo que **no**
> hace es recomponer el párrafo si el texto nuevo es mucho más largo.

Si haces clic donde no hay texto que la aplicación pueda leer, te lo dice y no
toca nada. En un PDF escaneado no hay texto que detectar: sus páginas son
imágenes.

**Acentos y caracteres.** El texto que escribas usa las fuentes estándar del PDF,
que cubren todo el español —acentos, eñes, signos de apertura, símbolos de
moneda—. No cubren alfabetos como el chino, el árabe o el cirílico, ni emojis: si
escribes algo así se sustituye y la aplicación te avisa de cuántos caracteres
cambió.

## 8. Firma e imágenes

### Tu firma

Elige **Firma** y se abre el cuadro para prepararla. Tienes dos caminos:

- **Dibujarla** con el ratón o el dedo, eligiendo color y grosor.
- **Importar una foto** de tu firma en papel. La aplicación **le quita el fondo**
  y deja sólo el trazo, con un deslizador para ajustar cuánto quita.

Al aceptar, la firma se recorta a su contenido y **se guarda en el navegador**:
la próxima vez que abras la aplicación sigue ahí.

Después, un clic en la página la estampa, y puedes estamparla en tantas páginas
como necesites. En el panel derecho tienes **Dibujar o cambiar la firma…** y
**Olvidar la firma guardada**.

### Imágenes

**Imagen** abre el selector de archivos. Elige un PNG o JPG y después:

- **Un clic** la coloca a su tamaño natural, centrada en ese punto.
- **Arrastrando** la encajas dentro del rectángulo que dibujes, sin deformarla.

Al cambiarle el tamaño por una esquina **se conserva la proporción**; con `Shift`
la liberas. El panel derecho tiene además la opacidad y un botón **Recuperar
proporción**.

## 9. Mover y ajustar lo que añadiste

Con la herramienta **Mover** activa:

- **Clic** sobre un objeto para seleccionarlo.
- **Arrastrar** para moverlo; los **tiradores** de esquinas y lados cambian su
  tamaño.
- **Doble clic** sobre un texto lo abre para escribir.
- Las **flechas del teclado** lo mueven 1 punto, o 10 con `Shift`.

En el panel derecho tienes **Al frente** y **Al fondo** para resolver
solapamientos, más **Duplicar** y **Eliminar**.

**Deshacer y rehacer** (`Ctrl+Z` y `Ctrl+Y`) alcanzan a todo: lo que dibujas, lo
que borras, girar páginas, reordenarlas, unir archivos, numerar y comparar.

## 10. Numerar páginas

El botón **Numerar** abre un cuadro con todo configurable:

| Ajuste | Opciones |
|---|---|
| Formato | `1` · `Página 1` · `1 de 20` · `1 / 20` · `Página 1 de 20` · `- 1 -` |
| Posición | Las seis habituales: arriba o abajo, a la izquierda, centro o derecha |
| Margen | Distancia al borde, en puntos |
| Tipografía | Helvetica, Times o Courier, con tamaño y color |
| Páginas | Rango «de … a …» |
| Empezar en | El número de la primera |
| Portada | Casilla para no numerar la primera página |

Los números se colocan como objetos normales: los ves al instante, puedes mover
uno suelto y entran en deshacer. Volver a aplicar **reemplaza** la numeración
anterior en vez de duplicarla, y **Quitar numeración** los elimina todos sin
tocar nada más.

**En páginas giradas sale derecho:** si una página está girada, el número se
compensa para que se lea horizontal, no de lado.

## 11. Comparar dos PDF

**Comparar** te pide un segundo archivo y enfrenta su texto con el del documento
abierto, palabra por palabra. Después marca las diferencias **encima del
documento que tienes abierto**:

- **Verde** — palabras que sólo están aquí.
- **Barra roja** — el punto exacto donde el otro archivo tiene texto que aquí
  falta.

Al terminar sale un informe con el recuento por página y **el texto concreto que
falta**, para que no se te escape lo que se quitó. Puedes guardar el PDF con las
marcas dentro, o quitarlas de un clic.

El archivo con el que comparas **no se añade** a tu documento: sólo se lee.

> **Compara texto, no diseño.** Si a uno de los dos archivos no le queda texto
> —un escaneado son imágenes— no se marca nada y se te explica por qué, en vez de
> señalarte el documento entero como distinto. Tampoco compara imágenes ni
> maquetación. Si tienen distinto número de páginas, se avisa y se compara la
> parte común.

## 12. Comprimir

**Comprimir** reduce el peso del archivo y **te enseña cuánto va a pesar antes de
que descargues nada**. Hay dos modos, y la diferencia importa:

**Optimizado — conserva el texto.** Recomprime sólo las imágenes que van dentro
del PDF y deja intactos el texto y los gráficos. El documento se sigue pudiendo
buscar, copiar y editar. **Es el que conviene casi siempre.**

**Máximo — convierte las páginas en imagen.** Cada página pasa a ser una
fotografía. Reduce más en documentos con mucho texto, pero **el documento deja de
tener texto**: no se podrá buscar, copiar ni editar después. Úsalo sólo para
cumplir un límite de tamaño al enviar algo, y guarda siempre el original.

**Intensidad:** tres niveles en ambos modos — *Ligera* (mejor calidad),
*Equilibrada* (recomendada) y *Fuerte* (archivo más pequeño).

> **Hasta dónde puede llegar.** Lo que hace pesar un PDF son las imágenes. En una
> prueba con fotografías, un archivo de 3 869 KB bajó a 72 KB en modo optimizado,
> con el texto intacto. Pero un PDF de puro texto ya viene comprimido de fábrica
> y apenas bajará: la aplicación te lo dice en lugar de fingir una mejora.

## 13. Atajos de teclado

| Atajo | Qué hace |
|---|---|
| `Ctrl+O` | Abrir archivos |
| `Ctrl+S` | Guardar el PDF |
| `Ctrl+Z` / `Ctrl+Y` | Deshacer / rehacer |
| `Ctrl+D` | Duplicar el objeto seleccionado |
| `Supr` | Borrar el objeto seleccionado |
| `Intro` | Editar el texto seleccionado |
| `Esc` | Cancelar, cerrar el cuadro abierto y volver a «Mover» |
| Flechas | Mover 1 pt · con `Shift`, 10 pt |
| `Re Pág` / `Av Pág` | Página anterior y siguiente |
| `Ctrl` + `+` / `−` | Acercar y alejar |
| `Ctrl+0` | Zoom al 100 % |
| `Ctrl` + rueda | Zoom con el ratón |
| `V T E H P L F R C W I S D` | Elegir herramienta, en el orden de la barra |

El zoom también se elige en la barra inferior, con niveles del 25 % al 400 % más
**Ajustar ancho** y **Página completa**.

## 14. Si algo no va

| Síntoma | Qué hacer |
|---|---|
| Página en blanco al abrir | Falta la carpeta `assets`. Descarga el proyecto completo |
| «No se cargaron las librerías» | Lo mismo: `assets/vendor` junto a `index.html` |
| **El texto sale ilegible, o se ve distinto en cada computadora** | Ver abajo. Es el problema más común y tiene solución |
| Un PDF muy grande va lento | Ábrelo con `abrir.bat` / `abrir.command` / `abrir.sh` |
| `abrir.bat` se cierra al instante | No tienes Python ni Node. Abre `index.html` con doble clic |
| El texto reescrito no queda alineado | Ajusta tamaño e interlineado, o muévelo con las flechas |

### El mismo PDF se ve bien en una computadora y mal en otra

Muchos PDF —sobre todo los que salen de sistemas administrativos— **no llevan sus
tipografías dentro del archivo**. Sólo dicen «usa Courier New» y dan por hecho
que la computadora la tiene. Cada equipo la resuelve con lo que tenga instalado,
y por eso el mismo documento puede verse perfecto en una máquina y con las letras
cambiadas en otra.

Pulsa el botón **?** de la barra superior. Ahí tienes:

1. **La casilla «Usar sólo las tipografías que trae el programa».** Al marcarla,
   el editor deja de depender de lo que tenga instalado cada equipo y **todos ven
   lo mismo**. Se aplica al momento, sin perder lo que hayas dibujado, y se
   recuerda.
2. **«Ver las tipografías de este PDF».** Una tabla que dice, una por una, si
   viene dentro del archivo o de dónde sale.

## 15. Lo que la aplicación no hace

Dicho sin adornos, para que no pierdas tiempo buscándolo:

- **No convierte de Word a PDF ni al revés.** Hacerlo con fidelidad exige un
  motor de maquetación de Office. Usa el propio Word (*Archivo → Guardar como →
  PDF*) o LibreOffice, que es gratuito.
- **No traduce.** Cualquier traductor decente implica mandar el contenido de tus
  documentos a un servicio externo, y eso choca con el principio de que aquí nada
  sale de tu equipo.
- **No hace OCR.** Un PDF escaneado se ve y se puede anotar, pero no convierte
  esas imágenes en texto. Por eso «Editar» y «Comparar» no tienen a qué agarrarse
  en un escaneado.
- **No rellena formularios PDF** ni pone contraseña a los archivos.
- **La edición de texto es «tapar y reescribir»**, no una edición de documento
  como la de Word.

## 16. Privacidad

Todo ocurre dentro de tu navegador. No hay servidor, no hay subidas, no hay
telemetría y no hay ninguna conexión de red: las librerías van dentro del propio
proyecto. **Puedes usarlo con el equipo desconectado de internet.**

Lo único que se guarda entre sesiones es tu firma y tus preferencias (orden de
las herramientas y el ajuste de tipografías), y se quedan en el navegador de tu
equipo.

Recuerda el matiz de [«Tapar»](#6-las-14-herramientas): oculta a la vista, pero
el texto original sigue dentro del archivo.

---

Construido con [pdf.js](https://mozilla.github.io/pdf.js/) y
[pdf-lib](https://pdf-lib.js.org/), incluidos dentro del proyecto para que
funcione sin conexión. Dentro de la aplicación, el botón **?** tiene un resumen
de las herramientas, los atajos y el diagnóstico de tipografías.
