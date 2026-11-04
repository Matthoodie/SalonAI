# SalonAI — završni roadmap prve javne verzije

Ažurirano: 2. studenoga 2026.
Potvrđena polazna verzija: 4d26d21.

## Cilj prve verzije

Jedna aplikacija za frizerske/barber salone i grooming salone, sa zajedničkim katalogom,
rasporedom, zaposlenicima, rezervacijama, klijentima i ovlastima. Grooming je dio prve
verzije prije javne objave, a ne naknadna opcija. Izbor djelatnosti prilagođava iskustvo
bez odvajanja aplikacije u zasebne kopije.

Kozmetički saloni i složeniji beauty centri cilj su verzije 2 nakon izlaska live.
Podrška za sobe, uređaje, više istodobnih resursa i paralelne tretmane također ostaje za V2.

## Potvrđeno završeno

- Rezervacije i provjera dostupnosti, zaposlenici i njihove usluge.
- Više usluga unutar jednog termina: jedan klijent, jedan zaposlenik, uzastopno izvođenje,
  ukupno trajanje i cijena, povijesne snimke stavki.
- Zahtjevi za odsutnost i blokirano vrijeme, zaštita postojećih termina.
- Ovlasti, članstva i odabir salona prema dosadašnjim provjerama.
- Korisničko ime/fotografija, uređene Postavke i pregled poslovanja s rasponom datuma.
- Backend potvrđenog uvoza cjenika: preview, validacija, duplikati, transakcija i idempotencija.
  TEST i DEV migracija uspješne; 719 backend testova prošlo.

Ovaj popis nije tvrdnja da je produkcijska spremnost već potvrđena.

## Aktualni slijed prema dogovoru

- Uvoz fotografija/PDF-a i pregled prije spremanja: implementirani; prošireni rubni scenariji ostaju u završnoj regresiji.
- Vizualne dorade Postavki, pregleda poslovanja, Usluga, Klijenata, Zaposlenika, Termina,
  Kalendara i zahtjeva: paketi primijenjeni; korisnik potvrdio provjere.
- Magic Wizard, paket 1 — backend nacrt i nastavak: potvrđeno 755/755 testova i TEST/DEV migracija.
- Magic Wizard, paket 2 — sučelje u Postavkama: potvrđeno 143 frontend testa i ručni rad;
  commit 4d26d21 poslan na development.
- Aktualno: paket 3 — zatvoreno, kontrolirano kreiranje prvog salona i trajni status onboardinga.
  Lokalni unit/API testovi prošli; TEST/DEV migracija i PostgreSQL provjere čekaju korisnika.
  Detalji: [SALON_SETUP_PHASE3.md](SALON_SETUP_PHASE3.md).
- Slijedi početni postupak prije dashboarda, bez poslovnog sidebara; stvarna provjera
  obveznih podataka i potvrda dovršenosti. Postojeći saloni ostaju dostupni.
- Zatim grooming s pasminom i fotografijom ljubimca → WhatsApp i dogovorene AI funkcionalnosti
  → mobilna/PWA i produkcijska priprema → besplatni pilot → naplata.
- Naplata nije uvjet za početak besplatnog pilota. Beauty centri ostaju V2.

## 1. Dovršetak uvoza cjenika

### Paket 1 — backend: završeno
Pregled bez zapisivanja; potvrda svih odabranih stavki u jednoj transakciji;
ponovljena potvrda vraća prethodni rezultat; nema prepisivanja postojećih usluga.

### Paket 2 — nacrt i potvrda na frontendu: završeno
- Uređivanje naziva, kategorije, cijene i trajanja.
- Odabir stavki i izričita primjena zajedničkog trajanja.
- Nepoznato trajanje ostaje prazno; najmanje jedna cijela minuta prije spremanja.
- Pregled i potvrda mogućih duplikata.
- Ponovna provjera nakon izmjene nacrta.
- Zaštita od dvostrukog klika, neizvjesnog odgovora i promjene salona.
- Samo potvrda u tijeku čuva se u sessionStorage po korisniku i salonu;
  običan nespremljeni nacrt traje dok je obrazac otvoren.
- Testovi, build, ručna provjera vlasnika/zaposlenika, commit.

### Paket 3 — fotografija/PDF i prepoznavanje: implementirano i ručno provjereno
- Fotografija s mobitela, screenshot ili PDF postaju uređiv nacrt.
- Prepoznati tekst nikada se automatski ne sprema u katalog.
- Nepouzdane cijene, valuta, paketi i doplate označavaju se za pregled.
- Varijante usluge razdvajaju se u stavke za korisničku potvrdu.
- Odabrati pružatelja obrade, ograničenja veličine/broja stranica i pravila čuvanja datoteka.
- Ključevi ostaju na backendu; kontrolirati pristup, potrošnju i greške obrade.
- Bez izmišljanja trajanja i automatske konverzije valuta.

### Paket 4 — provjera cijelog postupka
Stvarni primjeri frizerskih i grooming cjenika, fotografije slabije kvalitete,
prazni/ponovljeni dokumenti, prekid veze, duplikati, mobilni prikaz i izolacija salona.
Izlazni kriterij: dokument -> pregled -> dopuna -> potvrda -> nove upotrebljive usluge.

## 2. Magic Wizard — vođeno početno postavljanje

Završni početni ekran za novog vlasnika ima pet koraka, prije dashboarda:

1. Vaš salon: djelatnost, naziv, lokacija i vremenska zona.
2. Vaš tim: samostalni rad ili tim, stvarni profili zaposlenika i rad vlasnika.
3. Usluge: ručni unos ili fotografija/PDF, pregled i dopuna trajanja.
4. Raspored: radno vrijeme i povezanost zaposlenika s uslugama.
5. Pregled i početak rada: backend provjera obveznih uvjeta pa otvaranje dashboarda.

Koraci se spremaju i mogu nastaviti nakon odjave; povratak na prethodni korak je dopušten.
Postojeći saloni ne zaključavaju se retroaktivno. Pozvani članovi ne kreiraju salon ponovno.
Kreiranje salona ostaje zatvoreno, uz dopušteni razvojni račun do pripreme javnog pilota.

Završna ručna provjera uključuje i prvi probni termin.

Wizard treba moći nastaviti već započeto postavljanje bez stvaranja duplikata.
Predlošci su izbor korisnika, ne automatski poslovni podaci. Postojeći saloni ne prolaze
ponovno obavezno kroz početno postavljanje. Grooming se ne predstavlja potpuno spremnim
dok nisu završene funkcije iz sljedeće faze. Beauty funkcije se ne nude kao dovršene u V1.

## 3. Grooming modul — obavezan za V1

### Podaci
- Klijent ostaje vlasnik/kontakt; jedan vlasnik može imati više ljubimaca.
- Ljubimac: ime, vrsta životinje, pasmina ili opis/mješanac, veličina/težina,
  praktične napomene o dlaci i postupanju te opcionalna fotografija kao avatar.
- Fotografija je privatni sadržaj salona; definirati ograničenja i kontrolu pristupa.
- Nepoznate podatke ne izmišljati niti zahtijevati bez poslovne potrebe.

### Termini i povijest
- Jedan ljubimac po terminu u prvoj verziji.
- Termin povezan s vlasnikom, ljubimcem, zaposlenikom i odabranim uslugama.
- Odvojena povijest svakog ljubimca; vlasnik vidi se kao kontakt.
- Varijante usluga prema veličini/vrsti njege; cijena i trajanje jasno potvrđeni.
- Pasmina sama ne određuje automatski cijenu ili trajanje.
- Postojeći frizerski termini rade bez ljubimca.
- Promjena vlasnika/arhiviranje mora čuvati povijesne zapise i izolaciju salona.

Izlazni kriterij: vlasnik s dva ljubimca, zasebni profili i fotografije, odvojeni termini,
ispravan kalendar, ukupno trajanje više usluga i povijest bez miješanja životinja.

## 4. Probni rad frizerskog i grooming scenarija

- Proći od prvog ulaska i Wizarda do stvarne rezervacije i završetka termina.
- Provjeriti owner/admin/employee, salon switch, cijene i statistiku.
- Provjeriti mobitel, slike ljubimaca, prazna stanja i jasne poruke pogrešaka.
- Ukloniti blokirajuće nedostatke prije javne objave.

## 5. Dovršetak ranije planiranih integracija

Zadržati ranije planirani smjer WhatsApp/n8n i AI asistenta; detaljan opseg konkretnih
paketa definirati prije njihove implementacije. Ovaj roadmap ne smatra ih već dovršenima.
Integracije moraju koristiti istu provjerenu dostupnost, ovlasti i pravila rezerviranja,
uključujući ljubimca kod groominga. Ne smiju pisati izravno mimo booking servisa.
Prvo ograničen, testiran tok rezervacije/potvrde; zatim dodatne automatizacije.

## 6. Mobilna/PWA i priprema za javnu objavu

- PWA instalacija i provjera na Androidu/iOS-u; jasna poruka bez mreže, bez nesigurnog offline rezerviranja.
- Odvojena produkcijska konfiguracija, baza i autentikacija.
- Hosting, domena, HTTPS, produkcijski API i mediji.
- Provjera migracija, sigurnosnih kopija i stvarnog postupka povrata podataka.
- Praćenje grešaka i operativna provjera ključnih tokova.
- Kontrola pristupa, izolacija salona i ograničenja vanjskih integracija.
- Korisničke upute unutar aplikacije: osnovni rad, uvoz, Wizard, zaposlenici i grooming.
- Definirati podršku, obradu podataka i sadržaj potrebnih korisničkih dokumenata.
- Prije naplate definirati planove, ograničenja i provesti implementaciju/provjeru
  pretplata; zasebno razlikovati besplatni pilot i komercijalnu objavu.
- Završni regresijski testovi, frontend build i ručni scenariji obje djelatnosti.

## 7. Objava V1 i besplatni pilot

Označena verzija, kontrolirani deploy, provjera nakon objave i prve povratne informacije.
Javna objava slijedi tek nakon dovršenog groominga s pasminom i avatarom ljubimca,
Wizarda, uvoza i dogovorenih funkcija prve verzije. Točan datum ovisi o provjerama,
ne o proizvoljnom postotku dovršenosti.

## 8. Naplata nakon besplatnog pilota

Na temelju interesa pilot-korisnika potvrditi planove, cijene, ograničenja i pružatelja
naplate. Zatim implementirati pretplate, provjeru webhookova, prava pristupa, otkazivanje
i oporavak od neuspjele naplate; testirati prije uključivanja stvarnih plaćanja.

## Verzija 2 — nakon live objave

Kozmetički saloni i složeniji beauty centri, resursi poput soba/ležajeva/uređaja,
paralelni tretmani, složeniji obračuni trajanja/cijena i naprednije automatizacije.
Prioriteti se potvrđuju prema iskustvu prvih korisnika.

## Ažuriranje — početni ekran (faza 4A)

- Početni ekran bez poslovnog izbornika za račune bez odabranog aktivnog salona.
- Prihvat pozivnice i izbor između više dostupnih salona koriste postojeći backend.
- Učitavanje i greške također ne prikazuju poslovni sidebar.
- Ovo nije završetak obveznog onboardinga. Kreiranje ostaje isključeno u konfiguraciji.
- Sljedeći paket: povezani koraci Salon → Tim → Usluge → Raspored → Pregled,
  backend provjera spremnosti i potvrda dovršetka prije dashboarda za nove salone.
- Postojeći saloni nastavljaju raditi bez obveznog ponovnog postavljanja.

## Ažuriranje — povezani onboarding (faza 4B)

- Uveden obrazac kreiranja za allowlist račune, trajno spremljen identičan zahtjev
  za izričito ponavljanje nakon neizvjesnog rezultata.
- App pri odabiru salona provjerava status. Novi salon ostaje u pet koraka do
  backend potvrde; postojeći salon bez onboarding retka radi kao prije.
- Tim, usluge i raspored koriste postojeće stranice i iste API-je unutar wizarda.
- Završna provjera: izbor djelatnosti/načina rada, aktivni profil, aktivna usluga,
  svaka usluga pokrivena aktivnim kvalificiranim zaposlenikom s tjednim rasporedom.
- Samostalni način: jedan aktivan profil, vlasnik pruža usluge.
- Stvarni PostgreSQL testovi i Vite build moraju proći lokalni verifier prije aktivacije.
- Nema javnog moda kreiranja. Nova dozvola vrijedi samo za izabrani razvojni račun.
- Slijedi lokalni cjeloviti test novog salona, zatim grooming s pasminom i fotografijom.
- Grooming izbor djelatnosti još ne implementira profile ljubimaca. Beauty ostaje V2.
