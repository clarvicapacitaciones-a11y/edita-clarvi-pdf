/* ===========================================================================
   anotaciones.js — los objetos que el usuario dibuja encima del PDF

   Tipos
   -----
   rect      {x,y,w,h, trazo, relleno, grosor, opacidad}
   elipse    idem
   resaltado {x,y,w,h, relleno, opacidad}            (se mezcla en multiplicar)
   tapar     {x,y,w,h, relleno}                      (opaco, para censurar)
   linea     {x1,y1,x2,y2, trazo, grosor, opacidad}
   flecha    idem + punta
   trazo     {pts:[x,y,x,y,…], trazo, grosor, opacidad, resaltador}
   imagen    {x,y,w,h, imgId, opacidad}              (firma incluida)
   texto     {x,y,w, texto, tam, fuente, negrita, cursiva, color, alineado,
              interlineado, fondo}

   Todas las coordenadas están en puntos del espacio de página sin girar.

   Las medidas del texto se toman SIEMPRE de pdf-lib (no del canvas), para que
   los saltos de línea en pantalla sean exactamente los del PDF exportado.
   =========================================================================== */
(function (raiz) {
  'use strict';

  var Clarvi = raiz.Clarvi || (raiz.Clarvi = {});
  var util = Clarvi.util;
  var geo = Clarvi.geo;

  var PDFLib = raiz.PDFLib;

  /* ── Fuentes ────────────────────────────────────────────────────────── */

  var FAMILIAS = {
    Helvetica: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    Times:     '"Times New Roman", Times, serif',
    Courier:   '"Courier New", Courier, monospace'
  };

  var ESTANDAR = {
    'Helvetica':      'Helvetica',
    'Helvetica-bc':   'HelveticaBoldOblique',
    'Helvetica-b':    'HelveticaBold',
    'Helvetica-c':    'HelveticaOblique',
    'Times':          'TimesRoman',
    'Times-bc':       'TimesRomanBoldItalic',
    'Times-b':        'TimesRomanBold',
    'Times-c':        'TimesRomanItalic',
    'Courier':        'Courier',
    'Courier-bc':     'CourierBoldOblique',
    'Courier-b':      'CourierBold',
    'Courier-c':      'CourierOblique'
  };

  var fuentesMedida = null;   // clave → PDFFont del documento de medidas

  /** Clave interna de fuente a partir de familia + estilo. */
  function claveFuente(fuente, negrita, cursiva) {
    var f = FAMILIAS[fuente] ? fuente : 'Helvetica';
    var sufijo = (negrita ? 'b' : '') + (cursiva ? 'c' : '');
    return sufijo ? f + '-' + sufijo : f;
  }

  /** Nombre de la fuente estándar de pdf-lib correspondiente. */
  function nombreEstandar(clave) { return ESTANDAR[clave] || 'Helvetica'; }

  /**
   * Prepara un documento pdf-lib invisible del que sacar las métricas.
   * Se llama una vez al arrancar.
   */
  function prepararFuentes() {
    if (fuentesMedida) return Promise.resolve(fuentesMedida);
    return PDFLib.PDFDocument.create().then(function (doc) {
      var claves = Object.keys(ESTANDAR);
      return Promise.all(claves.map(function (k) {
        return doc.embedFont(PDFLib.StandardFonts[nombreEstandar(k)]);
      })).then(function (fuentes) {
        fuentesMedida = {};
        claves.forEach(function (k, i) { fuentesMedida[k] = fuentes[i]; });
        return fuentesMedida;
      });
    });
  }

  function fuenteMedida(anot) {
    if (!fuentesMedida) return null;
    return fuentesMedida[claveFuente(anot.fuente, anot.negrita, anot.cursiva)];
  }

  /* ── Texto codificable ──────────────────────────────────────────────────
     Las fuentes estándar de PDF usan WinAnsi. Cubre todo el español, pero no
     alfabetos no latinos ni emojis: esos se sustituyen para no romper el
     guardado.
     ─────────────────────────────────────────────────────────────────────── */

  var EXTRA_WINANSI = '€‚ƒ„…†‡ˆ‰Š' +
                      '‹ŒŽ‘’“”•–—' +
                      '˜™š›œžŸ';

  function caracterValido(c) {
    var n = c.charCodeAt(0);
    if (n === 10) return true;                       // salto de línea
    if (n >= 32 && n <= 126) return true;            // ASCII imprimible
    if (n >= 160 && n <= 255) return true;           // Latin-1
    return EXTRA_WINANSI.indexOf(c) >= 0;
  }

  /** Sustituye lo que el PDF no podría representar. Devuelve {texto, cambios}. */
  function sanear(texto) {
    var salida = '', cambios = 0;
    for (var i = 0; i < texto.length; i++) {
      var c = texto[i];
      if (caracterValido(c)) { salida += c; }
      else if (c === '\r') { /* se ignora */ }
      else if (c === '\t') { salida += '    '; }
      else { salida += '?'; cambios++; }
    }
    return { texto: salida, cambios: cambios };
  }

  /* ── Medidas de texto ───────────────────────────────────────────────── */

  function anchoTexto(cadena, anot) {
    var f = fuenteMedida(anot);
    if (!f) return cadena.length * anot.tam * 0.5;
    try { return f.widthOfTextAtSize(cadena, anot.tam); }
    catch (e) { return cadena.length * anot.tam * 0.5; }
  }

  function ascenso(anot) {
    var f = fuenteMedida(anot);
    if (!f) return anot.tam * 0.75;
    try { return f.heightAtSize(anot.tam, { descender: false }); }
    catch (e) { return anot.tam * 0.75; }
  }

  /**
   * Corta el texto en líneas que quepan en anot.w.
   * Es la única función de salto de línea: la usan tanto el dibujo en
   * pantalla como la exportación, así que ambos coinciden siempre.
   */
  function lineas(anot) {
    var ancho = Math.max(4, anot.w);
    var parrafos = String(anot.texto == null ? '' : anot.texto).split('\n');
    var salida = [];

    parrafos.forEach(function (parrafo) {
      if (parrafo === '') { salida.push(''); return; }

      var palabras = parrafo.split(/(\s+)/);   // se conservan los espacios
      var linea = '';

      function empujar() { salida.push(linea.replace(/\s+$/, '')); linea = ''; }

      for (var i = 0; i < palabras.length; i++) {
        var trozo = palabras[i];
        if (trozo === '') continue;

        if (anchoTexto(linea + trozo, anot) <= ancho || linea === '') {
          // Una sola palabra más larga que el cuadro: se parte por letras.
          if (linea === '' && anchoTexto(trozo, anot) > ancho) {
            var acumulado = '';
            for (var j = 0; j < trozo.length; j++) {
              if (acumulado && anchoTexto(acumulado + trozo[j], anot) > ancho) {
                salida.push(acumulado);
                acumulado = '';
              }
              acumulado += trozo[j];
            }
            linea = acumulado;
            continue;
          }
          linea += trozo;
        } else {
          empujar();
          if (!/^\s+$/.test(trozo)) { i--; }   // se reintenta la palabra sola
        }
      }
      salida.push(linea.replace(/\s+$/, ''));
    });

    return salida;
  }

  function altoTexto(anot) {
    return Math.max(1, lineas(anot).length) * anot.tam * anot.interlineado;
  }

  /* ── Creación ───────────────────────────────────────────────────────── */

  function nueva(tipo, datos) {
    var a = { id: util.id('a'), tipo: tipo };
    for (var k in datos) if (Object.prototype.hasOwnProperty.call(datos, k)) a[k] = datos[k];
    return a;
  }

  function nuevoTexto(x, y, w, ajustes, texto) {
    return nueva('texto', {
      x: x, y: y, w: Math.max(24, w),
      texto: texto == null ? '' : texto,
      tam: ajustes.tamTexto,
      fuente: ajustes.fuenteTexto,
      negrita: ajustes.negrita,
      cursiva: ajustes.cursiva,
      color: ajustes.colorTexto,
      alineado: ajustes.alineado,
      interlineado: ajustes.interlineado,
      fondo: ''
    });
  }

  /* ── Caja envolvente ────────────────────────────────────────────────── */

  function caja(anot) {
    var m;
    switch (anot.tipo) {
      case 'rect':
      case 'elipse':
        m = (anot.grosor || 0) / 2;
        return { x: anot.x - m, y: anot.y - m, w: anot.w + 2 * m, h: anot.h + 2 * m };

      case 'resaltado':
      case 'tapar':
      case 'imagen':
        return { x: anot.x, y: anot.y, w: anot.w, h: anot.h };

      case 'linea':
      case 'flecha':
        m = (anot.grosor || 1) / 2 + 1;
        return {
          x: Math.min(anot.x1, anot.x2) - m,
          y: Math.min(anot.y1, anot.y2) - m,
          w: Math.abs(anot.x2 - anot.x1) + 2 * m,
          h: Math.abs(anot.y2 - anot.y1) + 2 * m
        };

      case 'trazo': {
        m = (anot.grosor || 1) / 2;
        var p = anot.pts;
        if (!p || p.length < 2) return { x: 0, y: 0, w: 0, h: 0 };
        var minX = p[0], maxX = p[0], minY = p[1], maxY = p[1];
        for (var i = 2; i < p.length; i += 2) {
          if (p[i] < minX) minX = p[i];
          if (p[i] > maxX) maxX = p[i];
          if (p[i + 1] < minY) minY = p[i + 1];
          if (p[i + 1] > maxY) maxY = p[i + 1];
        }
        return { x: minX - m, y: minY - m, w: (maxX - minX) + 2 * m, h: (maxY - minY) + 2 * m };
      }

      case 'texto':
        return { x: anot.x, y: anot.y, w: anot.w, h: altoTexto(anot) };
    }
    return { x: 0, y: 0, w: 0, h: 0 };
  }

  /* ── ¿El puntero toca este objeto? ──────────────────────────────────── */

  function tocado(anot, x, y, tolerancia) {
    var t = tolerancia == null ? 3 : tolerancia;

    switch (anot.tipo) {
      case 'resaltado':
      case 'tapar':
      case 'texto':
      case 'imagen':
        return geo.enRect(x, y, caja(anot), t);

      case 'rect': {
        var r = { x: anot.x, y: anot.y, w: anot.w, h: anot.h };
        if (anot.relleno) return geo.enRect(x, y, r, t);
        var m = (anot.grosor || 1) / 2 + t;
        return geo.enRect(x, y, r, m) &&
               !geo.enRect(x, y, { x: r.x + m, y: r.y + m, w: r.w - 2 * m, h: r.h - 2 * m }, 0);
      }

      case 'elipse': {
        var cx = anot.x + anot.w / 2, cy = anot.y + anot.h / 2;
        var rx = Math.max(1, anot.w / 2), ry = Math.max(1, anot.h / 2);
        var mm = (anot.grosor || 1) / 2 + t;
        var dentro = Math.pow((x - cx) / (rx + mm), 2) + Math.pow((y - cy) / (ry + mm), 2) <= 1;
        if (!dentro) return false;
        if (anot.relleno) return true;
        var fuera = Math.pow((x - cx) / Math.max(1, rx - mm), 2) +
                    Math.pow((y - cy) / Math.max(1, ry - mm), 2) >= 1;
        return fuera;
      }

      case 'linea':
      case 'flecha':
        return geo.distSegmento(x, y, anot.x1, anot.y1, anot.x2, anot.y2)
               <= (anot.grosor || 1) / 2 + t;

      case 'trazo': {
        var p = anot.pts, lim = (anot.grosor || 1) / 2 + t;
        for (var i = 0; i + 3 < p.length; i += 2) {
          if (geo.distSegmento(x, y, p[i], p[i + 1], p[i + 2], p[i + 3]) <= lim) return true;
        }
        return false;
      }
    }
    return false;
  }

  /* ── Mover y redimensionar ──────────────────────────────────────────── */

  function mover(anot, dx, dy) {
    switch (anot.tipo) {
      case 'linea':
      case 'flecha':
        anot.x1 += dx; anot.y1 += dy; anot.x2 += dx; anot.y2 += dy;
        break;
      case 'trazo':
        for (var i = 0; i < anot.pts.length; i += 2) {
          anot.pts[i] += dx; anot.pts[i + 1] += dy;
        }
        break;
      default:
        anot.x += dx; anot.y += dy;
    }
  }

  /** ¿Se puede redimensionar con tiradores? */
  function redimensionable(anot) { return anot.tipo !== 'linea' && anot.tipo !== 'flecha'; }

  /** Adapta el objeto a un rectángulo nuevo (escalando si hace falta). */
  function ajustarACaja(anot, nuevo) {
    var viejo = caja(anot);
    if (viejo.w <= 0 || viejo.h <= 0) return;

    var ex = nuevo.w / viejo.w, ey = nuevo.h / viejo.h;

    if (anot.tipo === 'trazo') {
      for (var i = 0; i < anot.pts.length; i += 2) {
        anot.pts[i]     = nuevo.x + (anot.pts[i] - viejo.x) * ex;
        anot.pts[i + 1] = nuevo.y + (anot.pts[i + 1] - viejo.y) * ey;
      }
      return;
    }

    if (anot.tipo === 'texto') {
      // El texto sólo cambia de ancho: el alto lo marca el propio contenido.
      anot.x = nuevo.x; anot.y = nuevo.y;
      anot.w = Math.max(20, nuevo.w);
      return;
    }

    anot.x = nuevo.x + ((anot.x - viejo.x) * ex);
    anot.y = nuevo.y + ((anot.y - viejo.y) * ey);
    anot.w = Math.max(2, anot.w * ex);
    anot.h = Math.max(2, anot.h * ey);
  }

  /* ── Dibujo en pantalla ─────────────────────────────────────────────────
     El contexto ya viene transformado al espacio de página, así que aquí se
     dibuja con las coordenadas tal cual están guardadas.
     ─────────────────────────────────────────────────────────────────────── */

  function dibujar(ctx, anot) {
    ctx.save();
    ctx.globalAlpha = anot.opacidad == null ? 1 : anot.opacidad;

    switch (anot.tipo) {

      case 'tapar':
        ctx.globalAlpha = 1;
        ctx.fillStyle = anot.relleno || '#ffffff';
        ctx.fillRect(anot.x, anot.y, anot.w, anot.h);
        break;

      case 'resaltado':
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = anot.relleno || '#ffe14d';
        ctx.fillRect(anot.x, anot.y, anot.w, anot.h);
        break;

      case 'rect':
        if (anot.relleno) { ctx.fillStyle = anot.relleno; ctx.fillRect(anot.x, anot.y, anot.w, anot.h); }
        if (anot.trazo && anot.grosor > 0) {
          ctx.strokeStyle = anot.trazo;
          ctx.lineWidth = anot.grosor;
          ctx.strokeRect(anot.x, anot.y, anot.w, anot.h);
        }
        break;

      case 'elipse': {
        var cx = anot.x + anot.w / 2, cy = anot.y + anot.h / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.abs(anot.w / 2), Math.abs(anot.h / 2), 0, 0, Math.PI * 2);
        if (anot.relleno) { ctx.fillStyle = anot.relleno; ctx.fill(); }
        if (anot.trazo && anot.grosor > 0) {
          ctx.strokeStyle = anot.trazo;
          ctx.lineWidth = anot.grosor;
          ctx.stroke();
        }
        break;
      }

      case 'linea':
      case 'flecha':
        ctx.strokeStyle = anot.trazo;
        ctx.lineWidth = anot.grosor;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(anot.x1, anot.y1);
        ctx.lineTo(anot.x2, anot.y2);
        ctx.stroke();
        if (anot.tipo === 'flecha') {
          var puntos = puntaFlecha(anot);
          ctx.fillStyle = anot.trazo;
          ctx.beginPath();
          ctx.moveTo(puntos[0], puntos[1]);
          ctx.lineTo(puntos[2], puntos[3]);
          ctx.lineTo(puntos[4], puntos[5]);
          ctx.closePath();
          ctx.fill();
        }
        break;

      case 'trazo': {
        var p = anot.pts;
        if (!p || p.length < 2) break;
        if (anot.resaltador) ctx.globalCompositeOperation = 'multiply';
        ctx.strokeStyle = anot.trazo;
        ctx.lineWidth = anot.grosor;
        ctx.lineCap = anot.resaltador ? 'butt' : 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(p[0], p[1]);
        if (p.length === 2) ctx.lineTo(p[0] + 0.01, p[1]);
        for (var i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
        ctx.stroke();
        break;
      }

      case 'imagen': {
        var bm = Clarvi.imagenes && Clarvi.imagenes.bitmap(anot.imgId);
        if (bm) {
          ctx.drawImage(bm, anot.x, anot.y, anot.w, anot.h);
        } else {
          // La imagen todavía no está lista: se marca el hueco.
          ctx.strokeStyle = '#9aa5bd';
          ctx.setLineDash([3, 3]);
          ctx.lineWidth = 0.7;
          ctx.strokeRect(anot.x, anot.y, anot.w, anot.h);
          ctx.setLineDash([]);
        }
        break;
      }

      case 'texto':
        dibujarTexto(ctx, anot);
        break;
    }

    ctx.restore();
  }

  /** Los tres vértices de la punta de una flecha. */
  function puntaFlecha(anot) {
    var largo = Math.max(4, (anot.grosor || 1) * 3.6);
    var ang = Math.atan2(anot.y2 - anot.y1, anot.x2 - anot.x1);
    var abre = Math.PI / 7;
    return [
      anot.x2, anot.y2,
      anot.x2 - largo * Math.cos(ang - abre), anot.y2 - largo * Math.sin(ang - abre),
      anot.x2 - largo * Math.cos(ang + abre), anot.y2 - largo * Math.sin(ang + abre)
    ];
  }

  function dibujarTexto(ctx, anot) {
    var ls = lineas(anot);
    var alto = ls.length * anot.tam * anot.interlineado;

    if (anot.fondo) {
      ctx.fillStyle = anot.fondo;
      ctx.fillRect(anot.x, anot.y, anot.w, alto);
    }

    ctx.fillStyle = anot.color || '#000000';
    ctx.textBaseline = 'alphabetic';
    ctx.font = (anot.cursiva ? 'italic ' : '') + (anot.negrita ? 'bold ' : '') +
               anot.tam + 'px ' + (FAMILIAS[anot.fuente] || FAMILIAS.Helvetica);

    var base = ascenso(anot);
    var desplazamiento = (anot.tam * anot.interlineado - anot.tam) / 2;

    for (var i = 0; i < ls.length; i++) {
      var linea = ls[i];
      if (!linea) continue;

      var anchoPdf = anchoTexto(linea, anot);
      var x = anot.x;
      if (anot.alineado === 'centro') x = anot.x + (anot.w - anchoPdf) / 2;
      else if (anot.alineado === 'der') x = anot.x + (anot.w - anchoPdf);

      var y = anot.y + desplazamiento + i * anot.tam * anot.interlineado + base;

      // Se estira la línea para que ocupe justo lo que ocupará en el PDF.
      var anchoCanvas = ctx.measureText(linea).width;
      if (anchoCanvas > 0.01 && Math.abs(anchoCanvas - anchoPdf) > 0.05) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(anchoPdf / anchoCanvas, 1);
        ctx.fillText(linea, 0, 0);
        ctx.restore();
      } else {
        ctx.fillText(linea, x, y);
      }
    }
  }

  Clarvi.anots = {
    FAMILIAS: FAMILIAS,
    claveFuente: claveFuente,
    nombreEstandar: nombreEstandar,
    prepararFuentes: prepararFuentes,
    fuenteMedida: fuenteMedida,
    fuentesMedida: function () { return fuentesMedida; },
    sanear: sanear,
    anchoTexto: anchoTexto,
    ascenso: ascenso,
    lineas: lineas,
    altoTexto: altoTexto,
    nueva: nueva,
    nuevoTexto: nuevoTexto,
    caja: caja,
    tocado: tocado,
    mover: mover,
    redimensionable: redimensionable,
    ajustarACaja: ajustarACaja,
    dibujar: dibujar,
    puntaFlecha: puntaFlecha
  };
})(window);
