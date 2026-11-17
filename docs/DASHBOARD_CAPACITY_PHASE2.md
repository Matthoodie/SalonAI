# ZRIHTAN — D2: kapacitet, API i toplinska mapa

Polazna verzija: 9b0eb66 (D1). Paket nema novu migraciju, ovisnost ni promjenu .env.

## Opseg

Dashboard vlasnika/administratora dobiva zaseban pregled planiranog kapaciteta za
7, 14 ili 30 lokalnih kalendarskih datuma, uključujući današnji. Početak je vrijeme
izračuna na poslužitelju, završetak lokalna ponoć nakon zadnjeg datuma. Današnji
protekli sati ne ulaze. Financijski odabir iz prethodnog paketa ostaje neovisan.
Prikazuju se kapacitet, rezervirano/slobodno vrijeme, popunjenost, zaposlenici,
toplinska mapa po datumima i satima te proširiva brojčana tablica. HR/EN i teme.

## Definicije

- Samo aktivni zaposlenici odabranog salona.
- Za svaki datum: efektivna odsutnost isključuje rad; dnevna iznimka nadjačava
  tjedni raspored; bez obaju rasporeda taj dan nema kapaciteta.
- Raspoloživi kapacitet = radni intervali umanjeni za uniju efektivnih blokada.
- Zauzeće = unija svih neotkazanih spremljenih termina unutar kapaciteta.
  Koriste se spremljeni starts_at/ends_at; stavke usluga ne umnožavaju termin.
- Slobodno = kapacitet − zauzeće; postotak = zauzeće / kapacitet * 100.
- Ukupno se zbrajaju sati zaposlenika; dva zaposlenika po 8 h daju 16 h.
  Ukupni postotak nije prosjek postotaka zaposlenika.
- Bez kapaciteta postotak je null / crtica, a ne lažnih 0%. Nulti broj rezervacija
  uz stvarni kapacitet jest 0%.
- Pending zahtjev za odsutnost/blokadu sam po sebi ne ulazi: čitaju se samo
  employee_time_off i employee_blocked_times nakon odobrenja/izravnog unosa.
- Pending/confirmed/completed/no_show rezervacije zadržavaju vrijeme prema postojećoj
  logici kolizija. Budući completed/no_show posebno se označuju kao nepravilnost.
- Vrijeme izvan kapaciteta i preklapanje rezervacija zasebne su anomalije. Ne mogu
  umjetno povećati postotak iznad 100% ni nestati bez obavijesti.
- Slobodni sati nisu raspoloživi termini: rezervacija i dalje ovisi o trajanju,
  kvalifikacijama, razlomljenim prazninama i postojećem availability API-ju.

## Vremenske zone i DST

Radno vrijeme pretvara se iz zone salona u stvarne UTC intervale. Podržani su
pomaci od pola i četvrt sata te polusatni prijelazi. Ne bira se proizvoljno između
dvaju ponovljenih lokalnih vremena. Nepostojeći/ponovljeni početak ili kraj smjene
ili granice razdoblja vraća CAPACITY_LOCAL_TIME_UNCLEAR, uz uputu za provjeru
rasporeda. Smjena s valjanim krajevima preko prijelaza računa stvarno trajanje.

Toplinska mapa zbraja obje pojave jesenskog sata u istu ćeliju. Proljetni nepostojeći
sat nema kapaciteta. Postoci su ponderirani stvarnim minutama svih zaposlenika.
Sati bez kapaciteta u svim datumima izostavljeni su iz vizualne mape.
Suvremeni pomaci moraju biti izraženi u cijelim minutama; ostali se odbijaju.

## Podaci i ovlasti

GET /api/dashboard/capacity?days=7 (ili 14/30; zadano 7). Jedini query je days.
Identitet korisnika i salona dolazi iz postojećeg privatnog middlewarea. Endpoint
odbija zaposleničku ulogu te ne prihvaća korisnikov salon_id ili proizvoljan raspon.
Aktivni salon, korisnik i owner/admin članstvo ponovno se provjeravaju u bazi.

Pristup i sve tablice čitaju se u jednoj REPEATABLE READ READ ONLY transakciji;
konkurentna promjena rasporeda ne može pomiješati dva stanja u jednom izvješću.
PostgreSQL upiti imaju timeout 5 s. Nema izmjena rezervacija, rasporeda ili ovlasti.
Nema imena klijenata, napomena, fotografija ni razloga odsutnosti u odgovoru.
Odgovor je private, no-store. Maksimalno 100 aktivnih zaposlenika; najviše 25.000
redaka po izvoru i 25.000 konačnih intervala za izračun. Prekoračenje se odbija;
ne prikazuje se djelomični rezultat ni tihi LIMIT uz netočan postotak.

Frontend provjerava salon, zonu, razdoblje, identitete, datume, ukupne iznose i
zbrojeve ćelija. Promjena salona ili razdoblja prekida zahtjev; zakašnjeli odgovor
ne zamjenjuje novi prikaz. Greška uklanja prethodni rezultat. Nema automatskog
ponavljanja. Ručni gumb Osvježi kapacitet i novi ulazak na dashboard pokreću izračun;
vrijeme izračuna je vidljivo. Promjena jezika čuva raspon i ne pokreće novi zahtjev.

## Povijesni podaci

Ovo je PLAN prema trenutačnim pravilima. Ne rekonstruira povijesne smjene i ne
prikazuje povijesnu popunjenost. Promjena rasporeda utječe na sljedeći izračun.
Za kasniju povijesnu analitiku treba verzionirati rasporede ili spremati dovoljno
vremenski označenih činjenica. Današnji raspored nije dokaz prošlog kapaciteta.

## Provjere i prihvat

- 30 postojećih D1 + 24 nova backend unit/API testa (54 ciljano).
- 7 novih PostgreSQL testova: scope, iznimke/odsutnost, otkazivanje/neaktivnost,
  opoziv prava, anomalije, konkurentna promjena, montirana privatna ruta.
- 10 novih frontend API testova; komplet frontend 310 testova.
- Dodatna razvojna React DOM provjera: HR/EN bez refetcha, raspon, tablice,
  escaping imena, greška briše stari rezultat, abort i kasni odgovor, scope uloge.
- Kompilacija cijelog main/App stabla provjerena u razvojnom okruženju.
- PostgreSQL nije dostupan u okruženju pripreme: 7 DB testova i cijeli backend
  suite moraju proći lokalni verify. Širi unit run imao je 251/252 prolaz;
  postojeći appointments.test.js zahtijeva živu bazu i ovdje vraća ECONNREFUSED.
- Vite produkcijski build i vizualni pregled u stvarnom pregledniku dio su lokalnog
  prihvata. Ne tvrditi da su DB/build provjere prošle prije uspješnog izvješća.

Ručni prihvat: owner/admin vidi pregled; employee ga nema; 7/14/30 mijenja samo
kapacitet; poznata smjena i termin daju očekivane sate; odobrena odsutnost/blokada
umanjuje kapacitet nakon osvježavanja; HR/EN, obje teme, prazan salon/raspored.
Za današnji primjer uzeti u obzir da izračun počinje sada, ne od ponoći.

## Rollback i sljedeći koraci

Installer najprije provjerava cijeli manifest i hash preduvjeta. --check ne piše;
--apply stvara privremeni backup i pri pogrešci pisanja vraća izvorne bajtove.
Nema automatskog rollbacka nakon neuspješnih testova: zadržati izvješće i backup,
ne primjenjivati paket ponovno. Nakon prihvata spremiti samo navedene datoteke u Git.
Slijedi E: deterministički poslovni uvidi; zatim WhatsApp i ostali V1 koraci.
