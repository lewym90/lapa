# ŁAPA — Nowodwór

Aplikacja PWA dla wolontariuszy Schroniska dla Psów w Nowodworze: kartoteka psów, spacery i obserwacje, wspólny kalendarz, transporty, potrzeby, import ogłoszeń ze strony schroniska. Działa offline, synchronizuje się z serwerem.

- `index.html`, `css/`, `js/`, `sw.js`, `manifest.webmanifest`: aplikacja (bez budowania, wystarczy GitHub Pages).
- `server/`: serwer wspólnych danych (Node 22, bez zależności). Instalacja na VPS: `server/install.sh`.

W repozytorium nie ma haseł ani kluczy. Hasła wolontariusza i koordynatora są ustawiane na serwerze przy instalacji i zapisane tylko jako skróty.

## Nowa wersja

Po zmianach uruchom `./bump.sh 1.1.0` (ustawia wersję w config.js, sw.js i version.json), zrób commit i push. Aplikacje u wolontariuszy zaktualizują się same po ponownym otwarciu.


## Dokumentacja
Stan projektu, wdrożenie, decyzje i testy: [docs/STAN.md](docs/STAN.md).
