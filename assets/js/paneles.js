/* ===========================================================================
   paneles.js — panel de propiedades, panel de páginas y barra inferior
   =========================================================================== */
(function (raiz) {
  'use strict';

  var Clarvi = raiz.Clarvi || (raiz.Clarvi = {});
  var util = Clarvi.util;
  var estado = Clarvi.estado;
  var anots = Clarvi.anots;
  var render = Clarvi.render;
  var herr = Clarvi.herramientas;

  var PALETA = ['#111111', '#ffffff', '#d64545', '#e07b1c', '#f2c200',
                '#1f9d63', '#1d74d6', '#6b3fa0', '#7a6a5a', '#9aa5bd'];
  var PALETA_RESALTAR = ['#ffe14d', '#a8f0a0', '#9fd8ff', '#ffb3d1', '#ffc48a', '#d6c2ff'];

  var cuerpoProps, tituloProps, listaMin, accionesPag, contSel;
  var listaDocs, cabDocs;
  var minPorId = new Map();

  /* ════════════════════ Panel de propiedades ════════════════════ */

  function fila(etiqueta) {
    var f = util.crear('div', 'fila');
    if (etiqueta != null) f.appendChild(util.crear('label', null, etiqueta));
    return f;
  }

  function filaColor(etiqueta, valor, alCambiar, permitirNinguno) {
    var f = fila(etiqueta);
    var inp = document.createElement('input');
    inp.type = 'color';
    inp.value = valor || '#000000';
    inp.addEventListener('input', function () { alCambiar(inp.value); });
    f.appendChild(inp);

    if (permitirNinguno) {
      var btn = util.crear('button', 'mini-btn', valor ? 'Quitar' : 'Poner');
      btn.title = valor ? 'Dejarlo sin relleno' : 'Aplicar el color elegido como relleno';
      btn.addEventListener('click', function () { alCambiar(valor ? '' : inp.value); });
      f.appendChild(btn);
    }
    return f;
  }

  function paleta(colores, valor, alCambiar) {
    var p = util.crear('div', 'paleta');
    colores.forEach(function (c) {
      var b = util.crear('button');
      b.style.background = c;
      b.title = c;
      if (c.toLowerCase() === String(valor).toLowerCase()) b.classList.add('act');
      b.addEventListener('click', function () { alCambiar(c); });
      p.appendChild(b);
    });
    return p;
  }

  function filaRango(etiqueta, valor, min, max, paso, alCambiar, formato) {
    var f = fila(etiqueta);
    var inp = document.createElement('input');
    inp.type = 'range';
    inp.min = min; inp.max = max; inp.step = paso; inp.value = valor;
    var val = util.crear('span', 'val', formato ? formato(valor) : String(valor));
    inp.addEventListener('input', function () {
      var v = parseFloat(inp.value);
      val.textContent = formato ? formato(v) : String(v);
      alCambiar(v);
    });
    f.appendChild(inp);
    f.appendChild(val);
    return f;
  }

  function filaSelect(etiqueta, opciones, valor, alCambiar) {
    var f = fila(etiqueta);
    var sel = document.createElement('select');
    opciones.forEach(function (o) {
      var op = document.createElement('option');
      op.value = o[0]; op.textContent = o[1];
      if (String(o[0]) === String(valor)) op.selected = true;
      sel.appendChild(op);
    });
    sel.addEventListener('change', function () { alCambiar(sel.value); });
    f.appendChild(sel);
    return f;
  }

  function filaNumero(etiqueta, valor, min, max, paso, alCambiar) {
    var f = fila(etiqueta);
    var inp = document.createElement('input');
    inp.type = 'number';
    inp.min = min; inp.max = max; inp.step = paso; inp.value = valor;
    inp.addEventListener('change', function () {
      var v = util.limitar(parseFloat(inp.value) || min, min, max);
      inp.value = v;
      alCambiar(v);
    });
    f.appendChild(inp);
    return f;
  }

  function grupo(titulo) {
    var g = util.crear('div', 'grupo-prop');
    if (titulo) g.appendChild(util.crear('h4', null, titulo));
    return g;
  }

  function boton(texto, alPulsar, clase) {
    var b = util.crear('button', 'btn-prop' + (clase ? ' ' + clase : ''), texto);
    b.addEventListener('click', alPulsar);
    return b;
  }

  /* ── Repintado tras cambiar una propiedad ───────────────────────────── */

  function tocarAnot(anot) {
    var pag = estado.pagina(estado.seleccion.paginaId);
    estado.marcar('propiedad');
    render.dibujarAnots(pag);
    estado.emitir('pagina', pag.id);
  }

  /* ── Propiedades de un objeto seleccionado ──────────────────────────── */

  function propsDeAnotacion(anot) {
    var c = document.createDocumentFragment();
    var aj = estado.ajustes;

    var NOMBRES = {
      texto: 'Texto', rect: 'Rectángulo', elipse: 'Elipse', linea: 'Línea',
      flecha: 'Flecha', trazo: 'Trazo a mano', resaltado: 'Resaltado',
      tapar: 'Tapado', imagen: 'Imagen'
    };
    tituloProps.textContent = NOMBRES[anot.tipo] || 'Objeto';

    /* Texto */
    if (anot.tipo === 'texto') {
      var g = grupo('Tipografía');
      g.appendChild(filaSelect('Fuente', [
        ['Helvetica', 'Helvetica / Arial'],
        ['Times', 'Times / Serif'],
        ['Courier', 'Courier / Mono']
      ], anot.fuente, function (v) { anot.fuente = aj.fuenteTexto = v; tocarAnot(anot); }));

      g.appendChild(filaNumero('Tamaño', util.redondear(anot.tam, 1), 4, 200, 0.5,
        function (v) { anot.tam = aj.tamTexto = v; tocarAnot(anot); herr.colocarEditor(); }));

      var fEstilo = fila('Estilo');
      var caja = util.crear('div', 'grupo-botones');
      caja.style.flex = '1 1 auto';
      var bN = boton('N', function () { anot.negrita = aj.negrita = !anot.negrita; tocarAnot(anot); refrescar(); });
      bN.style.fontWeight = '700';
      if (anot.negrita) bN.style.background = '#dbe6fb';
      var bC = boton('C', function () { anot.cursiva = aj.cursiva = !anot.cursiva; tocarAnot(anot); refrescar(); });
      bC.style.fontStyle = 'italic';
      if (anot.cursiva) bC.style.background = '#dbe6fb';
      caja.appendChild(bN); caja.appendChild(bC);
      fEstilo.appendChild(caja);
      g.appendChild(fEstilo);

      g.appendChild(filaSelect('Alinear', [
        ['izq', 'Izquierda'], ['centro', 'Centro'], ['der', 'Derecha']
      ], anot.alineado, function (v) { anot.alineado = aj.alineado = v; tocarAnot(anot); herr.colocarEditor(); }));

      g.appendChild(filaRango('Interlineado', anot.interlineado, 0.9, 2.5, 0.05,
        function (v) { anot.interlineado = aj.interlineado = v; tocarAnot(anot); herr.colocarEditor(); },
        function (v) { return v.toFixed(2); }));
      c.appendChild(g);

      var gc = grupo('Color');
      gc.appendChild(filaColor('Texto', anot.color, function (v) {
        anot.color = aj.colorTexto = v; tocarAnot(anot); herr.colocarEditor(); refrescar();
      }));
      gc.appendChild(paleta(PALETA, anot.color, function (v) {
        anot.color = aj.colorTexto = v; tocarAnot(anot); herr.colocarEditor(); refrescar();
      }));
      gc.appendChild(filaColor('Fondo', anot.fondo, function (v) {
        anot.fondo = v; tocarAnot(anot); refrescar();
      }, true));
      c.appendChild(gc);

      var ge = grupo('Contenido');
      ge.appendChild(boton('Editar el texto…', function () { herr.editarSeleccion(); }));
      c.appendChild(ge);
    }

    /* Resaltado */
    if (anot.tipo === 'resaltado') {
      var gr = grupo('Resaltado');
      gr.appendChild(filaColor('Color', anot.relleno, function (v) {
        anot.relleno = aj.colorResaltar = v; tocarAnot(anot); refrescar();
      }));
      gr.appendChild(paleta(PALETA_RESALTAR, anot.relleno, function (v) {
        anot.relleno = aj.colorResaltar = v; tocarAnot(anot); refrescar();
      }));
      gr.appendChild(filaRango('Intensidad', anot.opacidad, 0.1, 1, 0.05,
        function (v) { anot.opacidad = aj.opacidadResaltar = v; tocarAnot(anot); },
        function (v) { return Math.round(v * 100) + '%'; }));
      c.appendChild(gr);
    }

    /* Tapado */
    if (anot.tipo === 'tapar') {
      var gt = grupo('Tapado');
      gt.appendChild(filaColor('Color', anot.relleno, function (v) {
        anot.relleno = aj.colorTapar = v; tocarAnot(anot); refrescar();
      }));
      gt.appendChild(paleta(['#ffffff', '#000000', '#f4f4f4', '#eeeae0', '#111111'],
        anot.relleno, function (v) { anot.relleno = aj.colorTapar = v; tocarAnot(anot); refrescar(); }));
      c.appendChild(gt);
    }

    /* Imagen */
    if (anot.tipo === 'imagen') {
      var gi = grupo('Archivo');
      var fi = Clarvi.imagenes.ficha(anot.imgId);
      if (fi) {
        var info = util.crear('div', 'aviso-props');
        info.innerHTML = '<b>' + fi.nombre + '</b><br>' + fi.ancho + ' × ' + fi.alto +
                         ' px · ' + util.tamanoLegible(fi.bytes.length);
        gi.appendChild(info);
      }
      gi.appendChild(filaRango('Opacidad', anot.opacidad, 0.05, 1, 0.05,
        function (v) { anot.opacidad = aj.opacidadImagen = v; tocarAnot(anot); },
        function (v) { return Math.round(v * 100) + '%'; }));
      gi.appendChild(boton('Recuperar proporción', function () {
        var f = Clarvi.imagenes.ficha(anot.imgId);
        if (!f) return;
        anot.h = anot.w * (f.alto / Math.max(1, f.ancho));
        tocarAnot(anot);
      }));
      c.appendChild(gi);
      var nota = util.crear('div', 'aviso-props');
      nota.innerHTML = 'Al arrastrar una esquina se conserva la proporción. ' +
                       'Con <b>Shift</b> la deformas a voluntad.';
      c.appendChild(nota);
    }

    /* Formas y trazos */
    if (['rect', 'elipse', 'linea', 'flecha', 'trazo'].indexOf(anot.tipo) >= 0) {
      var gf = grupo('Trazo');
      gf.appendChild(filaColor('Color', anot.trazo, function (v) {
        anot.trazo = aj.colorTrazo = v; tocarAnot(anot); refrescar();
      }));
      gf.appendChild(paleta(PALETA, anot.trazo, function (v) {
        anot.trazo = aj.colorTrazo = v; tocarAnot(anot); refrescar();
      }));
      gf.appendChild(filaRango('Grosor', anot.grosor, 0.5, 24, 0.5,
        function (v) { anot.grosor = aj.grosor = v; tocarAnot(anot); },
        function (v) { return v + ' pt'; }));
      c.appendChild(gf);

      if (anot.tipo === 'rect' || anot.tipo === 'elipse') {
        var gre = grupo('Relleno');
        gre.appendChild(filaColor('Color', anot.relleno, function (v) {
          anot.relleno = aj.colorRelleno = v; tocarAnot(anot); refrescar();
        }, true));
        if (anot.relleno) {
          gre.appendChild(paleta(PALETA, anot.relleno, function (v) {
            anot.relleno = aj.colorRelleno = v; tocarAnot(anot); refrescar();
          }));
        }
        c.appendChild(gre);
      }

      var go = grupo('Opacidad');
      go.appendChild(filaRango('Opacidad', anot.opacidad, 0.05, 1, 0.05,
        function (v) { anot.opacidad = aj.opacidad = v; tocarAnot(anot); },
        function (v) { return Math.round(v * 100) + '%'; }));
      c.appendChild(go);
    }

    /* Orden y acciones */
    var ga = grupo('Objeto');
    var caja2 = util.crear('div', 'grupo-botones');
    caja2.appendChild(boton('Al frente', function () { ordenar(anot, 1); }));
    caja2.appendChild(boton('Al fondo', function () { ordenar(anot, -1); }));
    ga.appendChild(caja2);
    ga.appendChild(boton('Duplicar', function () { herr.duplicarSeleccion(); refrescar(); }));
    ga.appendChild(boton('Eliminar', function () { herr.borrarSeleccion(); }, 'peligro'));
    c.appendChild(ga);

    return c;
  }

  function ordenar(anot, direccion) {
    var pag = estado.pagina(estado.seleccion.paginaId);
    var i = pag.anots.indexOf(anot);
    if (i < 0) return;
    pag.anots.splice(i, 1);
    if (direccion > 0) pag.anots.push(anot); else pag.anots.unshift(anot);
    estado.marcar('orden');
    render.dibujarAnots(pag);
    estado.emitir('pagina', pag.id);
  }

  /* ── Propiedades por defecto de la herramienta activa ───────────────── */

  var AYUDA_HERR = {
    seleccionar: 'Haz clic en cualquier objeto que hayas añadido para moverlo, ' +
                 'cambiar su tamaño o editarlo. <b>Doble clic</b> sobre un texto lo abre para escribir.',
    editar: 'Haz clic sobre un renglón del PDF: se tapa con el color del fondo y ' +
            'aparece un cuadro para reescribirlo. <b>Ojo:</b> el párrafo no se recompone, ' +
            'sólo se sustituye ese renglón.',
    borrar: 'Haz clic (o arrastra) sobre los objetos que hayas añadido para eliminarlos. ' +
            'El contenido original del PDF no se toca; para ocultarlo usa <b>Tapar</b>.',
    seltexto: 'Ahora puedes seleccionar el texto original del PDF con el ratón y copiarlo ' +
              'con <b>Ctrl+C</b>.'
  };

  function propsDeHerramienta() {
    var c = document.createDocumentFragment();
    var aj = estado.ajustes;
    var h = estado.herramienta;

    var NOMBRES = {
      seleccionar: 'Mover', texto: 'Texto nuevo', editar: 'Editar texto del PDF',
      resaltar: 'Resaltar', lapiz: 'Lápiz', linea: 'Línea', flecha: 'Flecha',
      rect: 'Rectángulo', elipse: 'Elipse', tapar: 'Tapar', borrar: 'Borrador',
      seltexto: 'Copiar texto', imagen: 'Insertar imagen', firma: 'Firma'
    };
    tituloProps.textContent = NOMBRES[h] || 'Propiedades';

    if (AYUDA_HERR[h] && h !== 'editar') {
      var av = util.crear('div', 'aviso-props');
      av.innerHTML = AYUDA_HERR[h];
      c.appendChild(av);
    }

    if (h === 'texto' || h === 'editar') {
      var g = grupo('Texto por defecto');
      g.appendChild(filaSelect('Fuente', [
        ['Helvetica', 'Helvetica / Arial'],
        ['Times', 'Times / Serif'],
        ['Courier', 'Courier / Mono']
      ], aj.fuenteTexto, function (v) { aj.fuenteTexto = v; }));
      g.appendChild(filaNumero('Tamaño', aj.tamTexto, 4, 200, 0.5, function (v) { aj.tamTexto = v; }));
      g.appendChild(filaColor('Color', aj.colorTexto, function (v) { aj.colorTexto = v; refrescar(); }));
      g.appendChild(paleta(PALETA, aj.colorTexto, function (v) { aj.colorTexto = v; refrescar(); }));
      c.appendChild(g);

      if (h === 'editar') {
        var av2 = util.crear('div', 'aviso-props');
        av2.innerHTML = AYUDA_HERR.editar;
        c.appendChild(av2);
      }
    }

    if (h === 'imagen' || h === 'firma') {
      var gim = grupo(h === 'firma' ? 'Firma' : 'Imagen');
      var lista = estado.pendiente;
      var esFirma = h === 'firma';
      var correcta = lista && (esFirma ? lista.esFirma === true : lista.esFirma !== true);

      var av = util.crear('div', 'aviso-props');
      av.innerHTML = correcta
        ? 'Lista para colocar. <b>Clic</b> en la página para el tamaño natural, ' +
          'o <b>arrastra</b> para encajarla. Puedes estamparla en varias páginas seguidas.'
        : (esFirma
            ? 'Dibuja tu firma o importa una foto: se le quitará el fondo del papel.'
            : 'Elige un archivo PNG o JPG de tu equipo.');
      gim.appendChild(av);

      gim.appendChild(boton(esFirma ? 'Dibujar o cambiar la firma…' : 'Elegir imagen…',
        function () { estado.emitir('pedirImagen', h); }));

      if (esFirma && Clarvi.imagenes.firmaGuardada()) {
        gim.appendChild(boton('Olvidar la firma guardada', function () {
          Clarvi.imagenes.olvidarFirma();
          estado.pendiente = null;
          refrescar();
        }, 'peligro'));
      }

      gim.appendChild(filaRango('Opacidad', aj.opacidadImagen, 0.05, 1, 0.05,
        function (v) { aj.opacidadImagen = v; },
        function (v) { return Math.round(v * 100) + '%'; }));
      c.appendChild(gim);
    }

    if (h === 'resaltar') {
      var gr = grupo('Marcatextos');
      gr.appendChild(filaColor('Color', aj.colorResaltar, function (v) { aj.colorResaltar = v; refrescar(); }));
      gr.appendChild(paleta(PALETA_RESALTAR, aj.colorResaltar, function (v) { aj.colorResaltar = v; refrescar(); }));
      gr.appendChild(filaRango('Intensidad', aj.opacidadResaltar, 0.1, 1, 0.05,
        function (v) { aj.opacidadResaltar = v; },
        function (v) { return Math.round(v * 100) + '%'; }));
      c.appendChild(gr);
      var nota = util.crear('div', 'aviso-props');
      nota.innerHTML = 'Arrastra sobre el texto. Un <b>clic suelto</b> resalta el renglón entero.';
      c.appendChild(nota);
    }

    if (h === 'tapar') {
      var gt = grupo('Tapar');
      gt.appendChild(filaColor('Color', aj.colorTapar, function (v) { aj.colorTapar = v; refrescar(); }));
      gt.appendChild(paleta(['#ffffff', '#000000', '#f4f4f4', '#eeeae0'], aj.colorTapar,
        function (v) { aj.colorTapar = v; refrescar(); }));
      c.appendChild(gt);
    }

    if (['lapiz', 'linea', 'flecha', 'rect', 'elipse'].indexOf(h) >= 0) {
      var gf = grupo('Trazo');
      gf.appendChild(filaColor('Color', aj.colorTrazo, function (v) { aj.colorTrazo = v; refrescar(); }));
      gf.appendChild(paleta(PALETA, aj.colorTrazo, function (v) { aj.colorTrazo = v; refrescar(); }));
      gf.appendChild(filaRango('Grosor', aj.grosor, 0.5, 24, 0.5,
        function (v) { aj.grosor = v; }, function (v) { return v + ' pt'; }));
      gf.appendChild(filaRango('Opacidad', aj.opacidad, 0.05, 1, 0.05,
        function (v) { aj.opacidad = v; },
        function (v) { return Math.round(v * 100) + '%'; }));
      c.appendChild(gf);

      if (h === 'rect' || h === 'elipse') {
        var gre = grupo('Relleno');
        gre.appendChild(filaColor('Color', aj.colorRelleno,
          function (v) { aj.colorRelleno = v; refrescar(); }, true));
        c.appendChild(gre);
      }
    }

    return c;
  }

  function refrescar() {
    util.vaciar(cuerpoProps);
    var anot = estado.anotSeleccionada();
    cuerpoProps.appendChild(anot ? propsDeAnotacion(anot) : propsDeHerramienta());
  }

  /* ════════════════════ Panel de páginas ════════════════════ */

  /* Interacción, tal y como la pidió el usuario:
       · clic en la miniatura   → va a esa página, sin marcarla
       · clic en el recuadro    → la marca o la desmarca, acumulando sin teclas
       · Shift en el recuadro   → marca el rango desde la última marcada
       · arrastrar la miniatura → la reordena
     El arrastre y el clic conviven porque ordenar.js decide según cuánto se
     haya movido el puntero. */

  var ultimaMarcada = null;
  var arrastrandoMin = false;

  function crearMiniatura(pag) {
    var el = util.crear('div', 'min');
    el.dataset.pag = pag.id;
    el.dataset.id = pag.id;

    var canvas = document.createElement('canvas');
    canvas.width = 180; canvas.height = 240;
    el.appendChild(canvas);

    var marca = util.crear('span', 'min-marca', '✓');
    marca.title = 'Marcar esta página';
    el.appendChild(marca);
    el.appendChild(util.crear('span', 'min-etiq'));
    el.appendChild(util.crear('span', 'min-num'));

    marca.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });
    marca.addEventListener('click', function (ev) {
      ev.stopPropagation();
      alternarMarca(pag.id, ev.shiftKey);
    });

    minPorId.set(pag.id, el);
    return el;
  }

  function alternarMarca(id, conRango) {
    if (conRango && ultimaMarcada && ultimaMarcada !== id) {
      var a = estado.indiceDe(ultimaMarcada), b = estado.indiceDe(id);
      if (a >= 0 && b >= 0) {
        var desde = Math.min(a, b), hasta = Math.max(a, b);
        for (var i = desde; i <= hasta; i++) estado.paginasSel.add(estado.paginas[i].id);
      }
    } else if (estado.paginasSel.has(id)) {
      estado.paginasSel.delete(id);
    } else {
      estado.paginasSel.add(id);
    }
    ultimaMarcada = id;
    actualizarMiniaturas();
    estado.emitir('seleccionPaginas');
  }

  function activarArrastreMiniaturas() {
    Clarvi.ordenar.activar({
      contenedor: listaMin,
      selector: '.min',
      ignorar: '.min-marca',
      alClic: function (id) {
        var i = estado.indiceDe(id);
        if (i >= 0) irAPagina(i, true);
      },
      alSoltar: function (idOrigen, idDestino, antes) {
        var destino = estado.indiceDe(idDestino);
        if (destino < 0) return;
        Clarvi.docs.reordenar(idOrigen, antes ? destino : destino + 1);
      }
    });

    // Mientras el usuario toca la lista no se le mueve bajo los dedos.
    listaMin.addEventListener('pointerdown', function () { arrastrandoMin = true; });
    raiz.addEventListener('pointerup', function () {
      setTimeout(function () { arrastrandoMin = false; }, 250);
    });
    listaMin.addEventListener('scroll', function () {
      arrastrandoMin = true;
      clearTimeout(activarArrastreMiniaturas._t);
      activarArrastreMiniaturas._t = setTimeout(function () { arrastrandoMin = false; }, 900);
    });
  }

  function actualizarMiniaturas() {
    // Se descartan las miniaturas de páginas eliminadas.
    var vivos = new Set(estado.paginas.map(function (p) { return p.id; }));
    minPorId.forEach(function (el, id) {
      if (!vivos.has(id)) {
        if (el.parentNode) el.parentNode.removeChild(el);
        minPorId.delete(id);
      }
    });

    var anterior = null;
    estado.paginas.forEach(function (pag, i) {
      var el = minPorId.get(pag.id) || crearMiniatura(pag);
      var siguiente = anterior ? anterior.nextSibling : listaMin.firstChild;
      if (siguiente !== el) listaMin.insertBefore(el, siguiente);
      anterior = el;

      el.classList.toggle('sel', estado.paginasSel.has(pag.id));
      el.classList.toggle('actual', i === estado.paginaActual);
      util.$('.min-num', el).textContent = String(i + 1);

      var etiq = util.$('.min-etiq', el);
      var giro = estado.giroTotal(pag);
      etiq.textContent = giro ? giro + '°' : '';
      etiq.style.display = giro ? '' : 'none';

      var canvas = util.$('canvas', el);
      if (canvas.dataset.firma !== render.firmaPagina(pag)) {
        canvas.dataset.firma = '';
        render.pintarMiniatura(pag, canvas);
      }
    });

    var n = estado.paginasSel.size;
    accionesPag.hidden = n === 0;
    contSel.textContent = n === 1 ? '1 página' : n + ' páginas';

    actualizarDocumentos();
  }

  /** Deja a la vista la miniatura de la página que se está mirando. */
  function seguirPaginaActual() {
    if (arrastrandoMin) return;
    var pag = estado.paginas[estado.paginaActual];
    if (!pag) return;
    var el = minPorId.get(pag.id);
    if (!el) return;

    var arriba = el.offsetTop;
    var abajo = arriba + el.offsetHeight;
    var visibleArriba = listaMin.scrollTop;
    var visibleAbajo = visibleArriba + listaMin.clientHeight;

    // Si ya se ve entera, no se toca nada: mover la lista sin motivo molesta.
    if (arriba >= visibleArriba && abajo <= visibleAbajo) return;

    listaMin.scrollTop = (arriba < visibleArriba)
      ? arriba - 10
      : abajo - listaMin.clientHeight + 10;
  }

  /* ════════════════════ Documentos abiertos ════════════════════ */

  function actualizarDocumentos() {
    if (!listaDocs) return;

    var docs = Clarvi.docs.documentosEnOrden();
    listaDocs.hidden = docs.length === 0;
    cabDocs.hidden = docs.length === 0;
    util.$('.pista', cabDocs).style.display = docs.length > 1 ? '' : 'none';

    util.vaciar(listaDocs);

    docs.forEach(function (d) {
      var fila = util.crear('div', 'doc');
      fila.dataset.id = d.fuenteId;
      if (estado.paginas[estado.paginaActual] &&
          estado.paginas[estado.paginaActual].fuenteId === d.fuenteId) {
        fila.classList.add('actual');
      }

      var ico = util.crear('span');
      ico.setAttribute('data-icono', 'documento');
      Clarvi.iconos.pon(ico, 'documento');
      fila.appendChild(ico);

      var nombre = util.crear('span', 'doc-nombre', d.fuente ? d.fuente.nombre : 'documento');
      nombre.title = (d.fuente ? d.fuente.nombre : '') + ' — ' + d.paginas + ' página(s)';
      fila.appendChild(nombre);

      if (!d.contiguo) {
        var mez = util.crear('span', 'doc-mezcla', 'mezclado');
        mez.title = 'Sus páginas están repartidas entre las de otro archivo. ' +
                    'Si mueves este documento, volverán a quedar juntas.';
        fila.appendChild(mez);
      }

      fila.appendChild(util.crear('span', 'doc-pags', d.paginas + ' pág.'));

      var quitar = util.crear('button', 'doc-quitar');
      quitar.setAttribute('data-icono', 'quitar');
      Clarvi.iconos.pon(quitar, 'quitar');
      quitar.title = 'Quitar este documento y todas sus páginas';
      quitar.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });
      quitar.addEventListener('click', function (ev) {
        ev.stopPropagation();
        if (docs.length < 2) {
          estado.emitir('aviso', {
            tipo: 'error',
            texto: 'Es el único documento abierto: quitarlo dejaría la ventana vacía.'
          });
          return;
        }
        if (!raiz.confirm('¿Quitar «' + (d.fuente ? d.fuente.nombre : 'este documento') +
                          '» y sus ' + d.paginas + ' página(s)?')) return;
        Clarvi.docs.eliminarDocumento(d.fuenteId);
      });
      fila.appendChild(quitar);

      listaDocs.appendChild(fila);
    });
  }

  function activarArrastreDocumentos() {
    Clarvi.ordenar.activar({
      contenedor: listaDocs,
      selector: '.doc',
      ignorar: '.doc-quitar',
      alClic: function (id) {
        var primera = Clarvi.docs.paginasDeFuente(id)[0];
        if (primera) irAPagina(estado.indiceDe(primera.id), true);
      },
      alSoltar: function (idOrigen, idDestino, antes) {
        Clarvi.docs.reordenarDocumento(idOrigen, idDestino, antes);
      }
    });
  }

  /* ════════════════════ Navegación y zoom ════════════════════ */

  function irAPagina(indice, suave) {
    indice = util.limitar(indice, 0, estado.paginas.length - 1);
    var pag = estado.paginas[indice];
    if (!pag) return;
    estado.paginaActual = indice;
    var el = render.elementoDe(pag.id);
    if (el) {
      render.lienzo().scrollTo({ top: el.offsetTop - 20, behavior: suave ? 'smooth' : 'auto' });
    }
    actualizarBarraInferior();
    actualizarMiniaturas();
    seguirPaginaActual();
  }

  function actualizarBarraInferior() {
    var inp = util.$('#inpPag');
    inp.value = estado.paginas.length ? (estado.paginaActual + 1) : 0;
    inp.max = Math.max(1, estado.paginas.length);
    util.$('#totalPag').textContent = '/ ' + estado.paginas.length;
  }

  /** Detecta qué página está más centrada al desplazarse. */
  function detectarPaginaVisible() {
    var lienzo = render.lienzo();
    var centro = lienzo.scrollTop + lienzo.clientHeight * 0.35;
    var mejor = estado.paginaActual;

    for (var i = 0; i < estado.paginas.length; i++) {
      var el = render.elementoDe(estado.paginas[i].id);
      if (!el) continue;
      if (el.offsetTop <= centro) mejor = i; else break;
    }
    if (mejor !== estado.paginaActual) {
      estado.paginaActual = mejor;
      actualizarBarraInferior();
      actualizarMiniaturas();
      seguirPaginaActual();
    }
  }

  /* ════════════════════ Arranque ════════════════════ */

  function iniciar() {
    cuerpoProps = util.$('#propsCuerpo');
    tituloProps = util.$('#tituloProps');
    listaMin = util.$('#listaMin');
    accionesPag = util.$('#accionesPag');
    contSel = util.$('#contSel');
    listaDocs = util.$('#listaDocs');
    cabDocs = util.$('#cabDocs');

    activarArrastreMiniaturas();
    activarArrastreDocumentos();

    estado.al('seleccion', refrescar);
    estado.al('herramienta', refrescar);
    estado.al('documento', function () { actualizarMiniaturas(); actualizarBarraInferior(); });
    estado.al('seleccionPaginas', actualizarMiniaturas);

    var repintarMin = util.aplazar(actualizarMiniaturas, 220);
    estado.al('pagina', repintarMin);

    refrescar();
  }

  Clarvi.paneles = {
    iniciar: iniciar,
    refrescar: refrescar,
    actualizarMiniaturas: actualizarMiniaturas,
    actualizarBarraInferior: actualizarBarraInferior,
    detectarPaginaVisible: detectarPaginaVisible,
    seguirPaginaActual: seguirPaginaActual,
    actualizarDocumentos: actualizarDocumentos,
    alternarMarca: alternarMarca,
    irAPagina: irAPagina
  };
})(window);
