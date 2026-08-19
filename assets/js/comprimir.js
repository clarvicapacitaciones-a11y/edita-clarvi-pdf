/* ===========================================================================
   comprimir.js — reducir el peso del PDF

   Dos modos, porque no hay uno solo que valga para todo:

   · Optimizado — recomprime las imágenes que van DENTRO del PDF y deja el
                  texto y los vectores intactos. El documento se sigue pudiendo
                  buscar, copiar y editar. Es lo que conviene casi siempre.

   · Máximo     — convierte cada página en una fotografía. Reduce mucho más,
                  pero el texto deja de existir como tal. Se avisa claramente.

   Un PDF de puro texto ya viene comprimido de fábrica: ahí no hay nada que
   rascar, y así se le dice al usuario en lugar de fingir una mejora.
   =========================================================================== */
(function (raiz) {
  'use strict';

  var Clarvi = raiz.Clarvi || (raiz.Clarvi = {});
  var util = Clarvi.util;
  var estado = Clarvi.estado;

  var PDFLib = raiz.PDFLib;
  var pdfjsLib = raiz.pdfjsLib;

  var N = function (n) { return PDFLib.PDFName.of(n); };

  /* Cuanto más agresivo, menor calidad y menor resolución máxima.
     El lado máximo está pensado sobre una página completa:
     2200 px ≈ 200 ppp, 1650 ≈ 150 ppp, 1100 ≈ 100 ppp. */
  var NIVELES = {
    ligera:      { calidad: 0.85, maxLado: 2200, ppp: 200, nombre: 'Ligera' },
    equilibrada: { calidad: 0.72, maxLado: 1650, ppp: 150, nombre: 'Equilibrada' },
    fuerte:      { calidad: 0.55, maxLado: 1100, ppp: 100, nombre: 'Fuerte' }
  };

  /* ══════════════════ Utilidades de imagen ══════════════════ */

  function lienzo(ancho, alto) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(ancho));
    c.height = Math.max(1, Math.round(alto));
    return c;
  }

  function aJpeg(canvas, calidad) {
    return new Promise(function (resolver) {
      canvas.toBlob(function (blob) {
        if (!blob) { resolver(null); return; }
        blob.arrayBuffer().then(function (b) { resolver(new Uint8Array(b)); });
      }, 'image/jpeg', calidad);
    });
  }

  function nombreFiltro(dict) {
    var f = dict.get(N('Filter'));
    return f ? String(f) : '';
  }

  function numero(dict, clave) {
    var v = dict.get(N(clave));
    return v && typeof v.asNumber === 'function' ? v.asNumber() : null;
  }

  /**
   * Convierte una imagen del PDF en un lienzo. Devuelve null si el formato no
   * es de los que sabemos tratar con seguridad.
   */
  function lienzoDeImagen(obj) {
    var dict = obj.dict;
    var ancho = numero(dict, 'Width');
    var alto = numero(dict, 'Height');
    if (!ancho || !alto) return Promise.resolve(null);

    // Máscaras de recorte y imágenes con Decode invertido: no se tocan.
    if (String(dict.get(N('ImageMask')) || '') === 'true') return Promise.resolve(null);
    if (dict.get(N('Decode'))) return Promise.resolve(null);

    var filtro = nombreFiltro(dict);

    /* Ya es un JPEG: el navegador lo abre tal cual. */
    if (filtro === '/DCTDecode') {
      var blob = new Blob([obj.contents.slice(0)], { type: 'image/jpeg' });
      return createImageBitmap(blob).then(function (bm) {
        var c = lienzo(bm.width, bm.height);
        c.getContext('2d').drawImage(bm, 0, 0);
        return c;
      }).catch(function () { return null; });
    }

    /* Comprimido sin pérdida, en 8 bits de gris o de color. */
    if (filtro === '/FlateDecode') {
      var bpc = numero(dict, 'BitsPerComponent');
      var espacio = String(dict.get(N('ColorSpace')) || '');
      if (bpc !== 8) return Promise.resolve(null);
      if (espacio !== '/DeviceRGB' && espacio !== '/DeviceGray') return Promise.resolve(null);

      var crudo;
      try {
        crudo = PDFLib.decodePDFRawStream({ dict: dict, contents: obj.contents }).decode();
      } catch (e) { return Promise.resolve(null); }

      var canales = espacio === '/DeviceRGB' ? 3 : 1;
      if (crudo.length < ancho * alto * canales) return Promise.resolve(null);

      var c2 = lienzo(ancho, alto);
      var ctx = c2.getContext('2d');
      var img = ctx.createImageData(ancho, alto);
      var d = img.data;

      for (var i = 0, p = 0, q = 0; i < ancho * alto; i++, p += canales, q += 4) {
        if (canales === 3) { d[q] = crudo[p]; d[q + 1] = crudo[p + 1]; d[q + 2] = crudo[p + 2]; }
        else { d[q] = d[q + 1] = d[q + 2] = crudo[p]; }
        d[q + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      return Promise.resolve(c2);
    }

    /* JPEG2000, fax y JBIG2 ya son formatos muy comprimidos: se dejan estar. */
    return Promise.resolve(null);
  }

  /* ══════════════════ Modo optimizado ══════════════════ */

  function optimizar(bytes, nivel, avisarProgreso) {
    var ajustes = NIVELES[nivel] || NIVELES.equilibrada;

    return PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false })
      .then(function (doc) {
        var contexto = doc.context;

        // Las máscaras de transparencia se dejan como están: reencodarlas con
        // pérdida crearía halos alrededor de los recortes.
        var mascaras = new Set();
        contexto.enumerateIndirectObjects().forEach(function (par) {
          var obj = par[1];
          if (!(obj instanceof PDFLib.PDFRawStream)) return;
          ['SMask', 'Mask'].forEach(function (clave) {
            var m = obj.dict.get(N(clave));
            if (m && m.tag) mascaras.add(m.tag);
          });
        });

        var candidatas = contexto.enumerateIndirectObjects().filter(function (par) {
          var ref = par[0], obj = par[1];
          return obj instanceof PDFLib.PDFRawStream &&
                 String(obj.dict.get(N('Subtype')) || '') === '/Image' &&
                 !mascaras.has(ref.tag);
        });

        var resumen = { imagenes: candidatas.length, tocadas: 0, ahorro: 0 };
        var cadena = Promise.resolve();

        candidatas.forEach(function (par, indice) {
          cadena = cadena.then(function () {
            if (avisarProgreso) {
              avisarProgreso('Optimizando imagen ' + (indice + 1) + ' de ' + candidatas.length + '…');
            }
            return recomprimir(contexto, par[0], par[1], ajustes, resumen);
          });
        });

        return cadena
          .then(function () { return doc.save({ useObjectStreams: true }); })
          .then(function (salida) { return { bytes: salida, resumen: resumen }; });
      });
  }

  function recomprimir(contexto, ref, obj, ajustes, resumen) {
    return lienzoDeImagen(obj).then(function (origen) {
      if (!origen) return;

      var escala = Math.min(1, ajustes.maxLado / Math.max(origen.width, origen.height));
      var destino = origen;

      if (escala < 1) {
        destino = lienzo(origen.width * escala, origen.height * escala);
        var ctx = destino.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(origen, 0, 0, destino.width, destino.height);
      }

      return aJpeg(destino, ajustes.calidad).then(function (nuevos) {
        if (!nuevos) return;
        // Regla de oro: si no mejora, no se toca.
        if (nuevos.length >= obj.contents.length) return;

        var dict = obj.dict.clone(contexto);
        dict.set(N('Filter'), N('DCTDecode'));
        dict.set(N('Width'), PDFLib.PDFNumber.of(destino.width));
        dict.set(N('Height'), PDFLib.PDFNumber.of(destino.height));
        dict.set(N('BitsPerComponent'), PDFLib.PDFNumber.of(8));
        dict.set(N('ColorSpace'), N('DeviceRGB'));
        dict.delete(N('DecodeParms'));
        dict.delete(N('Decode'));

        resumen.ahorro += obj.contents.length - nuevos.length;
        resumen.tocadas++;
        contexto.assign(ref, PDFLib.PDFRawStream.of(dict, nuevos));
      });
    }).catch(function () { /* una imagen problemática no debe tumbar el proceso */ });
  }

  /* ══════════════════ Modo máximo ══════════════════ */

  function rasterizar(bytes, nivel, avisarProgreso) {
    var ajustes = NIVELES[nivel] || NIVELES.equilibrada;
    var escala = ajustes.ppp / 72;

    return pdfjsLib.getDocument({ data: bytes.slice(0), isEvalSupported: false }).promise
      .then(function (doc) {
        return PDFLib.PDFDocument.create().then(function (salida) {
          salida.setProducer('Editor PDF Clarvi');
          var cadena = Promise.resolve();

          for (var i = 1; i <= doc.numPages; i++) {
            (function (numero) {
              cadena = cadena.then(function () {
                if (avisarProgreso) {
                  avisarProgreso('Convirtiendo página ' + numero + ' de ' + doc.numPages + '…');
                }
                return doc.getPage(numero).then(function (pag) {
                  var vpPuntos = pag.getViewport({ scale: 1 });
                  var vp = pag.getViewport({ scale: escala });

                  var c = lienzo(vp.width, vp.height);
                  var ctx = c.getContext('2d', { alpha: false });
                  ctx.fillStyle = '#ffffff';
                  ctx.fillRect(0, 0, c.width, c.height);

                  return pag.render({ canvasContext: ctx, viewport: vp }).promise
                    .then(function () { return aJpeg(c, ajustes.calidad); })
                    .then(function (jpeg) {
                      if (!jpeg) return;
                      return salida.embedJpg(jpeg).then(function (img) {
                        var hoja = salida.addPage([vpPuntos.width, vpPuntos.height]);
                        hoja.drawImage(img, {
                          x: 0, y: 0,
                          width: vpPuntos.width, height: vpPuntos.height
                        });
                      });
                    });
                });
              });
            })(i);
          }

          return cadena
            .then(function () { doc.destroy(); return salida.save(); })
            .then(function (b) {
              return { bytes: b, resumen: { paginas: doc.numPages, rasterizado: true } };
            });
        });
      });
  }

  /* ══════════════════ Interfaz ══════════════════ */

  var dlg = {};
  var resultado = null;      // { bytes, tamOriginal, tamNuevo, modo }

  function iniciar() {
    dlg.modal = util.$('#modalComprimir');
    if (!dlg.modal) return;

    dlg.info = util.$('#compriInfo');
    dlg.nivel = util.$('#compriNivel');
    dlg.aviso = util.$('#compriAviso');
    dlg.resultado = util.$('#compriResultado');
    dlg.calcular = util.$('#btnCalcularCompri');
    dlg.descargar = util.$('#btnDescargarCompri');

    util.$$('input[name="compriModo"]').forEach(function (r) {
      r.addEventListener('change', alCambiarModo);
    });
    dlg.nivel.addEventListener('change', function () { limpiarResultado(); });

    dlg.calcular.addEventListener('click', calcular);
    dlg.descargar.addEventListener('click', descargar);
    util.$('#btnCerrarComprimir').addEventListener('click', cerrar);
    dlg.modal.addEventListener('click', function (ev) { if (ev.target === dlg.modal) cerrar(); });
  }

  function modoElegido() {
    var r = util.$('input[name="compriModo"]:checked');
    return r ? r.value : 'optimizado';
  }

  function alCambiarModo() {
    limpiarResultado();
    var maximo = modoElegido() === 'maximo';
    dlg.aviso.className = 'aviso-props' + (maximo ? ' peligro' : '');
    dlg.aviso.innerHTML = maximo
      ? '<b>Cuidado:</b> cada página se convierte en una fotografía. Reduce mucho ' +
        'más, pero el documento <b>deja de tener texto</b>: no se podrá buscar, ' +
        'copiar ni editar después. Úsalo sólo para enviar por correo o subir a un ' +
        'portal que limite el tamaño, y guarda siempre el original.'
      : 'Se recomprimen las imágenes que hay dentro del PDF y <b>el texto se ' +
        'queda intacto</b>: el documento se sigue pudiendo buscar, copiar y ' +
        'editar. Si el PDF es sólo texto, ya viene comprimido y apenas bajará.';
  }

  function limpiarResultado() {
    resultado = null;
    dlg.resultado.hidden = true;
    dlg.descargar.disabled = true;
  }

  function calcular() {
    dlg.calcular.disabled = true;
    dlg.resultado.hidden = false;
    dlg.resultado.className = 'aviso-props';
    dlg.resultado.textContent = 'Preparando el documento…';

    var modo = modoElegido();
    var nivel = dlg.nivel.value;

    function progreso(t) { dlg.resultado.textContent = t; }

    Clarvi.exportar.construir(estado.paginas).then(function (base) {
      var original = base.bytes.length;
      var tarea = modo === 'maximo'
        ? rasterizar(base.bytes, nivel, progreso)
        : optimizar(base.bytes, nivel, progreso);

      return tarea.then(function (r) {
        resultado = {
          bytes: r.bytes,
          tamOriginal: original,
          tamNuevo: r.bytes.length,
          modo: modo
        };
        mostrarResultado(r.resumen);
      });
    }).catch(function (err) {
      dlg.resultado.className = 'aviso-props peligro';
      dlg.resultado.textContent = 'No se pudo comprimir: ' + (err.message || err);
    }).then(function () { dlg.calcular.disabled = false; });
  }

  function mostrarResultado(resumen) {
    var antes = resultado.tamOriginal, despues = resultado.tamNuevo;
    var baja = antes - despues;
    var pct = antes ? Math.round(baja / antes * 100) : 0;

    dlg.resultado.className = 'aviso-props';
    dlg.descargar.disabled = false;

    if (baja <= 0) {
      dlg.resultado.className = 'aviso-props peligro';
      dlg.resultado.innerHTML =
        '<b>No se consiguió reducirlo.</b> Este PDF ya está bien comprimido: ' +
        (resumen && resumen.imagenes === 0
          ? 'no lleva imágenes, sólo texto y vectores, que ya ocupan muy poco.'
          : 'sus imágenes no mejoran al recomprimirlas.') +
        ' Se puede descargar igualmente, pero no merece la pena.';
      return;
    }

    var detalle = resumen && resumen.rasterizado
      ? resumen.paginas + ' página(s) convertidas en imagen.'
      : (resumen.tocadas + ' de ' + resumen.imagenes + ' imágenes recomprimidas.');

    dlg.resultado.innerHTML =
      '<b>' + util.tamanoLegible(antes) + ' → ' + util.tamanoLegible(despues) +
      '</b> &nbsp; (' + pct + ' % menos)<br>' + detalle;
  }

  function descargar() {
    if (!resultado) return;
    var sufijo = resultado.modo === 'maximo' ? '-comprimido-max' : '-comprimido';
    util.descargar(resultado.bytes, Clarvi.docs.nombreSalida(sufijo), 'application/pdf');
    estado.emitir('aviso', { tipo: 'ok', texto: 'PDF comprimido descargado.' });
    cerrar();
  }

  function abrir() {
    if (!estado.hayDocumento()) return;
    limpiarResultado();
    alCambiarModo();
    dlg.info.textContent = estado.paginas.length + ' página(s) en el documento.';
    dlg.modal.hidden = false;
  }

  function cerrar() { dlg.modal.hidden = true; }

  Clarvi.comprimir = {
    iniciar: iniciar,
    abrir: abrir,
    cerrar: cerrar,
    optimizar: optimizar,
    rasterizar: rasterizar,
    NIVELES: NIVELES
  };
})(window);
