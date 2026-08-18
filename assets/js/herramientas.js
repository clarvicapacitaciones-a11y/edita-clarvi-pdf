/* ===========================================================================
   herramientas.js — todo lo que ocurre al usar el ratón sobre una página
   =========================================================================== */
(function (raiz) {
  'use strict';

  var Clarvi = raiz.Clarvi || (raiz.Clarvi = {});
  var util = Clarvi.util;
  var estado = Clarvi.estado;
  var geo = Clarvi.geo;
  var anots = Clarvi.anots;
  var render = Clarvi.render;

  var arrastre = null;      // gesto en curso
  var edicion = null;       // { paginaId, anotId, area } mientras se escribe
  var TOL_TIRADOR = 9;      // píxeles de tolerancia para agarrar un tirador

  /* ── Conversión de coordenadas ──────────────────────────────────────── */

  function paginaDeEvento(ev) {
    var el = ev.target.closest ? ev.target.closest('.pagina') : null;
    return el ? estado.pagina(el.dataset.pag) : null;
  }

  function puntoPagina(ev, pag) {
    var v = render.vista(pag.id);
    if (!v) return { x: 0, y: 0 };
    var caja = v.anot.getBoundingClientRect();
    return geo.aPagina(pag, ev.clientX - caja.left, ev.clientY - caja.top, estado.zoom);
  }

  function puntoVista(ev, pag) {
    var v = render.vista(pag.id);
    if (!v) return { x: 0, y: 0 };
    var caja = v.anot.getBoundingClientRect();
    return { x: ev.clientX - caja.left, y: ev.clientY - caja.top };
  }

  /* ── Objeto de vista previa mientras se arrastra ────────────────────── */

  function previa(pag) {
    if (!arrastre || arrastre.paginaId !== pag.id || !arrastre.previa) return null;
    return arrastre.previa;
  }

  /* ── Selección ──────────────────────────────────────────────────────── */

  function seleccionar(paginaId, anotId) {
    var cambia = !estado.seleccion ||
                 estado.seleccion.paginaId !== paginaId ||
                 estado.seleccion.anotId !== anotId;
    estado.seleccion = anotId ? { paginaId: paginaId, anotId: anotId } : null;
    if (cambia) estado.emitir('seleccion');
    return cambia;
  }

  function anotEnPunto(pag, x, y) {
    var tol = 3 / Math.max(0.2, estado.zoom);
    for (var i = pag.anots.length - 1; i >= 0; i--) {
      if (anots.tocado(pag.anots[i], x, y, tol)) return pag.anots[i];
    }
    return null;
  }

  /** ¿El puntero está sobre un tirador del objeto seleccionado? */
  function tiradorEnPunto(pag, ev) {
    var anot = estado.anotSeleccionada();
    if (!anot || !estado.seleccion || estado.seleccion.paginaId !== pag.id) return null;

    var pv = puntoVista(ev, pag);
    var lista;

    if (anots.redimensionable(anot)) {
      lista = geo.tiradores(anots.caja(anot));
    } else {
      lista = [{ n: 'p1', x: anot.x1, y: anot.y1 }, { n: 'p2', x: anot.x2, y: anot.y2 }];
    }

    for (var i = 0; i < lista.length; i++) {
      var v = geo.aVista(pag, lista[i].x, lista[i].y, estado.zoom);
      if (Math.hypot(v.x - pv.x, v.y - pv.y) <= TOL_TIRADOR) return lista[i].n;
    }
    return null;
  }

  /* ── Alta de objetos ────────────────────────────────────────────────── */

  function anadir(pag, anot) {
    pag.anots.push(anot);
    seleccionar(pag.id, anot.id);
    estado.marcar('añadir');
    estado.emitir('pagina', pag.id);
    return anot;
  }

  function ajustesTrazo() {
    var a = estado.ajustes;
    return { trazo: a.colorTrazo, grosor: a.grosor, opacidad: a.opacidad };
  }

  /* ── Comienzo del gesto ─────────────────────────────────────────────── */

  function alBajar(ev) {
    if (ev.button !== 0) return;
    var pag = paginaDeEvento(ev);
    if (!pag) return;
    if (estado.herramienta === 'seltexto') return;

    if (edicion) cerrarEditor(true);

    var p = puntoPagina(ev, pag);
    estado.paginaActual = estado.indiceDe(pag.id);

    var herr = estado.herramienta;
    ev.preventDefault();
    try { ev.target.setPointerCapture(ev.pointerId); } catch (e) { /* opcional */ }

    /* — Mover / seleccionar — */
    if (herr === 'seleccionar') {
      var tirador = tiradorEnPunto(pag, ev);
      if (tirador) {
        var anotSel = estado.anotSeleccionada();
        arrastre = {
          tipo: tirador === 'p1' || tirador === 'p2' ? 'extremo' : 'redim',
          paginaId: pag.id, anot: anotSel, tirador: tirador,
          inicio: p, cajaInicial: anots.caja(anotSel),
          copia: util.clonar(anotSel), movido: false
        };
        return;
      }

      var encontrado = anotEnPunto(pag, p.x, p.y);
      seleccionar(pag.id, encontrado ? encontrado.id : null);
      estado.emitir('pagina', pag.id);

      if (encontrado) {
        arrastre = {
          tipo: 'mover', paginaId: pag.id, anot: encontrado,
          inicio: p, ultimo: p, movido: false
        };
      }
      return;
    }

    /* — Borrador — */
    if (herr === 'borrar') {
      arrastre = { tipo: 'borrar', paginaId: pag.id, borrados: 0 };
      borrarEn(pag, p);
      return;
    }

    /* — Editar texto existente — */
    if (herr === 'editar') {
      editarTextoExistente(pag, p);
      return;
    }

    /* — Dibujo libre — */
    if (herr === 'lapiz') {
      var a = ajustesTrazo();
      arrastre = {
        tipo: 'trazo', paginaId: pag.id,
        previa: anots.nueva('trazo', {
          pts: [p.x, p.y], trazo: a.trazo, grosor: a.grosor,
          opacidad: a.opacidad, resaltador: false
        })
      };
      return;
    }

    /* — Formas y cuadros que se crean arrastrando — */
    arrastre = { tipo: 'crear', paginaId: pag.id, inicio: p, actual: p, herr: herr };
    actualizarPrevia(ev.shiftKey);
  }

  /* ── Movimiento ─────────────────────────────────────────────────────── */

  function alMover(ev) {
    if (!arrastre) { actualizarCursor(ev); return; }

    var pag = estado.pagina(arrastre.paginaId);
    if (!pag) { arrastre = null; return; }

    var p = puntoPagina(ev, pag);

    switch (arrastre.tipo) {
      case 'mover': {
        var dx = p.x - arrastre.ultimo.x, dy = p.y - arrastre.ultimo.y;
        if (!arrastre.movido && Math.hypot(p.x - arrastre.inicio.x, p.y - arrastre.inicio.y) < 1.2) return;
        arrastre.movido = true;
        anots.mover(arrastre.anot, dx, dy);
        arrastre.ultimo = p;
        break;
      }

      case 'redim': {
        var d = { x: p.x - arrastre.inicio.x, y: p.y - arrastre.inicio.y };
        var nuevo = geo.redimensionar(arrastre.cajaInicial, arrastre.tirador, d.x, d.y, 6);
        if (ev.shiftKey && arrastre.cajaInicial.h > 0) {
          var razon = arrastre.cajaInicial.w / arrastre.cajaInicial.h;
          nuevo.h = nuevo.w / razon;
        }
        var copia = util.clonar(arrastre.copia);
        anots.ajustarACaja(copia, nuevo);
        for (var k in copia) if (Object.prototype.hasOwnProperty.call(copia, k)) arrastre.anot[k] = copia[k];
        arrastre.movido = true;
        break;
      }

      case 'extremo': {
        var q = p;
        if (ev.shiftKey) {
          var fijoX = arrastre.tirador === 'p1' ? arrastre.anot.x2 : arrastre.anot.x1;
          var fijoY = arrastre.tirador === 'p1' ? arrastre.anot.y2 : arrastre.anot.y1;
          q = geo.ajustarAngulo(fijoX, fijoY, p.x, p.y);
        }
        if (arrastre.tirador === 'p1') { arrastre.anot.x1 = q.x; arrastre.anot.y1 = q.y; }
        else { arrastre.anot.x2 = q.x; arrastre.anot.y2 = q.y; }
        arrastre.movido = true;
        break;
      }

      case 'trazo': {
        var pts = arrastre.previa.pts;
        var ux = pts[pts.length - 2], uy = pts[pts.length - 1];
        var minimo = 0.7 / Math.max(0.2, estado.zoom);
        if (Math.hypot(p.x - ux, p.y - uy) < minimo) return;
        pts.push(p.x, p.y);
        break;
      }

      case 'borrar':
        borrarEn(pag, p);
        break;

      case 'crear':
        arrastre.actual = p;
        actualizarPrevia(ev.shiftKey);
        break;
    }

    render.dibujarAnots(pag);
  }

  function actualizarCursor(ev) {
    if (estado.herramienta !== 'seleccionar') return;
    var pag = paginaDeEvento(ev);
    var lienzo = render.lienzo();
    if (!pag) return;

    var t = tiradorEnPunto(pag, ev);
    if (t) {
      var giro = estado.giroTotal(pag);
      lienzo.style.cursor = (t === 'p1' || t === 'p2')
        ? 'crosshair' : geo.cursorTirador(t, giro);
      return;
    }
    var p = puntoPagina(ev, pag);
    lienzo.style.cursor = anotEnPunto(pag, p.x, p.y) ? 'move' : '';
  }

  /* ── Fin del gesto ──────────────────────────────────────────────────── */

  function alSubir(ev) {
    if (!arrastre) return;
    var pag = estado.pagina(arrastre.paginaId);
    var gesto = arrastre;
    arrastre = null;
    if (!pag) return;

    switch (gesto.tipo) {
      case 'mover':
      case 'redim':
      case 'extremo':
        if (gesto.movido) estado.marcar('mover');
        break;

      case 'trazo':
        if (gesto.previa.pts.length >= 4) {
          anadir(pag, gesto.previa);
        } else {
          // Un simple clic con el lápiz: se deja un punto visible.
          gesto.previa.pts.push(gesto.previa.pts[0] + 0.4, gesto.previa.pts[1]);
          anadir(pag, gesto.previa);
        }
        break;

      case 'borrar':
        if (gesto.borrados) estado.marcar('borrar');
        break;

      case 'crear':
        terminarCreacion(pag, gesto, ev.shiftKey);
        break;
    }

    render.dibujarAnots(pag);
    estado.emitir('pagina', pag.id);
  }

  /* ── Creación de formas ─────────────────────────────────────────────── */

  function rectDelGesto(gesto, shift) {
    var a = gesto.inicio, b = gesto.actual;
    var r = geo.rectDe(a.x, a.y, b.x, b.y);
    if (shift) { var lado = Math.max(r.w, r.h); r.w = lado; r.h = lado; }
    return r;
  }

  function actualizarPrevia(shift) {
    var aj = estado.ajustes;
    var herr = arrastre.herr;
    var r = rectDelGesto(arrastre, shift);
    var a = arrastre.inicio, b = arrastre.actual;

    if (shift && (herr === 'linea' || herr === 'flecha')) {
      b = geo.ajustarAngulo(a.x, a.y, b.x, b.y);
    }

    switch (herr) {
      case 'resaltar':
        arrastre.previa = anots.nueva('resaltado', {
          x: r.x, y: r.y, w: r.w, h: r.h,
          relleno: aj.colorResaltar, opacidad: aj.opacidadResaltar
        });
        break;
      case 'tapar':
        arrastre.previa = anots.nueva('tapar', {
          x: r.x, y: r.y, w: r.w, h: r.h, relleno: aj.colorTapar
        });
        break;
      case 'rect':
        arrastre.previa = anots.nueva('rect', {
          x: r.x, y: r.y, w: r.w, h: r.h,
          trazo: aj.colorTrazo, relleno: aj.colorRelleno,
          grosor: aj.grosor, opacidad: aj.opacidad
        });
        break;
      case 'elipse':
        arrastre.previa = anots.nueva('elipse', {
          x: r.x, y: r.y, w: r.w, h: r.h,
          trazo: aj.colorTrazo, relleno: aj.colorRelleno,
          grosor: aj.grosor, opacidad: aj.opacidad
        });
        break;
      case 'linea':
      case 'flecha':
        arrastre.previa = anots.nueva(herr, {
          x1: a.x, y1: a.y, x2: b.x, y2: b.y,
          trazo: aj.colorTrazo, grosor: aj.grosor, opacidad: aj.opacidad
        });
        break;
      case 'texto':
        arrastre.previa = anots.nueva('rect', {
          x: r.x, y: r.y, w: r.w, h: r.h,
          trazo: '#4f8ef7', relleno: '', grosor: 0.6, opacidad: 0.9
        });
        break;
    }
  }

  function terminarCreacion(pag, gesto, shift) {
    var r = rectDelGesto(gesto, shift);
    var previaFinal = gesto.previa;

    var aj = estado.ajustes;
    var minimo = 3;

    if (gesto.herr === 'texto') {
      var ancho = r.w < 20 ? 240 : r.w;
      var anot = anots.nuevoTexto(r.x, r.y, ancho, aj, '');
      pag.anots.push(anot);
      seleccionar(pag.id, anot.id);
      estado.emitir('pagina', pag.id);
      abrirEditor(pag, anot, true);
      return;
    }

    if (gesto.herr === 'linea' || gesto.herr === 'flecha') {
      if (!previaFinal) return;
      var largo = Math.hypot(previaFinal.x2 - previaFinal.x1, previaFinal.y2 - previaFinal.y1);
      if (largo < minimo) return;
      anadir(pag, previaFinal);
      return;
    }

    if (r.w < minimo || r.h < minimo) {
      // Un clic suelto con «Resaltar» marca el renglón que haya debajo.
      if (gesto.herr === 'resaltar') resaltarRenglon(pag, gesto.inicio);
      return;
    }

    if (previaFinal) {
      if (gesto.herr === 'resaltar') ajustarAlRenglon(pag, previaFinal);
      anadir(pag, previaFinal);
    }
  }

  /* ── Ayudas basadas en el texto original ────────────────────────────── */

  /** Si el resaltado cae sobre renglones conocidos, se ajusta a su altura. */
  function ajustarAlRenglon(pag, anot) {
    var datos = render.textoResuelto(pag.id);
    if (!datos) return;

    var y0 = anot.y, y1 = anot.y + anot.h;
    var arriba = Infinity, abajo = -Infinity, tocados = 0;

    datos.renglones.forEach(function (r) {
      var cruza = (r.y + r.alto) > y0 && r.y < y1 &&
                  (r.x + r.ancho) > anot.x && r.x < (anot.x + anot.w);
      if (!cruza) return;
      tocados++;
      arriba = Math.min(arriba, r.y - r.tam * 0.08);
      abajo = Math.max(abajo, r.y + r.alto + r.tam * 0.06);
    });

    if (tocados && abajo > arriba) { anot.y = arriba; anot.h = abajo - arriba; }
  }

  function resaltarRenglon(pag, p) {
    var datos = render.textoResuelto(pag.id);
    if (!datos) return;
    var r = renglonEn(datos, p);
    if (!r) return;
    var aj = estado.ajustes;
    anadir(pag, anots.nueva('resaltado', {
      x: r.x, y: r.y - r.tam * 0.08, w: r.ancho, h: r.alto + r.tam * 0.14,
      relleno: aj.colorResaltar, opacidad: aj.opacidadResaltar
    }));
  }

  function renglonEn(datos, p) {
    var mejor = null;
    datos.renglones.forEach(function (r) {
      if (p.x >= r.x - 2 && p.x <= r.x + r.ancho + 2 &&
          p.y >= r.y - 1 && p.y <= r.y + r.alto + 1) {
        if (!mejor || r.alto < mejor.alto) mejor = r;
      }
    });
    return mejor;
  }

  /* ── Editar un texto que ya está en el PDF ──────────────────────────── */

  function editarTextoExistente(pag, p) {
    estado.emitir('progreso', 'Buscando el texto…');

    render.textoDePagina(pag).then(function (datos) {
      var r = renglonEn(datos, p);
      if (!r) {
        estado.emitir('aviso', {
          tipo: 'error',
          texto: 'Ahí no hay texto que se pueda editar. Prueba sobre un renglón, ' +
                 'o usa «Texto» para escribir encima.'
        });
        return;
      }

      var margen = Math.max(0.6, r.tam * 0.09);
      var caja = {
        x: r.x - margen, y: r.y - margen,
        w: r.ancho + margen * 2, h: r.alto + margen * 2
      };

      var fondo = render.colorFondo(pag, caja);
      var tinta = render.colorTinta(pag, { x: r.x, y: r.y, w: r.ancho, h: r.alto }, fondo);

      var tapa = anots.nueva('tapar', {
        x: caja.x, y: caja.y, w: caja.w, h: caja.h, relleno: fondo
      });

      var familia = /serif/i.test(r.familia) && !/sans/i.test(r.familia) ? 'Times'
                  : /mono/i.test(r.familia) ? 'Courier' : 'Helvetica';
      var nombre = r.nombreFuente || '';
      var negrita = /bold|black|heavy|semibold|demi/i.test(nombre);
      var cursiva = /italic|oblique/i.test(nombre);

      var texto = anots.nueva('texto', {
        x: r.x, y: 0, w: Math.max(30, r.ancho + r.tam * 1.2),
        texto: anots.sanear(r.texto).texto,
        tam: util.redondear(r.tam, 2),
        fuente: familia, negrita: negrita, cursiva: cursiva,
        color: tinta, alineado: 'izq', interlineado: 1.15, fondo: '',
        deTapa: tapa.id
      });
      // La línea base del texto nuevo debe caer donde estaba la original.
      texto.y = r.base - anots.ascenso(texto) - (texto.tam * texto.interlineado - texto.tam) / 2;

      pag.anots.push(tapa);
      pag.anots.push(texto);
      seleccionar(pag.id, texto.id);
      estado.marcar('editar texto');
      estado.emitir('pagina', pag.id);
      render.dibujarAnots(pag);

      abrirEditor(pag, texto, false);
      estado.emitir('aviso', { tipo: 'ok', texto: 'Texto listo para reescribir.' });
    });
  }

  /* ── Editor de texto sobre la página ────────────────────────────────── */

  function abrirEditor(pag, anot, esNuevo) {
    cerrarEditor(true);

    var v = render.vista(pag.id);
    if (!v) return;

    var area = document.createElement('textarea');
    area.className = 'editor-texto';
    area.value = anot.texto || '';
    area.spellcheck = false;
    v.el.appendChild(area);

    edicion = { paginaId: pag.id, anotId: anot.id, area: area, esNuevo: esNuevo };
    colocarEditor();

    area.addEventListener('input', function () {
      anot.texto = area.value;
      colocarEditor();
      render.dibujarAnots(pag);
    });

    area.addEventListener('keydown', function (ev) {
      ev.stopPropagation();
      if (ev.key === 'Escape') { ev.preventDefault(); cerrarEditor(true); }
      else if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); cerrarEditor(true); }
    });

    area.addEventListener('blur', function () { cerrarEditor(true); });

    setTimeout(function () {
      // preventScroll: enfocar no debe mover el lienzo bajo los pies del usuario.
      try { area.focus({ preventScroll: true }); } catch (e) { area.focus(); }
      area.setSelectionRange(area.value.length, area.value.length);
    }, 0);
  }

  /** Coloca y da forma al textarea para que calce con la página girada. */
  function colocarEditor() {
    if (!edicion) return;
    var pag = estado.pagina(edicion.paginaId);
    var anot = estado.anotacion(edicion.paginaId, edicion.anotId);
    if (!pag || !anot) { cerrarEditor(false); return; }

    var z = estado.zoom;
    var giro = estado.giroTotal(pag);
    var alto = Math.max(anot.tam * anot.interlineado, anots.altoTexto(anot));
    var esq = geo.aVista(pag, anot.x, anot.y, z);
    var a = edicion.area;

    a.style.transformOrigin = '0 0';
    a.style.transform = 'translate(' + esq.x + 'px,' + esq.y + 'px) rotate(' + giro + 'deg)';
    a.style.width = (anot.w * z) + 'px';
    a.style.height = (alto * z) + 'px';
    a.style.fontSize = (anot.tam * z) + 'px';
    a.style.lineHeight = (anot.tam * anot.interlineado * z) + 'px';
    a.style.fontFamily = anots.FAMILIAS[anot.fuente] || anots.FAMILIAS.Helvetica;
    a.style.fontWeight = anot.negrita ? '700' : '400';
    a.style.fontStyle = anot.cursiva ? 'italic' : 'normal';
    a.style.color = anot.color || '#000';
    a.style.textAlign = anot.alineado === 'centro' ? 'center'
                      : (anot.alineado === 'der' ? 'right' : 'left');
  }

  /** Cierra el editor guardando (o descartando si quedó vacío). */
  function cerrarEditor(guardar) {
    if (!edicion) return;
    var datos = edicion;
    edicion = null;

    var pag = estado.pagina(datos.paginaId);
    var anot = estado.anotacion(datos.paginaId, datos.anotId);

    if (datos.area.parentNode) datos.area.parentNode.removeChild(datos.area);

    if (!pag || !anot) return;

    if (guardar) {
      var limpio = anots.sanear(datos.area.value);
      anot.texto = limpio.texto;
      if (limpio.cambios) {
        estado.emitir('aviso', {
          tipo: 'error',
          texto: 'Se sustituyeron ' + limpio.cambios + ' carácter(es) que las fuentes ' +
                 'estándar del PDF no admiten.'
        });
      }
    }

    if (!anot.texto || !anot.texto.trim()) {
      pag.anots = pag.anots.filter(function (a) { return a.id !== anot.id; });
      if (estado.seleccion && estado.seleccion.anotId === anot.id) estado.seleccion = null;
    }

    estado.marcar('texto');
    estado.emitir('pagina', pag.id);
    estado.emitir('seleccion');
    render.dibujarAnots(pag);
  }

  function editando() { return edicion; }

  /** Abre el editor del objeto de texto seleccionado (doble clic, Intro…). */
  function editarSeleccion() {
    var anot = estado.anotSeleccionada();
    if (!anot || anot.tipo !== 'texto') return false;
    var pag = estado.pagina(estado.seleccion.paginaId);
    if (!pag) return false;
    abrirEditor(pag, anot, false);
    return true;
  }

  /* ── Borrador ───────────────────────────────────────────────────────── */

  function borrarEn(pag, p) {
    var encontrado = anotEnPunto(pag, p.x, p.y);
    if (!encontrado) return;
    pag.anots = pag.anots.filter(function (a) { return a.id !== encontrado.id; });
    if (estado.seleccion && estado.seleccion.anotId === encontrado.id) estado.seleccion = null;
    if (arrastre) arrastre.borrados = (arrastre.borrados || 0) + 1;
    render.dibujarAnots(pag);
    estado.emitir('pagina', pag.id);
  }

  /* ── Acciones sobre la selección ────────────────────────────────────── */

  function borrarSeleccion() {
    var anot = estado.anotSeleccionada();
    if (!anot) return false;
    var pag = estado.pagina(estado.seleccion.paginaId);
    pag.anots = pag.anots.filter(function (a) { return a.id !== anot.id; });
    estado.seleccion = null;
    estado.marcar('borrar');
    estado.emitir('pagina', pag.id);
    estado.emitir('seleccion');
    render.dibujarAnots(pag);
    return true;
  }

  function duplicarSeleccion() {
    var anot = estado.anotSeleccionada();
    if (!anot) return false;
    var pag = estado.pagina(estado.seleccion.paginaId);
    var copia = util.clonar(anot);
    copia.id = util.id('a');
    delete copia.deTapa;
    anots.mover(copia, 10, 10);
    pag.anots.push(copia);
    seleccionar(pag.id, copia.id);
    estado.marcar('duplicar objeto');
    estado.emitir('pagina', pag.id);
    render.dibujarAnots(pag);
    return true;
  }

  function moverSeleccion(dx, dy) {
    var anot = estado.anotSeleccionada();
    if (!anot) return false;
    var pag = estado.pagina(estado.seleccion.paginaId);
    anots.mover(anot, dx, dy);
    estado.emitir('pagina', pag.id);
    render.dibujarAnots(pag);
    return true;
  }

  /* ── Doble clic ─────────────────────────────────────────────────────── */

  function alDobleClic(ev) {
    var pag = paginaDeEvento(ev);
    if (!pag) return;
    var p = puntoPagina(ev, pag);
    var encontrado = anotEnPunto(pag, p.x, p.y);
    if (encontrado && encontrado.tipo === 'texto') {
      ev.preventDefault();
      seleccionar(pag.id, encontrado.id);
      abrirEditor(pag, encontrado, false);
    }
  }

  /* ── Alta de escuchadores ───────────────────────────────────────────── */

  function iniciar() {
    var paginas = util.$('#paginas');
    paginas.addEventListener('pointerdown', alBajar);
    paginas.addEventListener('dblclick', alDobleClic);
    raiz.addEventListener('pointermove', alMover);
    raiz.addEventListener('pointerup', alSubir);
    raiz.addEventListener('pointercancel', alSubir);
  }

  Clarvi.herramientas = {
    iniciar: iniciar,
    previa: previa,
    seleccionar: seleccionar,
    borrarSeleccion: borrarSeleccion,
    duplicarSeleccion: duplicarSeleccion,
    moverSeleccion: moverSeleccion,
    editarSeleccion: editarSeleccion,
    cerrarEditor: cerrarEditor,
    colocarEditor: colocarEditor,
    editando: editando,
    hayArrastre: function () { return !!arrastre; }
  };
})(window);
