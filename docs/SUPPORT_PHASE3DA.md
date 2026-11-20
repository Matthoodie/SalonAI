# ZRIHTAN Support S3D-A — evidencija obavijesti, bez slanja

Datum: 20. studenoga 2026. Polazna verzija: development 325464e.
Status: PRIPREMLJENO; TEST i DEV prihvat provodi korisnik.

## Ponašanje

Novi odgovor operatera sada stvara jedan zapis u support_notification_outbox.
Odgovor, revizija prijave, idempotentni receipt, obavijest i audit spremaju se
u istoj transakciji. Ako upis obavijesti ili audita ne uspije, odgovor se ne sprema
napola; UI prikazuje neuspjeh i dopušta ponavljanje istog request_id.

Ponovljeni isti zahtjev vraća postojeći rezultat bez nove obavijesti. UNIQUE
message_id dodatno čuva pravilo jedan događaj po odgovoru. Nova zasebna poruka
ima zaseban događaj. Sama promjena statusa ili kreiranje prijave ne stvara događaj.

Svaki događaj ima state=held. Ne postoji worker, HTTP endpoint za outbox, pošiljatelj,
provider, retry runner, API ključ, e-mail slanje ni mogućnost uključivanja slanja
varijablom okruženja. S3D-A nije dovršen sustav isporuke e-maila. Postojeći UI se
ne mijenja. Odgovori se i dalje čitaju kroz Pomoć i podrška / Moje prijave.

## Minimalni podaci i jezik

Outbox pohranjuje ID poruke, vrstu događaja, jezik, held stanje i vrijeme.
Ne kopira e-mail, ime autora, naslov/opis prijave ni tijelo odgovora. Veza do
prijave i autora ide preko poruke. Brisanje autora → prijave → poruke uklanja
pripadajući događaj. Jezik se preuzima s prijave pri nastanku događaja (hr/en),
ne iz trenutačnog jezika operatera. Promjena jezika prijave ne mijenja stare događaje.

Predložak pregleda sadrži samo broj prijave i uputu za otvaranje razgovora.
Nema sadržaja razgovora, lozinki ni prijavnih tokena. Poveznica na produkcijsku
aplikaciju dodat će se tek kada postoji provjerena adresa i tok prijave.

## Migracija i kompatibilnost

Nova migracija: 1795262400000_add-support-notification-outbox.js.
Nema popunjavanja iz povijesnih poruka; događaji nastaju samo kroz nove odgovore.
Nema novih npm ovisnosti ni promjene package.json, .env, Clerk ovlasti ili DNS-a.
Nova verzija koda zahtijeva migraciju: provesti TEST prvo, pa zasebno DEV prije
ponovnog pokretanja backenda. Migracija ne briše niti mijenja postojeće prijave.

Down migracija namjerno odbija automatsko brisanje. Pri povratku starog koda tablica
može ostati. Stari kod ne bilježi nove događaje; taj vremenski razmak nije pokriven
budućim e-mail obavijestima. Ne zaobilaziti instalacijske provjere hashova.

## Provjera

Lokalno: 127/127 izoliranih testova podrške (15 dodatnih), syntax i installer provjere.
PostgreSQL nije dostupan u pripremnom okruženju. Deset novih DB scenarija mora
proći na korisničkoj TEST bazi, uz cijeli backend skup. Broj svih backend testova
ne pretpostavljati ako su u međuvremenu nastale druge promjene.

DB scenariji: atomski held upis; istodobno/ponovljeno slanje; status bez događaja;
dva odgovora; stvarna UNIQUE pogreška i potpuni rollback; audit rollback; zabrana
bez ovlasti; read-only preview; cascade brisanja autora; jezik i bez backfilla.

Verifier --database prihvaća salonai_regression ili naziv s odvojenom riječi test,
uspoređuje naziv s DEV bazom i prosljeđuje eksplicitnu TEST konfiguraciju.
Radi TEST migracije, 10 DB scenarija i puni backend. DEV ne migrira.

## Ručni DEV prihvat (nakon TEST uspjeha i DEV migracije)

1. U aplikaciji pošaljite jednu sintetičku prijavu HR ili EN i odgovorite kao operater.
2. Kao autor provjerite odgovor u svojim prijavama.
3. Iz backend direktorija pokrenite:
   node --env-file=.env scripts/support-notification-preview.js --database salonai_dev
4. Očekivano: delivery_enabled:false, state:held, jedna nova stavka s brojem prijave
   i predloškom u jeziku prijave. Nema primatelja ni teksta odgovora.
5. Promijenite samo status i ponovite pregled: broj događaja ostaje isti.
6. Pošaljite drugi odgovor: pojavljuje se drugi događaj. Pregled ništa ne šalje.

Pregled vraća najviše 20 novijih događaja. Za starije koristite --before uz
next_before iz prethodnog ispisa. CLI zahtijeva lokalni pristup DB vjerodajnicama;
nije za korisnike salona niti se smije izložiti preko javnog HTTP-a.

## S3D-B — odvojeni sljedeći paket

Odabrati e-mail servis, verificirati zrihtan.com i točne DNS zapise pružatelja,
pošiljatelja te kontrolirane testne primatelje. Provjeriti potvrđeni aktualni
kontakt autora prije isporuke; ne zaključivati da je users.email automatski
potvrđen i aktualan. Dodati worker, zaključavanje/lease, ograničene pokušaje,
idempotenciju isporuke, obradu neizvjesnog ishoda i nadzor pogrešaka.

Događaje held iz ovog paketa NE poslati automatski nakon uključivanja servisa.
Potrebna je izričita odluka i migracija aktivacijskog praga: stari testni događaji
ostaju isključeni ili se kontrolirano uklanjaju po pravilima čuvanja. Definirati
rokove čuvanja događaja, pokušaja i prijava prije stvarnog pilota.

## Domena

Korisnik je potvrdio kupnju zrihtan.com na Porkbunu 20.11.2026.; screenshot
pokazuje obnavljanje i zaključavanje ON, privatnost kontakta i rok 20.11.2027.
Predloženo: zrihtan.com landing, app.zrihtan.com aplikacija. Ostale domene nisu
potvrđene kao kupljene. URL forwarding jest konfiguriran, ali odredište nije
vidljivo. Paket ne mijenja DNS, preusmjeravanja, hosting niti objavljuje aplikaciju.
