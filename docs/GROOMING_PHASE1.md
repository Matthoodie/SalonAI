# Grooming 1 — profili ljubimaca: baza i API

Temelj za odnos klijent (vlasnik) -> više ljubimaca. Nema frontend promjena,
izmjena termina ni uploada fotografija u ovoj fazi. Postojeći podaci se ne pretvaraju
u ljubimce. Migracija stvara praznu tablicu client_pets i indeks.

## Pristup i model

- Aktivni vlasnik salona ili administrator; aktivno članstvo, korisnik i salon
  ponovno se provjeravaju u transakciji prema bazi.
- business_type u salon_setup mora biti grooming ili mixed. Bez postavljene
  djelatnosti, ili kod hair/other, API vraća PET_BUSINESS_DISABLED (403).
- Ako se djelatnost kasnije promijeni, postojeći ljubimci ostaju u bazi, ali se
  pristup blokira dok salon ponovno ne odabere grooming/mixed.
- Svaki ljubimac ima salon_id i client_id; složeni strani ključ sprječava vezu
  s klijentom drugog salona. API ne prihvaća promjenu vlasnika ili salona.
- Ime: 1–100 Unicode znakova. species: dog, cat, other. breed: do 150 znakova,
  može biti prazan tekst, Mješanac ili Nepoznata. notes: do 2000 znakova.
- Jednaka imena nisu identitet: dvije životinje istog vlasnika smiju imati isto ime.
- active je odvojen od vlasnikova statusa. Arhiviranje ne briše profil.
- Arhivirani vlasnik: pregled i arhiviranje dopušteni; stvaranje, uređivanje i
  aktiviranje zahtijevaju da vlasnik ponovno bude aktivan. Aktivacija vlasnika
  ne aktivira automatski njegove arhivirane ljubimce.
- revision kreće od 1. Svaka stvarna izmjena povećava verziju; stara verzija daje
  PET_VERSION_CONFLICT (409). Ponavljanje već postavljenog statusa uz aktualnu
  verziju ne povećava verziju.
- Nema DELETE rute. Administrativno brisanje klijenta/salona u bazi kaskadno briše
  ljubimce; normalni CRM koristi arhiviranje.

## API

Sve rute koriste postojeći privatni middleware i odabrani salon, nikada salon
ili korisnika iz tijela zahtjeva. Odgovor je {data: ...}, Cache-Control: no-store.

| Metoda | Putanja | Tijelo / rezultat |
| --- | --- | --- |
| GET | /api/clients/:clientId/pets | Popis aktivnih i arhiviranih ljubimaca tog klijenta |
| POST | /api/clients/:clientId/pets | name, species, breed, notes; 201 s novim profilom |
| PUT | /api/clients/:clientId/pets/:petId | Cijeli profil + expected_revision; 200 |
| PATCH | /api/clients/:clientId/pets/:petId/active | active (boolean), expected_revision; 200 |

Nepoznat klijent u salonu ili ljubimac pod pogrešnim vlasnikom daje 404.
Nedopuštena polja (salon_id, client_id, active u stvaranju, photo_url itd.) daju 400.
POST nema idempotency ključ: nakon neizvjesnog mrežnog ishoda prvo osvježiti popis,
a ne automatski ponavljati zahtjev. Budući UI mora poštovati to pravilo.
Bilješke se u budućem UI-ju prikazuju kao tekst, nikada kao HTML.

## Provjere i uvođenje

- 11 novih unit/API/transaction testova: vrijednosti, identiteti, ovlasti,
  odbijanje neispravnog unosa prije DB pristupa, rollback, release i bez retryja.
- 11 PostgreSQL testova: više ljubimaca, lifecycle, stale/concurrent updates,
  izolacija salona/vlasnika, autoritativne ovlasti, arhivirani vlasnik, djelatnost,
  FK/constraints i puni HTTP tok. Pokreću se na zasebnoj TEST bazi korisnika.
- Cijeli backend suite i frontend testovi/build obavezni su u verifieru prije DEV migracije.
- Ovdje nema dostupnog PostgreSQL poslužitelja; ne tvrdi se da su DB testovi već
  prošli. Verify skripta prvo migrira TEST bazu i provjerava da nije ista kao DEV.
- Nove ovisnosti i AI pozivi nisu potrebni. Kreiranje salona ostaje isključeno.
- Migracija: 1793901600000_create-client-pets. DEV up tek nakon svih provjera.
  Down briše tablicu i sve ljubimce — ne koristiti za rutinski povrat nakon unosa podataka.

## Sljedeće faze

2. UI u profilu klijenta, više ljubimaca, uređivanje/status, obje teme.
3. Ljubimac na terminu i kalendaru, povijest, prikladan ograničeni pristup zaposlenika
   u okviru njegovih booking ovlasti (puni CRM ostaje owner/admin).
4. Fotografija: siguran upload, pohrana, pristup i zamjena/uklanjanje.
Zatim WhatsApp/AI, mobilna/PWA, produkcija, besplatni pilot i naplata; beauty V2.
