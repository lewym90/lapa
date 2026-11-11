#!/bin/bash
# Aktualizacja serwera ŁAPY (kod, bez zmiany haseł i danych). Uruchom na serwerze jako root:
#   bash <(curl -fsSL https://raw.githubusercontent.com/lewym90/lapa/main/server/aktualizuj.sh)
set -euo pipefail
APP=/opt/lapa; REF="${LAPA_REF:-main}"; RAW="https://raw.githubusercontent.com/lewym90/lapa/$REF/server"; JS="https://raw.githubusercontent.com/lewym90/lapa/$REF/js"
cd "$APP"
cp lapa-server.mjs lapa-server.mjs.bak
[ -f dogmerge.mjs ] && cp dogmerge.mjs dogmerge.mjs.bak || true
curl -fsSL "$JS/dogmerge.js" -o dogmerge.new.mjs
"$APP/node/bin/node" --check dogmerge.new.mjs
mv dogmerge.new.mjs dogmerge.mjs
curl -fsSL "$RAW/lapa-server.mjs" -o lapa-server.new.mjs
LAPA_NO_LISTEN=1 DB_FILE=/tmp/lapa-check.db PASS_VOLUNTEER_HASH=scrypt\$16384\$aa\$bb PASS_COORDINATOR_HASH=scrypt\$16384\$aa\$cc "$APP/node/bin/node" --disable-warning=ExperimentalWarning --check lapa-server.new.mjs
mv lapa-server.new.mjs lapa-server.mjs
systemctl restart lapa
sleep 2
if curl -fsS -m 5 http://127.0.0.1:8797/health >/dev/null; then echo "GOTOWE: serwer ŁAPY zaktualizowany i działa."; rm -f lapa-server.mjs.bak dogmerge.mjs.bak
else echo "BŁĄD: przywracam poprzednią wersję"; mv lapa-server.mjs.bak lapa-server.mjs; [ -f dogmerge.mjs.bak ] && mv dogmerge.mjs.bak dogmerge.mjs || true; systemctl restart lapa; exit 1; fi
