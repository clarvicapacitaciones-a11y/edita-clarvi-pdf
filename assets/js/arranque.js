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

  window.CLARVI_ENTORNO = {
    esArchivo: esArchivo,
    basePdfjs: base,
    // Sólo se pueden descargar cuando hay un servidor detrás.
    cMapUrl: esArchivo ? null : base + 'cmaps/',
    fuentesUrl: esArchivo ? null : base + 'standard_fonts/'
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
