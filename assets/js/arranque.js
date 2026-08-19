/* ===========================================================================
   arranque.js — configuración de pdf.js según cómo se abra la aplicación.

   La app está pensada para funcionar de dos formas:

   1) Abriendo index.html directamente (protocolo file://).
      Los navegadores prohíben crear Web Workers desde file://, así que
      cargamos pdf.worker.js como script normal: pdf.js detecta entonces
      globalThis.pdfjsWorker y trabaja en el hilo principal. Es algo más
      lento con PDF muy grandes, pero no necesita servidor ni instalación.

   2) Servido por http:// (con abrir.bat / abrir.command / servidor.py).
      Se usa el worker real y además los cmaps y las fuentes estándar,
      lo que da la máxima fidelidad de reproducción.
   =========================================================================== */
(function () {
  'use strict';

  var base = 'assets/vendor/pdfjs/';
  var esArchivo = location.protocol === 'file:';

  /* ── Datos de pdf.js en file:// ──────────────────────────────────────────
     Con doble clic el navegador prohíbe descargar archivos, pero sí ejecuta
     etiquetas <script>. Cada fuente y cada cmap tiene al lado un .js que se
     asigna a window.CLARVI_DATOS, y estas factorías se lo dan a pdf.js bajo
     demanda. Sin esto, un PDF que no lleve su fuente incrustada pierde la
     tabla de codificación y el texto sale ilegible.
     ─────────────────────────────────────────────────────────────────────── */

  var enCurso = {};

  function cargarDato(clave, carpeta) {
    var cache = window.CLARVI_DATOS || (window.CLARVI_DATOS = {});
    if (cache[clave]) return Promise.resolve(cache[clave]);
    if (enCurso[clave]) return enCurso[clave];

    enCurso[clave] = new Promise(function (resolver, rechazar) {
      var s = document.createElement('script');
      s.src = base + 'datos/' + carpeta + '/' + encodeURIComponent(clave) + '.js';
      s.onload = function () {
        if (cache[clave]) resolver(cache[clave]);
        else rechazar(new Error('El archivo de datos «' + clave + '» vino vacío.'));
      };
      s.onerror = function () {
        rechazar(new Error('No se encontró el dato «' + clave + '». ' +
                           'Comprueba que la carpeta assets/vendor está completa.'));
      };
      document.head.appendChild(s);
    });

    return enCurso[clave];
  }

  function base64ABytes(b64) {
    var bin = atob(b64);
    var salida = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) salida[i] = bin.charCodeAt(i);
    return salida;
  }

  /** pdf.js instancia esto con {baseUrl}; aquí no hace falta ninguna URL. */
  function FabricaFuentes() {}
  FabricaFuentes.prototype.fetch = function (opciones) {
    if (!opciones || !opciones.filename) {
      return Promise.reject(new Error('Falta el nombre del archivo de fuente.'));
    }
    return cargarDato(opciones.filename, 'fuentes').then(base64ABytes);
  };

  function FabricaCMaps() {}
  FabricaCMaps.prototype.fetch = function (opciones) {
    if (!opciones || !opciones.name) {
      return Promise.reject(new Error('Falta el nombre del cmap.'));
    }
    return cargarDato(opciones.name + '.bcmap', 'cmaps').then(function (b64) {
      return {
        cMapData: base64ABytes(b64),
        compressionType: 1        // CMapCompressionType.BINARY
      };
    });
  };

  window.CLARVI_ENTORNO = {
    esArchivo: esArchivo,
    basePdfjs: base,

    // Servido por http:// se descargan por URL, que es lo más eficiente.
    cMapUrl: esArchivo ? null : base + 'cmaps/',
    fuentesUrl: esArchivo ? null : base + 'standard_fonts/',

    // Con doble clic se cargan como scripts, uno a uno y sólo cuando hacen falta.
    fabricaFuentes: esArchivo ? FabricaFuentes : null,
    fabricaCMaps: esArchivo ? FabricaCMaps : null
  };

  if (!window.pdfjsLib) {
    window.CLARVI_PDFJS_LISTO = Promise.resolve(false);
    return;
  }

  if (esArchivo) {
    window.CLARVI_PDFJS_LISTO = new Promise(function (resolver) {
      var s = document.createElement('script');
      s.src = base + 'pdf.worker.js';
      s.onload = function () { resolver(true); };
      s.onerror = function () {
        // Plan B: pdf.js sabe cargarlo él mismo con una etiqueta <script>.
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.js';
        resolver(false);
      };
      document.head.appendChild(s);
    });
  } else {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.js';
    window.CLARVI_PDFJS_LISTO = Promise.resolve(true);
  }
})();
