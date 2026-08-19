/* ===========================================================================
   fuentes.js — por qué un mismo PDF se ve distinto en cada equipo

   Muchos PDF administrativos NO llevan sus tipografías dentro del archivo:
   sólo apuntan «usa Courier New». Entonces cada equipo la resuelve como puede,
   según lo que tenga instalado, y de ahí que a una persona le salga bien y a
   otra le salga un churro de acentos.

   Aquí se ofrecen dos cosas:
     · un diagnóstico que dice, fuente por fuente, qué está pasando;
     · un interruptor para usar SÓLO las tipografías que trae el programa, con
       lo que el documento se ve igual en todos los equipos.
   =========================================================================== */
(function (raiz) {
  'use strict';

  var Clarvi = raiz.Clarvi || (raiz.Clarvi = {});
  var util = Clarvi.util;
  var estado = Clarvi.estado;

  var CLAVE = 'clarvi.fuentesSistema';

  /* ── Ajuste ─────────────────────────────────────────────────────────── */

  function usarFuentesDelSistema() {
    try {
      var v = raiz.localStorage.getItem(CLAVE);
      return v === null ? true : v === '1';
    } catch (e) { return true; }
  }

  function guardarAjuste(valor) {
    try { raiz.localStorage.setItem(CLAVE, valor ? '1' : '0'); } catch (e) { /* nada */ }
  }

  /* ── Diagnóstico ────────────────────────────────────────────────────── */

  /** Lista las tipografías que usa una página y cómo las ha resuelto pdf.js. */
  function analizarPagina(pag) {
    var fuente = estado.fuenteDe(pag);
    if (!fuente) return Promise.resolve([]);

    return fuente.doc.getPage(pag.indice + 1).then(function (pagPdf) {
      // Hace falta el render para que pdf.js haya preparado las tipografías.
      return pagPdf.getOperatorList().then(function () {
        return pagPdf.getTextContent();
      }).then(function (tc) {
        var claves = [];
        tc.items.forEach(function (i) {
          if (i.fontName && claves.indexOf(i.fontName) < 0) claves.push(i.fontName);
        });

        return claves.map(function (clave) {
          var d = null;
          try { if (pagPdf.commonObjs.has(clave)) d = pagPdf.commonObjs.get(clave); }
          catch (e) { /* aún no está lista */ }

          var estilo = tc.styles[clave] || {};
          if (!d) {
            return { nombre: clave, incrustada: null, sistema: null,
                     familia: estilo.fontFamily || '', desconocida: true };
          }
          return {
            nombre: (d.name || clave).replace(/^[A-Z]{6}\+/, ''),
            incrustada: d.missingFile !== true,
            sistema: d.systemFontInfo ? (d.systemFontInfo.css || d.systemFontInfo.baseFontName || 'sí') : null,
            familia: estilo.fontFamily || d.fallbackName || '',
            desconocida: false
          };
        });
      });
    }).catch(function () { return []; });
  }

  /** Junta el análisis de las primeras páginas, que es representativo. */
  function analizar(maxPaginas) {
    var limite = Math.min(maxPaginas || 3, estado.paginas.length);
    var vistas = {};
    var cadena = Promise.resolve();

    for (var i = 0; i < limite; i++) {
      (function (indice) {
        cadena = cadena.then(function () {
          return analizarPagina(estado.paginas[indice]).then(function (lista) {
            lista.forEach(function (f) {
              var previa = vistas[f.nombre];
              // Se queda con la información más completa de todas las páginas.
              if (!previa || (previa.desconocida && !f.desconocida)) vistas[f.nombre] = f;
            });
          });
        });
      })(i);
    }

    return cadena.then(function () {
      return Object.keys(vistas).map(function (k) { return vistas[k]; });
    });
  }

  /* ── Interfaz ───────────────────────────────────────────────────────── */

  var dlg = {};

  function iniciar() {
    dlg.casilla = util.$('#fuentesPropias');
    dlg.tabla = util.$('#tablaFuentes');
    dlg.boton = util.$('#btnVerFuentes');
    if (!dlg.casilla) return;

    dlg.casilla.checked = !usarFuentesDelSistema();
    dlg.casilla.addEventListener('change', function () {
      guardarAjuste(!dlg.casilla.checked);
      if (!estado.hayDocumento()) {
        estado.emitir('aviso', { tipo: 'ok', texto: 'Se aplicará al abrir el siguiente PDF.' });
        return;
      }
      estado.emitir('progreso', 'Volviendo a leer las tipografías…');
      Clarvi.docs.releerFuentes().then(function () {
        estado.emitir('aviso', {
          tipo: 'ok',
          texto: dlg.casilla.checked
            ? 'Ahora se usan sólo las tipografías del programa: el documento se verá igual en cualquier equipo.'
            : 'Vuelven a usarse las tipografías instaladas en este equipo.'
        });
        if (!util.$('#tablaFuentes').hidden) mostrarTabla();
      }).catch(function (err) {
        estado.emitir('aviso', { tipo: 'error', texto: 'No se pudo recargar: ' + (err.message || err) });
      });
    });

    dlg.boton.addEventListener('click', function () {
      if (!dlg.tabla.hidden) { dlg.tabla.hidden = true; return; }
      mostrarTabla();
    });
  }

  function mostrarTabla() {
    if (!estado.hayDocumento()) {
      dlg.tabla.hidden = false;
      dlg.tabla.innerHTML = '<p class="aviso-props">Abre primero un PDF.</p>';
      return;
    }

    dlg.tabla.hidden = false;
    dlg.tabla.innerHTML = '<p class="aviso-props">Mirando las tipografías…</p>';

    analizar(3).then(function (lista) {
      if (!lista.length) {
        dlg.tabla.innerHTML = '<p class="aviso-props">Este PDF no tiene texto: ' +
          'si está escaneado, sus páginas son imágenes y no hay tipografías que mirar.</p>';
        return;
      }

      var sinIncrustar = lista.filter(function (f) { return f.incrustada === false; });

      var html = '<table class="tabla-comp"><thead><tr>' +
        '<th>Tipografía</th><th>¿Va dentro del PDF?</th><th>De dónde sale</th>' +
        '</tr></thead><tbody>';

      lista.forEach(function (f) {
        var dentro = f.desconocida ? '<span class="dud">no se sabe</span>'
                   : f.incrustada ? '<span class="ok">sí</span>'
                                  : '<span class="mal">no</span>';
        var origen = f.incrustada ? 'del propio archivo'
                   : f.sistema ? 'de este equipo: <b>' + f.sistema + '</b>'
                               : 'sustituida por el programa';
        html += '<tr><td>' + f.nombre + '</td><td>' + dentro + '</td><td>' + origen + '</td></tr>';
      });
      html += '</tbody></table>';

      if (sinIncrustar.length) {
        html += '<p class="aviso-props peligro"><b>Ojo:</b> ' + sinIncrustar.length +
          ' tipografía(s) no van dentro del archivo. Eso es lo que hace que el mismo ' +
          'PDF se vea distinto en cada equipo, según lo que tenga instalado. ' +
          'Marca la casilla de arriba y todos verán lo mismo.</p>';
      } else {
        html += '<p class="aviso-props">Todas las tipografías van dentro del archivo, ' +
          'así que este PDF se ve igual en cualquier equipo.</p>';
      }

      dlg.tabla.innerHTML = html;
    }).catch(function (err) {
      dlg.tabla.innerHTML = '<p class="aviso-props peligro">No se pudo revisar: ' +
        (err.message || err) + '</p>';
    });
  }

  Clarvi.fuentes = {
    iniciar: iniciar,
    usarFuentesDelSistema: usarFuentesDelSistema,
    analizar: analizar,
    mostrarTabla: mostrarTabla
  };
})(window);
