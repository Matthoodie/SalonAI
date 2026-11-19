# ZRIHTAN Support S3B — API operaterske obrade

Datum: 19. studenoga 2026. Polazna verzija: development 25c2f00.
Status: PRIPREMLJENO, čeka korisnički TEST i DEV prihvat.
Lokalno: 33 nova izolirana testa; s postojećim testovima podrške ukupno 112/112.
Pripremljeno 12 PostgreSQL scenarija. Lokalno nisu izvršeni jer nema PostgreSQL servera.

## Ponašanje i granice

S3A ovlast provjerava se unutar iste transakcije kao čitanje ili upis. Salonski
owner/admin/employee ne dobivaju pristup prijavama drugih korisnika. Operater ne
mora biti član salona. Ne daje se pristup klijentima, terminima ili impersonaciji.
Ni instalacija ni migracija ne dodjeljuju stvarnu ovlast podrške.

S3B dodaje samo backend. S2 ostaje kompatibilan: korisnik već vidi status svoje
prijave; prikaz odgovora i operatorski ekran dolaze u S3C. Korisnik u ovom paketu
može samo čitati razgovor svoje prijave. Nema korisničkog slanja nastavka razgovora,
privitaka, internih bilješki, uređivanja/brisanja poruka niti e-mailova (S3D).
Tekst odgovora je običan tekst, ne HTML. S3C ga mora prikazivati escaped tekstom.

## HTTP ugovor

Sve rute koriste postojeću server autentikaciju; ID korisnika dolazi iz currentUser.
Odgovori i greške imaju Cache-Control: no-store. Nema obveznog odabranog salona.
API je montiran prije globalnog JSON parsera, s ograničenjem 32 KiB i bez kompresije.

Operatorska baza putanje: /api/support/operations

- GET /access: {data:{allowed:true}} za ovlašten račun; inače 401/403.
- GET /tickets?before=ID&status=open: opcionalni strogi filtri; {data:{tickets,next_before}}.
  Najviše 20 prijava, ID silazno; ne pretražuje se slobodan tekst.
- GET /tickets/:id: {data:ticket}, uključuje revision.
- GET /tickets/:id/messages?after=ID: {data:{ticket,messages,next_after}}.
  Najviše 50 poruka, ID uzlazno. Prvi poziv bez kursora; daljnji koristi next_after.
- POST /tickets/:id/operations: odgovor ili promjena statusa.
  Novo izvršenje 201; uspješno ponavljanje iste operacije 200.

Autorska ruta: GET /api/support/tickets/:id/messages?after=ID
Isti oblik razgovora, ali SQL uvjet obvezno user_id=prijavljeni autor. Tuđa i
nepostojeća prijava daju isti 404. Aktivni autor ostaje ovlašten nakon izlaska iz
salona. Neaktivan račun odbija se. Poruke ne otkrivaju ID operatera ni audit.

Odgovor operatera:
```json
{"request_id":"UUID-v4","expected_revision":1,"kind":"reply","body":"Tekst odgovora","status":"pending"}
```
status je kod odgovora neobavezan; bez njega ostaje prethodni status.
Odgovor ima 1–5000 Unicode znakova nakon normalizacije CRLF i trimanja.

Samo status:
```json
{"request_id":"UUID-v4","expected_revision":2,"kind":"status","status":"resolved"}
```
Dopušteni statusi open/pending/resolved/closed; operater može ponovno otvoriti prijavu.
Nema obvezne linearne putanje statusa. Odgovor bez statusa ne otvara zatvorenu prijavu.
Postavljanje već postojećeg statusa odbija se kodom SUPPORT_STATUS_UNCHANGED (409).

Rezultat operacije: {data:{ticket_id,revision,status,message_id,replayed}}.
request_id je jedinstven po operateru, ne po salonu. Isti UUID mora se ponavljati
s istim normaliziranim sadržajem, ticket_id i expected_revision. Promjena sadržaja
s istim UUID vraća SUPPORT_REQUEST_CONFLICT (409). Novi pokušaj nakon osvježavanja
revizije koristi novi UUID. Replay vraća originalni rezultat i kad je prijava kasnije
promijenjena; ne prikazuje nužno trenutačni status. Za aktualno stanje ponovno GET.

## Transakcije, ograničenja i audit

Sve postojeće prijave dobivaju revision=1. Svaki novi odgovor/status povećava reviziju.
Zastarjela revizija daje SUPPORT_REVISION_CONFLICT (409). Poruka, ažuriranje prijave,
receipt i audit su jedna transakcija. Kvar audita poništava cijelu promjenu.

Upis zaključava users redak operatera FOR UPDATE, zatim S3A grant, pa prijavu.
To serijalizira request_id i kvotu istog operatera čak i na različitim prijavama.
Dva operatera nad istom prijavom zaključavaju prijavu: samo jedan može koristiti istu
reviziju. Čitanja koriste S3A FOR SHARE brave do završetka transakcije. Opoziv čeka
već započetu autoriziranu transakciju; nakon završetka opoziva novi pozivi, uključujući
replay, odbijaju se. Ovlast se ne predmemorira.

Najviše 120 novih odgovora po operateru u satu, preko svih prijava. Replay ne troši
kvotu. Statusi nemaju ovu kvotu. Opći mrežni rate limit i nadzor čitanja dio su R1;
S3B nije konačna infrastrukturna zaštita od svih vrsta preopterećenja.

Audit upisuje uspješni pregled popisa/detalja/poruka i mutacije (list/detail/messages/
reply/status). /access je samo provjera dostupnosti i ne upisuje audit. Audit ne
kopira tekst odgovora, opis, e-mail ili podatke klijenata. Čitanje s neuspjelim auditom
ne vraća sadržaj klijentu. Ponavljanje već spremljene operacije ne duplicira audit.
Aplikacija ne izlaže uređivanje/brisanje audita. DB administrator ga može mijenjati;
audit nije kriptografski nepromjenjiv. Pravila čuvanja definirati prije pilota.

Brisanje prijave briše razgovor i receipts; audit zadržava minimalni numerički ID
prijave s praznim FK. Brisanje operatera uklanja njegove receipts, poruke ostaju bez
operator FK. Audit ostaje s numeričkim snapshotom. S3B ne uvodi HTTP brisanje računa
ili prijava; postojeća pravila brisanja moraju se provjeriti u R1/L2.

## Prihvat i povrat

--check → --apply → verifier --unit → verifier --database → zasebna DEV migracija.
--unit pokreće sintaksu i 112 izoliranih testova podrške. Cijeli backend pokreće se
samo u --database jer stari appointments.test.js koristi DB iako ima .test.js naziv.
TEST mora biti salonai_regression ili naziv sa zasebnom riječi test; mora se razlikovati
od DEV naziva. Verifier eksplicitno postavlja .env.test DATABASE_URL za sve podprocese.
Nema npm install, novih ovisnosti, frontend promjena ili .env izmjene.

12 DB scenarija: odbijanje neoperatera, audit čitanja, atomarni odgovor/status,
izolacija autora, replay nakon novih revizija, dva operatera, istodobni isti UUID,
rollback audita, opoziv blokira replay, paginacija, kvota i brisanje autora.
Nakon njih cijeli backend skup. Ne preskakati prethodne testove.

Migracija je aditivna. Automatski down odbijen je zbog sadržaja poruka i audita.
Povrat prethodnog koda može ostaviti nove tablice/revision; ne brisati podatke radi
rutinskog rollbacka. Installer radi backup izmijenjenih datoteka i vraća ih ako upis
paketa padne. Ako hash provjera ne prođe, ne koristiti force zamjenu.

Slijedi S3C: HR/EN operatorski red prijava, prikaz razgovora autora, stanje slanja,
409 osvježavanje, siguran replay, teme/mobitel i kontrolirana dodjela ovlasti testnom
operateru. Stvarnu ovlast nije potrebno dodjeljivati za DB prihvat S3B.
