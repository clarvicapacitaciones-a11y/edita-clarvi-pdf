/* Servidor local mínimo para el Editor PDF Clarvi (alternativa a servidor.py).
   No instala nada ni sale a internet: sólo sirve esta carpeta en 127.0.0.1. */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const RAIZ = __dirname;
const PUERTO_INICIAL = 8756;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.bcmap': 'application/octet-stream',
  '.pfb': 'application/octet-stream',
  '.ttf': 'font/ttf'
};

const servidor = http.createServer((req, res) => {
  let ruta = decodeURIComponent(req.url.split('?')[0]);
  if (ruta === '/') ruta = '/index.html';

  const destino = path.join(RAIZ, path.normalize(ruta));
  if (!destino.startsWith(RAIZ)) { res.writeHead(403).end('Prohibido'); return; }

  fs.readFile(destino, (err, datos) => {
    if (err) { res.writeHead(404).end('No encontrado'); return; }
    res.writeHead(200, {
      'Content-Type': TIPOS[path.extname(destino).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(datos);
  });
});

function abrirNavegador(url) {
  const orden = process.platform === 'win32' ? `start "" "${url}"`
              : process.platform === 'darwin' ? `open "${url}"`
              : `xdg-open "${url}"`;
  exec(orden, () => {});
}

function escuchar(puerto, intentos) {
  servidor.once('error', (e) => {
    if (e.code === 'EADDRINUSE' && intentos > 0) escuchar(puerto + 1, intentos - 1);
    else { console.error('No se pudo iniciar el servidor:', e.message); process.exit(1); }
  });
  servidor.listen(puerto, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${puerto}/index.html`;
    console.log('');
    console.log('  Editor PDF Clarvi');
    console.log('  -----------------');
    console.log('  Abierto en: ' + url);
    console.log('  Deja esta ventana abierta mientras lo uses.');
    console.log('  Para cerrarlo: Ctrl+C');
    console.log('');
    setTimeout(() => abrirNavegador(url), 500);
  });
}

escuchar(PUERTO_INICIAL, 30);
