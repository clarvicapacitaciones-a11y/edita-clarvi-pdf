/* ===========================================================================
   geometria.js — conversiones entre el espacio de página y el de pantalla

   Espacio de PÁGINA  : puntos PDF, página SIN girar, origen arriba-izquierda,
                        «y» hacia abajo. Es donde viven las anotaciones.
   Espacio de VISTA   : lo que se ve en pantalla, con el giro aplicado.
                        En puntos si la escala es 1, en píxeles CSS si la
                        escala es el zoom.

   Con r = giro total (0, 90, 180, 270), w/h = tamaño sin girar y s = escala:

     r=0     vx = x·s              vy = y·s
     r=90    vx = (h − y)·s        vy = x·s
     r=180   vx = (w − x)·s        vy = (h − y)·s
     r=270   vx = y·s              vy = (w − x)·s
   =========================================================================== */
(function (raiz) {
  'use strict';

  var Clarvi = raiz.Clarvi || (raiz.Clarvi = {});
  var estado = Clarvi.estado;

  var geo = {

    /** Página → vista. */
    aVista: function (pagina, x, y, escala) {
      var s = escala == null ? 1 : escala;
      var r = estado.giroTotal(pagina);
      switch (r) {
        case 90:  return { x: (pagina.alto - y) * s, y: x * s };
        case 180: return { x: (pagina.ancho - x) * s, y: (pagina.alto - y) * s };
        case 270: return { x: y * s, y: (pagina.ancho - x) * s };
        default:  return { x: x * s, y: y * s };
      }
    },

    /** Vista → página. */
    aPagina: function (pagina, vx, vy, escala) {
      var s = escala == null ? 1 : escala;
      var r = estado.giroTotal(pagina);
      switch (r) {
        case 90:  return { x: vy / s, y: pagina.alto - vx / s };
        case 180: return { x: pagina.ancho - vx / s, y: pagina.alto - vy / s };
        case 270: return { x: pagina.ancho - vy / s, y: vx / s };
        default:  return { x: vx / s, y: vy / s };
      }
    },

    /**
     * Deja el contexto listo para dibujar directamente en coordenadas de
     * página: aplica giro y escala de una sola vez.
     */
    aplicarTransformacion: function (ctx, pagina, escala) {
      var s = escala;
      var r = estado.giroTotal(pagina);
      switch (r) {
        case 90:  ctx.setTransform(0, s, -s, 0, pagina.alto * s, 0); break;
        case 180: ctx.setTransform(-s, 0, 0, -s, pagina.ancho * s, pagina.alto * s); break;
        case 270: ctx.setTransform(0, -s, s, 0, 0, pagina.ancho * s); break;
        default:  ctx.setTransform(s, 0, 0, s, 0, 0); break;
      }
    },

    /** Rectángulo normalizado a partir de dos esquinas cualesquiera. */
    rectDe: function (x1, y1, x2, y2) {
      return {
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        w: Math.abs(x2 - x1),
        h: Math.abs(y2 - y1)
      };
    },

    /** ¿Está el punto dentro del rectángulo (con margen opcional)? */
    enRect: function (x, y, r, margen) {
      var m = margen || 0;
      return x >= r.x - m && x <= r.x + r.w + m &&
             y >= r.y - m && y <= r.y + r.h + m;
    },

    /** Distancia de un punto al segmento a-b. */
    distSegmento: function (px, py, ax, ay, bx, by) {
      var dx = bx - ax, dy = by - ay;
      var largo2 = dx * dx + dy * dy;
      var t = largo2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / largo2;
      t = t < 0 ? 0 : (t > 1 ? 1 : t);
      var cx = ax + t * dx, cy = ay + t * dy;
      return Math.hypot(px - cx, py - cy);
    },

    /** Une dos rectángulos. */
    unirRect: function (a, b) {
      if (!a) return b;
      if (!b) return a;
      var x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
      return {
        x: x, y: y,
        w: Math.max(a.x + a.w, b.x + b.w) - x,
        h: Math.max(a.y + a.h, b.y + b.h) - y
      };
    },

    /** Ajusta un ángulo a múltiplos de 45° (para Shift). */
    ajustarAngulo: function (x1, y1, x2, y2) {
      var dx = x2 - x1, dy = y2 - y1;
      var largo = Math.hypot(dx, dy);
      var ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
      return { x: x1 + Math.cos(ang) * largo, y: y1 + Math.sin(ang) * largo };
    },

    /* ── Tiradores de redimensión ──────────────────────────────────────── */

    /** Los 8 tiradores de un rectángulo, en coordenadas de página. */
    tiradores: function (r) {
      var cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      return [
        { n: 'no', x: r.x,       y: r.y },
        { n: 'n',  x: cx,        y: r.y },
        { n: 'ne', x: r.x + r.w, y: r.y },
        { n: 'e',  x: r.x + r.w, y: cy },
        { n: 'se', x: r.x + r.w, y: r.y + r.h },
        { n: 's',  x: cx,        y: r.y + r.h },
        { n: 'so', x: r.x,       y: r.y + r.h },
        { n: 'o',  x: r.x,       y: cy }
      ];
    },

    /** Aplica el arrastre de un tirador sobre un rectángulo. */
    redimensionar: function (r, tirador, dx, dy, minimo) {
      var min = minimo == null ? 6 : minimo;
      var x1 = r.x, y1 = r.y, x2 = r.x + r.w, y2 = r.y + r.h;

      if (tirador.indexOf('o') >= 0) x1 += dx;
      if (tirador.indexOf('e') >= 0) x2 += dx;
      if (tirador.indexOf('n') >= 0) y1 += dy;
      if (tirador.indexOf('s') >= 0) y2 += dy;

      if (x2 - x1 < min) { if (tirador.indexOf('o') >= 0) x1 = x2 - min; else x2 = x1 + min; }
      if (y2 - y1 < min) { if (tirador.indexOf('n') >= 0) y1 = y2 - min; else y2 = y1 + min; }

      return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
    },

    /**
     * Como redimensionar(), pero conservando la proporción original.
     * Se ancla la esquina opuesta a la que se está arrastrando.
     */
    redimensionarProporcional: function (r, tirador, dx, dy, minimo) {
      var min = minimo == null ? 6 : minimo;
      if (r.w <= 0 || r.h <= 0) return geo.redimensionar(r, tirador, dx, dy, min);

      var razon = r.w / r.h;
      var libre = geo.redimensionar(r, tirador, dx, dy, min);

      var w = libre.w, h = libre.h;
      if (w / razon >= h) h = w / razon; else w = h * razon;
      w = Math.max(min, w);
      h = Math.max(min, h);

      var izquierda = tirador.indexOf('o') >= 0;
      var arriba = tirador.indexOf('n') >= 0;
      var anclaX = izquierda ? r.x + r.w : r.x;
      var anclaY = arriba ? r.y + r.h : r.y;

      return {
        x: izquierda ? anclaX - w : anclaX,
        y: arriba ? anclaY - h : anclaY,
        w: w, h: h
      };
    },

    /** ¿El tirador es una esquina (y no el centro de un lado)? */
    esEsquina: function (tirador) { return !!tirador && tirador.length === 2; },

    /** Cursor CSS del tirador, teniendo en cuenta el giro de la página. */
    cursorTirador: function (nombre, giro) {
      var orden = ['n', 'ne', 'e', 'se', 's', 'so', 'o', 'no'];
      var cursores = {
        n: 'ns-resize', ne: 'nesw-resize', e: 'ew-resize', se: 'nwse-resize',
        s: 'ns-resize', so: 'nesw-resize', o: 'ew-resize', no: 'nwse-resize'
      };
      var i = orden.indexOf(nombre);
      if (i < 0) return 'move';
      var giros = Math.round((giro || 0) / 45);
      return cursores[orden[(i + giros) % 8]];
    }
  };

  Clarvi.geo = geo;
})(window);
