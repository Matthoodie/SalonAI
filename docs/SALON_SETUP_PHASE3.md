# Magic Wizard — paket 3: kontrolirano kreiranje prvog salona

Polazna verzija 4d26d21. Paket 2 je korisnik provjerio (143 frontend testa, build,
ručni rad Wizarda), commitao i poslao. Ovaj paket mijenja samo backend i dokumentaciju.

## Granice ovog paketa

- Autentificirani račun može provjeriti smije li kreirati prvi salon.
- Kreiranje je ISKLJUČENO bez eksplicitne konfiguracije. Podržani su disabled i
  allowlist; public/ostale vrijednosti ne omogućavaju kreiranje.
- Kreiranje samo za dopušteni aktivni lokalni račun povezan s Clerk subjectom.
  Identitet dolazi iz postojećeg Clerk middlewarea i ponovno se provjerava u bazi.
- Svaki dopušteni račun bez bilo kakvog članstva može samostalno kreirati jedan salon.
  Neaktivno članstvo također blokira ovaj tok; ono se rješava kroz postojeći pristup.
- Salon, vlasničko članstvo, prvi nacrt Wizarda, status onboardinga i potvrda
  zahtjeva upisuju se u jednoj transakciji. Nema automatskog zaposlenika ni usluga.
- Jednaki ponovljeni zahtjev vraća iste ID-eve (200 umjesto prvog 201).
  Drugi sadržaj s istim UUID-om daje 409; drugi UUID istog računa nakon uspjeha daje 409.
- Zaključavanje retka korisnika serijalizira istodobne pokušaje kreiranja.
- Replay provjerava aktualni aktivni salon i aktivno vlasništvo; ne vraća ukinuti pristup.
- Potvrda ostaje kao zabrana drugog kreiranja i nakon brisanja salona (salon_id=NULL).
- Nova tablica salon_onboarding sadrži samo salone kreirane ovim postupkom.
  Postojeći saloni se NE upisuju migracijom i njihov status je not_required.
- Spremanje last_step=review nije dovršetak. Ovaj paket nema completion endpoint.

Ovaj paket još NE mijenja početni ekran/bočni izbornik, ne otvara javnu registraciju
salona i ne zaključava postojeće poslovne API rute. Novi salon ima trajni status
in_progress kao podlogu za sljedeći paket s početnim tokom i provjerom dovršenosti.
Do tada nemoj ručno aktivirati kreiranje u produkciji; u razvoju ga testiraju DB testovi.

## API ugovor

Rute su iza Clerk middlewarea i requireAuthenticatedUser. Prve dvije ne zahtijevaju
salon i ne koriste X-Salon-Id za određivanje vlasnika. Sve vraćaju Cache-Control:no-store.

GET /api/salon-onboarding/eligibility
```
{ "data": { "can_create": false, "reason": "disabled" } }
```
reason: disabled | not_allowed | already_created | existing_membership | null.
can_create=true je trenutačna informacija; POST ponovno provjerava sve uvjete.

POST /api/salon-onboarding/salons — točno pet polja:
```
{
  "request_id": "UUID v4 generiran jednom za ovaj pokušaj",
  "name": "Moj salon",
  "timezone": "Europe/Zagreb",
  "business_type": "hair",
  "location": "Pula"
}
```
name: obvezno 1–150 Unicode znakova nakon trim; location: 0–250 bez kontrolnih znakova.
business_type: hair | grooming | mixed | other. Zona mora biti podržana i u Nodeu i PostgreSQL-u.
Dodatna polja (user_id, salon_id, role, completed...) odbijaju se.

201 prvi uspjeh / 200 replay:
```
{ "data": { "salon_id": "123", "membership_id": "456", "replayed": false } }
```
Odgovor sadrži rezultat kreiranja, ne aktualno stanje salona. Nakon uspjeha osvježiti
/api/auth/workspaces, odabrati dobiveni salon postojećim transportom, učitati /api/auth/me
te /api/salon-onboarding/status i /api/salon-setup.

Kod neizvjesnog ishoda sačuvati ISTI request_id i ISTE podatke. Bez automatskog retryja;
izričito ponavljanje istog zahtjeva provjerava potvrdu. Ne generirati novi UUID za retry.

GET /api/salon-onboarding/status — zahtijeva odabrani salon i aktivno članstvo:
```
{ "data": { "salon_id": "123", "status": "in_progress", "requires_setup": true } }
```
status: not_required za ranije salone bez retka; in_progress za nove; completed za
budući potvrđeni završetak. requires_setup je true samo za in_progress.
Član može čitati status vlastitog salona; to mu ne daje vlasničke ovlasti.

## Konfiguracija (nije potrebna za primjenu ovog paketa)

Zadano ne dodavati ništa u .env; kreiranje ostaje zatvoreno.
Za kasniji kontrolirani UI test, tek nakon upute:
```
SALON_CREATION_MODE=allowlist
SALON_CREATION_ALLOWED_SUBJECTS=user_STVARNI_CLERK_ID_TESTNOG_RACUNA
```
Vrijednost mora biti točan Clerk User ID, ne email, API ključ ni lokalni numeric ID.
Više ID-eva odvaja se zarezom; prazna/neispravna lista zatvara mogućnost kreiranja.
Nema javnog načina rada u ovom paketu. Javni pilot dodatno zahtijeva zaštitu od
masovnog kreiranja računa i ograničenja zahtjeva na infrastrukturnoj/aplikacijskoj razini.
Nakon promjene .env ponovno pokrenuti backend. Ovdje nema AI poziva ili troškova API-ja.

## Migracija i provjere

1793728800000_create-salon-onboarding: dvije nove tablice, bez izmjene postojećih zapisa.
Down briše stanje onboardinga i potvrde; ne briše ranije kreirane salone/članstva.
Zato down nije postupak za poništavanje otvorenog salona i ne treba ga ručno pokretati.

Lokalno prošla 122 unit/API testa, uključujući 9 novih. Postojeći appointments.test.js
izostavljen je samo iz lokalnog unit izvođenja jer ovisi o PostgreSQL-u. Nije mijenjan.
Dodano je 17 PostgreSQL/API testova: transakcija, replay, konkurentnost, sukob tijela,
izolacija identiteta, postojeći/neaktivni članovi, rollback, status i uvjeti pristupa.
PostgreSQL nije dostupan u okruženju pripreme: te testove obvezno pokreće verifier na TEST
bazi zajedno s CIJELIM backend suiteom (uključujući appointments.test.js).
Nema novih ovisnosti. Priloženi verifier ne migrira DEV bazu i ne koristi AI ključ.

## Sljedeće

- Početni ekran bez poslovnog sidebara za račun bez salona, prihvaćanje pozivnice,
  kontrolirani početak kreiranja salona i nastavak nakon prekida.
- Pet koraka: Vaš salon → Vaš tim → Usluge/cjenik → Raspored → Pregled i početak rada.
  Usluge se mogu upisati ručno; upload nije obvezan. Povratak i spremanje po koraku.
- Ugrađeno uređivanje unutar početnog postupka, bez potrebe za pristupom dashboardu.
- Stvarna backend provjera aktivnog izvođača, usluga/trajanja, kvalifikacija i rasporeda
  prije completion endpointa; sam broj zaposlenika ili last_step nisu dokaz spremnosti.
- Pozvani zaposlenik prihvaća pozivnicu i ne postavlja vlasnikov salon ponovno.
- Postojeći saloni ostaju dostupni. Wizard u Postavkama ostaje za njihovo uređivanje.
- Potom grooming/pasmina/fotografija → WhatsApp/AI → PWA/produkcija → besplatni pilot → naplata.
