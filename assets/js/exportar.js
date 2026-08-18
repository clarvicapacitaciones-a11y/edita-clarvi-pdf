/* ===========================================================================
   exportar.js — construye el PDF final con pdf-lib

   Las anotaciones se escriben DENTRO del contenido de la página (no como
   comentarios), así que el resultado se ve igual en cualquier visor.

   Coordenadas: las anotaciones están en el espacio de página sin girar con la
   «y» hacia abajo; el PDF usa la «y» hacia arriba. Con vista = CropBox:

        x_pdf = vista[0] + x            y_pdf = vista[3] − y
   =========================================================================== */
(function (raiz) {
  'use strict';

  var Clarvi = raiz.Clarvi || (raiz.Clarvi = {});
  var util = Clarvi.util;
  var estado = Clarvi.estado;
  var anots = Clarvi.anots;

  var PDFLib = raiz.PDFLib;

  function color(hex) {
    var c = util.hexARgb(hex);
    return PDFLib.rgb(c.r, c.g, c.b);
  }

  /* ── Carga de los PDF de origen con pdf-lib ─────────────────────────── */

  function docOrigen(fuente) {
    if (fuente.docPdfLib) return Promise.resolve(fuente.docPdfLib);
    return PDFLib.PDFDocument.load(fuente.bytes, {
      ignoreEncryption: true,
      updateMetadata: false
    }).then(function (doc) {
      fuente.docPdfLib = doc;
      fuente.protegido = !!doc.isEncrypted;
      return doc;
    });
  }

  /* ── Imágenes del documento de salida ───────────────────────────────── */

  function creadorImagenes(salida) {
    var cache = {};
    return function (imgId) {
      if (cache[imgId]) return cache[imgId];

      var ficha = estado.imagenes.get(imgId);
      if (!ficha) return Promise.resolve(null);

      // Se manda una copia: pdf-lib podría quedarse con el búfer y la imagen
      // tiene que seguir sirviendo si se vuelve a guardar.
      var copia = ficha.bytes.slice(0);
      var tarea = (ficha.tipo === 'image/png')
        ? salida.embedPng(copia)
        : salida.embedJpg(copia);

      cache[imgId] = tarea.catch(function () { return null; });
      return cache[imgId];
    };
  }

  /* ── Fuentes tipográficas del documento de salida ───────────────────── */

  function creadorFuentes(salida) {
    var cache = {};
    return function (anot) {
      var clave = anots.claveFuente(anot.fuente, anot.negrita, anot.cursiva);
      if (cache[clave]) return Promise.resolve(cache[clave]);
      return salida.embedFont(PDFLib.StandardFonts[anots.nombreEstandar(clave)])
        .then(function (f) { cache[clave] = f; return f; });
    };
  }

  /* ── Volcado de un objeto a la página de salida ─────────────────────── */

  function pintar(pagPdf, pag, anot, obtenerFuente, obtenerImagen) {
    var x0 = pag.vista[0], y1 = pag.vista[3];
    var X = function (x) { return x0 + x; };
    var Y = function (y) { return y1 - y; };
    var op = anot.opacidad == null ? 1 : anot.opacidad;

    switch (anot.tipo) {

      case 'tapar':
        pagPdf.drawRectangle({
          x: X(anot.x), y: Y(anot.y + anot.h),
          width: anot.w, height: anot.h,
          color: color(anot.relleno || '#ffffff')
        });
        return Promise.resolve();

      case 'resaltado':
        pagPdf.drawRectangle({
          x: X(anot.x), y: Y(anot.y + anot.h),
          width: anot.w, height: anot.h,
          color: color(anot.relleno || '#ffe14d'),
          opacity: op,
          blendMode: PDFLib.BlendMode.Multiply
        });
        return Promise.resolve();

      case 'rect': {
        var opciones = {
          x: X(anot.x), y: Y(anot.y + anot.h),
          width: anot.w, height: anot.h
        };
        if (anot.relleno) { opciones.color = color(anot.relleno); opciones.opacity = op; }
        if (anot.trazo && anot.grosor > 0) {
          opciones.borderColor = color(anot.trazo);
          opciones.borderWidth = anot.grosor;
          opciones.borderOpacity = op;
        }
        pagPdf.drawRectangle(opciones);
        return Promise.resolve();
      }

      case 'elipse': {
        var oe = {
          x: X(anot.x + anot.w / 2), y: Y(anot.y + anot.h / 2),
          xScale: Math.max(0.1, anot.w / 2), yScale: Math.max(0.1, anot.h / 2)
        };
        if (anot.relleno) { oe.color = color(anot.relleno); oe.opacity = op; }
        if (anot.trazo && anot.grosor > 0) {
          oe.borderColor = color(anot.trazo);
          oe.borderWidth = anot.grosor;
          oe.borderOpacity = op;
        }
        pagPdf.drawEllipse(oe);
        return Promise.resolve();
      }

      case 'linea':
      case 'flecha':
        pagPdf.drawLine({
          start: { x: X(anot.x1), y: Y(anot.y1) },
          end:   { x: X(anot.x2), y: Y(anot.y2) },
          thickness: anot.grosor,
          color: color(anot.trazo),
          opacity: op,
          lineCap: PDFLib.LineCapStyle.Round
        });
        if (anot.tipo === 'flecha') {
          var p = anots.puntaFlecha(anot);
          pagPdf.drawSvgPath(
            'M ' + p[0] + ' ' + p[1] +
            ' L ' + p[2] + ' ' + p[3] +
            ' L ' + p[4] + ' ' + p[5] + ' Z',
            { x: x0, y: y1, color: color(anot.trazo), opacity: op }
          );
        }
        return Promise.resolve();

      case 'trazo': {
        var pts = anot.pts;
        if (!pts || pts.length < 4) return Promise.resolve();
        var d = 'M ' + util.redondear(pts[0], 2) + ' ' + util.redondear(pts[1], 2);
        for (var i = 2; i < pts.length; i += 2) {
          d += ' L ' + util.redondear(pts[i], 2) + ' ' + util.redondear(pts[i + 1], 2);
        }
        pagPdf.drawSvgPath(d, {
          x: x0, y: y1,
          borderColor: color(anot.trazo),
          borderWidth: anot.grosor,
          borderOpacity: op,
          borderLineCap: anot.resaltador ? PDFLib.LineCapStyle.Butt : PDFLib.LineCapStyle.Round,
          blendMode: anot.resaltador ? PDFLib.BlendMode.Multiply : undefined
        });
        return Promise.resolve();
      }

      case 'imagen':
        return obtenerImagen(anot.imgId).then(function (img) {
          if (!img) return;
          pagPdf.drawImage(img, {
            x: X(anot.x), y: Y(anot.y + anot.h),
            width: anot.w, height: anot.h,
            opacity: op
          });
        });

      case 'texto':
        return obtenerFuente(anot).then(function (fuente) {
          var ls = anots.lineas(anot);
          var ascenso = anots.ascenso(anot);
          var salto = anot.tam * anot.interlineado;
          var desplazamiento = (salto - anot.tam) / 2;

          if (anot.fondo) {
            var alto = ls.length * salto;
            pagPdf.drawRectangle({
              x: X(anot.x), y: Y(anot.y + alto),
              width: anot.w, height: alto,
              color: color(anot.fondo)
            });
          }

          for (var i = 0; i < ls.length; i++) {
            var linea = ls[i];
            if (!linea) continue;

            var ancho = anots.anchoTexto(linea, anot);
            var x = anot.x;
            if (anot.alineado === 'centro') x = anot.x + (anot.w - ancho) / 2;
            else if (anot.alineado === 'der') x = anot.x + (anot.w - ancho);

            var base = anot.y + desplazamiento + i * salto + ascenso;

            try {
              pagPdf.drawText(linea, {
                x: X(x), y: Y(base),
                size: anot.tam,
                font: fuente,
                color: color(anot.color || '#000000'),
                opacity: op
              });
            } catch (e) {
              // Último recurso si algún carácter no se puede codificar.
              pagPdf.drawText(anots.sanear(linea).texto.replace(/[^\x20-\x7e]/g, '?'), {
                x: X(x), y: Y(base), size: anot.tam, font: fuente,
                color: color(anot.color || '#000000'), opacity: op
              });
            }
          }
        });
    }

    return Promise.resolve();
  }

  /* ── Construcción del documento ─────────────────────────────────────── */

  /**
   * @param paginas  subconjunto (y orden) de estado.paginas a exportar
   * @returns Promise<{ bytes:Uint8Array, avisos:string[] }>
   */
  function construir(paginas) {
    if (!paginas.length) return Promise.reject(new Error('No hay páginas que guardar.'));

    var avisos = [];
    var salida = null;

    return PDFLib.PDFDocument.create().then(function (doc) {
      salida = doc;
      salida.setProducer('Editor PDF Clarvi');
      salida.setCreator('Editor PDF Clarvi');

      // Se cargan una sola vez todos los PDF de origen implicados.
      var ids = [];
      paginas.forEach(function (p) { if (ids.indexOf(p.fuenteId) < 0) ids.push(p.fuenteId); });

      return Promise.all(ids.map(function (id) {
        var f = estado.fuentes.get(id);
        return docOrigen(f).then(function () {
          if (f.protegido) {
            avisos.push('«' + f.nombre + '» está protegido con contraseña; ' +
                        'puede que su contenido no se copie correctamente.');
          }
        });
      }));

    }).then(function () {
      // Se agrupan las páginas por origen conservando el orden de aparición.
      var porFuente = new Map();
      paginas.forEach(function (p) {
        if (!porFuente.has(p.fuenteId)) porFuente.set(p.fuenteId, []);
        porFuente.get(p.fuenteId).push(p.indice);
      });

      var claves = Array.from(porFuente.keys());
      return Promise.all(claves.map(function (id) {
        var fuente = estado.fuentes.get(id);
        return salida.copyPages(fuente.docPdfLib, porFuente.get(id));
      })).then(function (copiadas) {
        var mapa = new Map();
        claves.forEach(function (id, i) { mapa.set(id, { lista: copiadas[i], siguiente: 0 }); });
        return mapa;
      });

    }).then(function (mapa) {
      var obtenerFuente = creadorFuentes(salida);
      var obtenerImagen = creadorImagenes(salida);
      var cadena = Promise.resolve();

      paginas.forEach(function (pag) {
        var entrada = mapa.get(pag.fuenteId);
        var pagPdf = entrada.lista[entrada.siguiente++];
        salida.addPage(pagPdf);

        var giro = estado.giroTotal(pag);
        pagPdf.setRotation(PDFLib.degrees(giro));

        pag.anots.forEach(function (anot) {
          cadena = cadena.then(function () {
            return pintar(pagPdf, pag, anot, obtenerFuente, obtenerImagen);
          });
        });
      });

      return cadena;

    }).then(function () {
      return salida.save({ addDefaultPage: false });
    }).then(function (bytes) {
      return { bytes: bytes, avisos: avisos };
    });
  }

  /* ── Acciones de la interfaz ────────────────────────────────────────── */

  function guardarTodo() {
    return construir(estado.paginas).then(function (r) {
      util.descargar(r.bytes, Clarvi.docs.nombreSalida('-editado'), 'application/pdf');
      return r;
    });
  }

  function extraerSeleccionadas() {
    var elegidas = estado.paginas.filter(function (p) { return estado.paginasSel.has(p.id); });
    if (!elegidas.length) return Promise.reject(new Error('No hay páginas seleccionadas.'));
    return construir(elegidas).then(function (r) {
      util.descargar(r.bytes, Clarvi.docs.nombreSalida('-extraido'), 'application/pdf');
      return r;
    });
  }

  Clarvi.exportar = {
    construir: construir,
    guardarTodo: guardarTodo,
    extraerSeleccionadas: extraerSeleccionadas
  };
})(window);
