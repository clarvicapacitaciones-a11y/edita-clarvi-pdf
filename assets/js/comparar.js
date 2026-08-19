/* ===========================================================================
   comparar.js — enfrentar el documento abierto con otro PDF

   Se compara palabra a palabra con el algoritmo de Myers, que es rápido
   justamente cuando hay pocas diferencias, que es el caso real: dos versiones
   del mismo documento.

   Las marcas se dejan sobre el documento abierto como anotaciones normales,
   con `origen: 'comparacion'`, así se ven, se pueden quitar de golpe y se
   guardan dentro del PDF con el código que ya existe.

     · verde  — está aquí y no en el otro archivo   (añadido en esta versión)
     · roja   — está en el otro archivo y no aquí   (quitado en esta versión)
                Se marca con una barra fina en el punto donde faltaría.
   =========================================================================== */
(function (raiz) {
  'use strict';

  var Clarvi = raiz.Clarvi || (raiz.Clarvi = {});
  var util = Clarvi.util;
  var estado = Clarvi.estado;
  var anots = Clarvi.anots;
  var render = Clarvi.render;

  var VERDE = '#7ddc8f';
  var ROJO = '#ff6b6b';
  var MAX_PALABRAS = 4000;      // por encima de esto no se compara palabra a palabra

  var ultimoInforme = null;

  /* ══════════════════ Diferencias (Myers) ══════════════════ */

  /**
   * Camino de edición más corto entre dos listas.
   * Devuelve null si son demasiado distintas como para valer la pena.
   */
  function caminoEdicion(a, b) {
    var n = a.length, m = b.length;
    var max = n + m;
    if (max === 0) return [];
    if (max > MAX_PALABRAS * 2) return null;

    var off = max;
    var v = new Int32Array(2 * max + 1);
    var traza = [];

    for (var d = 0; d <= max; d++) {
      traza.push(v.slice(0));
      for (var k = -d; k <= d; k += 2) {
        var x;
        if (k === -d || (k !== d && v[off + k - 1] < v[off + k + 1])) x = v[off + k + 1];
        else x = v[off + k - 1] + 1;

        var y = x - k;
        while (x < n && y < m && a[x] === b[y]) { x++; y++; }
        v[off + k] = x;

        if (x >= n && y >= m) return reconstruir(traza, n, m, off);
      }
    }
    return null;
  }

  /** Recorre la traza hacia atrás y produce la lista de operaciones. */
  function reconstruir(traza, n, m, off) {
    var pasos = [];
    var x = n, y = m;

    for (var d = traza.length - 1; d >= 0 && (x > 0 || y > 0); d--) {
      var v = traza[d];
      var k = x - y;
      var kPrevio;

      if (k === -d || (k !== d && v[off + k - 1] < v[off + k + 1])) kPrevio = k + 1;
      else kPrevio = k - 1;

      var xIni = v[off + kPrevio];
      var yIni = xIni - kPrevio;

      while (x > xIni && y > yIni) { pasos.push({ op: 'igual', a: x - 1, b: y - 1 }); x--; y--; }

      if (d > 0) {
        if (x === xIni) { pasos.push({ op: 'pon', a: -1, b: y - 1 }); y--; }
        else { pasos.push({ op: 'quita', a: x - 1, b: -1 }); x--; }
      }
    }
    return pasos.reverse();
  }

  /* ══════════════════ Palabras con su posición ══════════════════ */

  /**
   * Reconstruye el texto de un renglón junto con la posición de cada carácter.
   * Usa la misma regla de huecos que render.js, así que el texto coincide.
   */
  function mapaDeRenglon(r) {
    var texto = '', cajas = [];

    r.items.forEach(function (it, i) {
      if (i > 0 && render.hayHueco(r, i)) {
        var prev = r.items[i - 1];
        texto += ' ';
        cajas.push({ x: prev.x + prev.ancho, ancho: Math.max(0, it.x - (prev.x + prev.ancho)) });
      }
      var largo = it.texto.length || 1;
      var anchoLetra = it.ancho / largo;
      for (var c = 0; c < it.texto.length; c++) {
        texto += it.texto[c];
        cajas.push({ x: it.x + c * anchoLetra, ancho: anchoLetra });
      }
    });

    return { texto: texto, cajas: cajas };
  }

  /** Lista de palabras de una página, cada una con su caja en puntos. */
  function palabrasDe(renglones) {
    var salida = [];

    renglones.forEach(function (r) {
      var mapa = mapaDeRenglon(r);
      var re = /\S+/g, coincidencia;

      while ((coincidencia = re.exec(mapa.texto)) !== null) {
        var ini = coincidencia.index;
        var fin = ini + coincidencia[0].length - 1;
        var c0 = mapa.cajas[ini], c1 = mapa.cajas[fin];
        if (!c0 || !c1) continue;

        salida.push({
          texto: coincidencia[0],
          x: c0.x,
          ancho: Math.max(1, (c1.x + c1.ancho) - c0.x),
          y: r.y,
          alto: r.alto
        });
      }
    });

    return salida;
  }

  /* ══════════════════ Comparación ══════════════════ */

  function quitar(silencioso) {
    var quitadas = 0;
    estado.paginas.forEach(function (p) {
      var antes = p.anots.length;
      p.anots = p.anots.filter(function (a) { return a.origen !== 'comparacion'; });
      quitadas += antes - p.anots.length;
    });
    if (quitadas && !silencioso) {
      estado.marcar('quitar comparación');
      estado.emitir('documento');
      estado.emitir('aviso', { tipo: 'ok', texto: 'Se quitaron las marcas de la comparación.' });
    }
    return quitadas;
  }

  function hayMarcas() {
    return estado.paginas.some(function (p) {
      return p.anots.some(function (a) { return a.origen === 'comparacion'; });
    });
  }

  /** Marca en la página lo que cambia respecto de las palabras `otras`. */
  function marcarPagina(pag, aquí, otras) {
    var pasos = caminoEdicion(
      aquí.map(function (p) { return p.texto; }),
      otras.map(function (p) { return p.texto; })
    );

    if (pasos === null) {
      return { desbordado: true, anadidas: 0, quitadas: 0, textoQuitado: [] };
    }

    var anadidas = 0, quitadas = 0, textoQuitado = [];
    var pendientes = [];      // palabras seguidas que sólo están aquí

    function volcar() {
      if (!pendientes.length) return;
      var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      var mismaLinea = pendientes.every(function (p) { return p.y === pendientes[0].y; });

      if (mismaLinea) {
        pendientes.forEach(function (p) {
          x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x + p.ancho);
          y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y + p.alto);
        });
        pag.anots.push(anots.nueva('resaltado', {
          x: x0 - 0.5, y: y0, w: (x1 - x0) + 1, h: y1 - y0,
          relleno: VERDE, opacidad: 0.5, origen: 'comparacion'
        }));
      } else {
        // Palabras repartidas en varias líneas: una marca por palabra.
        pendientes.forEach(function (p) {
          pag.anots.push(anots.nueva('resaltado', {
            x: p.x - 0.5, y: p.y, w: p.ancho + 1, h: p.alto,
            relleno: VERDE, opacidad: 0.5, origen: 'comparacion'
          }));
        });
      }
      pendientes = [];
    }

    for (var i = 0; i < pasos.length; i++) {
      var paso = pasos[i];

      if (paso.op === 'quita') {                 // sólo está aquí → verde
        pendientes.push(aquí[paso.a]);
        anadidas++;
        continue;
      }

      volcar();

      if (paso.op === 'pon') {                   // falta aquí → barra roja
        textoQuitado.push(otras[paso.b].texto);
        quitadas++;

        // Se busca dónde encajaría: junto a la palabra anterior de esta página.
        var anclaje = null;
        for (var j = i - 1; j >= 0; j--) {
          if (pasos[j].a >= 0) { anclaje = aquí[pasos[j].a]; break; }
        }
        if (!anclaje) {
          for (var k = i + 1; k < pasos.length; k++) {
            if (pasos[k].a >= 0) { anclaje = aquí[pasos[k].a]; break; }
          }
        }
        if (!anclaje) continue;

        var yaMarcado = pag.anots.some(function (a) {
          return a.origen === 'comparacion' && a.esBarra &&
                 Math.abs(a.x - (anclaje.x + anclaje.ancho)) < 0.6 &&
                 Math.abs(a.y - anclaje.y) < 0.6;
        });
        if (yaMarcado) continue;

        pag.anots.push(anots.nueva('tapar', {
          x: anclaje.x + anclaje.ancho, y: anclaje.y,
          w: 1.8, h: anclaje.alto,
          relleno: ROJO, origen: 'comparacion', esBarra: true
        }));
      }
    }
    volcar();

    return { desbordado: false, anadidas: anadidas, quitadas: quitadas, textoQuitado: textoQuitado };
  }

  /** Compara el documento abierto con el PDF elegido. */
  function comparar(archivo) {
    if (!estado.hayDocumento()) return Promise.reject(new Error('Abre antes un PDF.'));

    estado.emitir('progreso', 'Leyendo «' + archivo.name + '»…');

    return util.leerArchivo(archivo)
      // Se abre suelto: el archivo con el que se compara NO pasa a formar
      // parte del documento, sólo se lee.
      .then(function (bytes) { return Clarvi.docs.abrirSuelto(bytes, archivo.name); })
      .then(function (otroDoc) {
        estado.emitir('progreso', 'Comparando…');
        quitar(true);

        var comunes = Math.min(estado.paginas.length, otroDoc.numPages);
        var informe = {
          nombre: archivo.name,
          paginasAqui: estado.paginas.length,
          paginasAlla: otroDoc.numPages,
          paginas: [],
          sinTexto: 0,        // ninguno de los dos tiene texto
          sinTextoAqui: 0,    // este documento no tiene texto en esa página
          sinTextoAlla: 0     // el otro archivo no lo tiene
        };

        var cadena = Promise.resolve();
        for (var i = 0; i < comunes; i++) {
          (function (indice) {
            cadena = cadena.then(function () {
              var pag = estado.paginas[indice];
              return Promise.all([
                render.textoDePagina(pag),
                otroDoc.getPage(indice + 1).then(render.extraerRenglones)
              ]).then(function (par) {
                var aquí = palabrasDe(par[0].renglones);
                var otras = palabrasDe(par[1].renglones);

                // Si a un lado no le queda texto, comparar no tiene sentido:
                // marcarlo todo como diferente sería engañoso. Se informa y ya.
                if (!aquí.length || !otras.length) {
                  if (!aquí.length && !otras.length) informe.sinTexto++;
                  else if (!aquí.length) informe.sinTextoAqui++;
                  else informe.sinTextoAlla++;

                  informe.paginas.push({
                    n: indice + 1, anadidas: 0, quitadas: 0, textoQuitado: [],
                    vacia: true,
                    palabrasAqui: aquí.length, palabrasAlla: otras.length
                  });
                  return;
                }

                var r = marcarPagina(pag, aquí, otras);
                informe.paginas.push({
                  n: indice + 1,
                  anadidas: r.anadidas, quitadas: r.quitadas,
                  textoQuitado: r.textoQuitado,
                  desbordado: r.desbordado,
                  vacia: false,
                  palabrasAqui: aquí.length, palabrasAlla: otras.length
                });
              });
            });
          })(i);
        }

        return cadena.then(function () {
          informe.totalAnadidas = informe.paginas.reduce(function (n, p) { return n + p.anadidas; }, 0);
          informe.totalQuitadas = informe.paginas.reduce(function (n, p) { return n + p.quitadas; }, 0);
          informe.cambiadas = informe.paginas.filter(function (p) { return p.anadidas || p.quitadas; }).length;
          informe.comparables = informe.paginas.filter(function (p) { return !p.vacia; }).length;

          estado.marcar('comparar');
          estado.emitir('documento');
          ultimoInforme = informe;
          otroDoc.destroy();
          return informe;
        });
      });
  }

  /* ══════════════════ Interfaz ══════════════════ */

  var dlg = {};

  function iniciar() {
    dlg.modal = util.$('#modalComparar');
    if (!dlg.modal) return;
    dlg.cuerpo = util.$('#compCuerpo');
    dlg.quitar = util.$('#btnQuitarComparacion');

    util.$('#btnCerrarComparar').addEventListener('click', cerrar);
    dlg.modal.addEventListener('click', function (ev) { if (ev.target === dlg.modal) cerrar(); });
    dlg.quitar.addEventListener('click', function () { quitar(); cerrar(); });
  }

  /** Aviso de que los dos documentos no tienen las mismas páginas. */
  function avisoPaginas(informe) {
    if (informe.paginasAqui === informe.paginasAlla) return null;
    var av = util.crear('div', 'aviso-props');
    av.innerHTML = '<b>Ojo:</b> este documento tiene ' + informe.paginasAqui +
      ' página(s) y el otro ' + informe.paginasAlla +
      '. Sólo se miraron las ' + informe.paginas.length + ' primeras.';
    return av;
  }

  function mostrarInforme(informe) {
    var c = dlg.cuerpo;
    util.vaciar(c);

    var resumen = util.crear('div', 'aviso-props');
    if (!informe.comparables) {
      // No hubo ni una sola página con texto a ambos lados.
      var culpable = informe.sinTextoAlla >= informe.sinTextoAqui
        ? '«' + informe.nombre + '»' : 'este documento';
      resumen.innerHTML =
        '<b>No se pudo comparar.</b> ' + culpable + ' no tiene texto: lo más ' +
        'probable es que sea un PDF escaneado, es decir, imágenes de las hojas. ' +
        'La comparación funciona sobre el texto, así que no hay palabras que enfrentar. ' +
        'No se marcó nada en el documento.';
      c.appendChild(resumen);
      var extra = avisoPaginas(informe);
      if (extra) c.appendChild(extra);
      dlg.quitar.hidden = !hayMarcas();
      dlg.modal.hidden = false;
      return;
    }
    if (!informe.totalAnadidas && !informe.totalQuitadas) {
      resumen.innerHTML = 'No se encontró ninguna diferencia de texto con <b>' +
                          informe.nombre + '</b>.';
    } else {
      resumen.innerHTML =
        'Comparado con <b>' + informe.nombre + '</b>:<br>' +
        '<span class="marca-verde"></span> ' + informe.totalAnadidas +
        ' palabra(s) que sólo están aquí &nbsp; ' +
        '<span class="marca-roja"></span> ' + informe.totalQuitadas +
        ' que sólo están en el otro archivo.<br>' +
        'Cambios en ' + informe.cambiadas + ' de ' + informe.comparables + ' páginas comparadas.';
    }
    c.appendChild(resumen);

    var avPag = avisoPaginas(informe);
    if (avPag) c.appendChild(avPag);

    var saltadas = informe.sinTexto + informe.sinTextoAqui + informe.sinTextoAlla;
    if (saltadas) {
      var av2 = util.crear('div', 'aviso-props');
      av2.innerHTML = '<b>' + saltadas + ' página(s) sin comparar</b> porque a uno de los ' +
        'dos lados no le queda texto. Si el PDF está escaneado son imágenes, y no hay ' +
        'palabras que enfrentar; esas páginas se dejaron sin marcar.';
      c.appendChild(av2);
    }

    var conCambios = informe.paginas.filter(function (p) {
      return p.anadidas || p.quitadas || p.desbordado;
    });

    if (conCambios.length) {
      var tabla = util.crear('table', 'tabla-comp');
      tabla.innerHTML = '<thead><tr><th>Pág.</th><th>Sólo aquí</th>' +
                        '<th>Sólo allá</th><th>Texto que falta aquí</th></tr></thead>';
      var cuerpo = document.createElement('tbody');

      conCambios.forEach(function (p) {
        var fila = document.createElement('tr');
        var quitado = p.desbordado
          ? '<i>demasiado distintas para detallarlo</i>'
          : (p.textoQuitado.slice(0, 14).join(' ') +
             (p.textoQuitado.length > 14 ? ' …' : '') || '—');
        fila.innerHTML =
          '<td>' + p.n + '</td>' +
          '<td class="num verde">' + (p.anadidas || '—') + '</td>' +
          '<td class="num rojo">' + (p.quitadas || '—') + '</td>' +
          '<td class="frag">' + quitado + '</td>';
        cuerpo.appendChild(fila);
      });

      tabla.appendChild(cuerpo);
      c.appendChild(tabla);
    }

    dlg.quitar.hidden = !hayMarcas();
    dlg.modal.hidden = false;
  }

  function cerrar() { dlg.modal.hidden = true; }

  Clarvi.comparar = {
    iniciar: iniciar,
    comparar: comparar,
    mostrarInforme: mostrarInforme,
    cerrar: cerrar,
    quitar: quitar,
    hayMarcas: hayMarcas,
    informe: function () { return ultimoInforme; },
    // se exponen para las pruebas
    caminoEdicion: caminoEdicion,
    palabrasDe: palabrasDe
  };
})(window);
