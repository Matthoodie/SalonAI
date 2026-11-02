# Magic Wizard — paket 2: korisničko sučelje

Polazni commit: 4cfbb9c. Backend temelj: korisnik potvrdio 755/755 testova,
TEST/DEV migraciju 1793642400000_create-salon-setup i postojeće tokove.

## Isporučeno

- Postavke → Postavljanje salona, samo za vlasnika. Nema prisilnog otvaranja.
- Učitavanje pri otvaranju; spremljeni last_step određuje nastavak.
- Djelatnost, lokacija, solo/tim i vlasnik pruža usluge; nepoznato ostaje null.
- Naziv salona i vremenska zona samo se prikazuju iz autoritativnog odgovora.
- Šest navigacijskih koraka. Tim/Usluge/Raspored imaju eksplicitne radnje koje
  najprije spremaju nacrt, pa otvaraju postojeću stranicu. Nema dupliciranja kataloga.
- Pregled prikazuje osnovne izbore, bez oznake dovršenosti ili izmišljene spremnosti.
- Spremi i nastavi / Natrag / odabir koraka spremaju cijeli nacrt s očekivanom revizijom.
- Spremi i zatvori čuva nastavak. Zatvori bez spremanja traži potvrdu ako je izmijenjen.
- Sukob, zabrana ili neizvjestan ishod zaustavljaju sljedeća spremanja do učitavanja.
  Izbori ostaju vidljivi, a zamjena spremljenim vrijednostima traži potvrdu.
- Bez automatskog ponavljanja zapisivanja, AI poziva, novih ovisnosti i migracija.
- Promjena salona/računa remounta wizard; salonski transport odbacuje zakašnjele odgovore.
- Osvježavanje/zatvaranje prozora uz nespremljene izmjene prikazuje browser potvrdu.
  Glavni aplikacijski izbornik nema globalni navigation blocker: prije odlaska
  koristi se Spremi i zatvori. Obični nespremljeni nacrt nije pohranjen u browseru.

## Provjere

143 frontend testa (134 postojeća + 9 novih) prošla lokalno.
Preglednik s mock API-jem: otvaranje, izbori, spremanje/nastavak, sukob i učitavanje,
spremanje prije navigacije, pregled bez lažne dovršenosti, promjena salonskog ključa,
StrictMode te širine 320/390/768/1200 bez horizontalnog preljeva.
JSX/CSS bundle uspješan. Stvarni Vite build i API provjeriti priloženim verifierom
te ručno u korisnikovom okruženju. Nove backend promjene nisu dio ovog paketa.

## Sljedeći koraci Magic Wizarda

1. Provjera stvarne spremnosti: aktivni zaposlenici, usluge s valjanim trajanjem,
   povezanost usluga i zaposlenika te radni raspored; pojedinačni problemi s jasnim akcijama.
2. Dovršiti upravljanje nazivom/zonom i rad vlasnika kroz provjerene backend operacije;
   izbor owner_provides_services sam po sebi ne stvara profil ni ovlasti.
3. Samostalno kreiranje prvog salona i vlasničkog članstva, idempotentno,
   s ograničenjem zlouporabe; ne koristiti endpoint koji zahtijeva već odabran salon.
4. Cijeli onboarding s probnim terminom i regresijom postojećih salona.
5. Grooming: vlasnik/kontakt, više ljubimaca, pasmina, avatar, termini i povijest.

WhatsApp/AI → PWA/produkcija → besplatni pilot → naplata ostaju iza ovih koraka.
Beauty i složeniji centri ostaju V2.
