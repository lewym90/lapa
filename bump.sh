#!/bin/bash
# Użycie: ./bump.sh 1.1.0  – ustawia numer wersji w całej aplikacji
set -e; v="$1"; [[ "$v" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "podaj wersję, np. 1.1.0"; exit 1; }
cd "$(dirname "$0")"
sed -i "s/^export const VERSION = .*/export const VERSION = '$v';/" js/config.js
sed -i "s/^const VERSION = .*/const VERSION = 'lapa-v$v';/" sw.js
echo "{\"version\":\"$v\"}" > version.json
echo "Wersja $v ustawiona."
