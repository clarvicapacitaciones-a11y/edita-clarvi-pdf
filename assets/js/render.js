/* ===========================================================================
   render.js — pintado de páginas, capa de texto, anotaciones y miniaturas

   Cada página del documento se representa así:

     <div class="pagina">
       <canvas class="capa-pdf">     ← lo que dibuja pdf.js
       <div   class="capa-texto">    ← spans transparentes para seleccionar texto
       <canvas class="capa-anot">    ← lo que añade el usuario + tiradores
     </div>

   Sólo se renderiza el contenido de las páginas cercanas a la ventana
   (IntersectionObserver), así que abrir un PDF de 400 páginas es inmediato.
   =========================================================================== */
(function (raiz) {
  'use strict';

  var Clarvi = raiz.Clarvi || (raiz.Clarvi = {});
  var util = Clarvi.util;
  var estado = Clarvi.estado;
  var geo = Clarvi.geo;
  var anots = Clarvi.anots;

  var pdfjsLib = raiz.pdfjsLib;

  var contenedor, lienzo;
  var vistas = new Map();          // paginaId → { el, pdf, anot, texto, … }
  var observador = null;
  var dpr = Math.min(raiz.devicePixelRatio || 1, 2);
  var cacheTexto = new Map();      // paginaId → Promise<{items, renglones}>
  var textoListo = new Map();      // paginaId → el mismo valor, ya resuelto

  var MARGEN_LIENZO = 40;          // relleno horizontal de .paginas

  /* ── Utilidades de escala ───────────────────────────────────────────── */

  function anchoDisponible() {
    return Math.max(120, lienzo.clientWidth - MARGEN_LIENZO - 8);
  }
  function altoDisponible() {
    return Math.max(120, lienzo.clientHeight - MARGEN_LIENZO);
  }

  /** Recalcula estado.zoom cuando el modo es «ajustar». */
  function recalcularZoom() {
    var modo = estado.modoZoom;
    if (modo !== 'ancho' && modo !== 'pagina') {
      estado.zoom = parseFloat(modo) || 1;
      return;
    }
    var pag = estado.paginas[estado.paginaActual] || estado.paginas[0];
    if (!pag) { estado.zoom = 1; return; }

    var t = estado.tamanoVista(pag);
    var z = anchoDisponible() / t.ancho;
    if (modo === 'pagina') z = Math.min(z, altoDisponible() / t.alto);
    estado.zoom = util.limitar(z, 0.08, 8);
  }

  /* ── Creación del DOM de una página ─────────────────────────────────── */

  function crearVista(pag) {
    var el = util.crear('div', 'pagina');
    el.dataset.pag = pag.id;

    var pdf = util.crear('canvas', 'capa-pdf');
    var texto = util.crear('div', 'capa-texto');
    var anot = util.crear('canvas', 'capa-anot');
    var cargando = util.crear('div', 'cargando', 'Cargando…');
    var num = util.crear('div', 'num-flotante');

    el.appendChild(pdf);
    el.appendChild(cargando);
    el.appendChild(texto);
    el.appendChild(anot);
    el.appendChild(num);

    var v = {
      id: pag.id, el: el, pdf: pdf, anot: anot, texto: texto,
      cargando: cargando, num: num,
      tarea: null, escalaHecha: 0, giroHecho: -1, textoHecho: 0
    };
    vistas.set(pag.id, v);
    return v;
  }

  /** Ajusta el tamaño de los lienzos de una página al zoom actual. */
  function dimensionar(pag, v) {
    var t = estado.tamanoVista(pag);
    var anchoCss = Math.max(1, Math.round(t.ancho * estado.zoom));
    var altoCss = Math.max(1, Math.round(t.alto * estado.zoom));

    v.el.style.width = anchoCss + 'px';
    v.el.style.height = altoCss + 'px';

    [v.pdf, v.anot].forEach(function (c) {
      var w = Math.max(1, Math.round(t.ancho * estado.zoom * dpr));
      var h = Math.max(1, Math.round(t.alto * estado.zoom * dpr));
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      c.style.width = anchoCss + 'px';
      c.style.height = altoCss + 'px';
    });

    v.texto.style.width = anchoCss + 'px';
    v.texto.style.height = altoCss + 'px';
  }

  /* ── Render del contenido PDF ───────────────────────────────────────── */

  function renderizarPdf(pag, v) {
    var escala = estado.zoom * dpr;
    var giro = estado.giroTotal(pag);

    if (v.escalaHecha === escala && v.giroHecho === giro && !v.sucio) return Promise.resolve();

    if (v.tarea) { try { v.tarea.cancel(); } catch (e) { /* ya terminada */ } v.tarea = null; }

    var fuente = estado.fuenteDe(pag);
    if (!fuente) return Promise.resolve();

    v.sucio = false;
    v.escalaHecha = escala;
    v.giroHecho = giro;

    return fuente.doc.getPage(pag.indice + 1).then(function (pagPdf) {
      // Si el zoom cambió mientras se cargaba, se abandona este render.
      if (v.escalaHecha !== escala || v.giroHecho !== giro) return;

      var vp = pagPdf.getViewport({ scale: escala, rotation: giro });
      var ctx = v.pdf.getContext('2d', { alpha: false });

      if (v.pdf.width !== Math.floor(vp.width) || v.pdf.height !== Math.floor(vp.height)) {
        v.pdf.width = Math.floor(vp.width);
        v.pdf.height = Math.floor(vp.height);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, v.pdf.width, v.pdf.height);

      var tarea = pagPdf.render({ canvasContext: ctx, viewport: vp });
      v.tarea = tarea;

      return tarea.promise.then(function () {
        v.tarea = null;
        v.cargando.style.display = 'none';
        v.pintado = true;
        if (v.pendienteTexto) construirCapaTexto(pag, v);
      }).catch(function (err) {
        v.tarea = null;
        if (err && err.name === 'RenderingCancelledException') return;
        v.escalaHecha = 0;
        v.cargando.textContent = 'No se pudo mostrar esta página';
      });
    }).catch(function () {
      v.escalaHecha = 0;
      v.cargando.textContent = 'No se pudo mostrar esta página';
    });
  }

  /* ── Capa de texto (seleccionar y copiar) ───────────────────────────── */

  function construirCapaTexto(pag, v) {
    var fuente = estado.fuenteDe(pag);
    if (!fuente) return;

    var escala = estado.zoom;
    var giro = estado.giroTotal(pag);
    if (v.textoHecho === escala && v.textoGiro === giro) return;

    v.textoHecho = escala;
    v.textoGiro = giro;
    v.pendienteTexto = false;

    fuente.doc.getPage(pag.indice + 1).then(function (pagPdf) {
      return pagPdf.getTextContent().then(function (contenido) {
        if (v.textoHecho !== escala || v.textoGiro !== giro) return;

        var vp = pagPdf.getViewport({ scale: escala, rotation: giro });
        var frag = document.createDocumentFragment();

        contenido.items.forEach(function (item) {
          if (!item.str) return;
          var tx = pdfjsLib.Util.transform(vp.transform, item.transform);
          var alto = Math.hypot(tx[2], tx[3]);
          if (alto < 0.5) return;

          var angulo = Math.atan2(tx[1], tx[0]);
          var span = document.createElement('span');
          span.textContent = item.str;
          span.style.left = tx[4] + 'px';
          span.style.top = (tx[5] - alto) + 'px';
          span.style.fontSize = alto + 'px';
          span.style.fontFamily = (contenido.styles[item.fontName] || {}).fontFamily || 'sans-serif';
          if (angulo) span.style.transform = 'rotate(' + angulo + 'rad)';
          frag.appendChild(span);
        });

        util.vaciar(v.texto);
        v.texto.appendChild(frag);
      });
    }).catch(function () { v.textoHecho = 0; });
  }

  function asegurarCapaTexto(pag) {
    var v = vistas.get(pag.id);
    if (!v) return;
    if (v.pintado) construirCapaTexto(pag, v);
    else v.pendienteTexto = true;
  }

  /* ── Texto original en coordenadas de página (herramienta «Editar») ──── */

  /**
   * Devuelve el texto de una página agrupado en renglones, con las cajas ya
   * en puntos del espacio de página sin girar (el mismo de las anotaciones).
   */
  /**
   * Extrae el texto de una página de pdf.js y lo agrupa en renglones, con las
   * cajas ya en puntos del espacio de página sin girar (el mismo de las
   * anotaciones). Funciona con cualquier documento, esté o no abierto en el
   * editor: la comparación de PDF lo usa sobre el segundo archivo.
   */
  function extraerRenglones(pagPdf) {
    var vp0 = pagPdf.getViewport({ scale: 1, rotation: 0 });

    return pagPdf.getTextContent().then(function (contenido) {
      var items = [];

      contenido.items.forEach(function (item) {
        if (!item.str || !item.str.trim()) return;
        var tx = pdfjsLib.Util.transform(vp0.transform, item.transform);
        var alto = Math.hypot(tx[2], tx[3]);
        if (alto < 0.5) return;
        // Sólo texto horizontal: el inclinado no se puede reescribir bien.
        if (Math.abs(tx[1]) > 0.02 * Math.abs(tx[0] || 1) && Math.abs(tx[0]) < 0.02) return;

        var estilo = contenido.styles[item.fontName] || {};
        var nombreReal = '';
        try {
          if (pagPdf.commonObjs.has(item.fontName)) {
            nombreReal = (pagPdf.commonObjs.get(item.fontName) || {}).name || '';
          }
        } catch (e) { /* la fuente aún no está cargada */ }

        items.push({
          texto: item.str,
          x: tx[4],
          base: tx[5],
          ancho: item.width || 0,
          tam: alto,
          familia: estilo.fontFamily || 'sans-serif',
          nombreFuente: nombreReal || estilo.fontFamily || ''
        });
      });

      items.sort(function (a, b) { return (a.base - b.base) || (a.x - b.x); });

      // Se agrupan en renglones por cercanía de línea base.
      var renglones = [];
      items.forEach(function (it) {
        var ultimo = renglones[renglones.length - 1];
        var margen = Math.max(1.5, it.tam * 0.35);
        if (ultimo && Math.abs(ultimo.base - it.base) <= margen) {
          ultimo.items.push(it);
          ultimo.base = (ultimo.base * (ultimo.items.length - 1) + it.base) / ultimo.items.length;
          ultimo.tam = Math.max(ultimo.tam, it.tam);
        } else {
          renglones.push({ base: it.base, tam: it.tam, items: [it] });
        }
      });

      renglones.forEach(function (r) {
        r.items.sort(function (a, b) { return a.x - b.x; });
        var x0 = Infinity, x1 = -Infinity, texto = '';
        r.items.forEach(function (it, i) {
          x0 = Math.min(x0, it.x);
          x1 = Math.max(x1, it.x + it.ancho);
          if (i > 0 && hayHueco(r, i)) texto += ' ';
          texto += it.texto;
        });
        r.texto = texto;
        r.x = x0;
        r.ancho = Math.max(1, x1 - x0);
        r.y = r.base - r.tam * 0.86;
        r.alto = r.tam * 1.16;
        r.familia = r.items[0].familia;
        r.nombreFuente = r.items[0].nombreFuente;
      });

      return { items: items, renglones: renglones };
    });
  }

  /**
   * ¿Hay que meter un espacio entre el trozo i-1 y el i de un renglón?
   * Se usa igual al construir el texto del renglón y al mapear cada carácter
   * a su posición, de modo que ambos caminos coinciden siempre.
   */
  function hayHueco(r, i) {
    var prev = r.items[i - 1], it = r.items[i];
    var hueco = it.x - (prev.x + prev.ancho);
    return hueco > r.tam * 0.16 && !/\s$/.test(prev.texto) && !/^\s/.test(it.texto);
  }

  /** Igual que extraerRenglones, pero cacheado por página del documento abierto. */
  function textoDePagina(pag) {
    if (cacheTexto.has(pag.id)) return cacheTexto.get(pag.id);

    var fuente = estado.fuenteDe(pag);
    if (!fuente) return Promise.resolve({ items: [], renglones: [] });

    var promesa = fuente.doc.getPage(pag.indice + 1)
      .then(extraerRenglones)
      .then(function (resultado) {
        textoListo.set(pag.id, resultado);
        return resultado;
      })
      .catch(function () {
        var vacio = { items: [], renglones: [] };
        textoListo.set(pag.id, vacio);
        return vacio;
      });

    cacheTexto.set(pag.id, promesa);
    return promesa;
  }

  /* ── Muestreo de color sobre lo ya renderizado ──────────────────────── */

  /** Punto de página → píxel del lienzo del PDF. */
  function aPixel(pag, x, y) {
    var v = geo.aVista(pag, x, y, estado.zoom * dpr);
    return { x: Math.round(v.x), y: Math.round(v.y) };
  }

  function leerPixeles(vista, puntos) {
    var ctx = vista.pdf.getContext('2d', { willReadFrequently: true });
    var salida = [];
    for (var i = 0; i < puntos.length; i++) {
      var p = puntos[i];
      if (p.x < 0 || p.y < 0 || p.x >= vista.pdf.width || p.y >= vista.pdf.height) continue;
      try {
        var d = ctx.getImageData(p.x, p.y, 1, 1).data;
        salida.push([d[0], d[1], d[2]]);
      } catch (e) { /* lienzo no legible */ }
    }
    return salida;
  }

  /** Color de fondo dominante alrededor de un rectángulo de página. */
  function colorFondo(pag, r) {
    var v = vistas.get(pag.id);
    if (!v || !v.pintado) return '#ffffff';

    var puntos = [];
    var pasos = 7;
    for (var i = 0; i <= pasos; i++) {
      var t = i / pasos;
      var x = r.x + r.w * t;
      puntos.push(aPixel(pag, x, r.y - Math.max(1.5, r.h * 0.28)));
      puntos.push(aPixel(pag, x, r.y + r.h + Math.max(1.5, r.h * 0.28)));
    }
    puntos.push(aPixel(pag, r.x - Math.max(2, r.h * 0.4), r.y + r.h / 2));
    puntos.push(aPixel(pag, r.x + r.w + Math.max(2, r.h * 0.4), r.y + r.h / 2));

    var muestras = leerPixeles(v, puntos);
    if (!muestras.length) return '#ffffff';

    // Se agrupa en cubos de 16 niveles y gana el más repetido.
    var cuentas = {}, mejor = null, mejorN = 0;
    muestras.forEach(function (c) {
      var clave = (c[0] >> 4) + ',' + (c[1] >> 4) + ',' + (c[2] >> 4);
      var e = cuentas[clave] || (cuentas[clave] = { n: 0, r: 0, g: 0, b: 0 });
      e.n++; e.r += c[0]; e.g += c[1]; e.b += c[2];
      if (e.n > mejorN) { mejorN = e.n; mejor = e; }
    });
    if (!mejor) return '#ffffff';
    return util.rgbAHex(mejor.r / mejor.n, mejor.g / mejor.n, mejor.b / mejor.n);
  }

  /** Color de la tinta dentro de un rectángulo (el píxel más oscuro). */
  function colorTinta(pag, r, fondoHex) {
    var v = vistas.get(pag.id);
    if (!v || !v.pintado) return '#111111';

    var fondo = util.hexARgb(fondoHex || '#ffffff');
    var lumFondo = util.luminancia(fondo.r * 255, fondo.g * 255, fondo.b * 255);

    var puntos = [];
    for (var i = 1; i < 26; i++) {
      for (var j = 1; j < 5; j++) {
        puntos.push(aPixel(pag, r.x + r.w * (i / 26), r.y + r.h * (j / 5)));
      }
    }

    var muestras = leerPixeles(v, puntos);
    var mejor = null, mejorDist = 26;
    muestras.forEach(function (c) {
      var dist = Math.abs(util.luminancia(c[0], c[1], c[2]) - lumFondo);
      if (dist > mejorDist) { mejorDist = dist; mejor = c; }
    });

    if (!mejor) return lumFondo < 128 ? '#ffffff' : '#111111';
    return util.rgbAHex(mejor[0], mejor[1], mejor[2]);
  }

  /* ── Dibujo de las anotaciones ──────────────────────────────────────── */

  function dibujarAnots(pag) {
    var v = vistas.get(pag.id);
    if (!v) return;

    var ctx = v.anot.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, v.anot.width, v.anot.height);

    var escala = estado.zoom * dpr;

    geo.aplicarTransformacion(ctx, pag, escala);
    for (var i = 0; i < pag.anots.length; i++) anots.dibujar(ctx, pag.anots[i]);

    // Vista previa de la herramienta en curso (rectángulo que se está creando…)
    if (Clarvi.herramientas && Clarvi.herramientas.previa) {
      var previa = Clarvi.herramientas.previa(pag);
      if (previa) anots.dibujar(ctx, previa);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    dibujarSeleccion(ctx, pag, escala);
  }

  function dibujarSeleccion(ctx, pag, escala) {
    if (!estado.seleccion || estado.seleccion.paginaId !== pag.id) return;
    var anot = estado.anotSeleccionada();
    if (!anot) return;

    var c = anots.caja(anot);
    var esquinas = [
      geo.aVista(pag, c.x, c.y, escala),
      geo.aVista(pag, c.x + c.w, c.y, escala),
      geo.aVista(pag, c.x + c.w, c.y + c.h, escala),
      geo.aVista(pag, c.x, c.y + c.h, escala)
    ];
    var xs = esquinas.map(function (p) { return p.x; });
    var ys = esquinas.map(function (p) { return p.y; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);

    ctx.save();
    ctx.strokeStyle = '#4f8ef7';
    ctx.lineWidth = 1 * dpr;
    ctx.setLineDash([4 * dpr, 3 * dpr]);
    ctx.strokeRect(x0 - 0.5, y0 - 0.5, (x1 - x0) + 1, (y1 - y0) + 1);
    ctx.setLineDash([]);

    var lado = 7 * dpr;
    function tirador(px, py) {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#4f8ef7';
      ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath();
      ctx.rect(px - lado / 2, py - lado / 2, lado, lado);
      ctx.fill();
      ctx.stroke();
    }

    if (anots.redimensionable(anot)) {
      geo.tiradores(c).forEach(function (t) {
        var p = geo.aVista(pag, t.x, t.y, escala);
        tirador(p.x, p.y);
      });
    } else {
      [[anot.x1, anot.y1], [anot.x2, anot.y2]].forEach(function (p) {
        var q = geo.aVista(pag, p[0], p[1], escala);
        tirador(q.x, q.y);
      });
    }
    ctx.restore();
  }

  /* ── Reconstrucción de la lista de páginas ──────────────────────────── */

  function reconstruir() {
    recalcularZoom();

    // Se descartan las vistas de páginas que ya no existen.
    var vivos = new Set(estado.paginas.map(function (p) { return p.id; }));
    vistas.forEach(function (v, id) {
      if (!vivos.has(id)) {
        if (v.tarea) { try { v.tarea.cancel(); } catch (e) { /* ignorar */ } }
        if (v.el.parentNode) v.el.parentNode.removeChild(v.el);
        vistas.delete(id);
        cacheTexto.delete(id);
        textoListo.delete(id);
      }
    });

    var anterior = null;
    estado.paginas.forEach(function (pag, i) {
      var v = vistas.get(pag.id) || crearVista(pag);

      // Colocación en el orden correcto sin recrear nodos.
      var siguiente = anterior ? anterior.nextSibling : contenedor.firstChild;
      if (siguiente !== v.el) contenedor.insertBefore(v.el, siguiente);
      anterior = v.el;

      var t = estado.tamanoVista(pag);
      var fuente = estado.fuenteDe(pag);
      v.num.textContent = (i + 1) + ' / ' + estado.paginas.length +
        (estado.fuentes.size > 1 && fuente ? '  ·  ' + fuente.nombre : '');

      var giro = estado.giroTotal(pag);
      var escala = estado.zoom * dpr;
      if (v.escalaHecha !== escala || v.giroHecho !== giro) {
        v.cargando.style.display = '';
        v.pintado = false;
        v.textoHecho = 0;
        util.vaciar(v.texto);
      }

      dimensionar(pag, v);
      dibujarAnots(pag);
      if (observador) observador.observe(v.el);
    });

    lienzo.classList.toggle('oculto-vacio', estado.paginas.length > 0);
    renderizarVisibles();
  }

  /** Renderiza el contenido de las páginas que están (casi) en pantalla. */
  function renderizarVisibles() {
    var arriba = lienzo.scrollTop - 900;
    var abajo = lienzo.scrollTop + lienzo.clientHeight + 900;

    estado.paginas.forEach(function (pag) {
      var v = vistas.get(pag.id);
      if (!v) return;
      var y0 = v.el.offsetTop, y1 = y0 + v.el.offsetHeight;
      if (y1 >= arriba && y0 <= abajo) {
        renderizarPdf(pag, v).then(function () {
          if (estado.herramienta === 'seltexto' || estado.herramienta === 'editar') {
            asegurarCapaTexto(pag);
          }
        });
      }
    });
  }

  /* ── Miniaturas ─────────────────────────────────────────────────────── */

  var colaMin = [];
  var minTrabajando = false;

  function pintarMiniatura(pag, canvas) {
    colaMin.push({ pag: pag, canvas: canvas });
    if (!minTrabajando) siguienteMiniatura();
  }

  function siguienteMiniatura() {
    var trabajo = colaMin.shift();
    if (!trabajo) { minTrabajando = false; return; }
    minTrabajando = true;

    var pag = trabajo.pag, canvas = trabajo.canvas;
    if (!canvas.isConnected || estado.indiceDe(pag.id) < 0) return siguienteMiniatura();

    var fuente = estado.fuenteDe(pag);
    if (!fuente) return siguienteMiniatura();

    fuente.doc.getPage(pag.indice + 1).then(function (pagPdf) {
      var giro = estado.giroTotal(pag);
      var t = estado.tamanoVista(pag);
      var escala = 180 / Math.max(1, t.ancho);
      var vp = pagPdf.getViewport({ scale: escala, rotation: giro });

      canvas.width = Math.max(1, Math.floor(vp.width));
      canvas.height = Math.max(1, Math.floor(vp.height));

      var ctx = canvas.getContext('2d', { alpha: false });
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      return pagPdf.render({ canvasContext: ctx, viewport: vp }).promise.then(function () {
        // Se superponen las anotaciones también en la miniatura.
        var ctx2 = canvas.getContext('2d');
        geo.aplicarTransformacion(ctx2, pag, escala);
        pag.anots.forEach(function (a) { anots.dibujar(ctx2, a); });
        ctx2.setTransform(1, 0, 0, 1, 0, 0);
        canvas.dataset.firma = firmaPagina(pag);
      });
    }).catch(function () { /* miniatura opcional */ })
      .then(function () { setTimeout(siguienteMiniatura, 0); });
  }

  /** Huella que cambia cuando la miniatura debe repintarse. */
  function firmaPagina(pag) {
    return pag.indice + ':' + estado.giroTotal(pag) + ':' + pag.anots.length + ':' +
           JSON.stringify(pag.anots).length;
  }

  /* ── API pública ────────────────────────────────────────────────────── */

  function iniciar() {
    contenedor = util.$('#paginas');
    lienzo = util.$('#lienzo');

    observador = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (!e.isIntersecting) return;
        var id = e.target.dataset.pag;
        var pag = estado.pagina(id);
        var v = vistas.get(id);
        if (pag && v) {
          renderizarPdf(pag, v).then(function () {
            if (estado.herramienta === 'seltexto' || estado.herramienta === 'editar') {
              asegurarCapaTexto(pag);
            }
          });
        }
      });
    }, { root: lienzo, rootMargin: '900px 0px' });
  }

  Clarvi.render = {
    iniciar: iniciar,
    reconstruir: reconstruir,
    renderizarVisibles: renderizarVisibles,
    recalcularZoom: recalcularZoom,
    dibujarAnots: dibujarAnots,
    vista: function (id) { return vistas.get(id); },
    dpr: function () { return dpr; },
    asegurarCapaTexto: asegurarCapaTexto,
    textoDePagina: textoDePagina,
    extraerRenglones: extraerRenglones,
    hayHueco: hayHueco,
    textoResuelto: function (id) { return textoListo.get(id) || null; },
    colorFondo: colorFondo,
    colorTinta: colorTinta,
    pintarMiniatura: pintarMiniatura,
    firmaPagina: firmaPagina,
    elementoDe: function (id) { var v = vistas.get(id); return v ? v.el : null; },
    lienzo: function () { return lienzo; }
  };
})(window);
