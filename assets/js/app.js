/* ===========================================================================
   app.js — arranque, botones, atajos de teclado y arrastrar-y-soltar
   =========================================================================== */
(function (raiz) {
  'use strict';

  var Clarvi = raiz.Clarvi;
  var util = Clarvi.util;
  var estado = Clarvi.estado;
  var render = Clarvi.render;
  var herr = Clarvi.herramientas;
  var paneles = Clarvi.paneles;
  var docs = Clarvi.docs;
  var exportar = Clarvi.exportar;

  var barraEstado, lienzo, inpArchivos, inpImagen, inpComparar;
  var modoAnadir = false;
  var ocupado = false;

  /* ── Mensajes de la barra inferior ──────────────────────────────────── */

  var limpiarAviso = null;

  function avisar(texto, tipo) {
    barraEstado.textContent = texto;
    barraEstado.className = 'estado' + (tipo ? ' ' + tipo : '');
    clearTimeout(limpiarAviso);
    if (tipo) {
      limpiarAviso = setTimeout(function () {
        barraEstado.textContent = resumen();
        barraEstado.className = 'estado';
      }, 6000);
    }
  }

  function resumen() {
    if (!estado.hayDocumento()) return 'Listo — abre un PDF para empezar';
    var nAnots = estado.paginas.reduce(function (n, p) { return n + p.anots.length; }, 0);
    var partes = [estado.paginas.length + ' página' + (estado.paginas.length === 1 ? '' : 's')];
    if (estado.fuentes.size > 1) partes.push(estado.fuentes.size + ' archivos unidos');
    if (nAnots) partes.push(nAnots + ' objeto' + (nAnots === 1 ? '' : 's') + ' añadido' + (nAnots === 1 ? '' : 's'));
    return partes.join('  ·  ');
  }

  /* ── Estado de los botones ──────────────────────────────────────────── */

  function actualizarBotones() {
    var hay = estado.hayDocumento();
    util.$('#btnAgregar').disabled = !hay || ocupado;
    util.$('#btnNumerar').disabled = !hay || ocupado;
    util.$('#btnComparar').disabled = !hay || ocupado;
    util.$('#btnComprimir').disabled = !hay || ocupado;
    util.$('#btnGuardar').disabled = !hay || ocupado;
    util.$('#btnExtraer').disabled = !hay || ocupado || estado.paginasSel.size === 0;
    util.$('#btnDeshacer').disabled = !estado.puedeDeshacer();
    util.$('#btnRehacer').disabled = !estado.puedeRehacer();
    util.$('#btnAbrir').disabled = ocupado;
  }

  /* ── Herramientas ───────────────────────────────────────────────────── */

  function elegirHerramienta(nombre) {
    if (estado.herramienta === nombre) return;
    herr.cerrarEditor(true);

    estado.herramienta = nombre;
    lienzo.dataset.herr = nombre;

    util.$$('.herr').forEach(function (b) {
      b.classList.toggle('activa', b.dataset.herr === nombre);
    });

    var textoActivo = nombre === 'seltexto';
    util.$$('.capa-texto').forEach(function (c) { c.classList.toggle('activa', textoActivo); });

    if (nombre !== 'seleccionar') herr.seleccionar(null, null);

    if (nombre === 'seltexto' || nombre === 'editar' || nombre === 'resaltar') precargarTexto();
    if ((nombre === 'imagen' || nombre === 'firma') && !imagenLista(nombre)) pedirImagen(nombre);

    estado.emitir('herramienta', nombre);
    estado.emitir('seleccion');
    render.renderizarVisibles();
  }

  /** Extrae el texto de las páginas visibles (lo usan «Editar» y «Resaltar»). */
  function precargarTexto() {
    var l = render.lienzo();
    estado.paginas.forEach(function (pag) {
      var el = render.elementoDe(pag.id);
      if (!el) return;
      var y0 = el.offsetTop, y1 = y0 + el.offsetHeight;
      if (y1 >= l.scrollTop - 400 && y0 <= l.scrollTop + l.clientHeight + 400) {
        render.textoDePagina(pag);
        if (estado.herramienta === 'seltexto') render.asegurarCapaTexto(pag);
      }
    });
  }

  /* ── Imagen y firma ─────────────────────────────────────────────────── */

  /** ¿Hay ya una imagen preparada del tipo que toca? */
  function imagenLista(herramienta) {
    var p = estado.pendiente;
    if (!p) return false;
    return herramienta === 'firma' ? p.esFirma === true : p.esFirma !== true;
  }

  /** Pide al usuario la imagen (o la firma) que se va a colocar. */
  function pedirImagen(herramienta) {
    if (herramienta === 'firma') {
      Clarvi.imagenes.abrirDialogo(function (ficha) {
        ficha.esFirma = true;
        estado.pendiente = ficha;
        avisar('Firma lista. Haz clic en la página donde quieras estamparla.', 'ok');
        paneles.refrescar();
      });
      return;
    }
    inpImagen.value = '';
    inpImagen.click();
  }

  function cargarImagen(archivo) {
    if (!archivo) return;
    Clarvi.imagenes.desdeArchivo(archivo).then(function (ficha) {
      estado.pendiente = ficha;
      avisar('Imagen lista. Haz clic en la página, o arrastra para encajarla.', 'ok');
      paneles.refrescar();
    }).catch(function (err) {
      avisar('No se pudo cargar la imagen: ' + (err.message || err), 'error');
    });
  }

  /* ── Comparar con otro PDF ──────────────────────────────────────────── */

  function compararCon(archivo) {
    ocupado = true;
    actualizarBotones();
    avisar('Comparando con «' + archivo.name + '»…');

    Clarvi.comparar.comparar(archivo).then(function (informe) {
      ocupado = false;
      actualizarBotones();
      Clarvi.comparar.mostrarInforme(informe);
      avisar(informe.totalAnadidas || informe.totalQuitadas
        ? 'Diferencias en ' + informe.cambiadas + ' página(s).'
        : 'Los dos documentos tienen el mismo texto.', 'ok');
    }).catch(function (err) {
      ocupado = false;
      actualizarBotones();
      avisar('No se pudo comparar: ' + (err.message || err), 'error');
    });
  }

  /* ── Abrir archivos ─────────────────────────────────────────────────── */

  function pedirArchivos(anadir) {
    modoAnadir = anadir;
    inpArchivos.value = '';
    inpArchivos.click();
  }

  function cargar(archivos, anadir) {
    if (!archivos || !archivos.length) return;
    ocupado = true;
    actualizarBotones();
    avisar('Abriendo…');

    docs.abrirArchivos(archivos, anadir).then(function (r) {
      ocupado = false;
      redibujarTodo();
      if (!anadir) paneles.irAPagina(0, false);
      var msg = anadir
        ? 'Se añadieron ' + r.anadidas + ' página(s). Total: ' + estado.paginas.length + '.'
        : estado.paginas.length + ' página(s) cargadas.';
      if (r.errores.length) avisar(msg + ' Con problemas: ' + r.errores.join(' · '), 'error');
      else avisar(msg, 'ok');
      actualizarBotones();
    }).catch(function (err) {
      ocupado = false;
      actualizarBotones();
      avisar(err.message || 'No se pudo abrir el archivo.', 'error');
    });
  }

  function redibujarTodo() {
    render.reconstruir();
    paneles.actualizarMiniaturas();
    paneles.actualizarBarraInferior();
    paneles.refrescar();
    actualizarBotones();
  }

  /* ── Guardar ────────────────────────────────────────────────────────── */

  function guardar(soloSeleccion) {
    if (ocupado || !estado.hayDocumento()) return;
    herr.cerrarEditor(true);
    ocupado = true;
    actualizarBotones();
    avisar('Preparando el PDF…');

    var tarea = soloSeleccion ? exportar.extraerSeleccionadas() : exportar.guardarTodo();

    tarea.then(function (r) {
      ocupado = false;
      actualizarBotones();
      if (r.avisos.length) avisar('Guardado, pero atención: ' + r.avisos.join(' · '), 'error');
      else avisar(soloSeleccion ? 'Páginas extraídas y descargadas.' : 'PDF guardado y descargado.', 'ok');
    }).catch(function (err) {
      ocupado = false;
      actualizarBotones();
      avisar('No se pudo guardar: ' + (err.message || err), 'error');
    });
  }

  /* ── Zoom ───────────────────────────────────────────────────────────── */

  var NIVELES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

  function aplicarZoom(modo) {
    var texto = String(modo);
    estado.modoZoom = texto;

    var sel = util.$('#selZoom');
    var hayOpcion = Array.prototype.some.call(sel.options, function (o) { return o.value === texto; });
    if (hayOpcion) sel.value = texto;

    herr.cerrarEditor(true);
    render.reconstruir();
    paneles.actualizarBarraInferior();
  }

  function pasoZoom(direccion) {
    var actual = estado.zoom;
    var siguiente = direccion > 0
      ? NIVELES.find(function (n) { return n > actual + 0.001; })
      : NIVELES.slice().reverse().find(function (n) { return n < actual - 0.001; });
    if (siguiente) aplicarZoom(siguiente);
  }

  /* ── Atajos de teclado ──────────────────────────────────────────────── */

  var TECLAS_HERR = {
    v: 'seleccionar', t: 'texto', e: 'editar', h: 'resaltar', p: 'lapiz',
    l: 'linea', f: 'flecha', r: 'rect', c: 'elipse', w: 'tapar',
    i: 'imagen', s: 'firma', d: 'borrar'
  };

  function escribiendo(ev) {
    var t = ev.target;
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  }

  function alTeclado(ev) {
    if (escribiendo(ev)) return;
    var ctrl = ev.ctrlKey || ev.metaKey;
    var k = ev.key.toLowerCase();

    if (ctrl && k === 'o') { ev.preventDefault(); pedirArchivos(false); return; }
    if (ctrl && k === 's') { ev.preventDefault(); guardar(false); return; }
    if (ctrl && k === 'z' && !ev.shiftKey) { ev.preventDefault(); if (estado.deshacer()) trasHistorial(); return; }
    if (ctrl && (k === 'y' || (k === 'z' && ev.shiftKey))) { ev.preventDefault(); if (estado.rehacer()) trasHistorial(); return; }
    if (ctrl && k === 'd') { ev.preventDefault(); herr.duplicarSeleccion(); paneles.refrescar(); return; }
    if (ctrl && (k === '+' || k === '=')) { ev.preventDefault(); pasoZoom(1); return; }
    if (ctrl && k === '-') { ev.preventDefault(); pasoZoom(-1); return; }
    if (ctrl && k === '0') { ev.preventDefault(); aplicarZoom(1); return; }
    if (ctrl) return;

    if (ev.key === 'Escape') {
      if (!util.$('#modalComprimir').hidden) { Clarvi.comprimir.cerrar(); return; }
      if (!util.$('#modalComparar').hidden) { Clarvi.comparar.cerrar(); return; }
      if (!util.$('#modalNumeros').hidden) { Clarvi.numeracion.cerrar(); return; }
      if (!util.$('#modalFirma').hidden) { Clarvi.imagenes.cerrarDialogo(); return; }
      if (!util.$('#modalAyuda').hidden) { util.$('#modalAyuda').hidden = true; return; }
      herr.cerrarEditor(true);
      elegirHerramienta('seleccionar');
      return;
    }
    if (ev.key === 'Delete' || ev.key === 'Backspace') {
      if (herr.borrarSeleccion()) { ev.preventDefault(); paneles.refrescar(); }
      return;
    }
    if (ev.key === 'Enter') { if (herr.editarSeleccion()) ev.preventDefault(); return; }

    if (ev.key.indexOf('Arrow') === 0 && estado.anotSeleccionada()) {
      ev.preventDefault();
      var paso = ev.shiftKey ? 10 : 1;
      var dx = ev.key === 'ArrowLeft' ? -paso : (ev.key === 'ArrowRight' ? paso : 0);
      var dy = ev.key === 'ArrowUp' ? -paso : (ev.key === 'ArrowDown' ? paso : 0);
      herr.moverSeleccion(dx, dy);
      estado.marcar('mover');
      return;
    }

    if (ev.key === 'PageDown') { ev.preventDefault(); paneles.irAPagina(estado.paginaActual + 1, true); return; }
    if (ev.key === 'PageUp') { ev.preventDefault(); paneles.irAPagina(estado.paginaActual - 1, true); return; }

    if (TECLAS_HERR[k]) { ev.preventDefault(); elegirHerramienta(TECLAS_HERR[k]); }
  }

  function trasHistorial() {
    redibujarTodo();
    avisar(resumen());
  }

  /* ── Arrastrar y soltar archivos ────────────────────────────────────── */

  function iniciarArrastre() {
    var capa = util.$('#capaArrastre');
    var contador = 0;

    raiz.addEventListener('dragenter', function (ev) {
      if (!ev.dataTransfer || Array.prototype.indexOf.call(ev.dataTransfer.types, 'Files') < 0) return;
      contador++;
      capa.hidden = false;
      capa.querySelector('div').textContent = estado.hayDocumento()
        ? 'Suelta para añadir estos PDF al final' : 'Suelta aquí los PDF';
    });
    raiz.addEventListener('dragleave', function () {
      if (--contador <= 0) { contador = 0; capa.hidden = true; }
    });
    raiz.addEventListener('dragover', function (ev) { ev.preventDefault(); });
    raiz.addEventListener('drop', function (ev) {
      ev.preventDefault();
      contador = 0;
      capa.hidden = true;
      if (ev.dataTransfer && ev.dataTransfer.files.length) {
        cargar(ev.dataTransfer.files, estado.hayDocumento());
      }
    });
  }

  /* ── Cableado de la interfaz ────────────────────────────────────────── */

  function conectar() {
    util.$('#btnAbrir').addEventListener('click', function () { pedirArchivos(false); });
    util.$('#btnAbrir2').addEventListener('click', function () { pedirArchivos(false); });
    util.$('#btnAgregar').addEventListener('click', function () { pedirArchivos(true); });
    util.$('#btnNumerar').addEventListener('click', function () { Clarvi.numeracion.abrir(); });
    util.$('#btnComprimir').addEventListener('click', function () { Clarvi.comprimir.abrir(); });
    util.$('#btnComparar').addEventListener('click', function () {
      inpComparar.value = '';
      inpComparar.click();
    });
    inpComparar.addEventListener('change', function () {
      var archivo = inpComparar.files && inpComparar.files[0];
      if (archivo) compararCon(archivo);
    });
    util.$('#btnGuardar').addEventListener('click', function () { guardar(false); });
    util.$('#btnExtraer').addEventListener('click', function () { guardar(true); });

    inpArchivos.addEventListener('change', function () {
      cargar(inpArchivos.files, modoAnadir && estado.hayDocumento());
    });

    inpImagen.addEventListener('change', function () {
      cargarImagen(inpImagen.files && inpImagen.files[0]);
    });

    estado.al('pedirImagen', pedirImagen);

    util.$('#btnDeshacer').addEventListener('click', function () { if (estado.deshacer()) trasHistorial(); });
    util.$('#btnRehacer').addEventListener('click', function () { if (estado.rehacer()) trasHistorial(); });

    util.$$('.herr').forEach(function (b) {
      b.addEventListener('click', function () { elegirHerramienta(b.dataset.herr); });
    });

    /* Panel de páginas */
    util.$('#btnSelTodo').addEventListener('click', function () {
      if (estado.paginasSel.size === estado.paginas.length) estado.paginasSel.clear();
      else estado.paginas.forEach(function (p) { estado.paginasSel.add(p.id); });
      paneles.actualizarMiniaturas();
      actualizarBotones();
    });

    function seleccionadas() { return Array.from(estado.paginasSel); }

    util.$('#btnRotIzq').addEventListener('click', function () { docs.girar(seleccionadas(), -90); });
    util.$('#btnRotDer').addEventListener('click', function () { docs.girar(seleccionadas(), 90); });
    util.$('#btnDuplicar').addEventListener('click', function () { docs.duplicar(seleccionadas()); });
    util.$('#btnBorrarPag').addEventListener('click', function () {
      var ids = seleccionadas();
      if (!ids.length) return;
      if (ids.length >= estado.paginas.length) {
        avisar('No se pueden eliminar todas las páginas: el PDF quedaría vacío.', 'error');
        return;
      }
      if (!raiz.confirm('¿Eliminar ' + ids.length + ' página(s) del documento?')) return;
      docs.eliminar(ids);
    });

    /* Barra inferior */
    util.$('#btnPagAnt').addEventListener('click', function () { paneles.irAPagina(estado.paginaActual - 1, true); });
    util.$('#btnPagSig').addEventListener('click', function () { paneles.irAPagina(estado.paginaActual + 1, true); });
    util.$('#inpPag').addEventListener('change', function () {
      paneles.irAPagina((parseInt(this.value, 10) || 1) - 1, true);
    });
    util.$('#selZoom').addEventListener('change', function () { aplicarZoom(this.value); });
    util.$('#btnZoomMas').addEventListener('click', function () { pasoZoom(1); });
    util.$('#btnZoomMenos').addEventListener('click', function () { pasoZoom(-1); });

    /* Ayuda */
    util.$('#btnAyuda').addEventListener('click', function () { util.$('#modalAyuda').hidden = false; });
    util.$('#btnCerrarAyuda').addEventListener('click', function () { util.$('#modalAyuda').hidden = true; });
    util.$('#modalAyuda').addEventListener('click', function (ev) {
      if (ev.target === this) this.hidden = true;
    });

    /* Desplazamiento y tamaño de ventana */
    var alDesplazar = util.aplazar(function () {
      render.renderizarVisibles();
      paneles.detectarPaginaVisible();
      if (estado.herramienta === 'seltexto' || estado.herramienta === 'editar' ||
          estado.herramienta === 'resaltar') precargarTexto();
    }, 90);
    lienzo.addEventListener('scroll', alDesplazar);

    raiz.addEventListener('resize', util.aplazar(function () {
      if (estado.modoZoom === 'ancho' || estado.modoZoom === 'pagina') render.reconstruir();
    }, 160));

    lienzo.addEventListener('wheel', function (ev) {
      if (!ev.ctrlKey) return;
      ev.preventDefault();
      pasoZoom(ev.deltaY < 0 ? 1 : -1);
    }, { passive: false });

    raiz.addEventListener('keydown', alTeclado);

    /* Avisos que emiten los módulos */
    estado.al('aviso', function (a) { avisar(a.texto, a.tipo); });
    estado.al('progreso', function (t) { avisar(t); });
    estado.al('historial', actualizarBotones);
    estado.al('seleccionPaginas', actualizarBotones);
    estado.al('documento', function () {
      render.reconstruir();
      avisar(resumen());
      actualizarBotones();
    });
    estado.al('pagina', util.aplazar(function () { avisar(resumen()); actualizarBotones(); }, 400));

    raiz.addEventListener('beforeunload', function (ev) {
      if (estado.hayDocumento() && estado.historialIdx > 0) {
        ev.preventDefault();
        ev.returnValue = '';
      }
    });

    iniciarArrastre();
  }

  /* ── Arranque ───────────────────────────────────────────────────────── */

  function iniciar() {
    barraEstado = util.$('#estado');
    lienzo = util.$('#lienzo');
    inpArchivos = util.$('#inpArchivos');
    inpImagen = util.$('#inpImagen');
    inpComparar = util.$('#inpComparar');
    lienzo.dataset.herr = 'seleccionar';

    if (!raiz.pdfjsLib || !raiz.PDFLib) {
      barraEstado.textContent = 'No se cargaron las librerías. Comprueba que la carpeta ' +
                                '«assets/vendor» está junto a index.html.';
      barraEstado.className = 'estado error';
      return;
    }

    render.iniciar();
    herr.iniciar();
    paneles.iniciar();
    Clarvi.imagenes.iniciar();
    Clarvi.numeracion.iniciar();
    Clarvi.comparar.iniciar();
    Clarvi.comprimir.iniciar();
    conectar();

    // Si el usuario ya firmó en otra sesión, se recupera para tenerla a mano.
    Clarvi.imagenes.cargarFirmaGuardada();

    Promise.all([
      raiz.CLARVI_PDFJS_LISTO || Promise.resolve(true),
      Clarvi.anots.prepararFuentes()
    ]).then(function () {
      avisar(resumen());
    }).catch(function (err) {
      avisar('Aviso al preparar el editor: ' + (err.message || err), 'error');
    });

    actualizarBotones();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})(window);
