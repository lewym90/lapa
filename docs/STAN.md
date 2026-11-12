# ŁAPA – Nowodwór: stan projektu i przekazanie pracy (wersja 1.9.0, 2026-11-11)

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


## Audyt 1.8.3 (2026-11-11)
- Plakat / karta psa do druku: podgląd pełnoekranowy (`printPreview` w ui.js) z przyciskami Zamknij i Drukuj (samo `print()` w PWA na telefonie nie działało).
- Szkice formularzy: pola z `data-nodraft` (wygenerowane teksty postów) nie są zapamiętywane, bo nadpisywały odświeżony post.
- Serwer: nagłówki CORS także przy błędach (błąd importu nie udaje już „brak połączenia"), zapis klienta wygrywa z wpisem `strona`, znacznik `poza_strona` (pies zniknął ze strony), czyszczenie historii >365 dni. Wymaga aktualizacji serwera (komenda w aktualizuj.sh z hashem commitu).
- Klient: status strony z `/health` (bez własnego sprawdzania), usunięte martwe fragmenty.
- Testy: tests/e*.py zaktualizowane do nowego menu; `s1.mjs` test serwera.
- Nie sprawdzone na prawdziwym telefonie: drukowanie z iOS (podgląd działa, samo okno druku zależy od systemu).

## 1.8.4 (2026-11-11)
Dokończenie audytu: usunięte nieużywane importy, etykiety dostępności pól wyszukiwania i imienia, większe pola dotyku linków, szkic formularza zapamiętywany po tytule i początkowej zawartości, fokus na oknie po otwarciu, bez `aria-live` na całej aplikacji. Błędy 500 w konsoli audit_ui.py pochodzą z braku sieci w piaskownicy (serwer testowy nie dociera do strony schroniska).

## 1.8.5 (2026-11-12)
Podpis „kto dodał / kto ostatnio zmienił": nowy `js/kto.js` (`ktoText`, `ktoInto`), użyty w Zaginięciach (lista i okno), Potrzebach rzeczowych (lista i edycja) i na karcie psa (ostatnia zmiana, także „automat (strona schroniska)"). Dane: `by` i `updated_at` zapisywane przy każdym zapisie i przesyłane przez serwer. Synchronizacja: zapis wysyłany ~0,4 s po wpisie, pobieranie co 45 s przy otwartej aplikacji i od razu po jej otwarciu; brak powiadomień push.


## 1.9.0 (2026-11-12): czat wolontariuszy z powiadomieniami
**Wymaga aktualizacji serwera** (komenda aktualizacji z hashem commitu). Klient bez nowego serwera pokaże czat, ale bez powiadomień i bez natychmiastowej synchronizacji.
- Dane: kolekcje `czat` (wiadomości: id, ts, autor, text, kind `msg`|`prosba`, pilne, wzm[], re, ref{typ,id,nazwa}, foto, edytowano, pin, zalatwione) i `czat_re` (reakcje: msg, imie, e; id `msg-imie-klucz`). Zwykła synchronizacja LWW. Serwer trzyma je `CHAT_DAYS`=30 dni (wraz ze zdjęciami), potem kasuje; telefony zachowują, dopóki użytkownik nie wyczyści („Wyczyść u mnie", `lapa.czat.clear`).
- `js/czat.js`: ekran `#/czat` (bez dolnej nawigacji), załączniki (pies, zaginięcie, termin, transport, zdjęcie), odpowiedzi z cytatem, reakcje, prośby o pomoc („Zgłaszam się", „Załatwione"), przypinanie, szukanie, @wzmianki, edycja/usuwanie własnych (koordynator może usuwać cudze), podgląd karty bez wychodzenia z czatu, licznik nieprzeczytanych (`.cbadge` w pasku Start, w menu, odznaka ikony aplikacji), baner o nowej wiadomości poza czatem. Na górze stała, dyskretna informacja o braku szyfrowania; okno „Jak działa czat".
- `js/push.js`: włączanie powiadomień jednym dotknięciem (bez kodów), jednorazowe okno po zalogowaniu, karta zachęty (Start/Czat, „Nie teraz" ukrywa na 7 dni), karta w Ustawieniach (Włącz/Wyłącz/Wyślij testowe, cisza nocna, wyciszenie), instrukcje dla iPhone'a bez ikony na ekranie głównym i dla zablokowanych zgód. Klucz serwera i zapis urządzenia odnawiają się same (`syncPush`).
- `sw.js`: obsługa `push` i `notificationclick` (otwiera lub aktywuje aplikację na `#/czat`), odznaka ikony.
- Serwer: Web Push bez zależności (VAPID ES256 + RFC 8291 aes128gcm, sprawdzone na wektorze testowym z RFC), klucze w `data/vapid.json` (tworzone same), tabela `push`, endpointy `/push/key|subscribe|prefs|unsubscribe|read|test`, dozwolone tylko hosty usług push (FCM, Apple, Mozilla, Windows). Powiadomienie wysyłane po nowej wiadomości `czat` do wszystkich poza autorem; cisza nocna 22:00-7:00 (czasu warszawskiego), przebijają ją „Pilne" i @imię; licznik odznaki per urządzenie liczy też wiadomości pominięte w ciszy. `GET /events` (SSE): każda zmiana na serwerze budzi telefony z otwartą aplikacją, które pobierają dane od razu (zamiast co 45 s).
- Testy: tests/s2.mjs (serwer push/SSE/czyszczenie, atrapa usługi push odszyfrowuje jak przeglądarka), tests/swpush.mjs (sw.js), tests/chat.py (dwóch użytkowników), tests/pushui.py (ustawienia i zgody z atrapą PushManager).
- Nie sprawdzone na prawdziwych telefonach: dostarczenie powiadomienia przez Apple/Google, zachowanie przy trybie „Nie przeszkadzaj" i oszczędzaniu baterii, odznaka na ikonie iPhone'a.


## 1.9.1
- Plakat zaginionego psa jest teraz obrazem PNG (js/plakat.js): Udostępnij/zapisz (gdy przeglądarka pozwala na pliki), Pobierz obraz (nie na iOS; tam przytrzymanie obrazu), Drukuj, Zmień zdjęcie. Pasek podglądu uwzględnia safe-area iPhone'a; Esc zamyka. Dotyczy tylko klienta.

## 1.9.2
- Okna (arkusze): każdy przycisk z data-sheet-close zamyka okno (naprawa „Rozumiem” w czacie).
- Brak powiększania: viewport bez zoomu, blokada gestów ściągania palcami.

## 1.9.3
- Start: mała plakietka „N nowych wiadomości na czacie” pod powitaniem (znika po przeczytaniu).

## 1.9.4 (audyt)
- Naprawa: plakietka czatu na Start kolidowała z klasą czipów w polu pisania (teraz .nchip).
- Import ze strony: błąd połączenia to 502 (nie 500 ze stosem w logach); automatyczne odświeżanie opisów próbuje najwyżej raz na godzinę i przerywa przy błędzie serwera.
- Plakat: zaokrąglenia rysowane także w starszych przeglądarkach bez roundRect.
- Sprawdzone: wszystkie testy, lint, SW ASSETS, importy, ekrany (tel + komputer) bez błędów.

## 1.9.5 / 1.9.6
- 1.9.5 zmieniło szablon posta adopcyjnego w „Teksty” bez prośby właściciela; w 1.9.6 cofnięte (js/teczka.js jak w 1.9.4). Nie zmieniać szablonów tekstów bez wyraźnej prośby.
- Analiza Instagrama schroniska (42 posty 2024-2026, wszystkie adopcyjne): układ „IMIĘ - hasło”, linia „wiek: …; wysokość w kłębie: … cm; waga: … kg; chip: …”, opis ze strony, blok kontaktu Justyna 691 742 265 / Dorota 607 119 526 / e-mail stowarzyszenie.nowodwor@wp.pl w osobnych liniach; bez hasztagów i prawie bez emotikon; dla psów w DT hasło „w domu tymczasowym” / „w domowym hoteliku dla psów”. Zaplanowana (jeszcze niezbudowana, czeka na wyraźne „zaczynaj”) zakładka „Social media”. Facebook nie doładowuje listy postów; potrzebny eksport od administratora lub wklejone przykłady (zbiórki, adoptowane, spacery, DT, hałas).
