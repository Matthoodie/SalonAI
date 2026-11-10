# Grooming 3A — veza termina, vlasnika i ljubimca (backend)

Polazni commit: `924ec35`. Preduvjet: primijenjen Grooming 1 i Grooming 2.

## Opseg ovog paketa

Ovo je prvi od dva paketa za Grooming 3. Uvodi vezu u bazi, spremanje kroz API,
zaštitu podataka, informacije u odgovorima termina/kalendara te ograničen izbor
ljubimaca za zaposlenike. Ne mijenja frontend. Trenutačni obrazac i dalje radi.
Grooming 3 nije dovršen dok ne primijenimo 3B (odabir i prikazi/povijest).
Nema novih ovisnosti, AI poziva ili potrebe za novim računom/salonom.

Migracija: `1794333600000_link-appointment-pets`.

## Model i povijest

- Jedan termin pripada jednom klijentu/vlasniku i najviše jednom ljubimcu.
- `recipient_type`: `pet`, `person` ili NULL za stare/neklasificirane termine.
- `pet_id` zajedno s `client_id,salon_id` čini strani ključ prema `client_pets`.
- `pet_name,pet_species,pet_breed` su snimka u trenutku odabira: ime/pasmina
  u povijesti ne mijenjaju se preimenovanjem ili arhiviranjem profila.
- `recipient_revision` počinje od 1; zajednička promjena vlasnika/ljubimca
  povećava ga. Stara verzija dobiva 409. Nema automatskog ponavljanja.
- Postojeći termini dobivaju NULL vrijednosti; nije dodijeljena nijedna životinja
  prema imenu vlasnika, broju životinja ili drugim pretpostavkama.
- Zabrana preklapanja istog ljubimca vrijedi i za različite zaposlenike.
  Kao postojeća zabrana za zaposlenika, izuzima otkazane termine, a granica kraja
  jednog i početka drugog je dopuštena. Postojeća dostupnost zaposlenika ostaje.
- Arhivirani ljubimci ostaju povezani s postojećim terminima i poviješću.
- Izravno brisanje ljubimca koji je povezan s terminom odbija strani ključ.

## API ugovor

### Kreiranje

POST `/api/appointments`: postojeći podaci + `recipient_type: "pet"`, `pet_id`.
Backend uzima podatke ljubimca iz baze, nikada iz poslanih prikaznih oznaka.
Za eksplicitni tip `person` nema `pet_id`; grooming salon odbija takav zahtjev.
Hair/other salon odbija tip `pet`; mixed podržava oba tipa.
Ljubimac i vlasnik moraju biti aktivni i pripadati odabranom salonu.
Izbor i rezervacija su u istoj transakciji; neuspjeh ne ostavlja novog vlasnika.

**Prijelazna kompatibilnost:** ako stari frontend uopće ne pošalje nova polja,
3A zadržava stari način kreiranja (NULL tip). To nije završna obvezna grooming
validacija. Paket 3B mora istodobno povezati UI i pooštriti backend putove kreiranja
za grooming salone, uključujući druge booking ulaze. Stari zapisi ostaju čitljivi.
Ne slati eksplicitni NULL tip umjesto izostavljenih polja.

### Promjena primatelja

PATCH `/api/appointments/:id/recipient`:

```json
{
  "client_id": 12,
  "recipient_type": "pet",
  "pet_id": 7,
  "expected_recipient_revision": 1
}
```

Koristi postojeću ovlast `appointment.change_client`, uključujući self scope.
Promjene su dopuštene samo na pending/confirmed terminima. Vlasnik i ljubimac
mijenjaju se jednim zapisom. Nepromijenjeni par ne osvježava povijesne oznake niti
povećava verziju. Stari `/client` endpoint odbija termine povezane s ljubimcem,
a na starim terminima ostaje kompatibilan i povećava verziju kod stvarne promjene.

### Ograničeni izbor za rezervaciju

GET `/api/appointments/pet-options?client_id=12` zahtijeva `appointment.create`.
Za uređivanje: dodati `appointment_id=34`; koristi `appointment.change_client`
i provjerava scope tog termina prije dohvata ljubimaca.

Odgovor `data`: `salon_id,client_id,business_type,pets,next_cursor`.
`pets` sadrži samo aktivne životinje aktivnog vlasnika: id, salon_id, client_id,
name, species, breed. Nema bilježaka ni kontaktnih podataka. Stranica ima do 50
stavki, nastavak `after=next_cursor`. Jednaka imena ne spajaju identitete.
Endpoint ima zasebni limit pretrage 30/min po korisniku i salonu te no-store.
Ne daje zaposleniku ovlasti uređivanja profila ljubimaca.

### Prikazi

GET liste/detalja termina te odgovori stvaranja, promjene statusa, rasporeda,
usluga i primatelja uključuju pet polja i recipient_revision. Kalendar uključuje
ista polja uz postojeće client/employee/service objekte. Nije uvedeno globalno
povećanje ovlasti čitanja. Pet povijest u 3B mora koristiti pet_id, ne ime.

## Provjere i instalacija

1. Zaustaviti backend. PostgreSQL mora raditi; frontend može ostati uključen.
2. Package --check pa --apply iz backend mape: samo promjena datoteka + TEMP backup.
3. Verify provjerava da su TEST i DEV odvojene baze; migrira isključivo TEST.
4. Novi unit/API/transakcijski testovi, PostgreSQL testovi, cijeli backend suite,
   frontend testovi/build i Git diff check moraju završiti s kodom 0.
5. Tek zatim DEV `npm run migrate:up` i `npm run dev`.
6. Ručno provjeriti postojeći termin, promjenu klijenta na starom terminu,
   reschedule/status, CRM ljubimce i frizerski/grooming salon.
7. Poslati izvještaj prije commita. Ne očekivati novi odabir u obrascu do 3B.

Lokalno kod autora izvršeni su unit/API/transakcijski testovi sa simuliranim DB
odgovorima i provjere instalera. Pravi PostgreSQL i puni integracijski suite nisu
izvršeni u tom okruženju; obvezni su u lokalnom verifieru prije DEV migracije.

Migracija down uklanja veze/snimke: nije postupak povratka nakon unosa stvarnih
podataka. Ne pokretati je u DEV-u bez zasebno pripremljenog plana oporavka.

## Sljedeći paket 3B

Vlasnik → ljubimac u rezervaciji; jasan izbor person/pet za mixed; obvezan ljubimac
za novo grooming rezerviranje i na backendu; novi vlasnik/ljubimac uz očuvanje
nacrta; ručno povezivanje starih aktivnih termina; pretraga po oboma; kartice,
kalendar, dashboard i povijest vlasnika/ljubimca. Po završetku 3B slijede fotografije.
