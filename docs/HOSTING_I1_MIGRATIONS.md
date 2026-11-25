# ZRIHTAN I1 — kontrolirane staging migracije

Polazni commit: abf6707. Status: PRIPREMLJENO; nije izvršeno na Render bazi.

## Opseg

Naredba backend/scripts/staging-migrate.js koristi procesno okruženje, bez dotenv.
Lokalne npm migrate naredbe i svih 43 postojeće migracije ostaju nepromijenjene.
Manifest bilježi SHA-256 sadržaja s normaliziranim CRLF. Nove ili promijenjene
migracije zahtijevaju pregled i ažuriranje manifesta. Ne kopira DEV podatke,
ne seeda salone, ne dodjeljuje ovlasti i ne šalje obavijesti.

## Zaštite

Prije uvoza pg/migratora traži ispravan staging konfiguracijski ugovor,
RENDER=true, internu Render DB adresu i odsutnost lokalne .env datoteke.
Manifest mora odgovarati direktoriju; instalirani node-pg-migrate mora biti
9.0.0, kao u postojećem package-lock.json. Nema novih ovisnosti.

Jedan pg.Client provjerava current_database() = zrihtan_staging, PostgreSQL 18,
primarnu bazu, USAGE/CREATE prava javne sheme, CREATE pravo baze te raspoloživost
btree_gist. Povijest mora biti točan početni niz poznatih migracija. Bez povijesti,
javna shema ne smije sadržavati postojeće relacije. To je provjera cilja i povijesti,
ne potpuni audit strukture postojeće baze.

--check radi SELECT upite u REPEATABLE READ READ ONLY transakciji. Ne poziva
migrator, ne uzima migracijski lock niti stvara pgmigrations. Nije zamjena s
node-pg-migrate --dry-run: verzija 9.0.0 osigurava history tablicu prije migracija.

--apply --database zrihtan_staging ponavlja preflight, uzima migracijski advisory
lock, ponovno čita povijest i predaje ISTI povezani client runneru. Smjer samo up,
singleTransaction=true, checkOrder=true, noLock=false, fake=false. Runnerov
reentrant lock i wrapperov lock otpuštaju se zasebno; client se zatvara.
Pogreške ne ispisuju URL, lozinku, SQL ni privatni provider stack.

Granica transakcije: node-pg-migrate 9.0.0 može stvoriti pgmigrations prije
transakcije migracija. Ako migracija padne, njezine transakcijske izmjene vraćaju
se; prazna history tablica može ostati. Nema automatskog down/brisanja.
Ako postcheck ili veza padne nakon commita, ne pretpostavljati rollback: prvo
ponoviti --check. Postcheck provjerava povijest, ne sve domenske invarijante.

## Lokalni prihvat

Iz backend mape:

    node --test tests/stagingConfiguration.test.js tests/stagingHosting.test.js tests/stagingMigrations.test.js
    node scripts/staging-migrate.js --help

Očekivano 42 + 45 + 49 = 136 testova. Novi testovi koriste zamjenski client/runner,
privremene datoteke i podprocese; ne dokazuju izvršavanje svih 43 SQL migracija.
Stvarno izvršavanje na Render/PostgreSQL 18 obavezni je sljedeći korak.
Nema nove migracije u paketu. Ne pokretati --apply lokalno.

## Sljedeća postava Rendera nakon commita

- Projekt ZRIHTAN, Staging, Frankfurt; backend Web Service uz postojeću bazu.
- Root backend, Build npm ci, Start node src/stagingServer.js, Health /healthz.
- U Render unosimo internu DATABASE_URL i staging konfiguracijski ugovor.
- Pre-deploy naredba, tek nakon provjerenog unosa konfiguracije:
  node scripts/staging-migrate.js --apply --database zrihtan_staging
- Paid Web Service podržava pre-deploy; početni deploy ručan, auto-deploy isključen.
- Iz Render Shella read-only provjera: node scripts/staging-migrate.js --check
- Nakon uspjeha pending_count 0; zasebno provjeriti health, Clerk pristup,
  onboarding prazne baze, frontend /api povezivanje i izolaciju salona.
- Vanjski pristup bazi ostaje isključen. Hosting URL/ključevi ne šalju se u chat.

Pregledan izvor runner.ts/db.ts/index.ts node-pg-migrate v9.0.0 i Render
postgresql-extensions/deploys dokumentacija (btree_gist podržan).

## Povratak

Installer kopira prethodni roadmap u ispisanu backup putanju. Instalacija ne
mijenja bazu. Nakon commita povrat koda radi se pregledanim git revertom;
to ne poništava migracije kasnije izvršene na Renderu. Bazu ne brisati automatski.
