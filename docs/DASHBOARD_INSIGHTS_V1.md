# Poslovni uvidi V1 / Business insights V1

Osnova: development 38e95af. Prethodni kapacitet i prezentacija potvrđeni ručno;
frontend 314/314, prethodne backend provjere 975/975 i kapacitet PostgreSQL 7/7.

## Opseg
- HR/EN uvidi za vlasnika/administratora unutar postojećeg poslovnog pregleda.
- Promjena vrijednosti završenih usluga u zatvorenom razdoblju prema prethodnom
  jednako dugom razdoblju. Nije naplata, prihod niti dobit.
- Različiti klijenti s barem jednim završenim terminom prije početka odabranog
  razdoblja u dostupnoj spremljenoj povijesti. Vlasnik s dva ljubimca broji se
  jednom. Dva posjeta unutar razdoblja sami po sebi ne čine ranijeg klijenta.
- Najviše tri konkretna datuma s najviše slobodnih zaposleničkih sati u
  odabranom planu kapaciteta 7/14/30 dana, uz datum i ukupni kapacitet dana.

## Ograničenja i sigurnost
- Izračuni su deterministički, bez AI poziva, novih zahtjeva, ovisnosti ili migracija.
- Koristi se postojeća autorizirana zbirka termina trenutačnog salona. Ako se
  uvede paginacija/ograničenje povijesti, povratak klijenata treba premjestiti na
  cjelovit serverski agregat prije korištenja na takvoj zbirci.
- Nema zaključka o rastu za nezavršeno razdoblje, nedostajuće cijene, prazne
  usporedbe ili buduće završene termine. Nulta prethodna vrijednost nema postotni rast.
- Bez ranijeg zapisa ne znači novi klijent. Ovo nije stopa zadržavanja.
- Nedostajući ID klijenta u relevantnoj povijesti onemogućuje taj uvid.
- Kapacitet preuzima provjeren odgovor postojećeg API-ja i postojeće zaštite
  od kasnog odgovora pri promjeni salona, razdoblja ili pogrešci učitavanja.
- Nepravilnosti rasporeda onemogućuju rangiranje slobodnih dana. Dani bez
  kapaciteta izostavljeni su; jednaka vremena razrješavaju se datumom.
- Slobodni sati mogu biti rascjepkani ili pripadati različitim zaposlenicima.
  Dostupnost konkretnog termina i kvalifikacije i dalje provjerava rezervacija.
- Današnji kapacitet odnosi se samo na preostalo vrijeme. Nema zaključaka o
  tipičnom danu tjedna ili preporuke za promocije iz kratke projekcije.

## Provjere
- 326/326 frontend testova lokalno, uključujući 12 novih testova izračuna.
- Cijeli main/App kompajliran esbuildom; ReactDOM HR/EN prikaz, promjena jezika
  i nezavršeno razdoblje provjereni u jsdomu.
- Instalacijski --check/--apply, ponovna instalacija i promijenjene datoteke
  provjeravaju se prije pisanja; izvorne datoteke imaju sigurnosnu kopiju.
- Korisnikov verify pokreće sve frontend testove i stvarni Vite build.

## Ručni prihvat
1. Owner/admin: pregled poslovanja prikazuje dva uvida ispod pokazatelja.
2. Zatvoreno razdoblje: datumi, iznosi i postotak odgovaraju postojećoj usporedbi.
3. Danas: opis da razdoblje nije završeno, bez zaključka o rastu.
4. Klijent s ranijim završenim terminom: brojanje jednom, i ako ima dva ljubimca.
5. Kapacitet: 7/14/30 dana, najviše tri datuma i ispravan redoslijed slobodnih sati.
6. HR/EN i svijetla/tamna tema samo na novim karticama. Zaposlenik nema
   upravljačke poslovne uvide kao ni ranije.
7. Promjena salona ili greška kapaciteta ne smije zadržati stare kapacitetne uvide.

Sljedeće: pregled preduvjeta za WhatsApp prema glavnom roadmapu, nakon prihvata.
