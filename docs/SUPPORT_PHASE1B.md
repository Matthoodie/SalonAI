# Support S1B — baza i korisnički API

Polazni commit: 9623fcf. Pripremljeno 18. 11. 2026.; čeka prihvat u korisničkoj TEST/DEV bazi.

## Opseg

S1A ostaje nepromijenjen. Nova tablica support_tickets i prijavljene korisničke rute.
Nema UI-ja, privitaka, e-maila, odgovora podrške ili platformnih administratorskih ovlasti.
Postojeći termini, klijenti, saloni, wizard, WhatsApp postavke i frontend nisu promijenjeni.

## API

Sve rute su pod /api/support/tickets, koriste Clerk i aktivni lokalni račun.
Ne zahtijevaju currentSalon; autor je isključivo req.currentUser.id.

- POST /: S1A tijelo s UUID v4 request_id; 201 za novu prijavu, 200 za ponavljanje.
  Odgovor {data: ticket, replayed: boolean}. Isti ključ i drugi sadržaj vraća 409.
- GET /: {data: {tickets, next_before}}. Najviše 20 prijava, id DESC.
  Opcionalno ?before=<id>; naredni kursor je posljednji vraćeni id ako postoji još zapisa.
  Popis ne sadrži puni opis ni tehnički hash/ključ/autora.
- GET /:id: {data: ticket}. Tuđa i nepostojeća prijava jednako vraćaju 404.
- PATCH/PUT/DELETE i administrativne rute nisu izložene.

S1A polja: request_id, category help/bug/idea, subject 5–160, description 20–5000,
language hr/en, opcionalni salon_id, context s page i app_version.
Status nove prijave je open; budući pending/resolved/closed su dopušteni u bazi,
ali korisnik ih ovim API-jem ne može postavljati ni mijenjati.

## Izolacija i ponavljanje

Svaki upit filtrira user_id iz autentikacije. Owner/admin salona ne dobiva tuđe prijave.
Aktivan račun provjerava se ponovo u transakciji. Novi salon_id zahtijeva aktivan salon
te aktivno članstvo. Članstvo i salon se zaključavaju pri stvaranju.
Autor i dalje može čitati svoju prijavu i ponoviti izvorni zahtjev nakon gubitka članstva.
Brisanje salona postavlja salon_id na null; originalni hash i ključ ostaju.
Brisanje korisnika kaskadno briše njegove prijave. Nema javnog DELETE endpointa.
Retenciju, povrat podataka i postupak zatvaranja računa treba urediti prije stvarnog pilota.

Jedinstveno (user_id, request_id); isti UUID kod drugog autora je neovisan zahtjev.
FOR UPDATE na korisniku serijalizira stvaranja za taj račun. Ponovljeni zahtjev vraća
trenutni zapis prijave, ne zaključani povijesni status. Hash se ne vraća klijentu.
Ako veza pukne nakon COMMIT-a, S2 mora ponoviti isti UUID i isti sadržaj.
Kod nove sadržajne izmjene nakon 409 potrebno je novo slanje s novim UUID-om.

## Granice i privatnost

- JSON do 32 KiB, bez kompresije; parser prije globalnog express.json.
- Najviše 5 novih prijava u kliznom satu i 20 u 24 sata po računu, na temelju baze.
- Replay se provjerava prije kvote i ne stvara novi zapis; limit vraća 429/Retry-After 3600.
  Taj interval je preporučeni ponovni pokušaj, ne jamstvo da je dnevna kvota oslobođena.
- Odgovori i greške Cache-Control no-store. Nema automatskog prikupljanja URL-a,
  tokena, kolačića, screenshotova ni podataka drugih obrazaca.
- Lokalni error handler vraća kodove, bez opisa greške baze ili sadržaja prijave u logu.
- Ukupni autentikacijski/network rate limit i platformni monitoring ostaju R1.

## Provjere

Lokalno: 49 ciljanih testova (23 S1A + 13 servis + 13 API), uključujući stvarni
Express HTTP i createApp povezivanje s injektiranom autentikacijom; to nije Clerk live test.
Nove datoteke prolaze node --check. PostgreSQL server nije dostupan u okruženju izrade:
12 DB scenarija isporučeno je za korisničku TEST bazu; njihovu uspješnost ne pretpostavljamo.
Verifier --unit: 49 ciljanih provjera, sintaksa, git diff/status.
Verifier --database: provjera odvojene TEST veze, TEST migracije, 12 PostgreSQL scenarija
i cijeli postojeći backend skup (run-tests.js all) nad TEST bazom. Neki postojeći .test.js
testovi također trebaju bazu pa puna regresija ide tek nakon TEST migracije.
Testovi koriste sintetičke zapise i finally čišćenje. DEV migracija tek nakon obaju prolaza.

DB scenariji: račun bez članstva; tuđe prijave; neaktivna članstva/saloni/korisnici;
konkurentni isti i različiti ključevi; kvote; paginacija; DB ograničenja; rollback;
stvarni montirani API nad testnom bazom.

## Migracija i povrat

1795003200000_create-support-tickets.js stvara samo support_tickets i indekse.
Nema npm install, .env izmjene niti uključivanja kreiranja salona.
Installer provjerava polazne hashove prije zapisa i radi sigurnosnu kopiju promijenjenih
postojećih datoteka. Greška pri zapisivanju vraća dotaknute datoteke.
To nije backup baze. down migracija briše support_tickets i sve prijave: NE pokretati je
nakon stvarnih prijava bez odvojenog plana zadržavanja/povrata podataka.
Siguran povrat aplikacijskog koda može ostaviti novu tablicu u bazi.

Nakon prihvata i commita slijedi S2: HR/EN obrazac i popis vlastitih prijava,
uključujući Welcome bez salona. S3 uvodi ovlaštenu obradu i odgovore podrške.
