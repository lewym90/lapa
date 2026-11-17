# ŁAPA – Nowodwór: stan projektu i przekazanie pracy (wersja 1.15.1, 2026-11-16)

Ten plik pozwala kontynuować pracę z innego konta lub sesji. Nie ma tu haseł ani kluczy (hasła wolontariusza i koordynatora ustawił właściciel na serwerze, zapisane są tylko jako hashe w usłudze systemd).

## Co to jest
PWA (vanilla JS, moduły ES, bez budowania) dla wolontariuszy Stowarzyszenia Wolontariat Schroniska dla Psów w Nowodworze. System zarządzania pracą stowarzyszenia: psy, spacery, Brama, teczka psa, adopcje, domy tymczasowe, zaginięcia, finanse, terminarz, zdjęcia. To niespodzianka dla znajomej właściciela, więc nie pytamy jej o szczegóły i zakładamy pełne uprawnienia każdego wolontariusza. Bez AI i płatnych API. Aplikacja nigdy sama niczego nie publikuje (Facebook, strona).

Wygląd: zieleń #173B32, kość słoniowa #F4F0E7, grafit #252925, szałwia #A8B6A3, złoto #B18A52, terakota #C8795B; Playfair Display + Inter.

## Wdrożenie
- Frontend: GitHub Pages, repo `lewym90/lapa`, gałąź `main`, katalog główny → https://lewym90.github.io/lapa/
- Nowa wersja: `./bump.sh X.Y.Z` (config.js VERSION, sw.js, version.json), commit, push. Aplikacja sama się aktualizuje po ponownym otwarciu (Ustawienia → Sprawdź aktualizację). Każdy nowy plik JS trzeba dopisać do listy ASSETS w `sw.js`.
- Serwer: VPS „NOWY”, katalog /opt/lapa, usługa systemd `lapa`, port 8797, adres https://188-68-247-201.sslip.io/lapa. Node 22 z `node:sqlite`. Pliki: `server/lapa-server.mjs` oraz `js/dogmerge.js` (na serwerze jako `dogmerge.mjs`).
- Aktualizacja serwera (komendę wpisuje właściciel w Termius na serwerze NOWY): `LAPA_REF=<commit> bash <(curl -fsSL https://raw.githubusercontent.com/lewym90/lapa/<commit>/server/aktualizuj.sh)`. Zmiany w `server/*` i `js/dogmerge.js` wymagają tej komendy; zmiany w reszcie `js/` i `css/` nie.
- **1.14.0 wymaga aktualizacji serwera** (rola administratora, ochrona kolekcji `oznaczenia`, kasowanie kontaktów z Bramy po 30 dniach). Komenda aktualizacji przy pierwszym uruchomieniu pyta o hasło administratora (dwa razy, niewidoczne; musi być inne niż hasło wolontariusza i koordynatora; zapisywany tylko skrót `PASS_ADMIN_HASH` w `/etc/lapa.env`). Czy właściciel ją wykonał: sprawdzić logowaniem hasłem administratora (Ustawienia → „Administrator”). Poprzednia aktualizacja: 15.11.2026, commit 022dc98.
- Hasła na serwerze: `/etc/lapa.env` (skróty scrypt). Zmiana: `bash /opt/lapa/zmien-haslo.sh wolontariusz|koordynator|administrator`.
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
- Potwierdzić, że serwer jest po aktualizacji 1.14.0 (hasło administratora działa). Komendę aktualizacji podawać tylko, gdy zmieni się `server/*` albo `js/dogmerge.js`.
- Zdjęcia: wiele plików naraz działa (okno „Zdjęcia / sesja” na karcie psa). Do ewentualnego dopracowania tylko na prośbę.
- Nie zbadane: Instagram, TikTok, YouTube, Puszatek, Psinder; powiadomienia poza aplikacją; kopia poza serwerem; wideo powitalne; redesign strony schroniska.

## Testy
W katalogu `tests/`. Używają lokalnego serwera API na porcie 18999 i statycznego na 8000 (`python3 -m http.server 8000 --bind 127.0.0.1` w katalogu repo). `bash tests/restart_api.sh` uruchamia czysty serwer testowy (kopiuje serwer z repo do /tmp/t; ścieżki liczone od położenia skryptu). Testy zależą od stanu: **przed każdym plikiem testów** restartować API z czystą bazą. Skrypty `*.py` uruchamiać z katalogu `tests/`.
- Serwer (bez przeglądarki): `node tests/s1.mjs` (atrapa strony schroniska), `node tests/s2.mjs` (push, SSE, czyszczenie czatu), `node tests/s3.mjs` (administrator, oznaczenia, kasowanie kontaktów), `node tests/swpush.mjs` (sw.js).
- Aplikacja (Playwright): `e3, e5, e7, e8, e9, e12, e13, kto, chat, pushui` (starsze) oraz `nowe1` (karta przyjęcia i ten sam stan wszędzie, 40), `droga1` (Droga psa i przypomnienia, 25), `teksty1` (szablony tekstów na karcie psa, w tym 2880 porównań z poprzednią wersją, 23), `social1` (Social media, 33), `znaki1` (boks, oznaczenia, opis, Brama, administrator, 46), `audyt` (każdy ekran i główne okna: telefon i komputer, wolontariusz i administrator; otwieranie, wyjście, zamykanie okien krzyżykiem/Esc/tłem, brak wychodzenia poza ekran, 683), `audyt2` (podgląd do druku i plakat), `kolejnosc1` (kolejność alfabetycznie/boks, 19). Wspólne funkcje: `tests/wspolne.py`. Serwer testowy ma hasło administratora `administrator-haslo-3`.
- Stan 16.11.2026 (1.15.0): wszystkie testy przechodzą. Uwaga: e13 (poranny komunikat) przechodzi tylko po 6:00, bo komunikat celowo nie pokazuje się w nocy.

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

## 1.10.0: zakładka „Social media” (js/social.js)
- Menu: Schronisko → Social media (trasy #/social i #/social/<rodzaj>). Rodzaje: pies do adopcji, zróbmy hałas, dom tymczasowy, zbiórka/leczenie, pies adoptowany, zaproszenie na spacery, odwołanie spacerów, relacja po spacerach, Maxi Zoo, podziękowanie; zaginięcie odsyła do istniejącego ekranu Zaginięcia.
- Platformy: Facebook, Instagram, TikTok, YouTube (tytuł i opis osobno), strona schroniska (tytuł, dane psa, opis). Tylko teksty do skopiowania (bez zdjęć, bez publikowania, bez logowania). Miejsce publikacji nadal zaznacza się w karcie psa („Gdzie jest ogłoszony”); w zakładce jest skrót do tego okna.
- Teksty z szablonów ze zmiennymi {imie}, {IMIE}, {haslo}, {dane}, {opis}, {cecha}, końcówki wg płci ({gotowy}, {go}, {mu}, {niego}, {wracal}, {adoptowany}), {kontakt}, {krs}, {yt_stopka} i pola rodzaju. Linie, w których wszystkie zmienne są puste, znikają.
- Edycja szablonu przy każdej karcie: zapis w kolekcji szablony_social (id typ__platforma), synchronizowany dla wszystkich wolontariuszy, „Przywróć domyślny” usuwa zmianę. Domyślne szablony wzorowane na postach FB (od 2.01.2026), IG, TikToka, YouTube i strony.
- Wzorce: TikTok „IMIĘ liczy na pomoc w znalezieniu prawdziwie kochającego go/ją domu i rodziny. Gotowy/Gotowa jest do pokochania i adoptowania. --- PRZEKAŻ 1.5% … KRS 0000861820 #piesek #dogtok #schronisko #niekupujadoptuj #pies”; YouTube tytuł „IMIĘ - jest gotowy do pokochania i adoptowania / czytaj opis ! #dog #pies #shorts #shortvideo” + stopka (kontakt, KRS, linki, prawa autorskie); strona „IMIĘ - hasło” + tabela danych.
- Do sprawdzenia przez właściciela: kontakt w apelach o dom tymczasowy (wzięty standardowy Justyna/Dorota; w postach bywał inny numer 601…), YouTube nie ma pola „ogłoszony” w karcie psa (KANALY bez yt, celowo niezmienione).
- Testy: social1.py (47), social2.py (synchronizacja dwóch użytkowników, offline), audyt ekranów, lint. Naprawiony błąd: odświeżenie kart po „change” gubiło pierwsze dotknięcie Kopiuj.

## 1.10.1
- Social media: każdy wygenerowany tekst jest polem edytowalnym (dopisek, emotka, poprawka) na potrzeby chwili: nie zmienia szablonu (to robi tylko „Edytuj szablon”), zmiany w formularzu go nie nadpisują, „Wróć do wygenerowanego” cofa poprawkę; zmiana psa lub zapis szablonu kasuje poprawkę. Kopiuj bierze tekst z pola. Test: social3.py.

## 1.10.2
- Karta psa → „Gdzie jest ogłoszony”: dodany kanał YouTube (pole `kanaly.yt`). Kontakt w apelach o DT bez zmian (Justyna/Dorota).

## 1.10.3
- Nazwa „Spacer z psem (GPS)” / „Spacer osobisty” zmieniona na „Spacer z wolontariuszem” (menu, okno „+”, tytuły, podpowiedź na Bramie). Pomiar GPS zostaje jako opcjonalne pole w środku.

## 1.11.0: „Droga psa” na karcie psa
- Pasek 7 etapów (Przyjęty, Zaufanie i spacery, Ocena, Zdjęcia, Opis, Ogłoszony, Adopcja) dla każdego psa, liczony z istniejących danych (`droga()` w js/teczka.js). Etapy to nie lista do odhaczenia w jeden dzień.
- Zdobywanie zaufania: pole `zaufanie` (znacznik czasu) w rekordzie psa, ustawiane przyciskiem „Jeszcze nie wychodzi: zdobywamy zaufanie” przy nowym psie bez spacerów; wyłącza się samo po pierwszym spacerze albo przyciskiem „Już wychodzi na spacery”. W tym czasie karta pokazuje liczbę dni, ostatnią notatkę i przycisk „Dodaj notatkę o postępach”, bez ponaglania; „Dziś i do zrobienia” nie przypomina o ocenie, zdjęciach, opisie, publikacji i „zróbmy hałas” dla takiego psa. Filtr „Zdobywamy zaufanie” na liście Psy.
- „Następny krok” (jedna miękka podpowiedź): pierwszy spacer (tylko nowy pies), ocena, sesja, opis, ogłoszenie.
- Klient tylko; import ze strony zachowuje pole `zaufanie`. Test: droga1.py (17).

## 1.12.0: „Nowe psy” (karta przyjęcia krok po kroku)
- Menu: Psy → **Nowe psy** (z plakietką liczby psów w toku). Dolny „+” → „Nowy pies w schronisku”: okno z imieniem tworzy psa (od razu ma kartę w Psy) i otwiera ekran kroków `#/nowe/<id>`. Lista `#/nowe`.
- Tylko psy dodane przez „Nowy pies” (flaga `nowy`) i jeszcze bez `karta_gotowa`. Psy ze strony i dotychczasowe nie trafiają na listę.
- 8 kroków (`kroki()` w js/teczka.js): Przyjęcie, Zaufanie i spacery, Zdrowie, Charakter, Wygląd i cechy, Zdjęcia, Opis i hasło, Ogłoszenie. Każdy otwiera się ponownie do edycji, zapis od razu. Wymagane: Przyjęcie (imię, płeć, data, wiek lub wielkość), Charakter (ocena lub „Pomiń na razie” = `pominiete.ocena`), Zdjęcia, Opis, Ogłoszenie (min. jeden kanał). Reszta opcjonalna; zaufanie nie blokuje.
- Zamknięcie: gdy wymagane są gotowe, każdy telefon po zmianie danych ustawia `karta_gotowa` i pies znika z listy (tylko w Psy). Późniejsze poprawki nie wracają go na listę. „Wróć do uzupełniania” ustawia `karta_otwarta` (nie zamyka się sama), „Zakończ uzupełnianie” zamyka.
- Zapis kroku wczytuje najnowszą wersję psa tuż przed zapisem i zmienia tylko pola kroku (zabezpieczenie przed nadpisaniem przy wspólnym uzupełnianiu). Krok 1 podpowiada, by imię techniczne zmienić na takie jak na stronie (import łączy po imieniu).
- Przypomnienia: plakietka w menu, linia „Nowe psy do uzupełnienia” na Starcie, jeden wpis „Karta przyjęcia: X z 8” w „Dziś i do zrobienia” zamiast osobnych o ocenie/zdjęciach/opisie/publikacji. Pies w trybie zaufania: bez przypomnień.
- Social: trasa `#/social/<rodzaj>/<id psa>` wybiera psa (krok Ogłoszenie → „Przygotuj teksty do postów”).
- Pliki: js/nowe.js (nowy), teczka.js, main.js, social.js, screens-start.js, css, sw.js. Klient tylko, serwer bez zmian. Test: nowe1.py (43).

## 1.13.0 (2026-11-15): jedne zasady postępu psa, edytowalne teksty na karcie psa
Prośba właściciela: wszędzie jednakowo; psów już ogłoszonych nie zmieniamy, skupiamy się na pracy od przyjęcia nowego psa. Klient tylko, serwer bez zmian.
- **Jedne zasady** (js/teczka.js): `przyjecieOk`, `ocenaPominieta`, `maOpis`, `ogloszony` (dowolny zaznaczony kanał, nie tylko FB/strona), `stanKarty` („X z 8” i czego wymaganego brakuje). Korzystają z nich: karta przyjęcia (`kroki`), Droga psa (`droga`), lista Psy, filtr, ekran Nowe psy, „Dziś i do zrobienia” (`gaps`). Usunięty stary licznik `etap()` (5 punktów).
- Lista Psy: plakietka „Nowy” i linia „Karta przyjęcia: X z 8” tylko dla psów z kartą w toku (`wToku`); filtr „Nowe psy (karta w toku)” pokazuje te same psy co ekran Nowe psy.
- Droga psa: „Przyjęty” u nowego psa liczy się jak krok Przyjęcie; „Ocena: na razie pominięta” po „Pomiń na razie” (bez ponaglania o ocenę); „Ogłoszony” = dowolny kanał. Następny krok otwiera to samo okno co krok karty przyjęcia (`nw-step` z `data-k`: przyjęcie, opis, ogłoszenie).
- „Dziś i do zrobienia”: nowy pies w toku = jedno przypomnienie „Karta przyjęcia”; po zamknięciu karty brak osobnych przypomnień „dla nowych” (wcześniej: „bez oceny” mimo pominięcia, „gotowy do opublikowania” mimo ogłoszenia na IG). Przypomnienia dla pozostałych psów (zdjęcia, FB bez strony, status, zróbmy hałas, zdrowie, zniknął ze strony) bez zmian. Dane psów nie są zmieniane.
- **Teksty do postów na karcie psa**: szablony z `{zmiennymi}` w kolekcji `szablony_karta` (id = rodzaj: album, post, halas, dt, sms), wspólne dla wszystkich; „Edytuj szablon” (podgląd, „Wstaw zmienną”), „Przywróć domyślny” z potwierdzeniem, podpis „Szablon zmieniony przez…”, odświeżanie na żywo po zmianie u kogoś innego. Domyślne szablony dają co do znaku te same teksty co 1.12.0 (test teksty1). Proste podstawianie (`wypelnijKarta`): bez usuwania pustych linii, nieznane `{słowa}` zostają. Social media bez zmian (osobne szablony `szablony_social`).
- Testy odtworzone i dodane (nowe1, droga1, teksty1, social1, wspolne.py); e3 dostosowany do 1.12 (Nowy pies otwiera kroki); ścieżki w testach niezależne od katalogu.

## 1.14.0 (2026-11-15): boks, „tylko dla wybranych”, krótki opis, administrator, Brama z kontaktem
Prośba ze schroniska. **Wymaga aktualizacji serwera** (komenda pyta o hasło administratora).
- **Trzy hasła:** wolontariusz, koordynator, administrator. Administrator = wszystkie uprawnienia koordynatora + oznaczanie psów; nie blokuje się po godzinie (klient: `state.admin`, `lapa.admin`; serwer: kolumna `sessions.fp_admin`, sesja administratora nie wygasa po `VOL_TTL`, ważna do zmiany hasła administratora). Hasło administratora/koordynatora działa od razu na ekranie logowania albo przez „Odblokuj…” (okno `unlockSheet`); „Wyłącz tryb administratora” w Ustawieniach.
- **Oznaczenia psa (tylko administrator):** kolekcja `oznaczenia` (id = id psa): `{ opis, wybrani: { on, powody[], inny, kto } | null }`. Serwer przyjmuje zapisy wyłącznie z sesji administratora (`forbidden` dla innych) i zapisuje `by = ''` (nie widać, kto oznaczył; nie dotyka rekordu psa, więc „Ostatnia zmiana” na karcie też nie zdradza). Klient dokleja je do psa jako `d.ozn` w `store.list/get('psy')`, a `save('psy')` je odcina (nigdy nie trafiają do rekordu psa). Krótki opis = zamknięta lista `OPISY` w js/znak.js: specjalny, dla każdego, dla aktywnych, wycofany. Na kafelku zastępuje hasło ze strony (także „w domu tymczasowym”/„w hoteliku”); hasło zostaje w danych i w tekstach postów.
- **Boks:** pole `boks` w rekordzie psa (od 1.14.1 cyfry i litery, np. 12, 7a, A3, „rząd 7/c”; do 8 znaków, `czyscBoks` w js/znak.js; nie znamy numeracji boksów), wpisuje każdy wolontariusz: okno „Gdzie jest…”, przycisk „+ Boks” na karcie, krok Przyjęcie. Widoczny tylko u psa w schronisku.
- **Wspólne znaczki** (js/znak.js: `boksPill`, `wybCls`, `wybPill`, `opisLine`, `linie`, `imieZnaki`): lista Psy (obwódka całego kafelka, pasek z powodem na zdjęciu, boks w rogu), karta psa (ramka na zdjęciach, opis pod imieniem, ramka z powodem), Brama, wybór psa, spacer i raport, Start, Pomoc, Nowe psy, Dziś i do zrobienia, Social media (wybór psa), czat, zaginięcia, adopcje, DT, transport, terminarz, finanse. Kolor `--wyb: #C8322B` (inny niż „Pilne”). Nie ma ich w tekstach postów, na plakatach ani w karcie PDF.
- **Brama:** „Wydaj” otwiera okno (imię, telefon lub Messenger, oba opcjonalne; podpowiedzi dzisiejszych osób), drugi przycisk „Wydaj” zapisuje spacer z godziną tej chwili. W „Poza”/„Wróciły” numer → `tel:`, link m.me/messenger/facebook → Messenger, inny tekst bez linku. Pole `kontakt` w rekordzie spaceru; serwer usuwa je po `KONTAKT_DAYS`=30 dniach (od `start`) z rekordów i historii (imię zostaje).
- Poprawki przy okazji: widoczne zaznaczenie przycisków `chip outline on` (Nowa obserwacja, Pomoc); podgląd do druku zamyka się Esc i przy zmianie ekranu.
- aktualizuj.sh: pyta o hasło administratora, gdy go brak (sprawdza, że jest inne niż dwa pozostałe), zapisuje skrót, przepisuje `zmien-haslo.sh` (+ administrator), potem jak dotąd aktualizuje kod z kopią i powrotem przy błędzie.

## 1.14.1
- Boks przyjmuje litery i cyfry (właściciel: nie znamy numeracji ani rozkładu boksów). Klient tylko; komenda serwera z 1.14.0 bez zmian (commit 63e158a).

## 1.15.0 (2026-11-16): kolejność według boksów
- Przełącznik „Kolejność: Alfabetycznie | Boks” na Bramie (w „Poza” i „Wróciły”: „Godzina | Boks”, bo tam domyślnie według godziny), w wyborze psa do spaceru i na liście Psy (js/znak.js: `kolejnosc`, `kolejnoscHtml`, `poBoksie`, akcja `kolejnosc`).
- Według boksów: psy z boksem w porządku naturalnym (2, 7, 7a, 12, A3; `Intl.Collator` z `numeric`), pod nimi psy bez boksu alfabetycznie (prośba właściciela). Na Bramie w „Wydaj” zostaje podział: najpierw psy, które dziś jeszcze nie wyszły, potem te, które już były; w obu grupach ta sama kolejność.
- Wybór zapamiętuje telefon, osobno dla każdego ekranu (`lapa.kolejnosc.brama|spacer|psy`). Na liście Psy w trybie „Boks” nie ma podnoszenia psów „Pilne” na górę (w trybie alfabetycznym jak dotąd). Klient tylko.

## 1.15.1 (2026-11-16)
- „Tylko wybrani” w wierszach list (Brama, wybór psa, Start, Pomoc, Dziś i do zrobienia, Nowe psy, adopcje, zaginięcia itd.): zamiast grubej czerwonej obwódki na zdjęciu cienka (2 px) czerwona ramka wokół całego wiersza (`:has()`), zdjęcie ze zwykłą złotą obwódką. Bez obsługi `:has()` – obwódka na zdjęciu jak wcześniej. Kafelki na liście Psy i karta psa bez zmian (decyzja właściciela). Tylko CSS.


## 1.16.0 (2026-11-17): role — administrator (schronisko) i wolontariusz (podgląd + zgłoszenia)
Prośba właściciela: pracownicy schroniska = administratorzy (wszystko), wolontariusze (sobotni spacerowicze, pomocnicy) = podgląd Psy, Pomoc, Potrzeby rzeczowe, Transport + zgłaszanie się „ja to ogarnę”. **Wymaga aktualizacji serwera** (komenda robi najpierw kopię bazy). Przed publikacją pracownicy muszą znać hasło administratora — ich dotychczasowe logowanie hasłem wolontariusza staje się podglądem.
- **Hasła:** tylko wolontariusz i administrator. Hasło koordynatora przestaje działać (logowanie i odblokowanie → 401). Administrator ma dawne uprawnienia koordynatora (`state.coordinator === state.admin`). Sesje wolontariusza 180 dni (`VOL_TTL_MS`), administratora bez wygasania (do zmiany hasła). install.sh pyta o hasło administratora zamiast koordynatora; zmien-haslo.sh `wolontariusz|administrator`.
- **Serwer pilnuje ról:** wolontariusz pobiera tylko `VOL_READ` (psy, spacery, potrzeby, transporty, deklaracje, zgloszenia, oferty, spacery_sob, zaginiecia, komunikaty); psy okrojone do `PSY_POLA` (bez zdrowia, czipu, kanałów, opiekuna DT itd.), spacery bez `kontakt`. Kursor przesuwa się także po ukrytych wierszach. Prywatne `p_*` tylko administrator (403). Zapis wolontariusza tylko `VOL_WRITE` (deklaracje, zgloszenia, oferty, p_tel), a zmiana/usunięcie istniejącego tylko przez telefon, który go dodał (tabela `owners`, nagłówek `x-lapa-dev` = `devId()` w js/api.js, skrót w bazie); oferta wolontariusza zawsze `stan: 'nowa'`. `/history`, `/import`, `/import/links`, `/site/sync`, wysyłka zdjęć — tylko administrator. Powiadomienia push (czat) tylko do administratorów (`push.admin`).
- **Telefony zgłoszeń:** `p_tel` `{ref_col, ref_id, tel, imie, ts}` (id = id zgłoszenia), widzi tylko administrator; serwer usuwa po `TEL_DAYS` = 30 dniach (`pruneTelefony`, nagrobki + czyszczenie historii i `owners`).
- **Klient:** `ROUTES_WOL`/`TABS_WOL` (Start, Psy, Pomoc, Potrzeby, Transport; menu: + Sobotnie spacery, Zaginione, Ustawienia); inne ekrany → Start z komunikatem. Ochrona wielowarstwowa: `VOL_ACTIONS` w ui.js (inne akcje → „To może zrobić tylko administrator”), `TylkoAdmin` w store.js, `przelaczRole` w db.js (zmiana roli czyści lokalne dane i pobiera od nowa; także „Wyłącz tryb administratora”).
- **js/wolontariusz.js (nowy):** okno „ja to ogarnę” (imię + telefon, podpowiedź z `lapa.tel`), Pomoc dla psów (chipy potrzeb z imionami), Potrzeby rzeczowe („Mogę przywieźć N”, administrator: „Przyjmij” dolicza, „Dolicz dostawę”), transport („Mogę pojechać”, administrator: „Przypisz”), Sobotnie spacery („Będę”), Start wolontariusza (pies dnia + 6 kafelków), ekran administratora `#/zgloszenia` (wszystkie zgłoszenia z telefonami; karta „Nowe zgłoszenia wolontariuszy: N” na Starcie, licznik od ostatniego obejrzenia `lapa.zgl.seen`). Inni wolontariusze widzą tylko imiona.
- **Karta psa wolontariusza** (`cardWol`): zdjęcia, opis, boks, cechy, ocena charakteru, czego potrzebuje (ze zgłoszeniem), historia spacerów, link do ogłoszenia, Udostępnij. Raport spaceru tylko do odczytu. Zaginięcia, transport, komunikaty — podgląd.
- **Oznaczenia** (tylko dla wybranych + krótki opis): widzi wyłącznie administrator, wszędzie jak w 1.15.1 (znak.js sprawdza `state.admin`; wolontariusz i tak nie dostaje kolekcji `oznaczenia`). Na Bramie dotknięcie imienia psa otwiera oznaczanie.
- aktualizuj.sh: krok kopii bazy (`data/kopia-przed-aktualizacja-DATA/`) przed podmianą kodu.
- Poprawka: szkic formularza (`draft`) po zamknięciu okna nie rzuca błędem.
- Testy: s4.mjs (role na serwerze, 29), wol1.py (zgłoszenia, dwie wolontariuszki i administrator, 45), znaki1 (69) i audyt (584, obie role: tylko dozwolone przyciski u wolontariusza) przepisane; stare testy logują się jako administrator (`wspolne.login` domyślnie `ADM`). tests/zrzuty116.py robi zrzuty (zdjęcia z tmpimg/ — katalog tylko lokalnie).

## 1.16.1 (2026-11-17): audyt po 1.16
**Wymaga aktualizacji serwera.**
- Serwer: powiadomienia z czatu tylko na telefony, których sesja jest TERAZ sesją administratora (kolumna `push.th` = skrót tokenu; złączenie z `sessions` i `fp_admin`). Wcześniej telefon po „Wyłącz tryb administratora”, wylogowaniu albo zmianie hasła nadal dostawałby treść czatu. Test s2 A13.
- zmien-haslo.sh (generowany przez aktualizuj.sh i install.sh): odrzuca hasło administratora takie samo jak wolontariusza i odwrotnie (inaczej każdy wolontariusz logowałby się jako administrator).
- aktualizuj.sh: zostawia 5 ostatnich kopii bazy sprzed aktualizacji.
- Pies dnia i Pomoc: bez psów, które odeszły, zaginęły albo zostały adoptowane (`dogOfDay`, `dogNeeds` patrzą też na `miejsce`).
- Zgłoszenia: „Przyjmij”/„Przypisz” odporne na podwójne dotknięcie; przycisk „Usuń” na ekranie Zgłoszenia wolontariuszy był niewidoczny (jasna ikona na jasnej karcie); na wąskich ekranach przyciski schodzą pod tekst, telefon w jednej linii; po „Będę” podziękowanie „Do zobaczenia pod bramą”.
- Lista Psy: po wyłączeniu trybu administratora filtr „Nowe psy”/„Zdobywamy zaufanie” wraca do „Aktywne”.
- Testy: upgrade1.py (telefon z poprzedniej wersji: wolontariusz czyszczony i pobiera okrojone dane, odrzucone zmiany psów, administrator pobiera wszystko), wol1 rozszerzony (okna wolontariusza tylko z dozwolonymi przyciskami, raport spaceru, pies, który odszedł).

## 1.16.2 (2026-11-17): usuwanie psa dodanego przez pomyłkę
- Karta przyjęcia (`#/nowe/:id`): przycisk „Usuń tego psa (pomyłka)” i podpowiedź, że imię zmienia się w kroku „Przyjęcie”. Na karcie psa bez zmian: „Edytuj” → „Usuń psa z aplikacji”.
- Wspólne `usunPsa(id)` (screens-psy.js, akcja `dog-usun`, tylko administrator): okno pokazuje, co zniknie; usuwa psa razem z jego spacerami, notatkami, wpisami zdrowia, zgłoszeniami pomocy (z telefonami), transportami (z ofertami) i oznaczeniem. Pies ze strony po usunięciu nie zostanie dodany ponownie (serwer pomija usunięte). Poprzednie wersje zostają w historii na serwerze.
- Test usun1.py.

## Wersja testowa (2026-11-17)
- `server/test-srodowisko.sh`: osobna kopia ŁAPY na tym samym VPS pod `https://<domena>/lapa-test/app/` (usługa `lapa-test`, port 8798, `/opt/lapa-test`, `/etc/lapa-test.env`, trasa `/etc/caddy/conf.d/lapa-test.caddy`). Dane = kopia prawdziwej bazy (`VACUUM INTO`, bez subskrypcji push i sesji) + zdjęcia; hasła jak w prawdziwej; strona schroniska nie jest czytana (`SITE_SYNC=0`). Tryby: bez argumentu (instalacja/nowa wersja z `LAPA_REF`), `nowe-dane`, `usun`.
- Serwer: `STATIC_DIR` – podaje pliki aplikacji spod `/app/` (tylko wersja testowa); `SITE_SYNC=0` wyłącza czytanie strony.
- Klient: `TEST` w config.js (adres zawiera `/app/`) → API = ten sam serwer; czerwony pasek „WERSJA TESTOWA”. Inny adres = osobne dane w przeglądarce (nie miesza się z prawdziwą aplikacją).
- Gałąź `test` w repozytorium = to, co jest na wersji testowej. GitHub Pages publikuje tylko `main`.
