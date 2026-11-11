#!/usr/bin/env bash
# Instalacja serwera ŁAPA – Nowodwór na VPS. Uruchom jako root:
#   bash <(curl -fsSL https://raw.githubusercontent.com/lewym90/lapa/main/server/install.sh)
# Bezpieczeństwo: osobny użytkownik, osobny katalog /opt/lapa, usługa tylko na 127.0.0.1:8797 (limit 150 MB RAM),
# jedna nowa trasa w /etc/caddy/conf.d/lapa.caddy. Pozostałych usług NIE dotyka.
# Po dodaniu trasy: caddy validate -> reload -> kontrola /zdrowie Typera; przy problemie plik trasy jest usuwany.
# Hasła są pytane na miejscu (nie wyświetlają się), w pliku zapisywane są tylko ich skróty.
set -uo pipefail
RAW="${RAW:-https://raw.githubusercontent.com/lewym90/lapa/main/server}"
APP=/opt/lapa; USR=lapa; ENVF=/etc/lapa.env; PORT=8797
CF="${CADDYFILE:-/etc/caddy/Caddyfile}"; CD="${CONFD:-$(dirname "$CF")/conf.d}"; ROUTE="$CD/lapa.caddy"
say() { printf '== %s\n' "$*"; }
die() { printf 'PRZERWANO: %s\n' "$*" >&2; exit 1; }
[ "$(id -u)" = 0 ] || die "uruchom jako root"
command -v systemctl >/dev/null || die "brak systemd"
command -v caddy >/dev/null || die "nie widzę Caddy"
[ -f "$CF" ] || die "brak $CF"
grep -qF "$CD" "$CF" || die "Caddy nie wczytuje $CD"
SITE_LINE="$(grep -nE '^[^[:space:]{#(][^{]*\{[[:space:]]*$' "$CF" | head -n1 | cut -d: -f1)"
DOM="$(sed -n "${SITE_LINE}p" "$CF" | sed -E 's/[[:space:]]*\{.*$//; s/[[:space:]].*$//')"
[ -n "$DOM" ] || die "nie ustaliłem domeny z Caddyfile"
health() { [ -n "${SKIP_HEALTH:-}" ] && return 0; curl -fsS -m 10 "https://$DOM/zdrowie" >/dev/null 2>&1; }
HB=0; health && HB=1

# 0) Port wolny? (przy ponownym uruchomieniu zajmuje go nasza usługa – to dozwolone)
if ss -ltnH | awk '{print $4}' | grep -qE "[:.]$PORT$" && ! systemctl is-active --quiet lapa; then die "port $PORT jest zajęty przez inną usługę"; fi
AV="$(df -Pm / | awk 'NR==2{print $4}')"; [ "${AV:-0}" -gt 500 ] || die "za mało miejsca na dysku (${AV:-?} MB wolnych)"

# 1) Użytkownik i katalogi
id "$USR" >/dev/null 2>&1 || useradd --system --home "$APP" --shell /usr/sbin/nologin "$USR" || die "useradd"
mkdir -p "$APP/data" "$APP/node"

# 2) Node 22 (własna kopia – node:sqlite wymaga nowszej wersji niż większość systemowych)
NODE="$APP/node/bin/node"
if [ ! -x "$NODE" ] || [ "$("$NODE" -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)" -lt 22 ]; then
  say "Pobieram własny Node 22 do $APP/node"
  case "$(uname -m)" in x86_64) A=x64;; aarch64|arm64) A=arm64;; *) die "nieobsługiwana architektura";; esac
  B=https://nodejs.org/dist/latest-v22.x
  F="$(curl -fsSL $B/SHASUMS256.txt | grep -o "node-v[0-9.]*-linux-$A.tar.xz" | head -n1)" || die "nie znalazłem Node"
  curl -fsSL "$B/$F" | tar -xJ -C "$APP/node" --strip-components=1 || die "pobieranie Node"
fi
say "Node: $($NODE -v)"

# 3) Pliki serwera
for f in lapa-server.mjs hash-password.mjs; do curl -fsSL "$RAW/$f" -o "$APP/$f" || die "pobieranie $f"; done
curl -fsSL "${RAW%/server}/js/dogmerge.js" -o "$APP/dogmerge.mjs" || die "pobieranie dogmerge.js"

# 4) Hasła (pytane tylko przy pierwszej instalacji; zmiana później: bash $APP/zmien-haslo.sh)
cat > "$APP/zmien-haslo.sh" <<'Z'
#!/usr/bin/env bash
# Zmiana hasła wolontariusza lub koordynatora. Użycie: bash /opt/lapa/zmien-haslo.sh wolontariusz|koordynator
set -uo pipefail
case "${1:-}" in wolontariusz) KEY=PASS_VOLUNTEER_HASH;; koordynator) KEY=PASS_COORDINATOR_HASH;; *) echo "Użycie: $0 wolontariusz|koordynator"; exit 1;; esac
[ "$(id -u)" = 0 ] || { echo "uruchom jako root"; exit 1; }
read -rsp "Nowe hasło (min. 8 znaków): " P1; echo; read -rsp "Powtórz hasło: " P2; echo
[ "$P1" = "$P2" ] || { echo "Hasła się różnią."; exit 1; }
H="$(printf '%s' "$P1" | /opt/lapa/node/bin/node /opt/lapa/hash-password.mjs)" || exit 1
grep -v "^$KEY=" /etc/lapa.env > /etc/lapa.env.new; printf "%s='%s'\n" "$KEY" "$H" >> /etc/lapa.env.new
chmod 600 /etc/lapa.env.new; mv /etc/lapa.env.new /etc/lapa.env
systemctl restart lapa && echo "Gotowe. Wszyscy zostaną poproszeni o nowe hasło przy następnym otwarciu aplikacji."
Z
chmod 700 "$APP/zmien-haslo.sh"
if [ ! -f "$ENVF" ]; then
  say "Ustaw hasła (nic się nie wyświetla podczas wpisywania)"
  read -rsp "Hasło WOLONTARIUSZA (min. 8 znaków): " P1; echo; read -rsp "Powtórz: " P2; echo
  [ "$P1" = "$P2" ] || die "hasła wolontariusza się różnią"
  HV="$(printf '%s' "$P1" | "$NODE" "$APP/hash-password.mjs")" || die "hasło wolontariusza za krótkie"
  read -rsp "Hasło KOORDYNATORA (min. 8 znaków, inne niż powyższe): " P3; echo; read -rsp "Powtórz: " P4; echo
  [ "$P3" = "$P4" ] || die "hasła koordynatora się różnią"
  [ "$P3" != "$P1" ] || die "hasła muszą być różne"
  HC="$(printf '%s' "$P3" | "$NODE" "$APP/hash-password.mjs")" || die "hasło koordynatora za krótkie"
  ( umask 077
  { echo "PORT=$PORT"; echo "HOST=127.0.0.1"; echo "DB_FILE=$APP/data/lapa.db"
    echo "ALLOWED_ORIGINS=https://lewym90.github.io"
    echo "PASS_VOLUNTEER_HASH='$HV'"; echo "PASS_COORDINATOR_HASH='$HC'"; } > "$ENVF" )
  unset P1 P2 P3 P4
fi
chmod 600 "$ENVF"
chown -R "$USR":"$USR" "$APP/data"

# 5) Usługa systemd
cat > /etc/systemd/system/lapa.service <<U
[Unit]
Description=ŁAPA – Nowodwór (wspólne dane wolontariuszy)
After=network-online.target
Wants=network-online.target
[Service]
User=$USR
EnvironmentFile=$ENVF
WorkingDirectory=$APP
ExecStart=$NODE --disable-warning=ExperimentalWarning $APP/lapa-server.mjs
Restart=always
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=$APP/data
MemoryMax=150M
[Install]
WantedBy=multi-user.target
U
chmod 644 /etc/systemd/system/lapa.service
systemctl daemon-reload && systemctl enable --now lapa >/dev/null 2>&1
systemctl restart lapa; sleep 2
systemctl is-active --quiet lapa || { journalctl -u lapa -n 20 --no-pager >&2; die "usługa nie wystartowała (Caddy i pozostałe usługi nietknięte)"; }
curl -fsS -m 5 "http://127.0.0.1:$PORT/health" >/dev/null || die "usługa nie odpowiada lokalnie"

# 6) Trasa w Caddy (z walidacją i wycofaniem)
mkdir -p "$CD"
[ -f "$ROUTE" ] && cp -p "$ROUTE" "$ROUTE.bak"
cat > "$ROUTE" <<R
handle_path /lapa/* {
	reverse_proxy 127.0.0.1:$PORT
}
R
chmod 755 "$CD"; chmod 644 "$ROUTE"
rollback() { say "WYCOFUJĘ trasę"; if [ -f "$ROUTE.bak" ]; then mv -f "$ROUTE.bak" "$ROUTE"; else rm -f "$ROUTE"; fi; systemctl reload caddy 2>/dev/null || systemctl restart caddy; exit 1; }
caddy validate --config "$CF" --adapter caddyfile >/dev/null 2>&1 || { echo "Caddy odrzucił konfigurację." >&2; rollback; }
systemctl reload caddy || rollback
sleep 3
systemctl is-active --quiet caddy || rollback
if [ $HB = 1 ]; then ok=0; for _ in 1 2 3 4 5 6; do health && { ok=1; break; }; sleep 3; done; [ $ok = 1 ] || { echo "Typer nie odpowiada po zmianie." >&2; rollback; }; fi
rm -f "$ROUTE.bak"
OKR=0; for _ in 1 2 3 4 5; do curl -fsS -m 10 "https://$DOM/lapa/health" >/dev/null 2>&1 && { OKR=1; break; }; sleep 3; done
say "GOTOWE. Pozostałe usługi działają jak wcześniej.$([ $OKR = 1 ] || echo ' (UWAGA: trasa publiczna jeszcze nie odpowiada – odczekaj chwilę i sprawdź ponownie)')"
echo
echo "Serwer ŁAPY działa pod adresem: https://$DOM/lapa"
echo "Zmiana hasła później: bash $APP/zmien-haslo.sh wolontariusz   (albo: koordynator)"
