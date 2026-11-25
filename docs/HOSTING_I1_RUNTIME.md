# ZRIHTAN I1 — staging backend runtime

Polazna verzija: development 2e2cb56. Status: PRIPREMLJENO, nije objavljeno.

## Opseg

Zaseban ulaz backend/src/stagingServer.js koristi procesne varijable i validator
iz prethodnog paketa. Odbija pogrešnu konfiguraciju i prisutnu lokalnu .env datoteku
prije učitavanja poslovne aplikacije. Ne mijenja npm run dev ni postojeće rute.
Nema migracije, novih ovisnosti, slanja poruka ili zapisivanja tajni.

Prije svih poslovnih ruta stoji stagingBoundary: zahtijeva Bearer token,
Clerk provjerenu aktivnu sesiju i točan Clerk user ID iz dopuštenog popisa.
Owner uloga salona sama po sebi ne daje staging pristup. Popis testera također
ne dodjeljuje salonske ovlasti ni ovlast operatera podrške.

Jedina javna provjera je GET/HEAD /healthz. Provjerava dostupnost baze i stvarni
current_database() = zrihtan_staging, vraća samo status ok ili generičku grešku.
To nije provjera migracijskog stanja; migracije i poslovni smoke test obavezni su
prije prihvata deploya. OPTIONS s ispravnim originom samo odobrava preflight;
ne prosljeđuje se poslovnim rutama. Ostali zahtjevi zahtijevaju prijavu.

CORS dopušta točno STAGING_APP_ORIGIN, Authorization, Content-Type i X-Salon-Id.
Browser iz drugog origina dobiva 403. Zahtjev bez Origina i dalje mora proći
Clerk i allowlist. Autorizacija se ne oslanja na CORS niti na korisničke ID zaglavlja.
Odgovori imaju no-store i noindex; noindex nije zamjena za autentikaciju.

Node HTTP sluša 0.0.0.0 i validirani PORT. SIGTERM/SIGINT zaustavlja prihvat,
čeka postojeće zahtjeve i zatvara pool; krajnji rok gašenja je 8 sekundi.
Pool je ograničen na 5 veza; početno povezivanje i health query imaju rok 3 sekunde.
Nema automatskih migracija, seedanja ili workera. Resend ključevi ostaju zabranjeni
prethodnim staging ugovorom. Postojeći loggeri poslovnih ruta nisu predmet ovog paketa.

## Provjere

Iz backend mape:

    node --test tests/stagingConfiguration.test.js tests/stagingHosting.test.js

42 prethodna + 45 novih testova = 87 testova. Novi testovi provjeravaju boundary
sa zamjenskom autentikacijom, CORS, health iznimku, sanitizaciju pogrešaka,
stvarni lokalni HTTP poslužitelj i gašenje s lažnim poolom. Ne pozivaju Clerk,
Resend niti PostgreSQL. Prijava s pravim Clerk tokenom i Render DB provjera
ostaju obavezan prihvat na stagingu. Puni backend/DB testovi ovdje nisu izvršeni.

## Sljedeći korak I1

Nakon lokalnih testova i commita pripremiti Render Web Service i frontend adresu.
Predviđene postavke (još ne pokretati deploy):
- projekt ZRIHTAN, environment Staging, regija Frankfurt;
- grana development, root directory backend;
- build npm ci;
- start node src/stagingServer.js;
- health check /healthz;
- početno ručni deploy, bez automatske objave svakog pusha.

Prije deploya treba završiti kontroliranu naredbu migracija za praznu staging bazu,
provjeriti Node verziju na hostingu, frontend /api povezivanje, Clerk testne ključeve
iste instance, stvarne tester ID-jeve i točan HTTPS origin. Hosting varijable unose se
u Render, ne u lokalnu .env niti Git. Internal Database URL ne šalje se u chat.
Testerski račun i njegovo članstvo u novoj staging bazi trebaju zaseban onboarding.
Podaci iz salonai_dev ne kopiraju se automatski.

## Povratak

Instalacija ispisuje putanju sigurnosne kopije ROADMAP_V1.md. Prije commita,
uz pregled Git statusa, mogu se ukloniti samo nove datoteke ovog paketa i vratiti
taj dokument iz kopije. Nakon commita koristi se pregledani git revert tog commita.
Nema baze za vraćanje jer paket ne mijenja bazu.
