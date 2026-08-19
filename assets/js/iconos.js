/* ===========================================================================
   iconos.js — juego de iconos propio, todos del mismo estilo

   Están dibujados a trazo sobre un lienzo de 24×24 y usan `currentColor`, así
   que cada icono toma el color del botón que lo contiene: gris en los paneles,
   blanco cuando el botón está activo o es de color. Se ven nítidos a cualquier
   tamaño y salen idénticos en Windows, Mac y Linux, cosa que con los emoji no
   pasaba.
   =========================================================================== */
(function (raiz) {
  'use strict';

  var Clarvi = raiz.Clarvi || (raiz.Clarvi = {});

  /* Cada entrada es el contenido del <svg>. Sin rellenos salvo donde se indica. */
  var TRAZOS = {

    /* ── Archivo ── */
    abrir:     '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4l2 2.5h5A1.5 1.5 0 0 1 17 9v1"/>' +
               '<path d="M3 9h16.2a1 1 0 0 1 .96 1.28l-2.1 7A1.5 1.5 0 0 1 16.6 18.5H4.5A1.5 1.5 0 0 1 3 17z"/>',
    unir:      '<rect x="3" y="4" width="10" height="13" rx="1.5"/>' +
               '<path d="M17 9v8M13 13h8"/>',
    guardar:   '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h9.7L20 8.8v9.7a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z"/>' +
               '<path d="M8 4v5h7M8 19v-5h8v5"/>',
    extraer:   '<path d="M6 4h8l5 5v11H6z"/><path d="M14 4v5h5"/>' +
               '<path d="M9.5 12.5l5 5M14.5 12.5l-5 5"/>',
    documento: '<path d="M6 3.5h7l5 5v12H6z"/><path d="M13 3.5v5h5"/>',

    /* ── Historial ── */
    deshacer:  '<path d="M4 10h9a5 5 0 0 1 0 10h-3"/><path d="M8 6l-4 4 4 4"/>',
    rehacer:   '<path d="M20 10h-9a5 5 0 0 0 0 10h3"/><path d="M16 6l4 4-4 4"/>',

    /* ── Acciones de documento ── */
    numerar:   '<path d="M4 8h16M4 16h16M9.5 4l-1.6 16M16.5 4l-1.6 16"/>',
    comparar:  '<path d="M4 9h13l-3-3M20 15H7l3 3"/>',
    comprimir: '<path d="M12 3v6M9 6.5l3-3 3 3"/><path d="M12 21v-6M9 17.5l3 3 3-3"/>' +
               '<path d="M3.5 12h17"/>',
    ayuda:     '<circle cx="12" cy="12" r="8.5"/>' +
               '<path d="M9.6 9.4a2.5 2.5 0 1 1 3.1 2.8c-.5.2-.7.6-.7 1.1v.5"/>' +
               '<circle cx="12" cy="16.6" r=".9" fill="currentColor" stroke="none"/>',

    /* ── Herramientas ── */
    seleccionar: '<path d="M6 3.5l12 8.2-5.2.9 2.6 5.4-2.1 1-2.6-5.4-3.4 3.5z"/>',
    texto:       '<path d="M5 6.5V5h14v1.5M12 5v14M9 19h6"/>',
    editar:      '<path d="M4 16.5L15.6 4.9a2 2 0 0 1 2.8 2.8L6.8 19.3 3.5 20z"/>' +
                 '<path d="M13.6 6.9l3.5 3.5"/>',
    resaltar:    '<path d="M4 15.5l6-6 4.5 4.5-6 6H4z"/>' +
                 '<path d="M13.5 6l4.5 4.5M4 21h16"/>',
    lapiz:       '<path d="M4.5 19.5l1-4.2L15.9 4.9a2 2 0 0 1 2.8 2.8L8.3 18.1z"/>',
    linea:       '<path d="M5 19L19 5"/>',
    flecha:      '<path d="M5 19L19 5M11 5h8v8"/>',
    rect:        '<rect x="4" y="6.5" width="16" height="11" rx="1"/>',
    elipse:      '<ellipse cx="12" cy="12" rx="8.5" ry="6.5"/>',
    tapar:       '<rect x="4" y="6.5" width="16" height="11" rx="1"/>' +
                 '<path d="M5 14.5l4-4M5 10l1.5-1.5M9.5 17.5l7-7M13.5 17.5l5.5-5.5M17.5 17.5l1.5-1.5"/>',
    imagen:      '<rect x="3.5" y="5" width="17" height="14" rx="1.5"/>' +
                 '<circle cx="8.5" cy="10" r="1.6"/>' +
                 '<path d="M3.5 16.2l4.6-4.1 4.2 3.6 3-2.6 5.2 4.4"/>',
    firma:       '<path d="M3.5 16.5c3.2 0 3.6-9 6-9 1.7 0 1.2 6.4 3 6.4 1.4 0 1.6-3.4 3-3.4 1.2 0 1.2 2.4 2.4 2.4.9 0 1.6-.8 2.6-1.9"/>' +
                 '<path d="M4 20h16"/>',
    borrar:      '<path d="M9.5 19.5L3.9 14a1.6 1.6 0 0 1 0-2.3l7.6-7.6a1.6 1.6 0 0 1 2.3 0l5.9 5.9a1.6 1.6 0 0 1 0 2.3L13 19.5z"/>' +
                 '<path d="M9.5 19.5H20M7.2 8.4l6.6 6.6"/>',
    seltexto:    '<path d="M9 4.5h1.5a1.5 1.5 0 0 1 1.5 1.5 1.5 1.5 0 0 1 1.5-1.5H15"/>' +
                 '<path d="M12 6v12"/>' +
                 '<path d="M9 19.5h1.5A1.5 1.5 0 0 0 12 18a1.5 1.5 0 0 0 1.5 1.5H15"/>',

    /* ── Páginas ── */
    girarIzq:  '<path d="M4 10a8 8 0 1 1 2.3 5.6"/><path d="M3.5 5.5V10H8"/>',
    girarDer:  '<path d="M20 10a8 8 0 1 0-2.3 5.6"/><path d="M20.5 5.5V10H16"/>',
    duplicar:  '<rect x="8" y="8" width="12" height="12" rx="1.5"/>' +
               '<path d="M16 5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16"/>',
    eliminar:  '<path d="M4.5 6.5h15M9.5 6.5V4.8A1.3 1.3 0 0 1 10.8 3.5h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7"/>' +
               '<path d="M6.5 6.5l.9 12.2a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-12.2"/>' +
               '<path d="M10.3 10v6.5M13.7 10v6.5"/>',
    marcarTodo:'<rect x="3.5" y="3.5" width="17" height="17" rx="2"/>' +
               '<path d="M7.5 12.2l3 3 6-6.4"/>',
    quitar:    '<path d="M6 6l12 12M18 6L6 18"/>',
    restablecer:'<path d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M3.5 4v4.5H8"/>',
    mover:     '<path d="M6 9h12M6 15h12"/>',

    /* ── Navegación ── */
    anterior:  '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
    siguiente: '<path d="M9.5 5.5L16 12l-6.5 6.5"/>',
    zoomMas:   '<path d="M12 5.5v13M5.5 12h13"/>',
    zoomMenos: '<path d="M5.5 12h13"/>',

    /* ── Bienvenida ── */
    bienvenida: '<path d="M6 3.5h7l5 5v12H6z"/><path d="M13 3.5v5h5"/>' +
                '<path d="M9 13h6M9 16.5h4"/>',
    candado:   '<rect x="4.5" y="10" width="15" height="10" rx="1.5"/>' +
               '<path d="M8 10V7.5a4 4 0 0 1 8 0V10"/>',
    reordenar: '<path d="M8 4.5v15M8 4.5L5 7.5M8 4.5l3 3"/>' +
               '<path d="M16 19.5v-15M16 19.5l-3-3M16 19.5l3-3"/>'
  };

  /** Devuelve el marcado SVG de un icono, o cadena vacía si no existe. */
  function svg(nombre, tamano) {
    var trazos = TRAZOS[nombre];
    if (!trazos) return '';
    var t = tamano || 24;
    return '<svg viewBox="0 0 24 24" width="' + t + '" height="' + t + '" ' +
           'fill="none" stroke="currentColor" stroke-width="1.6" ' +
           'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ' +
           'focusable="false">' + trazos + '</svg>';
  }

  /** Mete el icono dentro de un elemento. */
  function pon(el, nombre) {
    if (!el) return;
    var marcado = svg(nombre);
    if (marcado) el.innerHTML = marcado;
  }

  /** Recorre el documento y rellena todo lo que lleve data-icono. */
  function pintarTodos(raizDom) {
    var ambito = raizDom || document;
    var lista = ambito.querySelectorAll('[data-icono]');
    for (var i = 0; i < lista.length; i++) {
      pon(lista[i], lista[i].getAttribute('data-icono'));
    }
    return lista.length;
  }

  Clarvi.iconos = {
    svg: svg,
    pon: pon,
    pintarTodos: pintarTodos,
    nombres: function () { return Object.keys(TRAZOS); }
  };
})(window);
