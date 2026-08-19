/* ===========================================================================
   ordenar.js — arrastrar para ordenar, con clic alternativo

   Un solo gesto decide qué quiere el usuario: si mueve el puntero más de unos
   píxeles, está reordenando; si lo suelta donde lo pulsó, era un clic normal.
   Eso evita tener que elegir entre «clic para ir a la página» y «arrastrar para
   moverla»: se puede tener las dos cosas.

   Funciona con eventos de puntero, así que va igual con ratón, lápiz o dedo,
   cosa que el arrastre nativo de HTML no hacía.

   Lo usan las miniaturas de página, la lista de documentos y la barra de
   herramientas.
   =========================================================================== */
(function (raiz) {
  'use strict';

  var Clarvi = raiz.Clarvi || (raiz.Clarvi = {});

  var UMBRAL = 5;            // píxeles que hay que moverse para que sea arrastre
  var MARGEN_AUTO = 46;      // franja del borde que dispara el desplazamiento
  var VELOCIDAD_AUTO = 12;

  /**
   * @param opciones.contenedor   elemento con scroll que contiene los elementos
   * @param opciones.selector     selector de cada elemento movible
   * @param opciones.eje          'vertical' (por defecto) u 'horizontal'
   * @param opciones.ignorar      selector de zonas que NO inician el gesto
   * @param opciones.alSoltar     fn(idOrigen, idDestino, antes) al reordenar
   * @param opciones.alClic       fn(id, evento) si no llegó a ser arrastre
   * @param opciones.id           fn(elemento) → identificador (por defecto dataset.id)
   */
  function activar(opciones) {
    var contenedor = opciones.contenedor;
    if (!contenedor) return function () {};

    var horizontal = opciones.eje === 'horizontal';
    var idDe = opciones.id || function (el) { return el.dataset.id; };

    var gesto = null;
    var marca = null;
    var autoDesplaza = null;

    function elementoDe(destino) {
      return destino && destino.closest ? destino.closest(opciones.selector) : null;
    }

    function alBajar(ev) {
      if (ev.button !== 0) return;
      if (opciones.ignorar && ev.target.closest && ev.target.closest(opciones.ignorar)) return;

      var el = elementoDe(ev.target);
      if (!el || !contenedor.contains(el)) return;

      gesto = {
        el: el,
        id: idDe(el),
        x0: ev.clientX,
        y0: ev.clientY,
        arrastrando: false,
        destino: null,
        antes: true,
        pointerId: ev.pointerId
      };

      // La captura hace que sigamos recibiendo eventos aunque el puntero se
      // salga del elemento, que es justo lo que pasa al arrastrar.
      try { el.setPointerCapture(ev.pointerId); } catch (e) { /* opcional */ }
    }

    function alMover(ev) {
      if (!gesto) return;

      if (!gesto.arrastrando) {
        if (Math.hypot(ev.clientX - gesto.x0, ev.clientY - gesto.y0) < UMBRAL) return;
        gesto.arrastrando = true;
        gesto.el.classList.add('arrastrando');
        contenedor.classList.add('ordenando');
        crearMarca();
      }

      ev.preventDefault();
      situarMarca(ev);
      vigilarBordes(ev);
    }

    function alSubir(ev) {
      if (!gesto) return;
      var g = gesto;
      gesto = null;

      try { g.el.releasePointerCapture(g.pointerId); } catch (e) { /* opcional */ }
      pararAuto();

      if (!g.arrastrando) {
        if (opciones.alClic) opciones.alClic(g.id, ev);
        return;
      }

      g.el.classList.remove('arrastrando');
      contenedor.classList.remove('ordenando');
      quitarMarca();

      if (g.destino && idDe(g.destino) !== g.id && opciones.alSoltar) {
        opciones.alSoltar(g.id, idDe(g.destino), g.antes);
      }
    }

    function alCancelar() {
      if (!gesto) return;
      gesto.el.classList.remove('arrastrando');
      contenedor.classList.remove('ordenando');
      quitarMarca();
      pararAuto();
      gesto = null;
    }

    /* ── Marca de inserción ── */

    function crearMarca() {
      if (marca) return;
      marca = document.createElement('div');
      marca.className = 'marca-insercion' + (horizontal ? ' horizontal' : '');
      contenedor.appendChild(marca);
    }

    function quitarMarca() {
      if (marca && marca.parentNode) marca.parentNode.removeChild(marca);
      marca = null;
    }

    function situarMarca(ev) {
      var candidatos = Array.prototype.filter.call(
        contenedor.querySelectorAll(opciones.selector),
        function (e) { return e !== gesto.el; });

      var mejor = null, mejorDist = Infinity, antes = true;

      candidatos.forEach(function (e) {
        var r = e.getBoundingClientRect();
        var centro = horizontal ? r.left + r.width / 2 : r.top + r.height / 2;
        var pos = horizontal ? ev.clientX : ev.clientY;
        var dist = Math.abs(pos - centro);
        if (dist < mejorDist) { mejorDist = dist; mejor = e; antes = pos < centro; }
      });

      gesto.destino = mejor;
      gesto.antes = antes;
      if (!mejor || !marca) return;

      var caja = mejor.getBoundingClientRect();
      var base = contenedor.getBoundingClientRect();

      if (horizontal) {
        marca.style.left = (caja.left - base.left + contenedor.scrollLeft +
                            (antes ? -3 : caja.width + 1)) + 'px';
        marca.style.top = (caja.top - base.top + contenedor.scrollTop) + 'px';
        marca.style.height = caja.height + 'px';
      } else {
        marca.style.top = (caja.top - base.top + contenedor.scrollTop +
                           (antes ? -3 : caja.height + 1)) + 'px';
        marca.style.left = '4px';
        marca.style.right = '4px';
      }
    }

    /* ── Desplazamiento automático al llegar a los bordes ── */

    function vigilarBordes(ev) {
      var r = contenedor.getBoundingClientRect();
      var pos = horizontal ? ev.clientX : ev.clientY;
      var ini = horizontal ? r.left : r.top;
      var fin = horizontal ? r.right : r.bottom;

      var delta = 0;
      if (pos - ini < MARGEN_AUTO) delta = -VELOCIDAD_AUTO;
      else if (fin - pos < MARGEN_AUTO) delta = VELOCIDAD_AUTO;

      if (!delta) { pararAuto(); return; }
      if (autoDesplaza) { autoDesplaza.delta = delta; return; }

      autoDesplaza = { delta: delta, id: 0 };
      (function paso() {
        if (!autoDesplaza) return;
        if (horizontal) contenedor.scrollLeft += autoDesplaza.delta;
        else contenedor.scrollTop += autoDesplaza.delta;
        autoDesplaza.id = requestAnimationFrame(paso);
      })();
    }

    function pararAuto() {
      if (!autoDesplaza) return;
      cancelAnimationFrame(autoDesplaza.id);
      autoDesplaza = null;
    }

    contenedor.addEventListener('pointerdown', alBajar);
    contenedor.addEventListener('pointermove', alMover);
    contenedor.addEventListener('pointerup', alSubir);
    contenedor.addEventListener('pointercancel', alCancelar);
    // Arrastrar texto o imágenes por encima estorbaría al gesto.
    contenedor.addEventListener('dragstart', function (ev) { ev.preventDefault(); });

    return function desactivar() {
      contenedor.removeEventListener('pointerdown', alBajar);
      contenedor.removeEventListener('pointermove', alMover);
      contenedor.removeEventListener('pointerup', alSubir);
      contenedor.removeEventListener('pointercancel', alCancelar);
      alCancelar();
    };
  }

  /**
   * Reordena un array moviendo el elemento `origen` junto al `destino`.
   * Devuelve el índice final donde debe insertarse.
   */
  function posicionDestino(lista, idOrigen, idDestino, antes, idDe) {
    var iDestino = -1;
    for (var i = 0; i < lista.length; i++) {
      if (idDe(lista[i]) === idDestino) { iDestino = i; break; }
    }
    if (iDestino < 0) return -1;
    return antes ? iDestino : iDestino + 1;
  }

  Clarvi.ordenar = {
    activar: activar,
    posicionDestino: posicionDestino,
    UMBRAL: UMBRAL
  };
})(window);
