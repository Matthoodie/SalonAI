# ZRIHTAN — D1: temelj planirane popunjenosti

Polazna verzija: 8387838; paket C potvrđen s 300/300 frontend testova i ručnim pregledom.
Datum: 16. studenoga 2026.

## Opseg ovog paketa

D1 dodaje dvije čiste backend funkcionalne cjeline i 30 testova. Nema HTTP rute,
upita prema bazi, migracije, promjene ovlasti, novih ovisnosti ni promjene sučelja.
Postojeći dashboard ostaje na verziji paketa C. Novi izračun još nije pozvan iz aplikacije.
D2 treba implementirati autorizirano čitanje baze, pretvorbu rasporeda u UTC prozore
i HR/EN prikaz planirane popunjenosti. D1 nije završena funkcija za korisnika.

## Nalaz pregleda postojećeg koda

- `employeeRepository.js` zamjenjuje tjedne rasporede i dnevne iznimke, uključujući
  DELETE iz `employee_working_hours` i `employee_date_overrides`.
- `appointmentRepository.js` čita trenutačni tjedni raspored, iznimku za datum,
  odobrenu/ručno unesenu odsutnost iz `employee_time_off` i stvarne blokade.
- `availabilityService.js` daje prioritet odsutnosti, zatim dnevnoj iznimci,
  pa tjednom rasporedu. Izostanak radnog vremena znači neradni dan.
- Trenutačna provjera kolizija tretira sve statuse osim `cancelled` kao zauzeće.
- Pregledani model nije evidencija povijesnih verzija rasporeda. Stare termine
  nije korektno dijeliti današnjim kapacitetom i rezultat nazvati povijesnom popunjenošću.

Zato prvi prikaz kapaciteta planiramo za sadašnjost/budućnost uz jasno označenu
osnovu: trenutačno spremljeni raspored. Vrijednost nije evidencija stvarno odrađenih sati.

## Izračun i jedinice

Svi intervali su poluotvoreni `[starts_at, ends_at)`. Unutarnje trajanje je cijeli broj
milisekundi bez zaokruživanja. Za prikaz sati dijeli se s 3.600.000, minuta sa 60.000.

1. Spoji preklapajuće radne prozore zaposlenika i ograniči ih na traženi raspon.
2. Spoji stvarne blokade; oduzmi samo dio koji preklapa radne prozore.
3. Raspoloživi kapacitet = radni prozori minus blokade.
4. Zauzeće = unija neotkazanih termina unutar raspoloživog kapaciteta.
5. Slobodno = kapacitet minus zauzeće.
6. Popunjenost = zauzeće / kapacitet × 100. Kada nema kapaciteta, rezultat je `null`,
   nikada 0%. Postojeći kapacitet bez termina daje 0%.

Salon zbraja zaposlenik-sate: dva zaposlenika sa smjenom od osam sati daju 16 sati
kapaciteta. Ukupni postotak računa se iz zbroja vremena, a ne prosjekom postotaka osoba.
Više usluga u jednom terminu ne množi zauzeće: koristi se spremljeni početak i kraj termina.
Kapacitet ne uključuje ograničenja prostorija/opreme niti jamči da u svaki slobodan
fragment stane odabrana usluga. Za rezervaciju ostaje mjerodavan postojeći availability API.

## Interni ulazni ugovor

`calculateCapacityPlan` prima `salon_id`, `timezone`, `as_of`, `range` i `employees`.
Raspon ima `starts_at` i `ends_at`. Zaposlenik ima `employee_id`, `salon_id`, `active`,
`working_windows`, `blocks` i `appointments`. Svaka stavka tih nizova nosi oba identiteta
i UTC početak/kraj; termin dodatno `id` i kanonski `status`.

- Vrijeme je ISO UTC s `Z`, sekundama i opcionalno točno tri decimalna mjesta.
- Raspon mora početi u/poslije `as_of`; tehnički maksimum je 32 protekla dana.
  D2 može u UI ponuditi kraće raspona poput 7 ili 30 lokalnih datuma.
- `as_of` mora u D2 zadati server, ne klijent. Vrijeme zone je obavezno i provjereno.
- Maksimum 500 zaposlenika i ukupno 25.000 ulaznih intervala/termina; prekoračenje
  odbija izračun. Adapter ne smije skratiti rezultat bez upozorenja niti slati nepotpune stranice.
- Pozivatelj mora najprije razriješiti raspored po lokalnim datumima salona i pretvoriti
  prozore u nedvosmislene UTC intervale. D1 NE pretvara lokalno radno vrijeme u UTC.
- Odsutnost/neradni dan daju prazan radni prozor. Pauze i stvarne blokade idu u `blocks`.
  Zahtjev na čekanju ne daje blokadu; koristiti efektivne tablice, ne zahtjeve.
- Inaktivni zaposlenici ne doprinose rezultatu. Njihovi dostavljeni podaci ipak se validiraju.
- Svi identifikatori salona/zaposlenika moraju se slagati, a zaposlenici i termini
  ne smiju imati duplicirane identifikatore. Nepotpuni/neispravni podaci bacaju grešku.

Ovo je interni matematički ugovor, NE autorizacija ni ulaz javnog API-ja.
Identitete i rasporede nikada ne smijemo prihvatiti od preglednika kao izvor istine.

## Anomalije i točnost

- `outside_capacity_ms`: unija termina unutar traženog raspona, ali izvan kapaciteta
  (npr. izvan smjene ili u blokiranom vremenu). Prikazati upozorenje; ne povećavati postotak preko 100.
- `overlapping_booking_ms`: zbroj trajanja pojedinih termina minus njihova unija.
  To su višestruko rezervirane milisekunde; kod tri istodobna termina višak je dvostruk.
- `unusual_status_count`: budući termini sa statusom `completed` ili `no_show`.
  V1 ih zadržava kao zauzeće sukladno sadašnjoj provjeri kolizija i označava anomaliju.
- `booking_count`: broj neotkazanih termina koji presijecaju raspon aktivnih zaposlenika,
  uključujući termine izvan kapaciteta; ne zbraja se po uslugama.
- Vraćeni `capacity_intervals` i `occupied_intervals` omogućuju buduće presijecanje po
  lokalnim satnim ćelijama. D1 ne izrađuje niti prikazuje toplinsku mapu.
- DST testovi potvrđuju proteklo trajanje već razriješenih UTC intervala (23/25 sati)
  i očuvanje dvije pojave jesenskog sata. Ne potvrđuju budući lokalni konverter rasporeda.

## Obavezni sljedeći korak D2

1. Owner/admin API sa server-side provjerom aktivnog članstva i salona; zaposlenik 403.
2. Dosljedan read-only DB snapshot; svi upiti salon-scoped, ograničen datum/radni skup,
   bez N+1 upita i bez prešutne paginacije/skraćivanja.
3. Poštovati prioritet odsutnost > dnevna iznimka > tjedni raspored; testirati ponedjeljak/nedjelju.
4. Definirati i testirati nepostojeće/ponovljene lokalne sate prije spajanja. Ne birati
   nejasan lokalni trenutak prešutno; ne prikazivati takav izračun kao potpun.
5. Odvojeni API, DB i timezone testovi te browser zaštita od kasnog odgovora prethodnog salona.
6. HR/EN UI, teme, tablična alternativa toplinskoj mapi, prazna stanja i oznaka vremena izračuna.
7. Slobodno vrijeme ne nazivati brojem dostupnih termina; to ovisi o usluzi, trajanju i kvalifikacijama.

Povijesna iskorištenost zahtijeva zasebno projektiranje verzioniranja/snimki rasporeda.
Ne prikazivati današnji raspored kao stvarni raspored nekog prošlog mjeseca.

## Provjere i primjena

- `node --test --test-reporter=spec tests/capacityIntervals.test.js tests/capacityPlan.test.js`: 30/30.
- Seeded grid oracle uspoređuje intervalne operacije s nezavisnim diskretnim modelom u 200 scenarija.
- Instalacija provjerava hash polaznih datoteka, čuva backup i vraća promjene pri grešci pisanja.
- Paket ne pristupa TEST/DEV bazi i ne zahtijeva njihovo pokretanje.
- Postojećih 300 frontend testova nije povećano ovim backend paketom.
- Šira regresija API-ja/baze i vizualni pregled novog prikaza pripadaju D2 kada nastaje integracija.

## Redoslijed nakon D1

D2: autorizirana integracija kapaciteta i vizualizacija. E: poslovni uvidi temeljeni
na provjerenim metrikama. Zatim WhatsApp, preostale produkcijske provjere, pilot,
naplata i mobilni/PWA/store koraci glavnog roadmapa. Javno kreiranje salona ostaje kontrolirano.
