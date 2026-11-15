#!/bin/bash
# Aktualizacja serwera ŁAPY (kod, bez zmiany danych i istniejących haseł). Uruchom na serwerze jako root:
#   bash <(curl -fsSL https://raw.githubusercontent.com/lewym90/lapa/main/server/aktualizuj.sh)
# Gdy nie ma jeszcze hasła administratora, skrypt poprosi o nie (dwa razy, nic się nie wyświetla podczas wpisywania).
set -euo pipefail
APP=/opt/lapa; ENVF=/etc/lapa.env; NODE="$APP/node/bin/node"; REF="${LAPA_REF:-main}"; RAW="https://raw.githubusercontent.com/lewym90/lapa/$REF/server"; JS="https://raw.githubusercontent.com/lewym90/lapa/$REF/js"
cd "$APP"

# 1) Hasło administratora (tylko gdy jeszcze go nie ma). Musi być inne niż hasło wolontariusza i koordynatora.
if ! grep -q "^PASS_ADMIN_HASH=" "$ENVF"; then
  echo "== Ustaw hasło ADMINISTRATORA (min. 8 znaków, inne niż hasło wolontariusza i koordynatora)"
  read -rsp "Hasło administratora: " P1; echo; read -rsp "Powtórz: " P2; echo
  [ "$P1" = "$P2" ] || { echo "PRZERWANO: hasła się różnią. Nic nie zostało zmienione."; exit 1; }
  # porównanie z istniejącymi hasłami (skróty scrypt z $ENVF)
  SAME="$(set -a; . "$ENVF"; set +a; printf '%s' "$P1" | "$NODE" -e '
    const c=require("node:crypto");let s="";process.stdin.on("data",(d)=>s+=d).on("end",()=>{
      const ok=(h)=>{try{const[a,n,salt,hh]=String(h||"").split("$");if(a!=="scrypt")return false;const w=Buffer.from(hh,"base64");return c.timingSafeEqual(c.scryptSync(s,Buffer.from(salt,"base64"),w.length,{N:+n,r:8,p:1,maxmem:64*1024*1024}),w);}catch{return false}};
      console.log(ok(process.env.PASS_VOLUNTEER_HASH)||ok(process.env.PASS_COORDINATOR_HASH)?"1":"0");});')"
  [ "$SAME" = "0" ] || { echo "PRZERWANO: to hasło jest już hasłem wolontariusza albo koordynatora. Wymyśl inne."; exit 1; }
  HA="$(printf '%s' "$P1" | "$NODE" "$APP/hash-password.mjs")" || { echo "PRZERWANO: hasło za krótkie (min. 8 znaków)."; exit 1; }
  unset P1 P2
  cp "$ENVF" "$ENVF.bak"; ( umask 077; printf "PASS_ADMIN_HASH='%s'\n" "$HA" >> "$ENVF" ); chmod 600 "$ENVF"
  echo "Hasło administratora zapisane (tylko jego skrót)."
fi

# 2) Skrypt zmiany hasła: wolontariusz, koordynator, administrator
cat > "$APP/zmien-haslo.sh" <<'Z'
#!/usr/bin/env bash
# Zmiana hasła. Użycie: bash /opt/lapa/zmien-haslo.sh wolontariusz|koordynator|administrator
set -uo pipefail
case "${1:-}" in wolontariusz) KEY=PASS_VOLUNTEER_HASH;; koordynator) KEY=PASS_COORDINATOR_HASH;; administrator) KEY=PASS_ADMIN_HASH;; *) echo "Użycie: $0 wolontariusz|koordynator|administrator"; exit 1;; esac
[ "$(id -u)" = 0 ] || { echo "uruchom jako root"; exit 1; }
read -rsp "Nowe hasło (min. 8 znaków): " P1; echo; read -rsp "Powtórz hasło: " P2; echo
[ "$P1" = "$P2" ] || { echo "Hasła się różnią."; exit 1; }
H="$(printf '%s' "$P1" | /opt/lapa/node/bin/node /opt/lapa/hash-password.mjs)" || exit 1
grep -v "^$KEY=" /etc/lapa.env > /etc/lapa.env.new; printf "%s='%s'\n" "$KEY" "$H" >> /etc/lapa.env.new
chmod 600 /etc/lapa.env.new; mv /etc/lapa.env.new /etc/lapa.env
systemctl restart lapa && echo "Gotowe. Osoby z tym hasłem zostaną poproszone o nowe przy następnym otwarciu aplikacji."
Z
chmod 700 "$APP/zmien-haslo.sh"

# 3) Kod serwera (z kopią i sprawdzeniem; przy błędzie wraca poprzednia wersja)
cp lapa-server.mjs lapa-server.mjs.bak
[ -f dogmerge.mjs ] && cp dogmerge.mjs dogmerge.mjs.bak || true
curl -fsSL "$JS/dogmerge.js" -o dogmerge.new.mjs
"$NODE" --check dogmerge.new.mjs
mv dogmerge.new.mjs dogmerge.mjs
curl -fsSL "$RAW/lapa-server.mjs" -o lapa-server.new.mjs
LAPA_NO_LISTEN=1 DB_FILE=/tmp/lapa-check.db PASS_VOLUNTEER_HASH=scrypt\$16384\$aa\$bb PASS_COORDINATOR_HASH=scrypt\$16384\$aa\$cc "$NODE" --disable-warning=ExperimentalWarning --check lapa-server.new.mjs
mv lapa-server.new.mjs lapa-server.mjs
systemctl restart lapa
sleep 2
if curl -fsS -m 5 http://127.0.0.1:8797/health >/dev/null; then echo "GOTOWE: serwer ŁAPY zaktualizowany i działa."; rm -f lapa-server.mjs.bak dogmerge.mjs.bak
else echo "BŁĄD: przywracam poprzednią wersję"; mv lapa-server.mjs.bak lapa-server.mjs; [ -f dogmerge.mjs.bak ] && mv dogmerge.mjs.bak dogmerge.mjs || true; systemctl restart lapa; exit 1; fi
