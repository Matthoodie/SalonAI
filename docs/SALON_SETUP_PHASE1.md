# Magic Wizard — paket 1: backend temelj

Polazna verzija: 8ac53d0. Datum: 2. studenoga 2026.

## Opseg

Ovaj paket sprema nacrt postavljanja postojećeg salona. Ne otvara sučelje Wizarda,
ne kreira salon, zaposlenike, pozivnice ni usluge, ne mijenja rezervacije i ne
proglašava salon spremnim za produkciju. Postojeći saloni nisu prisilno uključeni.

Postavljanje je dostupno aktivnom vlasniku odabranog aktivnog salona. Administrator
nastavlja upravljati postojećim zaposlenicima/uslugama prema postojećim ovlastima;
u ovoj fazi ne uređuje vlasnikov nacrt početnog postavljanja.

## API

`GET /api/salon-setup` i `PUT /api/salon-setup` koriste postojeću Clerk autentikaciju,
aktivno članstvo i `x-salon-id`. Identitet salona i korisnika nikada ne dolazi iz tijela.
Odgovor je `{ data: { salon, setup, started } }`, uz `Cache-Control: no-store`.
GET bez spremljenog nacrta vraća `started:false`, revision 0 i prazne izbore, bez zapisa u bazu.
`salon` sadrži postojeći id, naziv i vremensku zonu; oni se ovim endpointom ne mijenjaju.

PUT prima cijeli nacrt:

```json
{
  "expected_revision": 0,
  "business_type": "hair",
  "location": "Pula",
  "team_mode": "solo",
  "owner_provides_services": true,
  "last_step": "team"
}
```

- business_type: null, hair, grooming, mixed, other.
- location: tekst do 250 znakova; prazan string je dopušten.
- team_mode: null, solo, team.
- owner_provides_services: null, true, false. To je namjera, ne aktivacija profila zaposlenika.
- last_step: business, salon, team, services, schedule, review. To je mjesto nastavka,
  ne dokaz dovršenih koraka. Čak ni review ne znači da je postavljanje završeno.
- expected_revision: cijeli broj od 0 do 2147483646; svako uspješno spremanje povećava revision.
- Nepoznata polja, uključujući completed, timezone, salon_id i user_id, odbijaju se.

Nedostajući podaci ostaju null/prazni. Izbor grooming/mixed ne uključuje još
nedovršene funkcije ljubimaca. "Other" je samo klasifikacija, ne obećanje beauty podrške.

## Konkurentnost i pogreške

Spremanje je transakcijsko. Jedan salon ima najviše jedan nacrt. Provjerava se stvarno
aktivno vlasničko članstvo u bazi; relevantni redci zaključani su do kraja transakcije.
Zastarjela revizija vraća 409 SALON_SETUP_VERSION_CONFLICT i ništa ne prepisuje.
Neuspjela prva potvrda ne ostavlja prazan redak. Ponovljen PUT sa starom revizijom
nije automatski replay: klijent treba ponovno dohvatiti stanje i omogućiti pregled.
Nakon prekida veze ne ponavljati spremanje automatski; GET razrješava trenutačno stanje.

Validacija: 400 SALON_SETUP_INVALID. Nedostupno članstvo/salon/korisnik:
403 SALON_SETUP_FORBIDDEN (route može vratiti postojeći INSUFFICIENT_SALON_ROLE).

## Provjere i migracija

Nova migracija: 1793642400000_create-salon-setup.js. Dodaje samo novu tablicu i indeks,
bez popunjavanja postojećih salona. Down uklanja spremljene nacrte; ne koristiti ga
kao rutinski povrat aplikacijskog koda nakon što postoje stvarni podaci.

Novi unit/API testovi provjeravaju tijelo, identitete, uloge i zaštitu od dodatnih polja.
PostgreSQL testovi pokrivaju čitanje bez upisa, nastavak, konkurentne prve zapise,
zastarjele revizije, rollback, izolaciju salona, promjene članstva i ograničenja baze.

Lokalno: novi unit/API testovi uspješni. PostgreSQL nije dostupan u pripremnom okruženju.
Širi unit run: 113/114 prolazi; postojeći appointments.test.js traži PostgreSQL te pada
s ECONNREFUSED. To nije potvrda pune regresije. Priloženi verifier izvršava TEST migracije,
nove DB testove i cijeli backend suite na korisnikovoj TEST bazi prije DEV migracije.
Automatske provjere ne koriste pravi OpenAI ključ i ne troše AI kredite.

## Sljedeći paketi

2. Sučelje Wizarda i nastavak nacrta; pristup iz Postavki postojećeg salona, bez prisilnog otvaranja.
3. Povezivanje tima, vlasnika-zaposlenika, uvoza i rasporeda s postojećim servisima.
   Završna provjera stvarnih podataka, ne samo oznaka koraka.
4. Samostalno kreiranje prvog salona za autentificiranog korisnika bez članstva:
   zaseban endpoint bez requireCurrentSalon, idempotentno stvaranje salona i vlasništva,
   ograničenje zloupotrebe i test izolacije. Ne zaobilaziti postojeći odabir salona/pozivnice.
5. Cijeli frizerski onboarding, zatim grooming modul s vlasnikom, ljubimcem, pasminom i avatarom.
