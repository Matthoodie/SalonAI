# Grooming 6 — neobavezna veličina i težina ljubimca

Polazna verzija: e5db279. Paket pripremljen 12. studenoga 2026.
Lokalne korisničke TEST/DEV provjere još slijede.

## Sučelje

Klijenti → Detalji → Ljubimci → Dodaj ljubimca ili Uredi.

- Veličina: Nije odabrana / Mala / Srednja / Velika / Vrlo velika.
- Težina u kg: neobavezni unos, zarez ili točka, do tri decimale.
- Prihvatljiv tehnički raspon: 0,001–200 kg; nije veterinarska preporuka.
- Primjeri: 12,5 i 12.5 spremaju se kao ista vrijednost; 1,007 sprema točno 1007 g.
- Prazno polje znači da vrijednost nije poznata. Nula nije zamjena za prazan podatak.
- Veličina je procjena salona; nema automatskih pragova prema vrsti, pasmini ili težini.
- Pogrešan unos prikazuje postojeću istaknutu pogrešku i fokusira prvo neispravno polje.
- Spremljeni podaci pojavljuju se na kartici ljubimca, u obje teme.
- Podaci ne mijenjaju cijenu ili trajanje rezervacije, niti stare snimke termina.
  Ovo je trenutno stanje profila, a ne vremenska evidencija mjerenja.

## Baza i API

Migracija: 1794506400000_add-pet-measurements.js.

client_pets.size_category: NULL ili small/medium/large/giant.
client_pets.weight_grams: NULL ili integer od 1 do 200000, s DB CHECK ograničenjem.
Postojeći redovi dobivaju NULL; nema nagađanja ni konverzije prethodnih bilježaka.

Postojeći POST/PUT profila prihvaća dva dodatna neobavezna polja. Sva dosadašnja
obvezna polja i expected_revision za PUT ostaju potrebni. Nepoznati identiteti,
statusi i dodatna polja ne mogu se ubaciti kroz ovaj payload.

- Izostavljeno novo polje na POST: sprema NULL.
- Izostavljeno novo polje na PUT: čuva postojeću vrijednost (kompatibilnost starog klijenta).
- Izričito null na PUT: uklanja taj podatak.
- weight_grams je strogo cijeli JSON broj; string, decimalni gram ili vrijednost izvan
  raspona odbija se prije pristupa bazi. UI šalje grame, ne decimalni broj kilograma.
- Čitanje vraća nova polja bez fotografskih bajtova.
- Spremanje se odvija u postojećoj transakciji i koristi revision profila; dva paralelna
  uređivanja ne mogu tiho prepisati promjene. Fotooperacije koriste istu kontrolu verzije.
- Arhiviranje i ponovno aktiviranje čuvaju težinu i veličinu. Uređivanje zahtijeva
  aktivnog vlasnika klijenta; arhivirani ljubimac može se urediti prema postojećem pravilu.
- Fotografije, povijest, zaposlenički izbor ljubimca i izolacija salona ostaju nepromijenjeni.
  Novi podaci nisu dodani zaposleničkom izboru ni javnom API-ju.

Nema novih ovisnosti, npm install, AI poziva ili promjene .env.
Kreiranje salona ostaje u postojećem kontroliranom načinu rada.

## Primjena i provjere

1. Čista development grana na e5db279; zaustavljen backend, PostgreSQL pokrenut.
2. package --check, zatim --apply. Installer sprema originalne datoteke u TEMP.
3. verify: novi unit testovi, migracije TEST baze, novi PostgreSQL testovi, cijeli
   backend suite, frontend suite, Vite build i Git provjere. TEST i DEV moraju biti različite baze.
4. Tek nakon izlaznog koda 0 pokrenuti npm run migrate:up na DEV-u, pa npm run dev.
5. Ne pokretati backend s novim kodom prije DEV migracije: metadata upiti trebaju nova polja.
6. Ne ponavljati --apply nakon uspješne primjene. Za ponavljanje provjera koristiti samo verify.

Kod autora prošlo: 197 backend testova bez stvarnog PostgreSQL-a, 215 frontend testova,
kompilacija JSX-a, React provjera mjera, regresija povijesti i fotografija.
PostgreSQL, puni backend suite i Vite build obvezno pokreće korisnički verifier.

DB testovi pokrivaju stvaranje, djelomični stari PUT, brisanje podataka, arhiviranje,
DB ograničenja, konkurentna uređivanja, očuvanje fotozapisa, salon/owner izolaciju,
arhiviranog vlasnika te owner/employee API provjere.

## Ručna završna provjera

- Stari ljubimac: oba nova polja prazna, ime/pasmina/fotografija/povijest sačuvani.
- Uredi → Velika + 12,5 → spremi, zatvori i ponovno otvori: isti podatak.
- Unesi 12.5 umjesto 12,5: isti spremljeni rezultat.
- Prazna težina i neodabrana veličina: dopušteno; prethodne vrijednosti se uklanjaju.
- 0, negativna vrijednost, slova, 200,001 i četiri decimale: nema spremanja,
  vidljiva pogreška i fokus na polje. 0,001 i 200: prihvaćeni rubovi.
- Novi ljubimac može se dodati bez novih polja. Dva istoimena profila ostaju odvojena.
- Arhiviraj/aktiviraj: mjere ostaju. Promjena/uklanjanje fotografije čuva mjere.
- Povijest, kalendar, kreiranje i izmjena termina rade; cijene se nisu promijenile.
- Svijetla/tamna tema, uzak prikaz; vlasnički i zaposlenički račun imaju dosadašnje ovlasti.

Down migracija briše nova polja i njihove podatke; nije rutinski korak nakon uspjeha.
U slučaju neuspjeha poslati izvještaj bez .env datoteka. Commit nakon korisničke provjere.

Sljedeći paket: podloga HR/EN, osobni odabir jezika na Welcome/Wizard/Postavke,
zatim sustavan prijevod cijelog sučelja prema ROADMAP_V1.md.
