# Support S3D-B3 — jedna kontrolirana DEV obavijest

Polazni commit: b6d1478. Paket pripremljen 24.11.2026.; čeka korisnički prihvat.
Nema nove migracije, npm ovisnosti, HTTP rute, frontend izmjene ni automatskog slanja.
Sljedeća kategorija nakon prihvata: I1 — domena i hosting.

## Svrha

Povezati postojeći S3D-B2 s aktualnim Clerk identitetom i Resend transportom iz B1.
Odgovor operatera → held događaj → pregled → priprema → izričito jedno slanje.
Ovo je administrativni DEV CLI, a ne produkcijski worker niti javni API.
Pristup CLI-ju pretpostavlja ovlašten pristup DEV računalu, bazi i serverskim tajnama.
Salonska owner uloga sama po sebi ne daje ovlast slanja. Funkciju CommandService
nikada ne izlagati kao HTTP rutu: authorId u CLI-ju nije autentikacijski dokaz.

## Nove datoteke

- backend/scripts/support-delivery-dev.js
- backend/src/services/supportClerkContactService.js
- backend/src/services/supportDeliveryCommandService.js
- backend/src/utils/supportDeliveryCommand.js
- backend/tests/supportDeliveryCommand.test.js
- backend/tests/supportDeliveryCommand.db.js
- docs/SUPPORT_PHASE3DB3.md
- ažuriran docs/ROADMAP_V1.md

## Granice i konfiguracija

CLI čita DATABASE_URL i CLERK_SECRET_KEY iz backend/.env, ne iz naslijeđenih varijabli.
Zahtijeva naziv salonai_dev u URL-u i stvarni current_database() prije drugih radnji.
Clerk ključ mora počinjati sk_test_. Njime se dohvaća aktualni korisnik, primarna
adresa i verified status. Banned, locked, deleted i deprovisioned računi se odbijaju.
Nema oslanjanja na zastarjeli lokalni users.email, metadata ili adresu operatera.
Nedostupna provjera kontakta zaustavlja rad prije slanja. Provjera ima vremenski limit;
pozadinski SDK read nakon timeouta ne može pokrenuti slanje.

Resend ključ za --send dolazi samo iz procesne ZRIHTAN_RESEND_API_KEY.
Ne unositi ga kao argument, u frontend, dokumentaciju, Git ili chat.
Slanje se obavlja samo na točno odabranu adresu koja se podudara s potvrđenom
primarnom adresom autora. Prijave drugih korisnika ne preusmjeravaju se testnom primatelju.
Pošiljatelj: ZRIHTAN <notifications@notify.zrihtan.com>.
Poruka sadrži broj prijave i uputu za otvaranje podrške; nema sadržaja razgovora.
Ne sadrži link na app domenu koja još nije postavljena.

## Načini rada (iz backend mape)

- --help: upute bez baze i mreže.
- --start --database salonai_dev: read-only UTC prag iz vremena baze.
- --list --database salonai_dev --after UTC_TIMESTAMP: najnovijih 20 događaja poslije praga;
  event_id, ticket_id, author_id, state, created_at. Nema sadržaja prijava ni adresa.
- --preview --database salonai_dev --after UTC_TIMESTAMP --event ID --author ID --to EMAIL:
  provjera kontakta i minimalni sadržaj obavijesti; nema upisa niti slanja.
- --prepare uz iste argumente: trajno zamrzavanje poruke, held → ready; nema slanja.
- --send uz iste argumente i --confirm-event ID: najviše jedan pokušaj slanja.
- --status --database salonai_dev --event ID --author ID: stanje i evidencija pokušaja,
  bez e-maila, tijela prijave i tajni; radi bez Clerk/Resend ključa.

Prag ostaje isti za pregled, pripremu i slanje. Pripremljenom događaju ne mijenjati
prag ni primatelja. --start ništa ne aktivira globalno i ne priprema stare događaje.
Ako zatvoriš terminal nakon pripreme, ponovno upiši ISTI ranije ispisani UTC prag.
Ne kreiraj novi prag za već pripremljenu poruku.

## Ishodi

- ready nakon prepare: poruka je pripremljena, još nije poslana.
- accepted: Resend je prihvatio zahtjev; nije dokaz dostave. Provjeri Resend i sandučić.
- accepted pri ponovnom --send: samo povrat stanja, bez novog kontakta s providerom.
- held/not_prepared: najprije pregled i priprema; izlazni kod 2.
- blocked/missing/rejected/suppressed: ne nastavljati slanje; izlazni kod 2.
- sending/uncertain: izlazni kod 3; pregled statusa i provider evidencije prije odluke.
- ready nakon stvarnog slanja uz rate_limited: zahtjev nije prihvaćen; vidi next_attempt_at.
  Nema automatskog retryja. B2 dopušta ograničeni ponovni pokušaj nakon backoffa.
- CLI exception: kod 1, generička greška bez tajni; nakon --send najprije --status.

Za uncertain ne raditi SQL reset, ne stvarati novu poruku radi ponovnog slanja iste obavijesti.
Istek leasea ne znači da e-mail nije poslan. Reconciliation je operativni izlazni kriterij,
a ne razlog za slijepo ponavljanje. Trenutni CLI ne rješava provider status webhookom.

## Provjere

Lokalno: 40 novih izoliranih testova; ukupno 206 izoliranih support testova prolazi.
Syntax provjere i --help prolaze. Nijedan pravi e-mail nije poslan pri tim provjerama.
Šest novih PostgreSQL testova koristi stvarne repository/transakcije uz simulirani
Clerk i HTTP transport. Samo u testu adapter predstavlja već provjerenu TEST bazu
kao DEV za command guard; produkcijski CLI nema takvu zastavicu ni override.
PostgreSQL ovdje nije dostupan: korisnik pokreće 6 novih + 17 B2 + 10 outbox testova
na salonai_regression te cijeli backend s TEST konfiguracijom. Nema migracije u B3.

Ručni prihvat: novi odgovor autoru vlastitog testnog računa, preview verified,
prepare ready, send accepted, jedan primljeni e-mail, status attempt_count=1,
ponovni --send i dalje accepted i attempt_count=1, bez nove poruke u Resendu.
Dok taj prihvat nije potvrđen, S3D-B3 ostaje PRIPREMLJENO.

## I1 i granica završetka

Nakon ovog paketa slijedi I1, bez dodavanja novih funkcija podrške.
U hostanom okruženju još treba postaviti automatsko izvršavanje, odvojene tajne,
aktivacijsku granicu, kontrolu grešaka/obavijesti te provjeru isporuke i postupak
razrješenja neizvjesnog ishoda. Ti kriteriji ostaju otvoreni do operativnog prihvata.
Ovaj paket ne zatvara produkcijsku e-mail spremnost, rokove čuvanja ili sve R1/R2 kriterije.

## Povrat

B3 ne mijenja shemu. Uklanjanje CLI-ja ne briše evidenciju B2.
Ako je paket već committan, revert njegova commita kroz zaseban kontrolirani korak.
Ako nije, instalater čuva raniji roadmap u TEMP backupu; prvo provjeriti Git diff.
Ne vraćati stanje prihvaćene ili neizvjesne obavijesti u held/ready.
