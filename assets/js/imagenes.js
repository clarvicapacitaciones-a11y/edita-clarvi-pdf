/* ===========================================================================
   imagenes.js — imágenes y firma

   Las imágenes se guardan en un almacén aparte (estado.imagenes) y las
   anotaciones sólo llevan su identificador. Así las instantáneas del historial
   de deshacer siguen siendo JSON ligero y los bytes no se duplican nunca.

   La firma se dibuja a mano o se importa desde una foto. Al importar se quita
   el fondo del papel: es lo que hace falta cuando la firma viene fotografiada
   o escaneada sobre una hoja blanca.
   =========================================================================== */
(function (raiz) {
  'use strict';

  var Clarvi = raiz.Clarvi || (raiz.Clarvi = {});
  var util = Clarvi.util;
  var estado = Clarvi.estado;

  var CLAVE_FIRMA = 'clarvi.firma';
  var MAX_LADO = 2400;          // se reescalan las fotos enormes al importarlas

  /* ── Almacén de imágenes ────────────────────────────────────────────── */

  /**
   * Registra una imagen y devuelve su ficha.
   * @param bytes Uint8Array con el archivo original (PNG o JPEG)
   * @param tipo  'image/png' | 'image/jpeg'
   */
  function registrar(bytes, tipo, nombre) {
    var blob = new Blob([bytes], { type: tipo });
    return createImageBitmap(blob).then(function (bitmap) {
      var ficha = {
        id: util.id('img'),
        tipo: tipo,
        nombre: nombre || 'imagen',
        bytes: bytes,
        ancho: bitmap.width,
        alto: bitmap.height,
        bitmap: bitmap
      };
      estado.imagenes.set(ficha.id, ficha);
      return ficha;
    });
  }

  function ficha(id) { return estado.imagenes.get(id) || null; }
  function bitmap(id) { var f = ficha(id); return f ? f.bitmap : null; }

  /** Lee un archivo del disco y lo registra tal cual. */
  function desdeArchivo(archivo) {
    var tipo = /png$/i.test(archivo.type) || /\.png$/i.test(archivo.name)
      ? 'image/png' : 'image/jpeg';
    return util.leerArchivo(archivo).then(function (bytes) {
      return registrar(bytes, tipo, archivo.name);
    });
  }

  /* ── Utilidades de lienzo ───────────────────────────────────────────── */

  function lienzoDe(ancho, alto) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(ancho));
    c.height = Math.max(1, Math.round(alto));
    return c;
  }

  function bytesDeLienzo(canvas, tipo, calidad) {
    return new Promise(function (resolver, rechazar) {
      canvas.toBlob(function (blob) {
        if (!blob) { rechazar(new Error('No se pudo generar la imagen.')); return; }
        blob.arrayBuffer().then(function (buf) { resolver(new Uint8Array(buf)); });
      }, tipo || 'image/png', calidad);
    });
  }

  /** Recorta los bordes completamente transparentes. */
  function recortarTransparente(canvas, margen) {
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    var d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    var x0 = canvas.width, y0 = canvas.height, x1 = -1, y1 = -1;

    for (var y = 0; y < canvas.height; y++) {
      for (var x = 0; x < canvas.width; x++) {
        if (d[(y * canvas.width + x) * 4 + 3] > 8) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return canvas;                       // estaba vacío

    var m = margen == null ? 4 : margen;
    x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m);
    x1 = Math.min(canvas.width - 1, x1 + m);
    y1 = Math.min(canvas.height - 1, y1 + m);

    var salida = lienzoDe(x1 - x0 + 1, y1 - y0 + 1);
    salida.getContext('2d').drawImage(canvas, x0, y0, salida.width, salida.height,
                                      0, 0, salida.width, salida.height);
    return salida;
  }

  /**
   * Quita el fondo de una firma fotografiada sobre papel.
   *
   * Se mide el brillo de los bordes (que es el papel), y cada píxel recibe una
   * transparencia proporcional a lo oscuro que sea respecto de ese papel. Así
   * los bordes del trazo quedan suavizados en vez de dentados.
   *
   * @param sensibilidad 0..1 — cuánto se agranda el rango que se considera papel
   */
  function quitarFondo(origen, sensibilidad) {
    var s = sensibilidad == null ? 0.5 : sensibilidad;
    var canvas = lienzoDe(origen.width, origen.height);
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(origen, 0, 0);

    var img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    var d = img.data;

    function lum(i) { return util.luminancia(d[i], d[i + 1], d[i + 2]); }

    // El papel se estima con el brillo medio del marco exterior.
    var suma = 0, cuenta = 0;
    var paso = Math.max(1, Math.floor(canvas.width / 120));
    for (var x = 0; x < canvas.width; x += paso) {
      [0, canvas.height - 1].forEach(function (y) {
        suma += lum((y * canvas.width + x) * 4); cuenta++;
      });
    }
    for (var y2 = 0; y2 < canvas.height; y2 += paso) {
      [0, canvas.width - 1].forEach(function (x2) {
        suma += lum((y2 * canvas.width + x2) * 4); cuenta++;
      });
    }
    var papel = cuenta ? suma / cuenta : 245;

    // Lo más oscuro de la imagen marca dónde la tinta es totalmente opaca.
    var minimo = 255;
    for (var i = 0; i < d.length; i += 4) {
      var l = lum(i);
      if (l < minimo) minimo = l;
    }

    var techo = papel - (papel - minimo) * (0.12 + s * 0.5);   // aquí empieza el trazo
    var suelo = minimo + (techo - minimo) * 0.25;              // aquí es opaco del todo
    if (techo <= suelo) techo = suelo + 1;

    for (var j = 0; j < d.length; j += 4) {
      var lj = lum(j);
      var alfa = lj >= techo ? 0
               : lj <= suelo ? 1
               : (techo - lj) / (techo - suelo);
      d[j + 3] = Math.round(util.limitar(alfa, 0, 1) * 255);
    }

    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  /** Reduce una imagen enorme antes de trabajar con ella. */
  function limitarTamano(bitmapOrigen) {
    var lado = Math.max(bitmapOrigen.width, bitmapOrigen.height);
    if (lado <= MAX_LADO) {
      var tal = lienzoDe(bitmapOrigen.width, bitmapOrigen.height);
      tal.getContext('2d').drawImage(bitmapOrigen, 0, 0);
      return tal;
    }
    var f = MAX_LADO / lado;
    var c = lienzoDe(bitmapOrigen.width * f, bitmapOrigen.height * f);
    c.getContext('2d').drawImage(bitmapOrigen, 0, 0, c.width, c.height);
    return c;
  }

  /* ── Diálogo de firma ───────────────────────────────────────────────── */

  var dlg = {};                 // referencias del DOM
  var trazos = [];              // trazos dibujados a mano
  var trazoActual = null;
  var importada = null;         // lienzo de la foto importada, sin procesar
  var alTerminar = null;        // callback cuando el usuario acepta

  function iniciarDialogo() {
    dlg.modal = util.$('#modalFirma');
    dlg.canvas = util.$('#lienzoFirma');
    dlg.ctx = dlg.canvas.getContext('2d');
    dlg.color = util.$('#colorFirma');
    dlg.grosor = util.$('#grosorFirma');
    dlg.sens = util.$('#sensFirma');
    dlg.filaSens = util.$('#filaSensFirma');
    dlg.filaDibujo = util.$('#filaDibujoFirma');
    dlg.inpFoto = util.$('#inpFotoFirma');
    dlg.aviso = util.$('#avisoFirma');

    /* Dibujo a mano */
    dlg.canvas.addEventListener('pointerdown', function (ev) {
      if (importada) return;
      ev.preventDefault();
      dlg.canvas.setPointerCapture(ev.pointerId);
      trazoActual = {
        color: dlg.color.value,
        grosor: parseFloat(dlg.grosor.value),
        pts: [puntoLienzo(ev)]
      };
      trazos.push(trazoActual);
      pintarFirma();
    });
    dlg.canvas.addEventListener('pointermove', function (ev) {
      if (!trazoActual) return;
      trazoActual.pts.push(puntoLienzo(ev));
      pintarFirma();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (e) {
      dlg.canvas.addEventListener(e, function () { trazoActual = null; });
    });

    util.$('#btnLimpiarFirma').addEventListener('click', function () {
      trazos = []; importada = null;
      dlg.inpFoto.value = '';
      modoDibujo(true);
      pintarFirma();
    });

    ['#btnFotoFirma', '#btnFotoFirma2'].forEach(function (sel) {
      var b = util.$(sel);
      if (b) b.addEventListener('click', function () {
        dlg.inpFoto.value = '';
        dlg.inpFoto.click();
      });
    });

    dlg.inpFoto.addEventListener('change', function () {
      var archivo = dlg.inpFoto.files && dlg.inpFoto.files[0];
      if (!archivo) return;
      var blob = new Blob([archivo], { type: archivo.type || 'image/png' });
      createImageBitmap(blob).then(function (bm) {
        importada = limitarTamano(bm);
        trazos = [];
        modoDibujo(false);
        pintarFirma();
      }).catch(function () {
        dlg.aviso.textContent = 'No se pudo leer esa imagen. Prueba con un PNG o un JPG.';
      });
    });

    dlg.sens.addEventListener('input', pintarFirma);
    dlg.color.addEventListener('input', pintarFirma);
    dlg.grosor.addEventListener('input', function () { /* sólo afecta a trazos nuevos */ });

    util.$('#btnCancelarFirma').addEventListener('click', cerrarDialogo);
    dlg.modal.addEventListener('click', function (ev) {
      if (ev.target === dlg.modal) cerrarDialogo();
    });
    util.$('#btnUsarFirma').addEventListener('click', aceptarFirma);
  }

  function modoDibujo(activo) {
    dlg.filaDibujo.hidden = !activo;
    dlg.filaSens.hidden = activo;
    dlg.aviso.textContent = activo
      ? 'Traza la firma con el ratón o el dedo.'
      : 'Se ha quitado el fondo del papel. Ajusta si quedó demasiado o muy poco.';
  }

  function puntoLienzo(ev) {
    var r = dlg.canvas.getBoundingClientRect();
    return {
      x: (ev.clientX - r.left) * (dlg.canvas.width / r.width),
      y: (ev.clientY - r.top) * (dlg.canvas.height / r.height)
    };
  }

  /** Repinta la vista previa del diálogo. */
  function pintarFirma() {
    var c = dlg.canvas, ctx = dlg.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);

    if (importada) {
      var limpia = quitarFondo(importada, parseFloat(dlg.sens.value));
      var f = Math.min(c.width / limpia.width, c.height / limpia.height, 1);
      var w = limpia.width * f, h = limpia.height * f;
      ctx.drawImage(limpia, (c.width - w) / 2, (c.height - h) / 2, w, h);
      return;
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    trazos.forEach(function (t) {
      if (t.pts.length < 1) return;
      ctx.strokeStyle = t.color;
      ctx.lineWidth = t.grosor;
      ctx.beginPath();
      ctx.moveTo(t.pts[0].x, t.pts[0].y);
      if (t.pts.length === 1) ctx.lineTo(t.pts[0].x + 0.1, t.pts[0].y);
      for (var i = 1; i < t.pts.length; i++) ctx.lineTo(t.pts[i].x, t.pts[i].y);
      ctx.stroke();
    });
  }

  /** Genera el PNG definitivo (recortado y con fondo transparente). */
  function lienzoFinal() {
    if (importada) {
      return recortarTransparente(quitarFondo(importada, parseFloat(dlg.sens.value)), 6);
    }
    // Se redibuja a mayor resolución para que la firma no salga pixelada.
    var escala = 3;
    var c = lienzoDe(dlg.canvas.width * escala, dlg.canvas.height * escala);
    var ctx = c.getContext('2d');
    ctx.scale(escala, escala);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    trazos.forEach(function (t) {
      if (!t.pts.length) return;
      ctx.strokeStyle = t.color;
      ctx.lineWidth = t.grosor;
      ctx.beginPath();
      ctx.moveTo(t.pts[0].x, t.pts[0].y);
      if (t.pts.length === 1) ctx.lineTo(t.pts[0].x + 0.1, t.pts[0].y);
      for (var i = 1; i < t.pts.length; i++) ctx.lineTo(t.pts[i].x, t.pts[i].y);
      ctx.stroke();
    });
    return recortarTransparente(c, 8);
  }

  function hayContenido() {
    return !!importada || trazos.some(function (t) { return t.pts.length > 1; });
  }

  function aceptarFirma() {
    if (!hayContenido()) {
      dlg.aviso.textContent = 'Dibuja la firma o importa una foto antes de continuar.';
      return;
    }
    var canvas = lienzoFinal();
    bytesDeLienzo(canvas, 'image/png').then(function (bytes) {
      guardarEnNavegador(canvas);
      return registrar(bytes, 'image/png', 'firma.png');
    }).then(function (f) {
      // Se guarda el callback ANTES de cerrar: cerrarDialogo() lo limpia.
      var avisar = alTerminar;
      cerrarDialogo();
      if (avisar) avisar(f);
    }).catch(function (err) {
      dlg.aviso.textContent = 'No se pudo preparar la firma: ' + (err.message || err);
    });
  }

  function guardarEnNavegador(canvas) {
    try { raiz.localStorage.setItem(CLAVE_FIRMA, canvas.toDataURL('image/png')); }
    catch (e) { /* sin espacio o modo privado: no es grave */ }
  }

  function firmaGuardada() {
    try { return raiz.localStorage.getItem(CLAVE_FIRMA); } catch (e) { return null; }
  }

  function olvidarFirma() {
    try { raiz.localStorage.removeItem(CLAVE_FIRMA); } catch (e) { /* nada */ }
  }

  /** Recupera la firma de sesiones anteriores y la registra en el almacén. */
  function cargarFirmaGuardada() {
    var dataUrl = firmaGuardada();
    if (!dataUrl) return Promise.resolve(null);
    return fetch(dataUrl)
      .then(function (r) { return r.arrayBuffer(); })
      .then(function (buf) { return registrar(new Uint8Array(buf), 'image/png', 'firma.png'); })
      .catch(function () { return null; });
  }

  function abrirDialogo(callback) {
    alTerminar = callback || null;
    trazos = [];
    importada = null;
    if (dlg.inpFoto) dlg.inpFoto.value = '';
    modoDibujo(true);
    pintarFirma();
    dlg.modal.hidden = false;
  }

  function cerrarDialogo() {
    dlg.modal.hidden = true;
    alTerminar = null;
  }

  Clarvi.imagenes = {
    iniciar: iniciarDialogo,
    registrar: registrar,
    desdeArchivo: desdeArchivo,
    ficha: ficha,
    bitmap: bitmap,
    abrirDialogo: abrirDialogo,
    cerrarDialogo: cerrarDialogo,
    firmaGuardada: firmaGuardada,
    olvidarFirma: olvidarFirma,
    cargarFirmaGuardada: cargarFirmaGuardada,
    quitarFondo: quitarFondo,
    recortarTransparente: recortarTransparente,
    bytesDeLienzo: bytesDeLienzo,
    lienzoDe: lienzoDe
  };
})(window);
