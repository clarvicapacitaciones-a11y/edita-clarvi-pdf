/* ===========================================================================
   estado.js — modelo de datos de la aplicación e historial deshacer/rehacer

   Modelo
   ------
   fuentes  Map  id → { id, nombre, bytes:Uint8Array, doc:PDFDocumentProxy,
                        numPaginas }
            Un PDF abierto. Nunca se modifica: es la materia prima de la que
            se copian las páginas al exportar.

   paginas  Array  Orden final del documento. Cada elemento:
            { id, fuenteId, indice,      ← de qué PDF y qué página original
              giro,                      ← giro añadido por el usuario (0/90/180/270)
              giroBase,                  ← giro que ya traía la página (/Rotate)
              ancho, alto,               ← tamaño sin rotar, en puntos
              vista: [x0,y0,x1,y1],      ← CropBox, para compensar desplazamientos
              anots: []                  ← objetos dibujados encima
            }

   Las coordenadas de las anotaciones están SIEMPRE en puntos del espacio de
   página sin rotar, con el origen arriba a la izquierda y la «y» hacia abajo.
   Es el mismo espacio en el que dibuja pdf-lib, así que exportar es directo.
   =========================================================================== */
(function (raiz) {
  'use strict';

  var Clarvi = raiz.Clarvi || (raiz.Clarvi = {});
  var util = Clarvi.util;

  var MAX_HISTORIAL = 80;

  var estado = {

    fuentes: new Map(),
    paginas: [],

    /* Interacción */
    herramienta: 'seleccionar',
    seleccion: null,          // { paginaId, anotId }
    paginasSel: new Set(),    // ids de páginas marcadas en el panel lateral
    paginaActual: 0,          // índice dentro de estado.paginas

    /* Vista */
    zoom: 1,
    modoZoom: '1',            // '1' | 'ancho' | 'pagina'

    /* Ajustes de las herramientas (se recuerdan entre usos) */
    ajustes: {
      colorTrazo:    '#d64545',
      colorRelleno:  '',            // vacío = sin relleno
      grosor:        2,
      opacidad:      1,
      colorResaltar: '#ffe14d',
      opacidadResaltar: 0.45,
      colorTapar:    '#ffffff',
      colorTexto:    '#111111',
      tamTexto:      12,
      fuenteTexto:   'Helvetica',
      negrita:       false,
      cursiva:       false,
      alineado:      'izq',
      interlineado:  1.25
    },

    /* Historial */
    historial: [],
    historialIdx: -1,

    /* Escuchadores de cambios */
    _oyentes: {}
  };

  /* ── Eventos internos muy simples ───────────────────────────────────── */

  estado.al = function (evento, fn) {
    (estado._oyentes[evento] || (estado._oyentes[evento] = [])).push(fn);
  };

  estado.emitir = function (evento, datos) {
    var lista = estado._oyentes[evento];
    if (!lista) return;
    for (var i = 0; i < lista.length; i++) lista[i](datos);
  };

  /* ── Acceso a páginas ───────────────────────────────────────────────── */

  estado.pagina = function (id) {
    for (var i = 0; i < estado.paginas.length; i++) {
      if (estado.paginas[i].id === id) return estado.paginas[i];
    }
    return null;
  };

  estado.indiceDe = function (id) {
    for (var i = 0; i < estado.paginas.length; i++) {
      if (estado.paginas[i].id === id) return i;
    }
    return -1;
  };

  estado.fuenteDe = function (pagina) { return estado.fuentes.get(pagina.fuenteId); };

  /** Giro total con el que se ve la página: el propio del PDF más el del usuario. */
  estado.giroTotal = function (pagina) {
    return (((pagina.giroBase + pagina.giro) % 360) + 360) % 360;
  };

  /** Tamaño en puntos tal y como se ve (con el giro aplicado). */
  estado.tamanoVista = function (pagina) {
    var r = estado.giroTotal(pagina);
    return (r % 180 === 0)
      ? { ancho: pagina.ancho, alto: pagina.alto }
      : { ancho: pagina.alto, alto: pagina.ancho };
  };

  estado.anotacion = function (paginaId, anotId) {
    var p = estado.pagina(paginaId);
    if (!p) return null;
    for (var i = 0; i < p.anots.length; i++) {
      if (p.anots[i].id === anotId) return p.anots[i];
    }
    return null;
  };

  estado.anotSeleccionada = function () {
    if (!estado.seleccion) return null;
    return estado.anotacion(estado.seleccion.paginaId, estado.seleccion.anotId);
  };

  estado.hayDocumento = function () { return estado.paginas.length > 0; };

  /* ── Historial ──────────────────────────────────────────────────────────
     Se guardan instantáneas del array de páginas (orden, giros y objetos
     dibujados). Las fuentes no se copian nunca: son inmutables.
     ─────────────────────────────────────────────────────────────────────── */

  function instantanea() {
    return JSON.stringify(estado.paginas.map(function (p) {
      return {
        id: p.id, fuenteId: p.fuenteId, indice: p.indice,
        giro: p.giro, giroBase: p.giroBase,
        ancho: p.ancho, alto: p.alto, vista: p.vista,
        anots: p.anots
      };
    }));
  }

  /** Registra el estado actual como un punto al que se puede volver. */
  estado.marcar = function (descripcion) {
    var foto = instantanea();
    var ultimo = estado.historial[estado.historialIdx];
    if (ultimo && ultimo.datos === foto) return;    // nada ha cambiado

    estado.historial.length = estado.historialIdx + 1;
    estado.historial.push({ datos: foto, desc: descripcion || '' });

    if (estado.historial.length > MAX_HISTORIAL) estado.historial.shift();
    estado.historialIdx = estado.historial.length - 1;
    estado.emitir('historial');
  };

  function restaurar(indice) {
    var entrada = estado.historial[indice];
    if (!entrada) return false;

    var datos = JSON.parse(entrada.datos);
    var previas = new Map();
    estado.paginas.forEach(function (p) { previas.set(p.id, p); });

    estado.paginas = datos.map(function (d) {
      var vieja = previas.get(d.id);
      // Se conserva la caché de render de la página si seguía existiendo.
      var p = vieja || {};
      p.id = d.id; p.fuenteId = d.fuenteId; p.indice = d.indice;
      p.giro = d.giro; p.giroBase = d.giroBase;
      p.ancho = d.ancho; p.alto = d.alto; p.vista = d.vista;
      p.anots = d.anots;
      return p;
    });

    estado.historialIdx = indice;

    // La selección puede haber dejado de existir.
    if (estado.seleccion && !estado.anotSeleccionada()) estado.seleccion = null;
    estado.paginasSel.forEach(function (id) {
      if (estado.indiceDe(id) < 0) estado.paginasSel.delete(id);
    });
    if (estado.paginaActual >= estado.paginas.length) {
      estado.paginaActual = Math.max(0, estado.paginas.length - 1);
    }
    return true;
  }

  estado.puedeDeshacer = function () { return estado.historialIdx > 0; };
  estado.puedeRehacer  = function () { return estado.historialIdx < estado.historial.length - 1; };

  estado.deshacer = function () {
    if (!estado.puedeDeshacer()) return false;
    restaurar(estado.historialIdx - 1);
    estado.emitir('historial');
    estado.emitir('documento');
    return true;
  };

  estado.rehacer = function () {
    if (!estado.puedeRehacer()) return false;
    restaurar(estado.historialIdx + 1);
    estado.emitir('historial');
    estado.emitir('documento');
    return true;
  };

  estado.reiniciarHistorial = function () {
    estado.historial = [];
    estado.historialIdx = -1;
    estado.marcar('inicio');
  };

  Clarvi.estado = estado;
})(window);
