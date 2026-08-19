/* ===========================================================================
   documentos.js — abrir PDF, unirlos y manipular páginas
   =========================================================================== */
(function (raiz) {
  'use strict';

  var Clarvi = raiz.Clarvi || (raiz.Clarvi = {});
  var util = Clarvi.util;
  var estado = Clarvi.estado;

  var pdfjsLib = raiz.pdfjsLib;

  function normalizarGiro(g) { return ((Math.round((g || 0) / 90) * 90) % 360 + 360) % 360; }

  /* ── Abrir un PDF con pdf.js ────────────────────────────────────────── */

  function opcionesPdfjs(bytes, contrasena) {
    var ent = raiz.CLARVI_ENTORNO || {};
    var o = {
      // pdf.js puede quedarse con el búfer, así que se le pasa una copia:
      // los bytes originales hacen falta después para escribir el PDF final.
      data: bytes.slice(0),
      isEvalSupported: false,
      disableAutoFetch: true
    };
    if (ent.cMapUrl) { o.cMapUrl = ent.cMapUrl; o.cMapPacked = true; }
    if (ent.fuentesUrl) { o.standardFontDataUrl = ent.fuentesUrl; }

    // Con doble clic (file://) el navegador no deja descargar nada, así que los
    // datos llegan por otra vía. Sin esto, los PDF cuyas fuentes no van
    // incrustadas salen con el texto ilegible.
    if (ent.fabricaFuentes) o.StandardFontDataFactory = ent.fabricaFuentes;
    if (ent.fabricaCMaps) { o.CMapReaderFactory = ent.fabricaCMaps; o.cMapPacked = true; }
    if (contrasena) o.password = contrasena;

    // Cuando el usuario prefiere ver el documento igual en todos los equipos,
    // se le dice a pdf.js que no eche mano de las tipografías instaladas.
    if (Clarvi.fuentes && !Clarvi.fuentes.usarFuentesDelSistema()) {
      o.useSystemFonts = false;
    }
    return o;
  }

  function abrirConPdfjs(bytes, nombre) {
    function intentar(contrasena, intentosPrevios) {
      return pdfjsLib.getDocument(opcionesPdfjs(bytes, contrasena)).promise
        .catch(function (err) {
          var esClave = err && (err.name === 'PasswordException' ||
                                /password/i.test(err.message || ''));
          if (esClave && intentosPrevios < 3) {
            var clave = raiz.prompt(
              'El archivo «' + nombre + '» está protegido.\nEscribe la contraseña:');
            if (clave == null) throw new Error('Se canceló la apertura de «' + nombre + '».');
            return intentar(clave, intentosPrevios + 1);
          }
          throw err;
        });
    }
    return intentar(null, 0);
  }

  /** Carga un PDF y devuelve la fuente registrada en el estado. */
  function cargarPdf(bytes, nombre) {
    return abrirConPdfjs(bytes, nombre).then(function (doc) {
      var fuente = {
        id: util.id('f'),
        nombre: nombre,
        bytes: bytes,
        doc: doc,
        numPaginas: doc.numPages,
        docPdfLib: null            // se carga sólo al exportar
      };
      estado.fuentes.set(fuente.id, fuente);
      return fuente;
    });
  }

  /** Lee los datos de una página original y crea la entrada del documento. */
  function crearPagina(fuente, indice) {
    return fuente.doc.getPage(indice + 1).then(function (pag) {
      var vp = pag.getViewport({ scale: 1, rotation: 0 });
      return {
        id: util.id('p'),
        fuenteId: fuente.id,
        indice: indice,
        giro: 0,
        giroBase: normalizarGiro(pag.rotate),
        ancho: vp.width,
        alto: vp.height,
        vista: pag.view.slice(0),
        anots: []
      };
    });
  }

  function paginasDe(fuente) {
    var tareas = [];
    for (var i = 0; i < fuente.numPaginas; i++) tareas.push(crearPagina(fuente, i));
    return Promise.all(tareas);
  }

  /* ── Abrir archivos elegidos por el usuario ─────────────────────────── */

  /**
   * @param archivos  FileList o array de File
   * @param anadir    true = unir al final; false = empezar de cero
   */
  function abrirArchivos(archivos, anadir) {
    var lista = Array.prototype.slice.call(archivos).filter(function (a) {
      return /\.pdf$/i.test(a.name) || a.type === 'application/pdf';
    });

    if (!lista.length) {
      return Promise.reject(new Error('No se encontró ningún PDF entre los archivos elegidos.'));
    }

    if (!anadir) {
      estado.fuentes.clear();
      estado.paginas = [];
      estado.paginasSel.clear();
      estado.seleccion = null;
      estado.paginaActual = 0;
    }

    var nuevas = [];
    var errores = [];

    var cadena = lista.reduce(function (previo, archivo) {
      return previo.then(function () {
        estado.emitir('progreso', 'Leyendo «' + archivo.name + '»…');
        return util.leerArchivo(archivo)
          .then(function (bytes) { return cargarPdf(bytes, archivo.name); })
          .then(paginasDe)
          .then(function (pags) { nuevas = nuevas.concat(pags); })
          .catch(function (err) {
            errores.push(archivo.name + ': ' + (err.message || 'no se pudo abrir'));
          });
      });
    }, Promise.resolve());

    return cadena.then(function () {
      if (!nuevas.length) {
        throw new Error(errores.length ? errores.join(' · ') : 'No se pudo abrir ningún archivo.');
      }
      estado.paginas = estado.paginas.concat(nuevas);
      // Al abrir se empieza de cero; al unir se conserva el historial para
      // que el usuario pueda deshacer la unión.
      if (anadir) estado.marcar('unir'); else estado.reiniciarHistorial();
      estado.emitir('documento');
      return { anadidas: nuevas.length, errores: errores };
    });
  }

  /* ── Operaciones sobre páginas ──────────────────────────────────────── */

  function idsOrdenados(ids) {
    return estado.paginas
      .map(function (p, i) { return { id: p.id, i: i }; })
      .filter(function (o) { return ids.indexOf(o.id) >= 0; })
      .map(function (o) { return o.id; });
  }

  function girar(ids, grados) {
    if (!ids.length) return;
    ids.forEach(function (id) {
      var p = estado.pagina(id);
      if (p) p.giro = normalizarGiro(p.giro + grados);
    });
    estado.marcar('girar');
    estado.emitir('documento');
  }

  function duplicar(ids) {
    if (!ids.length) return;
    var orden = idsOrdenados(ids);
    // Se recorre al revés para que los índices no se desplacen al insertar.
    for (var i = orden.length - 1; i >= 0; i--) {
      var idx = estado.indiceDe(orden[i]);
      if (idx < 0) continue;
      var copia = util.clonar(estado.paginas[idx]);
      copia.id = util.id('p');
      copia.anots.forEach(function (a) { a.id = util.id('a'); });
      estado.paginas.splice(idx + 1, 0, copia);
    }
    estado.marcar('duplicar');
    estado.emitir('documento');
  }

  function eliminar(ids) {
    if (!ids.length) return false;
    if (ids.length >= estado.paginas.length) return false;   // no dejar el PDF vacío

    estado.paginas = estado.paginas.filter(function (p) { return ids.indexOf(p.id) < 0; });
    ids.forEach(function (id) { estado.paginasSel.delete(id); });
    if (estado.seleccion && ids.indexOf(estado.seleccion.paginaId) >= 0) estado.seleccion = null;
    if (estado.paginaActual >= estado.paginas.length) estado.paginaActual = estado.paginas.length - 1;

    estado.marcar('eliminar');
    estado.emitir('documento');
    return true;
  }

  /** Mueve la página `id` para que quede en la posición `destino`. */
  function reordenar(id, destino) {
    var desde = estado.indiceDe(id);
    if (desde < 0) return;
    var p = estado.paginas.splice(desde, 1)[0];
    if (destino > desde) destino--;
    destino = util.limitar(destino, 0, estado.paginas.length);
    estado.paginas.splice(destino, 0, p);
    estado.marcar('reordenar');
    estado.emitir('documento');
  }

  /**
   * Vuelve a leer los PDF ya abiertos con las opciones actuales, conservando
   * las páginas y todo lo que el usuario haya dibujado encima. Se usa al
   * cambiar de dónde salen las tipografías.
   */
  function releerFuentes() {
    var tareas = [];

    estado.fuentes.forEach(function (fuente) {
      tareas.push(
        abrirConPdfjs(fuente.bytes, fuente.nombre).then(function (doc) {
          try { fuente.doc.destroy(); } catch (e) { /* ya estaba cerrado */ }
          fuente.doc = doc;
        })
      );
    });

    return Promise.all(tareas).then(function () {
      Clarvi.render.olvidarLoPintado();
      estado.emitir('documento');
    });
  }

  /* ── Operaciones por documento de origen ────────────────────────────── */

  /** Páginas que vienen de un archivo, en el orden en que están ahora. */
  function paginasDeFuente(fuenteId) {
    return estado.paginas.filter(function (p) { return p.fuenteId === fuenteId; });
  }

  /**
   * Los archivos abiertos, ordenados por dónde aparece su primera página.
   * `contiguo` avisa de si sus páginas siguen juntas o el usuario ya las ha
   * entremezclado con las de otro archivo: en ese segundo caso, moverlo las
   * volverá a agrupar, y conviene que se sepa de antemano.
   */
  function documentosEnOrden() {
    var vistos = [];
    var porId = new Map();

    estado.paginas.forEach(function (p, i) {
      var d = porId.get(p.fuenteId);
      if (!d) {
        d = { fuenteId: p.fuenteId, fuente: estado.fuentes.get(p.fuenteId),
              primera: i, ultima: i, paginas: 0 };
        porId.set(p.fuenteId, d);
        vistos.push(d);
      }
      d.ultima = i;
      d.paginas++;
    });

    vistos.forEach(function (d) {
      d.contiguo = (d.ultima - d.primera + 1) === d.paginas;
    });
    return vistos;
  }

  /**
   * Mueve TODAS las páginas de un archivo, en bloque y conservando su orden
   * relativo, hasta donde está otro archivo.
   */
  function reordenarDocumento(fuenteId, fuenteDestino, antes) {
    if (fuenteId === fuenteDestino) return false;

    var bloque = paginasDeFuente(fuenteId);
    if (!bloque.length) return false;

    var resto = estado.paginas.filter(function (p) { return p.fuenteId !== fuenteId; });

    // Se busca dónde empieza (o acaba) el archivo de destino dentro del resto.
    var destino = resto.length;
    for (var i = 0; i < resto.length; i++) {
      if (resto[i].fuenteId === fuenteDestino) {
        if (antes) { destino = i; break; }
        destino = i + 1;               // sigue avanzando hasta su última página
      }
    }

    estado.paginas = resto.slice(0, destino).concat(bloque, resto.slice(destino));
    estado.marcar('ordenar documentos');
    estado.emitir('documento');
    return true;
  }

  /** Quita del documento todas las páginas que venían de un archivo. */
  function eliminarDocumento(fuenteId) {
    var ids = paginasDeFuente(fuenteId).map(function (p) { return p.id; });
    if (!ids.length) return false;
    if (ids.length >= estado.paginas.length) return false;   // no dejarlo vacío
    return eliminar(ids);
  }

  /** Nombre sugerido para el archivo de salida. */
  function nombreSalida(sufijo) {
    var primera = estado.paginas[0];
    var base = 'documento';
    if (primera) {
      var f = estado.fuenteDe(primera);
      if (f) base = util.sinExtension(f.nombre);
    }
    var varias = estado.fuentes.size > 1;
    if (varias && sufijo === '-editado') return 'documento-unido.pdf';
    return base + (sufijo || '') + '.pdf';
  }

  Clarvi.docs = {
    /** Abre un PDF con pdf.js sin registrarlo como parte del documento.
        Lo usa la comparación, que sólo necesita leer el otro archivo. */
    abrirSuelto: abrirConPdfjs,
    cargarPdf: cargarPdf,
    paginasDe: paginasDe,
    abrirArchivos: abrirArchivos,
    girar: girar,
    duplicar: duplicar,
    eliminar: eliminar,
    reordenar: reordenar,
    releerFuentes: releerFuentes,
    paginasDeFuente: paginasDeFuente,
    documentosEnOrden: documentosEnOrden,
    reordenarDocumento: reordenarDocumento,
    eliminarDocumento: eliminarDocumento,
    normalizarGiro: normalizarGiro,
    nombreSalida: nombreSalida
  };
})(window);
