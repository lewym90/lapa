pkill -f /tmp/t/lapa-server.mjs; sleep 1; rm -rf /tmp/t/data
H1=$(echo -n 'wolontariusz-haslo-1' | node /home/claude/lapa-git/server/hash-password.mjs); H2=$(echo -n 'koordynator-haslo-2' | node /home/claude/lapa-git/server/hash-password.mjs)
cp /home/claude/lapa-git/server/lapa-server.mjs /tmp/t/; cp /home/claude/lapa-git/js/dogmerge.js /tmp/t/dogmerge.mjs
(DB_FILE=/tmp/t/data/t.db PORT=18999 SITE_SYNC_HOURS=99 PASS_VOLUNTEER_HASH="$H1" PASS_COORDINATOR_HASH="$H2" ALLOWED_ORIGINS=http://127.0.0.1:8000 setsid nohup node --disable-warning=ExperimentalWarning /tmp/t/lapa-server.mjs >/tmp/api.log 2>&1 &); sleep 2
