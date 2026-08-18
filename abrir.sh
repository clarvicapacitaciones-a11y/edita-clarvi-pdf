#!/usr/bin/env bash
# Abre el Editor PDF Clarvi. No instala nada.
cd "$(dirname "$0")" || exit 1

echo
echo "  Editor PDF Clarvi"
echo "  -----------------"
echo

if command -v python3 >/dev/null 2>&1; then
  echo "  Iniciando con Python..."
  exec python3 servidor.py
fi

if command -v node >/dev/null 2>&1; then
  echo "  Iniciando con Node..."
  exec node servidor.js
fi

echo "  No hay Python ni Node en este equipo."
echo "  Se abrira el editor directamente en el navegador."
echo

if command -v open >/dev/null 2>&1; then open index.html
elif command -v xdg-open >/dev/null 2>&1; then xdg-open index.html
else echo "  Abre a mano el archivo index.html con tu navegador."; fi
