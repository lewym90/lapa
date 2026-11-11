#!/bin/bash
# Aktualizacja serwera ŁAPY (kod, bez zmiany haseł i danych). Uruchom na serwerze jako root:
#   bash <(curl -fsSL https://raw.githubusercontent.com/lewym90/lapa/main/server/aktualizuj.sh)
set -euo pipefail
APP=/opt/lapa; RAW="https://raw.githubusercontent.com/lewym90/lapa/main/server"
cd "$APP"
cp lapa-server.mjs lapa-server.mjs.bak
curl -fsSL "$RAW/lapa-server.mjs" -o lapa-server.mjs.new
LAPA_NO_LISTEN=1 DB_FILE=/tmp/lapa-check.db PASS_VOLUNTEER_HASH=scrypt\$16384\$aa\$bb PASS_COORDINATOR_HASH=scrypt\$16384\$aa\$cc "$APP/node/bin/node" --disable-warning=ExperimentalWarning --check lapa-server.mjs.new
mv lapa-server.mjs.new lapa-server.mjs
systemctl restart lapa
sleep 2
if curl -fsS -m 5 http://127.0.0.1:8797/health >/dev/null; then echo "GOTOWE: serwer ŁAPY zaktualizowany i działa."; rm -f lapa-server.mjs.bak
else echo "BŁĄD: przywracam poprzednią wersję"; mv lapa-server.mjs.bak lapa-server.mjs; systemctl restart lapa; exit 1; fi
