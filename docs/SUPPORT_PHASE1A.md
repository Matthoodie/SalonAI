# Podrška S1A — ugovor i validacija

Osnova: 4870d09. Ovo je priprema, nije funkcionalan helpdesk.
Nema nove rute, tablice, migracije, UI-ja, .env varijable ili vanjskog slanja.
Modul se tek u S1B povezuje sa servisom. Postojeća aplikacija ostaje istog izgleda.

## Zahtjev za budući POST /api/support/tickets

```json
{
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "category": "bug",
  "subject": "Problem s kalendarom",
  "description": "Ne mogu otvoriti prikaz odabranog dana.",
  "language": "hr",
  "salon_id": null,
  "context": {"page": "calendar", "app_version": "4870d09"}
}
```

- Autor dolazi iz autentikacije, nikada iz tijela. Sam validator nije autorizacija.
- salon_id je opcionalan kontekst; S1B obavezno provjerava aktivno članstvo u tom salonu.
- Prijava pripada autoru; vlasnik/admin salona nema automatski pristup tuđim prijavama.
- Novi korisnik bez salona može prijaviti problem s početnim postavljanjem.
- Kategorije help/bug/idea, jezik hr/en. Naslov 5–160, opis 20–5000 Unicode znakova
  nakon trim-a; CRLF postaje LF. Nema pretvaranja proizvoljnih objekata u tekst.
- Kontekst sadrži samo page enum i opcionalnu oznaku verzije do 40 ASCII znakova.
  Ne sprema se puni URL, query string, sesija, token, screenshot ili kopija obrazaca.
- Nepoznati ključevi se odbijaju. Opis je običan tekst; UI ga mora prikazati escaped,
  bez dangerouslySetInnerHTML i bez automatskog izvršavanja korisničkih poveznica.
- Validator ne može prepoznati sve osobne podatke u slobodnom tekstu. UI mora objasniti
  da korisnik ne šalje lozinke, kartične podatke i podatke klijenata bez potrebe.
- SUPPORT_VALIDATION_ERROR, HTTP 400, field; poruka ne ponavlja dostavljeni sadržaj.

## Idempotencija i pristup (obavezni S1B kriteriji)

- request_id mora biti UUID v4, normaliziran na mala slova.
- supportRequestHash računa SHA-256 kanoniziranog sadržaja bez request_id.
- Hash nije anonimizacija niti tajna, služi samo usporedbi sadržaja zahtjeva.
- Jedinstvenost (authenticated_user_id, request_id) u bazi i transakcija štite od duplikata.
- Replay istog sadržaja vraća isti rezultat; različiti sadržaj za isti ključ vraća 409.
- Aktivni korisnik ponovno se provjerava; klijent ne bira status ili support ovlast.
- Rate limit i ograničenje HTTP tijela dodaju se u S1B; validator nije zamjena za njih.
- GET popis: samo vlastite prijave, cursor before pozitivni ID, fiksno 20 rezultata.
- GET detalj: neovlaštenom korisniku ne otkrivati postoji li tuđa prijava.
- Za odgovore podrške zaseban platformni grant, audit, statusi i kontrola verzije u S3.

## Provjera

23 nova testa: polja, duljine, Unicode, nepoznati ključevi, identiteti, UUID,
normalizacija, hash, granice ID-ja, sigurne greške i paginacija.
Pokretanje iz backend: node --test --test-reporter=spec tests/supportTicketValidation.test.js
Nema DB testova/migracije u S1A jer nema baze u ovoj promjeni.
Cijeli roadmap je konsolidiran; prethodni tekst sačuvan u ROADMAP_HISTORY_20261118.md.
