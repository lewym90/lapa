# ŁAPA — Nowodwór

Aplikacja PWA dla wolontariuszy Schroniska dla Psów w Nowodworze: psy ze strony schroniska (same się pojawiają i znikają), karta psa dla administratorów, Brama (wydawanie psów na spacery), terminarz i sobotnie spacery, pomoc (potrzeby, transport), zaginięcia, domy tymczasowe i hoteliki, finanse, czat. Działa offline, synchronizuje się z serwerem.

- `index.html`, `css/`, `js/`, `sw.js`, `manifest.webmanifest`: aplikacja (bez budowania, wystarczy GitHub Pages).
- `server/`: serwer wspólnych danych (Node 22, bez zależności). Instalacja na VPS: `server/install.sh`.

W repozytorium nie ma haseł ani kluczy. Hasła wolontariusza i administratora są ustawiane na serwerze przy instalacji i zapisane tylko jako skróty (od 1.16 nie ma hasła koordynatora).

## Nowa wersja

Po zmianach uruchom `./bump.sh 1.1.0` (ustawia wersję w config.js, sw.js i version.json), zrób commit i push. Aplikacje u wolontariuszy zaktualizują się same po ponownym otwarciu.


## Dokumentacja
Stan projektu, wdrożenie, decyzje i testy: [docs/STAN.md](docs/STAN.md).
