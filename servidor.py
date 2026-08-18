#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Servidor local mínimo para el Editor PDF Clarvi.

No instala nada ni sale a internet: sólo sirve los archivos de esta carpeta
en 127.0.0.1 para que el navegador pueda usar el worker de pdf.js y las
fuentes estándar. Ciérralo con Ctrl+C cuando termines.
"""
import http.server
import os
import socketserver
import sys
import threading
import webbrowser

PUERTO_INICIAL = 8756
RAIZ = os.path.dirname(os.path.abspath(__file__))


class Manejador(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=RAIZ, **kwargs)

    def log_message(self, formato, *args):
        pass  # sin ruido en la consola

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


def main():
    puerto = PUERTO_INICIAL
    servidor = None
    for _ in range(30):
        try:
            socketserver.TCPServer.allow_reuse_address = True
            servidor = socketserver.TCPServer(('127.0.0.1', puerto), Manejador)
            break
        except OSError:
            puerto += 1

    if servidor is None:
        print('No se encontró ningún puerto libre. Abre index.html directamente.')
        return 1

    url = 'http://127.0.0.1:%d/index.html' % puerto
    print('')
    print('  Editor PDF Clarvi')
    print('  -----------------')
    print('  Abierto en: %s' % url)
    print('  Deja esta ventana abierta mientras lo uses.')
    print('  Para cerrarlo: Ctrl+C')
    print('')

    threading.Timer(0.7, lambda: webbrowser.open(url)).start()
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print('\n  Servidor detenido. ¡Hasta luego!')
    finally:
        servidor.server_close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
