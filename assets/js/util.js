/* ===========================================================================
   util.js — utilidades generales
   =========================================================================== */
(function (raiz) {
  'use strict';

  var Clarvi = raiz.Clarvi || (raiz.Clarvi = {});

  var contadorId = 0;

  var util = {

    /* ── DOM ────────────────────────────────────────────────────────────── */

    $: function (sel, ctx) { return (ctx || document).querySelector(sel); },
    $$: function (sel, ctx) {
      return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
    },

    crear: function (etiqueta, clase, texto) {
      var el = document.createElement(etiqueta);
      if (clase) el.className = clase;
      if (texto != null) el.textContent = texto;
      return el;
    },

    vaciar: function (el) { while (el.firstChild) el.removeChild(el.firstChild); },

    /* ── Identificadores ────────────────────────────────────────────────── */

    id: function (prefijo) { return (prefijo || 'x') + (++contadorId) + '-' + Date.now().toString(36); },

    /* ── Números ────────────────────────────────────────────────────────── */

    limitar: function (v, min, max) { return v < min ? min : (v > max ? max : v); },

    redondear: function (v, decimales) {
      var f = Math.pow(10, decimales == null ? 2 : decimales);
      return Math.round(v * f) / f;
    },

    /* ── Colores ────────────────────────────────────────────────────────── */

    /** "#ff8800" → {r:1, g:0.533, b:0} (componentes 0..1, como pide pdf-lib) */
    hexARgb: function (hex) {
      var h = String(hex || '#000000').replace('#', '').trim();
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      var n = parseInt(h, 16);
      if (isNaN(n)) n = 0;
      return {
        r: ((n >> 16) & 255) / 255,
        g: ((n >> 8) & 255) / 255,
        b: (n & 255) / 255
      };
    },

    rgbAHex: function (r, g, b) {
      function p(v) {
        var s = Math.round(util.limitar(v, 0, 255)).toString(16);
        return s.length === 1 ? '0' + s : s;
      }
      return '#' + p(r) + p(g) + p(b);
    },

    /** Luminancia relativa aproximada (0 = negro, 255 = blanco). */
    luminancia: function (r, g, b) { return 0.299 * r + 0.587 * g + 0.114 * b; },

    /** "#ff8800" + 0.4 → "rgba(255,136,0,0.4)" */
    hexARgba: function (hex, alfa) {
      var c = util.hexARgb(hex);
      return 'rgba(' + Math.round(c.r * 255) + ',' + Math.round(c.g * 255) + ',' +
             Math.round(c.b * 255) + ',' + alfa + ')';
    },

    /* ── Archivos ───────────────────────────────────────────────────────── */

    descargar: function (bytes, nombre, tipo) {
      var blob = new Blob([bytes], { type: tipo || 'application/pdf' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = nombre;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 15000);
    },

    leerArchivo: function (archivo) {
      return new Promise(function (resolver, rechazar) {
        var fr = new FileReader();
        fr.onload = function () { resolver(new Uint8Array(fr.result)); };
        fr.onerror = function () { rechazar(new Error('No se pudo leer «' + archivo.name + '».')); };
        fr.readAsArrayBuffer(archivo);
      });
    },

    /** "informe.pdf" → "informe" */
    sinExtension: function (nombre) { return String(nombre).replace(/\.[^.]+$/, ''); },

    tamanoLegible: function (bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / 1048576).toFixed(1) + ' MB';
    },

    /* ── Varios ─────────────────────────────────────────────────────────── */

    esperar: function (ms) {
      return new Promise(function (r) { setTimeout(r, ms); });
    },

    /** Deja pasar un fotograma para que el navegador pinte. */
    respirar: function () {
      return new Promise(function (r) { requestAnimationFrame(function () { r(); }); });
    },

    aplazar: function (fn, ms) {
      var t = null;
      return function () {
        var args = arguments, self = this;
        clearTimeout(t);
        t = setTimeout(function () { fn.apply(self, args); }, ms);
      };
    },

    /** Copia profunda de datos planos (los objetos del modelo lo son). */
    clonar: function (o) { return JSON.parse(JSON.stringify(o)); }
  };

  Clarvi.util = util;
})(window);
