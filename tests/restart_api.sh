R="$(cd "$(dirname "$0")/.." && pwd)"  # katalog repozytorium
pkill -f /tmp/t/lapa-server.mjs; sleep 1; rm -rf /tmp/t/data; mkdir -p /tmp/t
H1=$(echo -n 'wolontariusz-haslo-1' | node $R/server/hash-password.mjs); H2=$(echo -n 'koordynator-haslo-2' | node $R/server/hash-password.mjs); H3=$(echo -n 'administrator-haslo-3' | node $R/server/hash-password.mjs)
cp $R/server/lapa-server.mjs /tmp/t/; cp $R/js/dogmerge.js /tmp/t/dogmerge.mjs
(DB_FILE=/tmp/t/data/t.db PORT=18999 SITE_SYNC_HOURS=99 PASS_VOLUNTEER_HASH="$H1" PASS_COORDINATOR_HASH="$H2" PASS_ADMIN_HASH="$H3" ALLOWED_ORIGINS=http://127.0.0.1:8000 setsid nohup node --disable-warning=ExperimentalWarning /tmp/t/lapa-server.mjs >/tmp/api.log 2>&1 &); sleep 2
