#!/bin/bash
# ŁAPA – WERSJA TESTOWA na tym samym serwerze. Prawdziwa aplikacja (/lapa, usługa lapa) zostaje nietknięta.
#   adres:  https://<domena>/lapa-test/app/
#   usługa: lapa-test (port 8798), katalog /opt/lapa-test, ustawienia /etc/lapa-test.env, trasa /etc/caddy/conf.d/lapa-test.caddy
#   dane:   osobna baza = KOPIA prawdziwych danych z chwili instalacji (zmiany w teście nie trafiają do wolontariuszy)
#   hasła:  takie same jak w prawdziwej aplikacji; strona schroniska jest czytana jak w prawdziwej (zmienia tylko dane testowe; SITE_SYNC=0 wyłącza); powiadomienia nie idą na prawdziwe telefony
# Użycie (jako root):
#   LAPA_REF=<gałąź lub commit> bash <(curl -fsSL https://raw.githubusercontent.com/lewym90/lapa/<to samo>/server/test-srodowisko.sh)            instalacja / nowa wersja testowa
#   ... test-srodowisko.sh nowe-dane     to samo + świeża kopia prawdziwych danych (testowe zmiany przepadają)
#   ... test-srodowisko.sh usun          usuwa wersję testową w całości
set -euo pipefail
REF="${LAPA_REF:-test}"; T=/opt/lapa-test; ENVT=/etc/lapa-test.env; PORT=8798; NODE=/opt/lapa/node/bin/node; PROD=/opt/lapa
CF=/etc/caddy/Caddyfile; CD="$(dirname "$CF")/conf.d"; ROUTE="$CD/lapa-test.caddy"; TRYB="${1:-}"
say() { printf '== %s\n' "$*"; }
die() { printf 'PRZERWANO: %s\n' "$*" >&2; exit 1; }
[ "$(id -u)" = 0 ] || die "uruchom jako root"
[ -x "$NODE" ] && [ -f /etc/lapa.env ] || die "nie widzę prawdziwej ŁAPY w $PROD (najpierw install.sh)"
SITE_LINE="$(grep -nE '^[^[:space:]{#(][^{]*\{[[:space:]]*$' "$CF" | head -n1 | cut -d: -f1)"
DOM="$(sed -n "${SITE_LINE}p" "$CF" | sed -E 's/[[:space:]]*\{.*$//; s/[[:space:]].*$//')"
[ -n "$DOM" ] || die "nie ustaliłem domeny z Caddyfile"
USR="$(systemctl show -p User --value lapa)"; [ -n "$USR" ] || USR=lapa
prod_ok() { curl -fsS -m 10 "http://127.0.0.1:8797/health" >/dev/null 2>&1; }

if [ "$TRYB" = usun ]; then
  say "Usuwam wersję testową"
  systemctl disable --now lapa-test >/dev/null 2>&1 || true
  rm -f /etc/systemd/system/lapa-test.service; systemctl daemon-reload
  if [ -f "$ROUTE" ]; then rm -f "$ROUTE"; caddy validate --config "$CF" --adapter caddyfile >/dev/null 2>&1 && systemctl reload caddy; fi
  rm -rf "$T" "$ENVT"
  prod_ok && say "GOTOWE: wersja testowa usunięta, prawdziwa ŁAPA działa." || say "Wersja testowa usunięta. UWAGA: prawdziwa ŁAPA nie odpowiada – sprawdź: systemctl status lapa"
  exit 0
fi

if ss -ltnH | awk '{print $4}' | grep -qE "[:.]$PORT$" && ! systemctl is-active --quiet lapa-test; then die "port $PORT jest zajęty przez inną usługę"; fi

# 1) Kod z GitHuba (gałąź/commit $REF)
say "Pobieram wersję $REF"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
curl -fsSL "https://codeload.github.com/lewym90/lapa/tar.gz/$REF" | tar xz -C "$TMP" --strip-components=1 || die "nie pobrałem kodu ($REF)"
[ -f "$TMP/index.html" ] && [ -f "$TMP/server/lapa-server.mjs" ] || die "pobrany kod jest niekompletny"
"$NODE" --check "$TMP/server/lapa-server.mjs"; "$NODE" --check "$TMP/js/dogmerge.js"
mkdir -p "$T/data"
rm -rf "$T/www.new"; mkdir -p "$T/www.new"
( cd "$TMP" && for x in *; do case "$x" in server|tests|docs|README.md|bump.sh|tmpimg) ;; *) cp -r "$x" "$T/www.new/";; esac; done )
cp "$TMP/server/lapa-server.mjs" "$T/lapa-server.new.mjs"; cp "$TMP/js/dogmerge.js" "$T/dogmerge.new.mjs"

# 2) Dane: kopia prawdziwej bazy (przy pierwszej instalacji albo „nowe-dane”)
if [ ! -f "$T/data/lapa.db" ] || [ "$TRYB" = nowe-dane ]; then
  say "Kopiuję prawdziwe dane do wersji testowej"
  systemctl stop lapa-test >/dev/null 2>&1 || true
  rm -f "$T"/data/lapa.db "$T"/data/lapa.db-* "$T"/data/site-status.json
  "$NODE" --disable-warning=ExperimentalWarning -e '
    const { DatabaseSync } = require("node:sqlite");
    new DatabaseSync(process.argv[1], { readOnly: true }).exec(`VACUUM INTO '"'"'${process.argv[2]}'"'"'`);
    const t = new DatabaseSync(process.argv[2]);
    for (const q of ["DELETE FROM push", "DELETE FROM sessions"]) { try { t.exec(q); } catch {} } // bez powiadomień na prawdziwe telefony, bez cudzych sesji
    t.close();' "$PROD/data/lapa.db" "$T/data/lapa.db"
  rm -rf "$T/data/photos"; [ -d "$PROD/data/photos" ] && cp -r "$PROD/data/photos" "$T/data/photos" || true
fi

# 3) Ustawienia (hasła jak w prawdziwej aplikacji)
( umask 077
  { echo "PORT=$PORT"; echo "HOST=127.0.0.1"; echo "DB_FILE=$T/data/lapa.db"; echo "ALLOWED_ORIGINS=https://$DOM"
    echo "STATIC_DIR=$T/www"; echo "SITE_SYNC=${SITE_SYNC:-1}"; echo "VAPID_SUB=https://$DOM/lapa-test"
    grep -E '^PASS_(VOLUNTEER|ADMIN)_HASH=' /etc/lapa.env; } > "$ENVT" )
chmod 600 "$ENVT"

# 4) Podmiana plików i usługa
[ -d "$T/www" ] && rm -rf "$T/www.old" && mv "$T/www" "$T/www.old"
mv "$T/www.new" "$T/www"; rm -rf "$T/www.old"
mv "$T/lapa-server.new.mjs" "$T/lapa-server.mjs"; mv "$T/dogmerge.new.mjs" "$T/dogmerge.mjs"
chown -R "$USR":"$USR" "$T/data"
cat > /etc/systemd/system/lapa-test.service <<U
[Unit]
Description=ŁAPA – WERSJA TESTOWA
After=network-online.target
Wants=network-online.target
[Service]
User=$USR
EnvironmentFile=$ENVT
WorkingDirectory=$T
ExecStart=$NODE --disable-warning=ExperimentalWarning $T/lapa-server.mjs
Restart=always
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=$T/data
MemoryMax=120M
[Install]
WantedBy=multi-user.target
U
systemctl daemon-reload; systemctl enable lapa-test >/dev/null 2>&1; systemctl restart lapa-test; sleep 2
systemctl is-active --quiet lapa-test && curl -fsS -m 5 "http://127.0.0.1:$PORT/health" >/dev/null || { journalctl -u lapa-test -n 20 --no-pager >&2; die "wersja testowa nie wystartowała (prawdziwa ŁAPA nietknięta)"; }

# 5) Trasa w Caddy (tylko raz; z walidacją i wycofaniem)
if [ ! -f "$ROUTE" ]; then
  say "Dodaję adres /lapa-test w Caddy"
  printf 'handle_path /lapa-test/* {\n\treverse_proxy 127.0.0.1:%s\n}\n' "$PORT" > "$ROUTE"; chmod 644 "$ROUTE"
  rollback() { rm -f "$ROUTE"; systemctl reload caddy 2>/dev/null || systemctl restart caddy; die "$1 – trasa wycofana, prawdziwa ŁAPA nietknięta"; }
  caddy validate --config "$CF" --adapter caddyfile >/dev/null 2>&1 || rollback "Caddy odrzucił konfigurację"
  systemctl reload caddy || rollback "Caddy nie przeładował konfiguracji"
  sleep 3; systemctl is-active --quiet caddy || rollback "Caddy nie działa po zmianie"
fi

OK=0; for _ in 1 2 3 4 5; do curl -fsS -m 10 "https://$DOM/lapa-test/app/version.json" >/dev/null 2>&1 && { OK=1; break; }; sleep 3; done
prod_ok || say "UWAGA: prawdziwa ŁAPA nie odpowiada – sprawdź: systemctl status lapa"
V="$(cat "$T/www/version.json" 2>/dev/null || true)"
if [ $OK = 1 ]; then say "GOTOWE: wersja testowa $V działa pod adresem: https://$DOM/lapa-test/app/"
else say "Wersja testowa $V zainstalowana, ale adres jeszcze nie odpowiada – odczekaj chwilę: https://$DOM/lapa-test/app/"; fi
