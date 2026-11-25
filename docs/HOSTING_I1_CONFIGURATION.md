# I1 — konfiguracijska podloga za staging

Polazni commit: 0d76fad. Datum: 25.11.2026.

## Potvrđeno
Render Hobby workspace Matej’s workspace, projekt ZRIHTAN, Staging.
Baza zrihtan-staging-db / zrihtan_staging, PostgreSQL 18, Frankfurt,
1 GB storage, 256 MB RAM, compute 6 USD + storage 0.30 USD mjesečno.
Vanjski pristup isključen prema korisničkoj potvrdi. Lokalna baza PostgreSQL 18.6.
Budžet približno 30 EUR/mj.; porezi, tečaj i dodatna potrošnja nisu fiksni.
Frontend build na commitu 0d76fad prošao; glavni JS chunk 648.82 kB,
gzip 190.58 kB; upozorenje ostaje za provjeru performansi.

## Opseg ovog paketa
Offline validator konfiguracije i CLI, izolirani testovi, dokumentacija.
Nema migracije, povezivanja s bazom, učitavanja .env, slanja e-maila,
instaliranja ovisnosti, promjene lokalnog pokretanja ili deploya.
Validator još NIJE uključen u postojeći server. PASS nije odobrenje za deploy.
Ovo je prvi dio postojeće I1 faze, a ne nova kategorija roadmape.

## Ugovor konfiguracije za iduću integraciju
APP_ENV=staging; NODE_ENV=production (optimizacije Node aplikacije).
DATABASE_URL: Render PostgreSQL, naziv zrihtan_staging, port 5432.
STAGING_APP_ORIGIN: jedan HTTPS origin na *.onrender.com ili staging.zrihtan.com.
CLERK_SECRET_KEY: testni server ključ (nikad VITE_).
CLERK_PUBLISHABLE_KEY i VITE_CLERK_PUBLISHABLE_KEY: isti testni javni ključ.
STAGING_ALLOWED_CLERK_USER_IDS: 1–20 jedinstvenih Clerk user_ identifikatora,
odvojenih zarezom; bez wildcarda ili e-mail adresa.
PORT: opcionalni broj 1024–65535; zadana vrijednost 10000.
Resend ključevi nisu dopušteni u prvom staging deployu.

Validator provjerava format, ne kontaktira Clerk i ne dokazuje da tajni i javni
ključ pripadaju istoj Clerk instanci. To treba provjeriti u konfiguraciji i E2E testu.
Provjerava naziv Render hosta, ne dokazuje regiju ni identitet servera.
Bazu i verziju provjeriti stvarnim upitom u kasnijem kontroliranom koraku.
Ne vraća lozinke, ključeve, ID-jeve testera niti connection string.

## Provjera sada
Iz backend mape:
node --test tests/stagingConfiguration.test.js
node scripts/staging-config-check.js --help

Testovi koriste isključivo izmišljene vrijednosti. Ne trebaju .env ni bazu.
--check-env namijenjen je kasnijem procesu s eksplicitnim staging varijablama.
Nemoj sada dodavati staging tajne u postojeći lokalni .env.

## Sljedeći dio I1
1. Integrirati fail-closed provjeru u zaseban hosting entry point.
2. Gate svih poslovnih API ruta uz provjeren Clerk token i allowlist testera.
   Postojeće availability/bookings rute nisu za neposredno javno izlaganje.
3. Odabrati API topology, povezati frontend, health/readiness i graceful shutdown.
4. Migracije nad izričito potvrđenom staging bazom, bez automatskog DEV seedanja.
5. Testovi prije kreiranja backend servisa; zatim kontrolirani deploy i smoke test.
Noindex nije sigurnosna kontrola; allowlist u ovom validatoru još ne blokira HTTP.

## Povrat
Installer sprema originalni roadmap u privremenu backup mapu.
Prije drugih izmjena moguće je vratiti taj roadmap i ukloniti četiri nove datoteke
ovog paketa. Ne koristiti git reset --hard ili git clean. Nakon commita povrat
se radi zasebnim git revert commitom, uz pregled promjena.
