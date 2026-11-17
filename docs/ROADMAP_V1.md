# ZRIHTAN — završni roadmap prve javne verzije

Ažurirano: 17. studenoga 2026.
Potvrđena polazna verzija: 9b0eb66 (temelj kapaciteta D1).
Aktualni paket: D2 vizualna dorada i dvije djelatnosti; lokalni prihvat dorade slijedi.

## Cilj prve verzije

Jedna aplikacija za frizerske/barber salone i grooming salone, sa zajedničkim katalogom,
rasporedom, zaposlenicima, rezervacijama, klijentima i ovlastima. Grooming je dio prve
verzije prije javne objave, a ne naknadna opcija. Izbor djelatnosti prilagođava iskustvo
bez odvajanja aplikacije u zasebne kopije.

Kozmetički saloni i složeniji beauty centri cilj su verzije 2 nakon izlaska live.
Podrška za sobe, uređaje, više istodobnih resursa i paralelne tretmane također ostaje za V2.

## Potvrđeno završeno

- Rezervacije i provjera dostupnosti, zaposlenici i njihove usluge.
- Više usluga unutar jednog termina: jedan klijent, jedan zaposlenik, uzastopno izvođenje,
  ukupno trajanje i cijena, povijesne snimke stavki.
- Zahtjevi za odsutnost i blokirano vrijeme, zaštita postojećih termina.
- Ovlasti, članstva i odabir salona prema dosadašnjim provjerama.
- Korisničko ime/fotografija, uređene Postavke i pregled poslovanja s rasponom datuma.
- Backend potvrđenog uvoza cjenika: preview, validacija, duplikati, transakcija i idempotencija.
  TEST i DEV migracija uspješne; 719 backend testova prošlo.

Ovaj popis nije tvrdnja da je produkcijska spremnost već potvrđena.

## Aktualni slijed prema dogovoru

1. Primijenjeno i korisnički potvrđeno: uvoz cjenika, vizualno usklađivanje stranica,
   svijetla/tamna tema, Magic Wizard, vlasnici s više ljubimaca, povezivanje termina
   i privatne fotografije ljubimaca (0f5d016).
2. Grooming 5 potvrđen: zaseban pregled zakazanih i prethodnih termina ljubimca;
   904 backend testa i 208 frontend testova, build i ručne provjere; commit e5db279.
3. Sada: Grooming 6 — neobavezna veličina/težina profila i završna regresija.
   Dokumentacija: [GROOMING_PHASE6.md](GROOMING_PHASE6.md). TEST/DEV provjere slijede.
   Minijature fotografija na terminima ostaju zasebna, neobavezna dorada uz definirane
   ovlasti; nisu uvjet za početak HR/EN faze.
4. HR/EN: jezik na početnom zaslonu, u Wizardu i Postavkama; zatim cijelo sučelje,
   poruke i formatiranje. Zajednički sustav prije WhatsApp/AI funkcionalnosti.
5. WhatsApp i dogovorene AI funkcionalnosti.
6. Mobilna/PWA, tehnički prototip Android/iOS aplikacije i produkcijska priprema.
7. Besplatni pilot, povratne informacije i stabilizacija.
8. Naplata. Beauty centri i složeniji resursi ostaju V2.

Registracija Clerk računa ne stvara automatski salon. Kreiranje prvog salona ostaje
kontrolirano kroz postojeću serversku konfiguraciju i dopuštene Clerk identitete.
Welcome bez obrasca za novi salon očekivan je za račun bez članstva i bez dozvole za
kreiranje. Wizard nije uklonjen; nastavlja se nakon dopuštenog kreiranja salona.

### Opseg HR/EN implementacije

- Jezik sučelja je osobna postavka, odvojena od djelatnosti salona, valute i vremenske zone.
- Prije prijave razuman početni izbor; nakon prijave pohranjena osobna postavka, s planom
  sinkronizacije između uređaja. Zaposlenici istog salona mogu koristiti različite jezike.
- Izdvojiti tekstove u kataloge HR/EN: navigaciju, obrasce, validaciju, statuse, prazne
  prikaze, uvoz, grooming, zahtjeve i autentikacijske ekrane gdje je podržano.
- API zadržava stabilne kodove grešaka; korisničke poruke prikazivati prema jeziku.
- Datum, vrijeme, iznosi i množine koriste odabrani jezik, ali vrijeme termina i dalje
  računa vremenska zona salona. Odabir engleskog ne mijenja EUR u drugu valutu.
- Imena, bilješke, uneseni cjenici i pasmine ne prevode se automatski.
- Provjeriti nedostajuće prijevode, duže tekstove, obje teme, uži prikaz, trajnost odabira
  i promjenu računa. Ovo je plan, nije dio paketa Grooming 5.

Sljedeći odjeljci i datirana ažuriranja čuvaju povijest implementacije; ovaj aktualni
slijed ima prednost pred starijim navodima o tome što je "sljedeće" ili čeka provjeru.

## 1. Dovršetak uvoza cjenika

### Paket 1 — backend: završeno
Pregled bez zapisivanja; potvrda svih odabranih stavki u jednoj transakciji;
ponovljena potvrda vraća prethodni rezultat; nema prepisivanja postojećih usluga.

### Paket 2 — nacrt i potvrda na frontendu: završeno
- Uređivanje naziva, kategorije, cijene i trajanja.
- Odabir stavki i izričita primjena zajedničkog trajanja.
- Nepoznato trajanje ostaje prazno; najmanje jedna cijela minuta prije spremanja.
- Pregled i potvrda mogućih duplikata.
- Ponovna provjera nakon izmjene nacrta.
- Zaštita od dvostrukog klika, neizvjesnog odgovora i promjene salona.
- Samo potvrda u tijeku čuva se u sessionStorage po korisniku i salonu;
  običan nespremljeni nacrt traje dok je obrazac otvoren.
- Testovi, build, ručna provjera vlasnika/zaposlenika, commit.

### Paket 3 — fotografija/PDF i prepoznavanje: implementirano i ručno provjereno
- Fotografija s mobitela, screenshot ili PDF postaju uređiv nacrt.
- Prepoznati tekst nikada se automatski ne sprema u katalog.
- Nepouzdane cijene, valuta, paketi i doplate označavaju se za pregled.
- Varijante usluge razdvajaju se u stavke za korisničku potvrdu.
- Odabrati pružatelja obrade, ograničenja veličine/broja stranica i pravila čuvanja datoteka.
- Ključevi ostaju na backendu; kontrolirati pristup, potrošnju i greške obrade.
- Bez izmišljanja trajanja i automatske konverzije valuta.

### Paket 4 — provjera cijelog postupka
Stvarni primjeri frizerskih i grooming cjenika, fotografije slabije kvalitete,
prazni/ponovljeni dokumenti, prekid veze, duplikati, mobilni prikaz i izolacija salona.
Izlazni kriterij: dokument -> pregled -> dopuna -> potvrda -> nove upotrebljive usluge.

## 2. Magic Wizard — vođeno početno postavljanje

Završni početni ekran za novog vlasnika ima pet koraka, prije dashboarda:

1. Vaš salon: djelatnost, naziv, lokacija i vremenska zona.
2. Vaš tim: samostalni rad ili tim, stvarni profili zaposlenika i rad vlasnika.
3. Usluge: ručni unos ili fotografija/PDF, pregled i dopuna trajanja.
4. Raspored: radno vrijeme i povezanost zaposlenika s uslugama.
5. Pregled i početak rada: backend provjera obveznih uvjeta pa otvaranje dashboarda.

Koraci se spremaju i mogu nastaviti nakon odjave; povratak na prethodni korak je dopušten.
Postojeći saloni ne zaključavaju se retroaktivno. Pozvani članovi ne kreiraju salon ponovno.
Kreiranje salona ostaje zatvoreno, uz dopušteni razvojni račun do pripreme javnog pilota.

Završna ručna provjera uključuje i prvi probni termin.

Wizard treba moći nastaviti već započeto postavljanje bez stvaranja duplikata.
Predlošci su izbor korisnika, ne automatski poslovni podaci. Postojeći saloni ne prolaze
ponovno obavezno kroz početno postavljanje. Grooming se ne predstavlja potpuno spremnim
dok nisu završene funkcije iz sljedeće faze. Beauty funkcije se ne nude kao dovršene u V1.

## 3. Grooming modul — obavezan za V1

### Podaci
- Klijent ostaje vlasnik/kontakt; jedan vlasnik može imati više ljubimaca.
- Ljubimac: ime, vrsta životinje, pasmina ili opis/mješanac, veličina/težina,
  praktične napomene o dlaci i postupanju te opcionalna fotografija kao avatar.
- Fotografija je privatni sadržaj salona; definirati ograničenja i kontrolu pristupa.
- Nepoznate podatke ne izmišljati niti zahtijevati bez poslovne potrebe.

### Termini i povijest
- Jedan ljubimac po terminu u prvoj verziji.
- Termin povezan s vlasnikom, ljubimcem, zaposlenikom i odabranim uslugama.
- Odvojena povijest svakog ljubimca; vlasnik vidi se kao kontakt.
- Varijante usluga prema veličini/vrsti njege; cijena i trajanje jasno potvrđeni.
- Pasmina sama ne određuje automatski cijenu ili trajanje.
- Postojeći frizerski termini rade bez ljubimca.
- Promjena vlasnika/arhiviranje mora čuvati povijesne zapise i izolaciju salona.

Izlazni kriterij: vlasnik s dva ljubimca, zasebni profili i fotografije, odvojeni termini,
ispravan kalendar, ukupno trajanje više usluga i povijest bez miješanja životinja.

## 4. Probni rad frizerskog i grooming scenarija

- Proći od prvog ulaska i Wizarda do stvarne rezervacije i završetka termina.
- Provjeriti owner/admin/employee, salon switch, cijene i statistiku.
- Provjeriti mobitel, slike ljubimaca, prazna stanja i jasne poruke pogrešaka.
- Ukloniti blokirajuće nedostatke prije javne objave.

## 5. Dovršetak ranije planiranih integracija

Zadržati ranije planirani smjer WhatsApp/n8n i AI asistenta; detaljan opseg konkretnih
paketa definirati prije njihove implementacije. Ovaj roadmap ne smatra ih već dovršenima.
Integracije moraju koristiti istu provjerenu dostupnost, ovlasti i pravila rezerviranja,
uključujući ljubimca kod groominga. Ne smiju pisati izravno mimo booking servisa.
Prvo ograničen, testiran tok rezervacije/potvrde; zatim dodatne automatizacije.

## 6. Mobilna/PWA i priprema za javnu objavu

- PWA instalacija i provjera na Androidu/iOS-u; jasna poruka bez mreže, bez nesigurnog offline rezerviranja.
- Odvojena produkcijska konfiguracija, baza i autentikacija.
- Hosting, domena, HTTPS, produkcijski API i mediji.
- Provjera migracija, sigurnosnih kopija i stvarnog postupka povrata podataka.
- Praćenje grešaka i operativna provjera ključnih tokova.
- Kontrola pristupa, izolacija salona i ograničenja vanjskih integracija.
- Korisničke upute unutar aplikacije: osnovni rad, uvoz, Wizard, zaposlenici i grooming.
- Definirati podršku, obradu podataka i sadržaj potrebnih korisničkih dokumenata.
- Prije naplate definirati planove, ograničenja i provesti implementaciju/provjeru
  pretplata; zasebno razlikovati besplatni pilot i komercijalnu objavu.
- Završni regresijski testovi, frontend build i ručni scenariji obje djelatnosti.

## 7. Objava V1 i besplatni pilot

Označena verzija, kontrolirani deploy, provjera nakon objave i prve povratne informacije.
Javna objava slijedi tek nakon dovršenog groominga s pasminom i avatarom ljubimca,
Wizarda, uvoza i dogovorenih funkcija prve verzije. Točan datum ovisi o provjerama,
ne o proizvoljnom postotku dovršenosti.

## 8. Naplata nakon besplatnog pilota

Na temelju interesa pilot-korisnika potvrditi planove, cijene, ograničenja i pružatelja
naplate. Zatim implementirati pretplate, provjeru webhookova, prava pristupa, otkazivanje
i oporavak od neuspjele naplate; testirati prije uključivanja stvarnih plaćanja.

## Verzija 2 — nakon live objave

Kozmetički saloni i složeniji beauty centri, resursi poput soba/ležajeva/uređaja,
paralelni tretmani, složeniji obračuni trajanja/cijena i naprednije automatizacije.
Prioriteti se potvrđuju prema iskustvu prvih korisnika.

## Ažuriranje — početni ekran (faza 4A)

- Početni ekran bez poslovnog izbornika za račune bez odabranog aktivnog salona.
- Prihvat pozivnice i izbor između više dostupnih salona koriste postojeći backend.
- Učitavanje i greške također ne prikazuju poslovni sidebar.
- Ovo nije završetak obveznog onboardinga. Kreiranje ostaje isključeno u konfiguraciji.
- Sljedeći paket: povezani koraci Salon → Tim → Usluge → Raspored → Pregled,
  backend provjera spremnosti i potvrda dovršetka prije dashboarda za nove salone.
- Postojeći saloni nastavljaju raditi bez obveznog ponovnog postavljanja.

## Ažuriranje — povezani onboarding (faza 4B)

- Uveden obrazac kreiranja za allowlist račune, trajno spremljen identičan zahtjev
  za izričito ponavljanje nakon neizvjesnog rezultata.
- App pri odabiru salona provjerava status. Novi salon ostaje u pet koraka do
  backend potvrde; postojeći salon bez onboarding retka radi kao prije.
- Tim, usluge i raspored koriste postojeće stranice i iste API-je unutar wizarda.
- Završna provjera: izbor djelatnosti/načina rada, aktivni profil, aktivna usluga,
  svaka usluga pokrivena aktivnim kvalificiranim zaposlenikom s tjednim rasporedom.
- Samostalni način: jedan aktivan profil, vlasnik pruža usluge.
- Stvarni PostgreSQL testovi i Vite build moraju proći lokalni verifier prije aktivacije.
- Nema javnog moda kreiranja. Nova dozvola vrijedi samo za izabrani razvojni račun.
- Slijedi lokalni cjeloviti test novog salona, zatim grooming s pasminom i fotografijom.
- Grooming izbor djelatnosti još ne implementira profile ljubimaca. Beauty ostaje V2.

## Ažuriranje — izgled aplikacije V1

- Uklonjen lokalni JSON izvoz iz korisničkih Postavki i App.jsx.
- Dodan osobni odabir Svijetlo / Tamno / Prema uređaju; pamti se po računu u pregledniku.
- Usklađene boje poslovnih stranica, obrazaca, kartica i statusa uz postojeću strukturu.
- Početni Magic Wizard zadržava zaseban izgled; kreiranje salona ostaje isključeno.
- Slijedi: grooming — više ljubimaca jednog klijenta, vrsta, pasmina, fotografija,
  odabir ljubimca na terminu i povijest posjeta.
- Zatim WhatsApp i dogovorene AI funkcionalnosti, mobilna/PWA i produkcijska priprema,
  besplatni pilot te naplata. Beauty centri i složenije djelatnosti ostaju V2.

## Ažuriranje — Grooming 1 (baza i API)

- Dodana podloga za više ljubimaca po klijentu: ime, vrsta, pasmina, napomena,
  arhiviranje i ponovno aktiviranje; izolacija salona i kontrola verzije izmjene.
- API namijenjen owner/admin računima grooming/mixed salona. Postojeći frizerski
  tijek termina ostaje nepromijenjen. Migraciju i DB testove potvrditi lokalno.
- Sljedeći paket: prikaz ljubimaca u CRM-u u svijetloj/tamnoj temi. Nakon toga
  povezivanje s terminima/poviješću i fotografije, kako je dogovoreno.
- Nastavak: WhatsApp i dogovoreni AI -> mobilna/PWA i produkcija -> besplatni pilot
  -> naplata. Kozmetički/složeni beauty centri ostaju V2.

## Ažuriranje — Grooming 2 (CRM sučelje)

- Klijenti → Detalji → Ljubimci: više profila, ime, vrsta, pasmina i bilješke.
- Dodavanje, uređivanje, arhiviranje/aktiviranje; svijetla i tamna tema.
- Kontrola ovlasti, salonske djelatnosti, verzija i neizvjesnog spremanja ostaje aktivna.
- Grooming 3: povezivanje termina/povijesti s ljubimcem. Grooming 4: fotografije/avatar.
- Zatim WhatsApp i dogovorene AI funkcionalnosti → mobilna/PWA i produkcijska priprema
  → besplatni pilot → naplata. Beauty centri i složenije djelatnosti ostaju V2.
- Mobilna faza uključuje tehnički prototip Android/iOS aplikacije (kandidat Capacitor),
  provjeru Clerk prijave, sigurne pohrane sesije, API pristupa, kamere/fotografija,
  navigacije, tipkovnice, safe-area prostora i stvarnih uređaja.
- Prije javne objave: zasebna produkcijska baza i tajne, domena/HTTPS, backup i probni
  povrat podataka, nadzor grešaka, ograničenja troškova AI-a i kontrolirano puštanje.
- Google Play/App Store: razvojni računi, potpisivanje, privatnost i brisanje računa,
  testna distribucija i pregled trgovina. Store objava nije automatski dio PWA instalacije;
  odobrenje i datum objave ovise o provjerama. Plaćanje se razrađuje nakon pilota.

## Ažuriranje — Grooming 3A (backend veze termina)

- Pripremljena migracija i API veza termina s jednim ljubimcem i njegovim vlasnikom.
- Povijesne oznake ljubimca, zajednička izmjena vlasnika/ljubimca s kontrolom verzije,
  zabrana preklapanja istog ljubimca te ograničen izbor za ovlaštene zaposlenike.
- Stari termini ostaju neklasificirani; nema automatskog pridruživanja životinja.
- 3A zadržava staro kreiranje bez novih polja radi kompatibilnosti postojećeg UI-ja.
  Migraciju i cijeli integracijski suite obvezno potvrditi na TEST bazi prije DEV-a.
- Sljedeći 3B: povezati obrazac i pooštriti backend obvezni odabir za grooming;
  mixed person/pet; prikaz obaju identiteta u terminima, kalendaru, dashboardu,
  pretrazi i povijesti. Grooming 3 ostaje u tijeku dok 3B ne prođe provjere.
- Zatim fotografije/avatar → WhatsApp i dogovoreni AI → mobilna/PWA, Android/iOS
  prototip i produkcijska priprema → besplatni pilot → naplata. Beauty ostaje V2.


### Grooming 3B — integracija termina (paket za provjeru)

- Odabir vlasnika i ljubimca u obrascu, mješoviti tok osoba/ljubimac.
- Obvezni ljubimac za novo grooming kreiranje i na backendu.
- Atomska promjena vlasnika/ljubimca s postojećim zaposleničkim ovlastima.
- Prikaz spremljenih podataka ljubimca i vlasnika u terminima, kalendaru, dashboardu i povijesti vlasnika.
- Kompatibilnost starih termina bez nagađanja životinje.
- Detalji i ručna provjera: GROOMING_PHASE3B.md. Zaključiti nakon lokalnog TEST suitea, builda i korisničke provjere.
- Sljedeće: fotografije ljubimaca; WhatsApp/AI; mobilna/PWA i produkcija; besplatni pilot; naplata.

### Grooming 3B — lokalna provjera potvrđena

- Korisnički izvještaj: 869/869 backend, 188/188 frontend, Vite build i diff check
  uspješni; ručni scenariji potvrđeni. Paket je spreman za commit prije fotografija.

### Grooming 4 — fotografije profila (paket za provjeru)

- Jedna fotografija po ljubimcu; pregled, zamjena i potvrđeno uklanjanje u CRM-u.
- Obrada i smanjivanje na serveru, bez EXIF/GPS i bez javnih URL-ova; baza čuva
  obrađenu sliku. Jedna migracija, bez novih ovisnosti ili AI poziva.
- Detalji: GROOMING_PHASE4.md. Zaključiti nakon lokalnih TEST/DEV i ručnih provjera.
- Preostale grooming dorade: zasebna povijest ljubimca i eventualne minijature uz
  termine uz posebno definirane zaposleničke ovlasti; postojeće oznake ostaju.
- Zatim WhatsApp i dogovorene AI funkcionalnosti → mobilna/PWA, Android/iOS prototip
  i produkcijska priprema → besplatni pilot → naplata. Beauty/složene djelatnosti V2.

## Ažuriranje — Grooming 5: termini pojedinog ljubimca

- Fotografije: korisnik potvrdio rad, provjere i commit/push 0f5d016.
- Novi read-only API i CRM prikaz svih statusa termina po salonu, vlasniku i ID-u ljubimca.
- Po 20 termina, nastavak preciznim vremenskim kursorom; bez automatskog pridruživanja
  starih termina i bez promjene rasporeda, statistike vlasnika ili ovlasti zaposlenika.
- Koristi indeks iz Grooming 3A. Nema nove migracije, ovisnosti ni promjene .env.
- Lokalne provjere autora: 192 backend testa bez PostgreSQL-a, 208 frontend testova,
  kompilacija JSX-a, React provjera povijesti i regresija fotografija. PostgreSQL,
  puni backend suite i Vite build obvezno provjeriti priloženim verifierom kod korisnika.

## Ažuriranje — Grooming 6: veličina i težina

- e5db279 uspješno poslan na development; radna grana čista prema korisničkom ispisu.
- Pripremljena dva neobavezna podatka profila: ručna kategorija veličine i težina u kg.
- Težina se pohranjuje kao cijeli broj grama. Unos dopušta zarez ili točku i do tri
  decimale. Prazno nije nula. Veličina se ne nagađa prema težini ili pasmini.
- Stari profil ima NULL; stari API zahtjev koji izostavi nova polja čuva prethodne
  vrijednosti. Izričito prazno polje u novom obrascu briše samo taj podatak.
- Jedna dodajuća migracija, bez novih ovisnosti. Fotografije, termin i povijest ostaju
  povezani s istim profilom. Cijena/trajanje termina ne mijenjaju se prema težini.
- Nakon TEST/DEV i ručne regresije zaključiti grooming paket i prijeći na HR/EN.
  Cijeli nastavak: HR/EN → WhatsApp/AI → mobilna/PWA, Android/iOS prototip i produkcija
  → besplatni pilot → naplata. Beauty centri ostaju V2.


## HR/EN — phase 1A (after Grooming 6)

- Implemented personal browser language preference (HR default / EN), separate per account.
- Selectors: Welcome, onboarding, Settings and Settings wizard; open forms retain drafts.
- First translated surfaces: Welcome shell and account/language settings.
- English coverage remains partial and is labelled in the selector.
- NEXT 1B: invitation, salon creation, both wizard bodies/validation; then full operational UI and locale presentation.
- Language never changes salon timezone/currency or user-entered data. No new migration/dependency.
- See LANGUAGE_PHASE1A.md for exact coverage and verification.
- Following stages remain WhatsApp/agreed AI -> mobile/PWA/store preparation and production -> free pilot -> billing.

## HR/EN — phase 1B (package ready for local verification)

- Phase 1A committed/pushed as a1ae2e7; user confirmed language preference and Welcome behaviour.
- Translated invitation acceptance, controlled creation and both wizard frames/instructions/validation.
- Live errors translate on language switch; drafts, request IDs, setup revision and account/salon scopes are preserved.
- Partial-coverage notice moved out of Welcome/onboarding headers. Obsolete Settings wizard help updated.
- Author checks: 229 frontend tests, App JSX compilation and mocked React flow regression checks.
- Pending user verification: installed Vite build and manual HR/EN acceptance; see LANGUAGE_PHASE1B.md.
- Remaining: full shared shell/Settings, embedded employee/service/import components, then other operational pages and locale formatting.
- Salon creation remains controlled; language work never enables it or repeats a mutation.
- After language rollout: WhatsApp/agreed AI -> mobile/PWA/store and production preparation -> free pilot -> billing.

## HR/EN — phase 1C (ready for user verification)

- Phase 1B manual checks and commit/push ac15975 confirmed by user.
- Shared navigation/header, profile labels, theme settings and permission management/history now translated.
- Locale switches preserve drafts, account/salon names, guards and theme. History uses salon timezone.
- Author checks: 236 frontend tests, App compilation, mocked React behaviour and installer regression.
- Pending user checks: installed Vite build and manual acceptance; see LANGUAGE_PHASE1C.md.
- Planned total: seven packages (1A–1G); large scopes may be split if needed.
- Next 1D Employees/Services/import; 1E Appointments/Calendar/Dashboard; 1F Clients/pets;
  1G absence/blocked requests plus remaining messages and global locale QA.
- Full English is not yet complete. No migration, dependency or salon-creation configuration change.
- Following roadmap remains WhatsApp/agreed AI -> mobile/PWA/store/production -> free pilot -> billing.

## HR/EN — phase 1D-A (ready for local acceptance)

- Phase 1C accepted and pushed as 5998dfd; working tree clean in user output.
- Phase 1D split into 1D-A Services/import and 1D-B Employees/schedules/invitations/memberships.
  Seven functional phases now use eight planned installation packages.
- 1D-A translates Services and embedded forms, manual import, review/duplicates and recognition UI.
- EUR display follows HR/EN; names/categories/source notes and request data remain unchanged.
- 243 frontend tests, App compilation and mocked UI import/recognition regression passed before packaging.
- User Vite build/manual checks pending; details in LANGUAGE_PHASE1DA.md.
- Remaining: 1D-B -> 1E Appointments/Calendar/Dashboard -> 1F Clients/pets -> 1G requests/global locale audit.
- Track bundle optimization before production: phase 1C main chunk warning at 501.68 kB.
- No new migration/dependency/configuration change. Following product roadmap remains unchanged.

## HR/EN — phase 1D-B (ready for local acceptance)

- 1D-A accepted: 243/243 tests, manual checks; commit a6db864 pushed to development.
- 1D-B translates Employees, employee schedules, invitations and memberships/history.
- User content, permission guards, request payloads and protected UTC intervals preserved.
- 251 frontend tests, App JSX compilation and mocked React/UI regression passed before delivery.
- Installed Vite build and user manual acceptance pending; see LANGUAGE_PHASE1DB.md.
- No migrations, dependencies or configuration changes.
- Next: 1E Appointments/Calendar/Dashboard -> 1F Clients/pets -> 1G requests/global HR/EN audit.
- Public salon creation remains intentionally disabled. Product roadmap and bundle optimization unchanged.

## HR/EN — phase 1E-A (ready for local acceptance)

- 1D-B accepted and pushed as 199b0e5; 251/251 tests and manual checks confirmed.
- 1E split into 1E-A Calendar/Dashboard and 1E-B Appointments/booking forms.
  Seven functional phases now use nine planned installation packages.
- 1E-A translates overview labels, statuses, calendar dates, counts and EUR display.
- Existing permissions, date keys, salon timezone calculations, statistics and callbacks retained.
- User-entered owner/pet/breed/service/employee names remain literal.
- 259 frontend tests, App JSX compilation, mocked React regression and installer checks passed.
- Installed Vite build and manual HR/EN/light/dark/mobile acceptance pending.
- Next: 1E-B -> 1F Clients/pets -> 1G requests and global locale QA.
- No migrations/dependencies/config changes. Public salon creation remains controlled.
- See LANGUAGE_PHASE1EA.md. Bundle optimization and the following product roadmap remain tracked.

## HR/EN — phase 1E-B (ready for local acceptance)

- 1E-A accepted with 259/259 tests and manual checks; edebfe1 pushed to development.
- 1E-B translates Appointments, booking/recipient/service editors, cards and shared quick ClientForm.
- Canonical statuses, owner/pet IDs, recipient revisions, service snapshots, permission checks and
  API/date/time/availability contracts preserved. Locale changes retain drafts and do not retry writes.
- 267 frontend tests, App JSX compilation, mocked React workflow tests and installer checks passed.
- User Vite/live-backend/manual acceptance remains pending; see LANGUAGE_PHASE1EB.md.
- Next: 1F Clients/pets/photos/history -> 1G absence/blocked requests and global HR/EN QA.
- Seven functional phases / nine planned installation packages. No new dependencies or migrations.
- Public salon creation remains controlled. Bundle optimization and the wider product roadmap remain tracked.

## HR/EN — phase 1F (ready for local acceptance)

- 1E-B accepted with 267/267 checks and pushed as e6ae5d9; working tree clean.
- 1F translates Clients, client cards/details, pets, photos, measurements and pet history.
- Drafts, file selections, literal user content, permission guards, revisions, payloads,
  pagination and salon timezone preserved; language changes do not retry requests.
- 275 frontend tests, App compilation, mocked React workflow and installer checks passed.
- Installed Vite build/live API/manual HR/EN acceptance pending; see LANGUAGE_PHASE1F.md.
- Next: 1G absence/blocked requests and global locale QA. Nine planned installation packages.
- No migration/dependency/config changes. Public creation remains controlled.
- Bundle optimization, WhatsApp/agreed AI, mobile/PWA/store/production, pilot and billing remain tracked.

## HR/EN — phase 1G (ready for local acceptance)

- 1F accepted with 275/275 tests and manual checks; 63d3cfb pushed, working tree clean.
- 1G translates absence/blocked-time requests, validation, conflict/uncertainty messages,
  confirmations and audit metadata; retains canonical payloads and salon-zone semantics.
- Global source audit addresses salon loading/access/switching, page error/loading UI,
  bilingual pre-identity loading and obsolete onboarding translation-progress notices.
- 283 frontend tests, full App JSX compilation, mocked React request/error-boundary
  scenarios and installer safety checks passed. User Vite/live/manual acceptance pending.
- See LANGUAGE_PHASE1G.md. No migration, new dependency or configuration change.
- Nine planned installation packages delivered through 1G; final cross-page acceptance
  still required before declaring the HR/EN phase closed. Browser-native dialogs and
  Clerk authentication UI remain distinct; user-entered content is not translated.
- Next: close HR/EN regression findings, then continue the main product roadmap.
- Bundle optimization, WhatsApp/agreed AI, mobile/PWA/store/production, free pilot and
  billing remain tracked. Public salon creation remains controlled.

## Accepted HR/EN and pre-WhatsApp sequence — 2026-11-15

- 1G accepted by user: 283/283 tests, full manual HR/EN checks; 29033f4 pushed cleanly.
- A: shared localised file picker for pricelist and pet photos; ready for local acceptance.
  See FILE_PICKER_V1.md. Native OS dialog language is outside application translations.
- B: rebrand visible product to ZRIHTAN; preserve internal keys and identifiers unless
  explicitly migrated. Use original logo assets and update public branding systematically.
- C: dashboard completed service value, future bookings value, averages, trends and
  top services. Use stored snapshots; distinguish service value from actual payments.
- D: capacity/utilisation and heatmap; confirm historical schedule availability first.
- E: deterministic business insights with clear definitions and sufficient data.
- Later statistics may use earlier stored facts; do not reconstruct missing historical
  schedules as fact or display unavailable metrics as zero.
- Then WhatsApp and remaining production/mobile/pilot/billing roadmap items.
- Public salon creation remains controlled. Package A has no migration or dependencies.

## ZRIHTAN rebrand — package B

- A accepted with 283/283 tests and manual checks; 9d7a6c2 pushed cleanly.
- B adds the supplied logo and consistent ZRIHTAN wordmark to application entry,
  welcome, onboarding, sidebar and mobile header; updates browser title/favicon.
- Existing data, personal preferences, auth identity and controlled creation retained.
- External Clerk/domain/email branding tracked separately in ZRIHTAN_REBRAND_V1.md.
- Next C: dashboard values/trends/top services; D: capacity/heatmap; E: rule-based
  insights; then WhatsApp and remaining production/mobile/pilot/billing roadmap.

## Business dashboard — package C

- B accepted: 283/283, rebrand committed/pushed as 2c4358b; clean development branch.
- C: completed value, future 30-calendar-date booking value, average completed value,
  count, equal-length previous period, bounded trend with exact table, top-five services.
- Owner/admin only new business overview; employee scope and existing schedules retained.
- Uses existing full authorised appointment list and saved prices/items. See
  DASHBOARD_BUSINESS_V1.md for exact definitions, incomplete data handling and limits.
- 300/300 frontend tests and React/compilation checks passed; local Vite/visual acceptance next.
- Move aggregates server-side before introducing pagination or materially larger datasets.
- D capacity/heatmap requires a historical schedule review; E rule-based insights;
  then WhatsApp and remaining production/mobile/pilot/billing roadmap.

## Kapacitet — D1, temelj planirane popunjenosti

- C prihvaćen: 300/300 frontend testova, uspješan ručni pregled, commit/push 8387838.
- Pregled zamjene rasporeda ne potvrđuje dostupnost povijesnih verzija radnog vremena.
- D1 dodaje čisti intervalni izračun kapaciteta, zauzeća, slobodnog vremena i anomalija.
- 30 novih backend testova; bez baze, migracija, API-ja, novih ovisnosti i UI promjena.
- D1 još nije integriran u aplikaciju. Upute i ugovor: DASHBOARD_CAPACITY_PHASE1.md.
- D2 slijedi: autorizirano čitanje baze, lokalni raspored → UTC, API/DB/DST testovi,
  HR/EN prikaz planirane popunjenosti i toplinska mapa s tabličnom alternativom.
- E: deterministički poslovni uvidi; zatim WhatsApp i ostali produkcijski/pilot/billing/mobile koraci.
- Povijesnu popunjenost ne izvoditi iz današnjeg rasporeda; javno kreiranje ostaje kontrolirano.

## Kapacitet — D2, integracija planirane popunjenosti

- D1 prihvaćen: 30/30, commit/push 9b0eb66; čista grana development.
- D2 povezuje efektivne rasporede, iznimke, odsutnosti, blokade i rezervacije u
  autoriziranom, konzistentnom read-only snimku baze; bez nove migracije.
- Owner/admin pregled za 7/14/30 lokalnih datuma od sada: sati, postoci, zaposlenici,
  toplinska mapa i brojčana tablica; HR/EN, teme, prazna stanja i obrada pogrešaka.
- 54 ciljane backend unit/API i 310 frontend provjera; 7 novih DB scenarija
  čeka lokalni PostgreSQL verify zajedno s cijelim backend suiteom i Vite buildom.
- Ugovor, DST, ograničenja, ovlasti i prihvat: DASHBOARD_CAPACITY_PHASE2.md.
- Povijesne smjene se ne izmišljaju. Promjene rasporeda vrijede za novi izračun plana.
- Slijedi E: poslovni uvidi prema pravilima; zatim WhatsApp, produkcija/pilot/billing/mobile.
- Javno kreiranje salona ostaje u postojećem kontroliranom režimu.

## D2 — prihvaćen izračun, dorada prikaza

- Korisnik potvrdio 54/54, TEST migracije, 7/7 PostgreSQL, 975/975 backend i
  310/310 frontend; poslovni izračun i ostale kontrole funkcionalni.
- Dorada: do sedam vidljivih dana, dnevni detalji, sati/minute, kartice na mobitelu,
  bez vodoravnog klizača; ukupni pokazatelji i dalje pokrivaju 7/14/30 dana.
- Jednodnevna usporedba prikazuje dva eksplicitna datuma/iznosa bez grafa;
  višednevni graf ima samo odabrano razdoblje i stvarne datume.
- Svi wizardi nude hair/grooming: Frizerski salon i brijačnice / Ljubimci.
  Prethodno spremljeni mixed/other zadržavaju se bez automatskog prepisivanja.
- 314 frontend testova i React/kompilacijske provjere; lokalni vizualni prihvat
  i Vite build slijede. Detalji: DASHBOARD_PRESENTATION_V1.md.
- Zajednički commit D2 + dorada nakon prihvata, potom E i WhatsApp.
