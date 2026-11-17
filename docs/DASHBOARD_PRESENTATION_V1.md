# ZRIHTAN — dorada dashboarda i djelatnosti

Preduvjet: primijenjeni D2 paket na grani development (HEAD 9b0eb66).
D2 lokalno potvrđen: 54/54 ciljano, 7/7 PostgreSQL, 975/975 backend, 310/310 frontend.
D2 još nije commitan: ovaj dodatak očekuje baš njegove promjene, bez resetiranja.

## Kapacitet

- 7/14/30 dana ostaje raspon izračuna. Vizualna navigacija dijeli taj raspon na
  stranice do sedam datuma; posljednja stranica od 30 dana ima dva datuma.
- Prethodno/sljedeće mijenja samo vidljivi dio već učitanih podataka. Ne traži
  novi API odgovor i ne mijenja ukupne pokazatelje cijelog raspona.
- Bez vodoravnog klizača: prilagodljiva mreža na širim prikazima i kartice dana
  kada je raspoloživi prostor uzak. Nema rezanja skrivenih datuma.
- Klik datuma/ćelije ili izbor datuma otvara detalje jednog dana. Svaki sat ima
  rezervirano/slobodno vrijeme i traku popunjenosti; nema višestotinskog popisa.
- Sati/minute: 50 min umjesto 0,83 h; ukupne minute zaokružene, manje od minute
  označeno '< 1 min'. Izračun i postotak ostaju u izvornoj milisekundnoj preciznosti.
- Četiri glavna pokazatelja u dva stupca (jednom na najužem prostoru), zaposlenici
  u karticama s četiri vrijednosti. Nema tablice koja širi prikaz.
- Tamna tema koristi postojeće tematske boje za prazne/nepopunjene ćelije.
- 0% znači postojeći slobodan kapacitet; crtica znači da kapaciteta nema.

## Poslovna vrijednost

Na poslanoj slici odabrani datum 29.09.2026. ima 116 EUR, prethodni 28.09.2026.
ima 0 EUR. Podaci su različiti datumi, ali prethodna zajednička numerička os to
nije jasno komunicirala.

- Za jedan dan nema linijskog grafikona s dvjema točkama: dvije kartice s izričitim
  datumima i iznosima prikazuju usporedbu dvaju dana.
- Za više dana kartice uspoređuju točno navedena razdoblja jednake duljine.
- Grafikon prikazuje samo odabrano razdoblje s datumima na osi. Prethodna linija
  uklonjena je kako se dvije različite vremenske osi ne bi miješale.
- Točni intervali svake točke i vrijednosti dostupni su ispod grafikona. Na užem
  prostoru zamjena su čitljive kartice datuma/iznosa, bez umanjivanja teksta grafa.
- Nisu promijenjene formule, statusi, cijene, zbrajanje ni postupak za nepotpune
  cijene. Nema novog prihoda/naplate: ovo i dalje predstavlja vrijednost usluga.

## Djelatnosti

Zajednički select u kreiranju salona, glavnom onboarding wizardu i wizardu postavki:
- hair: Frizerski salon i brijačnice / Hair salons and barbershops
- grooming: Ljubimci / Pets

Placeholder nije treća djelatnost. Mixed/other nisu ponuđeni za novi izbor.
Ako je takav izbor već spremljen, prikazuje se kao onemogućeni prethodni izbor;
ne pretvara se automatski u hair/grooming. Nakon korisnikova odabira jedne od dviju
opcija stara nestaje iz izbornika. Backend ugovor i povijesni podaci ostaju kompatibilni.
Ispravljena je zastarjela pomoćna poruka koja je najavljivala već postojeće ljubimce.

## Provjere i prihvat

314 frontend testova; četiri nova testa za trajanja, paginaciju, ponderirane dnevne
vrijednosti i djelatnosti. React DOM: posljednja stranica, izbor dana, promjena jezika
čuva izbor, jednodnevna usporedba bez SVG-a, višednevni graf bez prethodne linije,
legacy izbor i točno dvije aktivne djelatnosti. Kompilirano cijelo main/App stablo.
Browser Chromium nije se mogao pokrenuti u okruženju pripreme; stvarni vizualni
prihvat obje teme i širokog/uskog prikaza odrađuje korisnik. Lokalni verify izvršava
sve frontend testove, Vite build i Git provjere. Backend je neizmijenjen od D2.

Bez migracije, nove ovisnosti, promjene .env i nadogradnje Nodea.
Installer provjerava hash svih ciljnih datoteka, radi backup, a pri grešci pisanja
vraća izvorne bajtove. D2 + ovaj dodatak commitati zajedno nakon prihvata.
Slijedi E: poslovni uvidi; zatim WhatsApp i ostatak V1 roadmapa.
