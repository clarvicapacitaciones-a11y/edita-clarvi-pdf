/* ===========================================================================
   numeracion.js — numerar las páginas del documento

   Los números se crean como anotaciones de texto normales, marcadas con
   `origen: 'numeracion'`. Así se ven al instante, se pueden mover una a una,
   entran en deshacer/rehacer y se exportan con el código que ya existe.

   La posición se calcula en el espacio de la página TAL Y COMO SE VE, así que
   en una página girada el número sigue apareciendo abajo y derecho.
   =========================================================================== */
(function (raiz) {
  'use strict';

  var Clarvi = raiz.Clarvi || (raiz.Clarvi = {});
  var util = Clarvi.util;
  var estado = Clarvi.estado;
  var geo = Clarvi.geo;
  var anots = Clarvi.anots;

  var FORMATOS = [
    ['n',        '1'],
    ['pag n',    'Página 1'],
    ['n de t',   '1 de 20'],
    ['n/t',      '1 / 20'],
    ['pag n t',  'Página 1 de 20'],
    ['-n-',      '- 1 -']
  ];

  var POSICIONES = [
    ['ai', 'Arriba izquierda'], ['ac', 'Arriba centro'], ['ad', 'Arriba derecha'],
    ['bi', 'Abajo izquierda'],  ['bc', 'Abajo centro'],  ['bd', 'Abajo derecha']
  ];

  var opciones = {
    formato: 'n',
    posicion: 'bc',
    margen: 36,
    tam: 10,
    fuente: 'Helvetica',
    color: '#333333',
    empezarEn: 1,
    desde: 1,
    hasta: 0,          // 0 = hasta el final
    omitirPrimera: false
  };

  /* ── Texto de cada número ───────────────────────────────────────────── */

  function etiqueta(numero, total) {
    switch (opciones.formato) {
      case 'pag n':   return 'Página ' + numero;
      case 'n de t':  return numero + ' de ' + total;
      case 'n/t':     return numero + ' / ' + total;
      case 'pag n t': return 'Página ' + numero + ' de ' + total;
      case '-n-':     return '- ' + numero + ' -';
      default:        return String(numero);
    }
  }

  /* ── Colocación ─────────────────────────────────────────────────────── */

  /**
   * Devuelve el ancla del cuadro en el espacio de página (sin girar) más el
   * giro que hay que darle al texto para que se lea derecho en pantalla.
   */
  function colocar(pag, anchoCuadro, altoCuadro) {
    var vista = estado.tamanoVista(pag);
    var m = opciones.margen;
    var arriba = opciones.posicion[0] === 'a';
    var lado = opciones.posicion[1];

    // Coordenadas dentro de la página tal y como se ve
    var vx = lado === 'i' ? m
           : lado === 'd' ? vista.ancho - m - anchoCuadro
           : (vista.ancho - anchoCuadro) / 2;
    var vy = arriba ? m : vista.alto - m - altoCuadro;

    // Para que el número se lea derecho hay que girar el texto justo lo
    // contrario de lo que está girada la página.
    var giro = (360 - estado.giroTotal(pag)) % 360;

    // Ancla del cuadro: el punto de la página que se ve en (vx, vy)
    var esquina = geo.aPagina(pag, vx, vy, 1);

    return { x: esquina.x, y: esquina.y, giro: giro };
  }

  /* ── Aplicar y quitar ───────────────────────────────────────────────── */

  function quitar(silencioso) {
    var quitados = 0;
    estado.paginas.forEach(function (p) {
      var antes = p.anots.length;
      p.anots = p.anots.filter(function (a) { return a.origen !== 'numeracion'; });
      quitados += antes - p.anots.length;
    });
    if (quitados && !silencioso) {
      estado.marcar('quitar numeración');
      estado.emitir('documento');
      estado.emitir('aviso', { tipo: 'ok', texto: 'Se quitaron ' + quitados + ' números de página.' });
    }
    return quitados;
  }

  function aplicar() {
    if (!estado.hayDocumento()) return 0;

    quitar(true);

    var total = estado.paginas.length;
    var desde = util.limitar(opciones.desde || 1, 1, total);
    var hasta = opciones.hasta ? util.limitar(opciones.hasta, desde, total) : total;
    var puestos = 0;
    var numero = opciones.empezarEn;

    // El total que se enseña es el de páginas realmente numeradas.
    var totalMostrado = (hasta - desde + 1) - (opciones.omitirPrimera ? 1 : 0);
    totalMostrado = Math.max(1, totalMostrado) + (opciones.empezarEn - 1);

    for (var i = desde - 1; i < hasta; i++) {
      var pag = estado.paginas[i];
      if (opciones.omitirPrimera && i === desde - 1) continue;

      var texto = etiqueta(numero, totalMostrado);

      var molde = {
        tipo: 'texto', texto: texto, tam: opciones.tam,
        fuente: opciones.fuente, negrita: false, cursiva: false,
        interlineado: 1.15, alineado: 'izq'
      };
      var ancho = anots.anchoTexto(texto, molde) + 1;
      var alto = opciones.tam * 1.15;

      var sitio = colocar(pag, ancho, alto);

      pag.anots.push(anots.nueva('texto', {
        x: sitio.x, y: sitio.y, w: ancho,
        texto: texto,
        tam: opciones.tam,
        fuente: opciones.fuente,
        negrita: false, cursiva: false,
        color: opciones.color,
        alineado: 'izq',
        interlineado: 1.15,
        fondo: '',
        giro: sitio.giro,
        origen: 'numeracion'
      }));

      numero++;
      puestos++;
    }

    estado.marcar('numerar');
    estado.emitir('documento');
    return puestos;
  }

  function hayNumeracion() {
    return estado.paginas.some(function (p) {
      return p.anots.some(function (a) { return a.origen === 'numeracion'; });
    });
  }

  /* ── Diálogo ────────────────────────────────────────────────────────── */

  var dlg = {};

  function iniciar() {
    dlg.modal = util.$('#modalNumeros');
    if (!dlg.modal) return;

    dlg.formato = util.$('#numFormato');
    dlg.margen = util.$('#numMargen');
    dlg.tam = util.$('#numTam');
    dlg.fuente = util.$('#numFuente');
    dlg.color = util.$('#numColor');
    dlg.empezar = util.$('#numEmpezar');
    dlg.desde = util.$('#numDesde');
    dlg.hasta = util.$('#numHasta');
    dlg.omitir = util.$('#numOmitir');
    dlg.previa = util.$('#numPrevia');
    dlg.quitar = util.$('#btnQuitarNumeros');

    FORMATOS.forEach(function (f) {
      var o = document.createElement('option');
      o.value = f[0]; o.textContent = f[1];
      dlg.formato.appendChild(o);
    });

    util.$$('.rejilla-pos button').forEach(function (b) {
      b.addEventListener('click', function () {
        opciones.posicion = b.dataset.pos;
        util.$$('.rejilla-pos button').forEach(function (o) {
          o.classList.toggle('act', o.dataset.pos === opciones.posicion);
        });
        actualizarPrevia();
      });
    });

    [dlg.formato, dlg.margen, dlg.tam, dlg.fuente, dlg.color,
     dlg.empezar, dlg.desde, dlg.hasta, dlg.omitir].forEach(function (el) {
      el.addEventListener('input', function () { leerFormulario(); actualizarPrevia(); });
      el.addEventListener('change', function () { leerFormulario(); actualizarPrevia(); });
    });

    util.$('#btnCancelarNumeros').addEventListener('click', cerrar);
    dlg.modal.addEventListener('click', function (ev) { if (ev.target === dlg.modal) cerrar(); });

    util.$('#btnAplicarNumeros').addEventListener('click', function () {
      leerFormulario();
      var n = aplicar();
      cerrar();
      estado.emitir('aviso', {
        tipo: n ? 'ok' : 'error',
        texto: n ? 'Se numeraron ' + n + ' páginas.' : 'No quedó ninguna página dentro del rango elegido.'
      });
    });

    dlg.quitar.addEventListener('click', function () { quitar(); cerrar(); });
  }

  function leerFormulario() {
    opciones.formato = dlg.formato.value;
    opciones.margen = util.limitar(parseFloat(dlg.margen.value) || 36, 0, 200);
    opciones.tam = util.limitar(parseFloat(dlg.tam.value) || 10, 5, 72);
    opciones.fuente = dlg.fuente.value;
    opciones.color = dlg.color.value;
    opciones.empezarEn = Math.max(0, parseInt(dlg.empezar.value, 10) || 1);
    opciones.desde = Math.max(1, parseInt(dlg.desde.value, 10) || 1);
    opciones.hasta = Math.max(0, parseInt(dlg.hasta.value, 10) || 0);
    opciones.omitirPrimera = dlg.omitir.checked;
  }

  function actualizarPrevia() {
    var total = Math.max(1, estado.paginas.length);
    var pos = POSICIONES.filter(function (p) { return p[0] === opciones.posicion; })[0];
    dlg.previa.innerHTML =
      'Se verá <b>' + etiqueta(opciones.empezarEn, total) + '</b> en la posición ' +
      '<b>' + (pos ? pos[1].toLowerCase() : '') + '</b>, a ' + opciones.margen + ' pt del borde.';
  }

  function abrir() {
    if (!estado.hayDocumento()) return;
    dlg.formato.value = opciones.formato;
    dlg.margen.value = opciones.margen;
    dlg.tam.value = opciones.tam;
    dlg.fuente.value = opciones.fuente;
    dlg.color.value = opciones.color;
    dlg.empezar.value = opciones.empezarEn;
    dlg.desde.value = opciones.desde;
    dlg.hasta.value = opciones.hasta || estado.paginas.length;
    dlg.omitir.checked = opciones.omitirPrimera;
    util.$$('.rejilla-pos button').forEach(function (o) {
      o.classList.toggle('act', o.dataset.pos === opciones.posicion);
    });
    dlg.quitar.hidden = !hayNumeracion();
    leerFormulario();
    actualizarPrevia();
    dlg.modal.hidden = false;
  }

  function cerrar() { dlg.modal.hidden = true; }

  Clarvi.numeracion = {
    iniciar: iniciar,
    abrir: abrir,
    cerrar: cerrar,
    aplicar: aplicar,
    quitar: quitar,
    hayNumeracion: hayNumeracion,
    opciones: opciones,
    etiqueta: etiqueta
  };
})(window);
