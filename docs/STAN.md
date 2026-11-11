# ŁAPA – Nowodwór: stan projektu i przekazanie pracy (wersja 1.8.1, 2026-11-11)

Ten plik pozwala kontynuować pracę z innego konta lub sesji. Nie ma tu haseł ani kluczy (hasła wolontariusza i koordynatora ustawił właściciel na serwerze, zapisane są tylko jako hashe w usłudze systemd).

## Co to jest
PWA (vanilla JS, moduły ES, bez budowania) dla wolontariuszy Stowarzyszenia Wolontariat Schroniska dla Psów w Nowodworze. System zarządzania pracą stowarzyszenia: psy, spacery, Brama, teczka psa, adopcje, domy tymczasowe, zaginięcia, finanse, terminarz, zdjęcia. To niespodzianka dla znajomej właściciela, więc nie pytamy jej o szczegóły i zakładamy pełne uprawnienia każdego wolontariusza. Bez AI i płatnych API. Aplikacja nigdy sama niczego nie publikuje (Facebook, strona).

Wygląd: zieleń #173B32, kość słoniowa #F4F0E7, grafit #252925, szałwia #A8B6A3, złoto #B18A52, terakota #C8795B; Playfair Display + Inter.

## Wdrożenie
- Frontend: GitHub Pages, repo `lewym90/lapa`, gałąź `main`, katalog główny → https://lewym90.github.io/lapa/
- Nowa wersja: `./bump.sh X.Y.Z` (config.js VERSION, sw.js, version.json), commit, push. Aplikacja sama się aktualizuje po ponownym otwarciu (Ustawienia → Sprawdź aktualizację). Każdy nowy plik JS trzeba dopisać do listy ASSETS w `sw.js`.
- Serwer: VPS „NOWY”, katalog /opt/lapa, usługa systemd `lapa`, port 8797, adres https://188-68-247-201.sslip.io/lapa. Node 22 z `node:sqlite`. Pliki: `server/lapa-server.mjs` oraz `js/dogmerge.js` (na serwerze jako `dogmerge.mjs`).
- Aktualizacja serwera (komendę wpisuje właściciel w Termius na serwerze NOWY): `LAPA_REF=<commit> bash <(curl -fsSL https://raw.githubusercontent.com/lewym90/lapa/<commit>/server/aktualizuj.sh)`. Zmiany w `server/*` i `js/dogmerge.js` wymagają tej komendy; zmiany w reszcie `js/` i `css/` nie.
- Ostatnia aktualizacja serwera wymagana: commit 1ec8dc7 (automatyczne sprawdzanie strony). Czy właściciel ją wykonał, nie jest potwierdzone: sprawdzić w aplikacji w Ustawienia → „Strona schroniska” albo `GET /health` (pole `site`).
- Commity z trailerami `Co-Authored-By` i `Claude-Session` zgodnie z instrukcją sesji.

## Architektura w skrócie
- `js/main.js`: router (hash), menu (`MENU`, to samo w szufladzie i w panelu bocznym komputera ≥860 px), dolny pasek telefonu (nie zmieniać, właściciel go lubi), arkusz „+”.
- `js/store.js` + `js/db.js` (IndexedDB: records, outbox, meta, blob) + `js/sync.js`: offline-first, kolejka wysyłki, pobieranie zmian po numerze `seq`. Kolekcje `p_*` (adopcje, domy tymczasowe, finanse) tylko za hasłem koordynatora.
- `js/ui.js`: `html`, `esc`, `openSheet`, `closeSheet`, `toast`, `actions` (obsługa `data-act`), `pageBar`, `plusBtn`, szkice formularzy w arkuszach, blokada wygaszania ekranu.
- `js/dogmerge.js`: wspólna logika (aplikacja + serwer): z odczytu strony schroniska powstaje rekord psa, ocena zachowania z opisu, miejsce z hasła.
- `js/terminarz.js` (terminarz, sobotnie spacery, poranny komunikat), `js/udzial.js` (zgłoszenia „będę”), `js/brama.js`, `js/teczka.js`, `js/adopcje.js`, `js/zaginiecia.js`, `js/finanse.js`, `js/photos.js`, `js/screens-*.js`.
- Serwer: SQLite (tabele records, history, sessions), `/sync`, `/import`, `/import/links`, `/photo/:id` (JPEG do 1,5 MB), `/health`, `POST /site/sync`. Kopie bazy co 30 minut (VACUUM INTO, katalog `backups`, 48 h wszystkie, potem 1 na dobę do 60 dni). Automatyczne sprawdzanie strony schroniska 3 razy dziennie (3:00, 11:00, 17:00 czasu warszawskiego, zmienna `SITE_SYNC_HOURS`).

## Decyzje i preferencje właściciela
- Pisać po polsku, prosto i krótko. Jeden temat naraz. Komendy do Termius podawać pojedynczo i mówić, na którym serwerze.
- Na telefonie nic nie zmieniać bez prośby; zmiany na komputerze tylko, gdy dotyczą komputera.
- Aplikacja nie publikuje niczego sama. Dane nie mogą zginąć (kopie, historia rekordów).
- Wpisy „Tylko ja” w terminarzu są ukryte tylko w interfejsie, nie szyfrowane (uczciwe ograniczenie).
- Automatyczny import ze strony nie cofa ręcznych zmian (status, opis, miejsce), nie wskrzesza usuniętych psów i nie usuwa psów, które zniknęły ze strony.
- **Właściciel odrzucił** dopisywanie kolejnych funkcji z badania obowiązków wolontariuszy (zaświadczenia, umowa adopcyjna, ostrzeżenia na Bramie, statystyki, etykiety ról): „zaśmieci aplikację”. Nie wdrażać bez wyraźnej prośby. Opis badania: `docs/obowiazki-wolontariuszy.md`.

## Dla kolejnej sesji
- Najpierw potwierdzić z właścicielem, czy serwer został zaktualizowany (komenda wyżej).
- Zdjęcia: wiele plików naraz działa (okno „Zdjęcia / sesja” na karcie psa). Do ewentualnego dopracowania tylko na prośbę.
- Nie zbadane: Instagram, TikTok, YouTube, Puszatek, Psinder; powiadomienia poza aplikacją; kopia poza serwerem; wideo powitalne; redesign strony schroniska.

## Testy
W katalogu `tests/`: skrypty Playwright (`e*.py`) i test serwera (`s1.mjs`, atrapa strony schroniska). Używają lokalnego serwera API na porcie 18999 i statycznego na 8000 (`python3 -m http.server 8000` w katalogu repo). `tests/restart_api.sh` uruchamia czysty serwer testowy (kopiuje serwer do /tmp/t). Testy zależą od stanu: przed każdym uruchomieniem restartować API z czystą bazą. Znany nieszkodliwy błąd w e5: „finanse: wpłaty” (zapis liczby z separatorem tysięcy).
