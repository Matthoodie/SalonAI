# ZRIHTAN — roadmap do javne V1

Ažurirano: 25. studenoga 2026.
Potvrđena polazna verzija: development abf6707.
Aktualni paket: I1 — kontrolirane staging migracije (PRIPREMLJENO).
S3D-B3 spremljen kao 0d76fad; korisnik potvrdio primitak obavijesti u Gmailu. I1 započet.
Statusi: ZAVRŠENO = korisnički potvrđeno; PRIPREMLJENO = paket čeka prihvat;
PLAN = još nije implementirano. Ranija povijest ostaje u ROADMAP_HISTORY_20261118.md.

## 1. Cilj i granice V1

ZRIHTAN služi frizerskim salonima/brijačnicama i salonima za njegu ljubimaca.
Jedna aplikacija, odvojeni saloni i uloge owner/admin/employee, HR/EN i dvije teme.
Beauty centri, sobe, uređaji i paralelni resursi ostaju V2.

Razlikujemo:
- zatvoreni razvoj i staging, sa sintetičkim podacima;
- kontrolirani besplatni pilot stvarnih salona, tek nakon operativne i pravne pripreme;
- javnu V1 s jasno objavljenim opsegom i podrškom;
- komercijalnu V1 s uključenom naplatom, nakon pilota i provjere billing sustava.
Javna pilot stranica nije obećanje da su sve planirane funkcije dostupne.

## 2. Potvrđeno završeno

- Autentikacija Clerk, lokalni korisnici, članstva i salonske ovlasti.
- Termini, više uzastopnih usluga, povijesne cijene/trajanja, promjene i statusi.
- Raspoloživost, kvalifikacije, smjene, iznimke, odsutnosti, blokade i zaštita termina.
- Klijenti, zaposlenici, usluge, kalendar i poslovni pregled.
- Uvoz cjenika u pregled koji korisnik potvrđuje; nema automatskog spremanja AI nacrta.
- Welcome i Magic Wizard; kreiranje salona još je kontrolirano konfiguracijom.
- Grooming: više ljubimaca po vlasniku, fotografija, veličina/težina, termin i povijest.
- HR/EN sučelje, svijetla/tamna/sistemska tema i lokalizirani odabir datoteka.
- Javni rebrand ZRIHTAN; unutarnji identifikatori projekta ostaju kompatibilni.
- Poslovne vrijednosti, trendovi i najuspješnije usluge.
- Planirani kapacitet, dnevni/tjedni prikaz bez vodoravnog klizača, mobilne kartice.
- Deterministički poslovni uvidi; potvrđen commit 4870d09 i frontend 326/326.
- Zadnje prijavljene provjere kapaciteta: 54/54 ciljane, PostgreSQL 7/7,
  puni backend 975/975. To nije tvrdnja da su nakon svake dorade ponovljene sve provjere.

## 3. Odluke i otvorene stavke

- Početni pružatelj usluge bit će drugi obrt; točan subjekt NIJE ODABRAN.
- Kasniji prelazak na novi obrt planira se kao zaseban pravni i operativni projekt.
- zrihtan.com kupljena na Porkbunu 20.11.2026., rok 20.11.2027.; auto-renew, lock i privacy uključeni prema korisničkoj slici.
  Predloženo: zrihtan.com javna stranica,
  app.zrihtan.com aplikacija, staging.zrihtan.com zaštićeni test, podrška pod /help.
  zrihtan.hr, zrihtan.eu i zrihtan.com.hr planirane kasnije kao preusmjeravanja; kupnja nije potvrđena.
  Druga domena nije nužna za landing; DNS i hosting još nisu povezani kroz projekt.
  Postojeći URL forwarding ima nepoznato odredište; provjeriti prije spajanja hostinga.
- E-mail servis: Resend; notify.zrihtan.com verificirana, zaseban test dostave potvrđen.
- Hosting: Render, projekt ZRIHTAN / Staging. Naplatni servis, cijene pretplate i rokovi čuvanja još nisu odabrani.
- WhatsApp produkcijski/pilot broj NIJE ODABRAN; ne povezivati privatni broj automatski.
- Prvi razvoj WhatsAppa koristi testne resurse i dogovorene testne primatelje.
- Službeničke obveze i dopuštenost konkretnog poslovnog angažmana provjeriti zasebno;
  izostanak isplate ne tretirati kao automatsku pravnu dozvolu.
- Prije uporabe stvarnih podataka odrediti ugovornu stranu, ovlasti i obveze obrade.

## 4. Podrška — prvi sljedeći razvojni blok

### S1A — ugovor prijave i validacija (ZAVRŠENO, 9623fcf)
- Kategorije help/bug/idea, naslov 5–160 i opis 20–5000 Unicode znakova.
- HR/EN, UUID v4 za sigurno ponavljanje, hash normaliziranog sadržaja.
- Neobavezan kontekst salona; novi prijavljeni korisnik bez salona također je podržan.
- Samo oznaka stranice iz dopuštenog popisa i oznaka verzije; nema automatskog
  slanja tokena, kolačića, URL parametara, sadržaja obrazaca ili podataka klijenata.
- Odbijanje identiteta autora, statusa, uloge i privitaka iz korisničkog zahtjeva.
- 23 testa. Nema migracije, API rute, UI-ja, slanja poruka niti .env promjene.

### S1B — baza i korisnički API (ZAVRŠENO, 1a96b01)
- Migracija za prijave i potrebne indekse; status zaprimljeno na serveru.
- Prijavljeni aktivni račun iz postojeće autentikacije; ne zahtijevati salon.
- Autor se uzima isključivo sa servera. Za opcionalni salon provjeriti aktivno članstvo.
- Korisnik vidi samo svoje prijave, bez prava pregleda tuđih zbog salonske owner uloge.
- Idempotencija jedinstvena po autoru i request_id; isti sadržaj vraća istu prijavu,
  promijenjeni sadržaj s istim ključem vraća 409, bez novih zapisa.
- Ograničenje učestalosti i veličine tijela na serveru, transakcije i provjera aktivnog računa.
- Popis po stabilnom kursoru, najviše 20 rezultata; privatni odgovori bez predmemorije.
- Testovi izolacije korisnika/salona, dvostrukog i istodobnog slanja, pogrešaka i rollbacka.
- TEST migracija i DB provjere prije DEV migracije.
- S1B: 32 KiB JSON, najviše 5 novih prijava/sat i 20/24 sata po računu; ponavljanje postojeće prijave ne troši kvotu.
- Greške podrške ne bilježe opis prijave ni SQL parametre. Nema UI-ja, privitaka, odgovora ni e-mail slanja u S1B.
- Autor zadržava pristup svojim prijavama nakon prestanka članstva; novi salonski zahtjev zahtijeva aktivno članstvo.

### S2 — HR/EN korisničko sučelje (ZAVRŠENO, 3b71a1a)
- Pomoć i podrška u aplikaciji i početnom Welcome zaslonu.
- Obrazac, objašnjenje da se ne unose lozinke/osjetljivi podaci, potvrda s brojem prijave.
- Vlastite prijave i statusi; čuvanje istog request_id kod neizvjesnog ishoda.
- Nema automatskog screenshotanja. Privitci ostaju zasebna kasnija dorada.
- Teme, mobilni prikaz, promjena jezika, računa i salona te nedostupna mreža.
- Pristup iz aplikacije, Welcome zaslona i onboardinga u zasebnom dijalogu.
- Spremljeni pokušaj u sessionStorage odvojen po lokalnom korisniku; isti sadržaj i UUID do potvrde.
- S2 ne dodaje migracije, ovisnosti, e-mailove ni platformne ovlasti. Detalji: SUPPORT_PHASE2.md.

### S3 — operativna obrada i odgovor (UI/API završeni; e-mail integracija i operativni prihvat u tijeku)
- Posebna platformna ovlast podrške, odvojena od owner/admin salona.
- Kontrolirano dodjeljivanje i opoziv pristupa, audit radnji, bez impersonacije klijenta.
- Pregled prijave, odgovor i promjena statusa s kontrolom istodobnih izmjena.
- Korisnik čita odgovore samo na svojoj prijavi.
- Obavijest e-mailom nakon odabira servisa; spremljena prijava ne ovisi o uspjehu e-maila.
- Praćenje novih prijava, radno vrijeme podrške i realno obećani rok odgovora.
- Definirati rokove čuvanja i brisanje; sustav podrške nije trajni arhiv svih podataka.

### S3A — platformne ovlasti i audit (ZAVRŠENO, 25c2f00)
- Korisnički potvrđeno: 10/10 PostgreSQL, cijeli backend 1076/1076; commit/push čist.
- Ispravljen verifier: stari appointments.test.js koristi bazu, puni skup ide s TEST konfiguracijom.
- Posebna platform_support_access ovlast; salonske uloge ne dodjeljuju pristup.
- Kontrolirani CLI: točan Clerk user ID, naziv baze, očekivana revizija, razlog;
  pregled plana po zadanim postavkama, upis samo uz --apply.
- Nijedna ovlast ne dodjeljuje se instalacijom ili migracijom.
- Revizija sprečava prepisivanje tuđe novije promjene; grant i audit su jedna transakcija.
- Audit bilježi DB ulogu izvršitelja, vrijeme, cilj, promjenu i razlog; nema izmjene/brisanja kroz aplikaciju.
- Provjera pristupa veže ovlast uz lokalni ID i trenutačni Clerk identitet, uz zaključavanje do kraja transakcije.
- Nema HTTP administracijskih ruta ni operatorskog prikaza u S3A; detalji SUPPORT_PHASE3A.md.

### S3B — API obrade i odgovora (ZAVRŠENO, 9725dea)
- Potvrđeno: 12/12 PostgreSQL, 1121/1121 backend, migracije i commit/push.
- Ovlast se provjerava u istoj transakciji kao pristup prijavi/odgovor/promjena statusa.
- Audit operaterskih radnji, zaštita istodobnih izmjena i privatni odgovori autora.
- GET pristup/popisi/detalj/poruke; POST odgovor ili status uz UUID i expected_revision.
- Odgovor/status/receipt/audit u jednoj transakciji; replay ne duplicira poruku.
- Autorski GET razgovora samo za vlastitu prijavu, bez otkrivanja operatorskih ID-jeva.
- Paginacija 20 prijava / 50 poruka; 32 KiB JSON, odgovor do 5000 znakova, 120 odgovora/sat/operater.
- Nema novog UI-ja, korisničkih nastavaka razgovora ni e-maila u S3B. Detalji SUPPORT_PHASE3B.md.

### S3C — sučelje operatera i razgovora (ZAVRŠENO, 325464e)
- Korisnik potvrdio 45/45 ciljanih testova, ručni rad i čist commit/push.
- Paket SUPPORT_PHASE3C.md: operatorski popis/odgovori/status i autorovo čitanje odgovora.
- SessionStorage pokušaji, stabilan UUID, kontrola revizije, prekid zahtjeva i HR/EN.
- Nema nove migracije ni e-maila; korisnički nastavci razgovora nisu implementirani.
- Operater vidi red prijava; korisnik samo razgovore vlastitih prijava; HR/EN i teme.

### S3D-A — evidencija obavijesti (ZAVRŠENO, 736b3ef)
- Jedan held događaj za svaki novi odgovor operatera, u istoj transakciji s odgovorom i auditom.
- Nema događaja za promjenu statusa; nema popunjavanja povijesnih poruka.
- Minimalni identifikatori i HR/EN jezik prijave, bez kopije e-maila ili sadržaja razgovora.
- Read-only lokalni CLI s eksplicitnim nazivom baze; nema HTTP outbox pristupa.
- Nova migracija, bez novih ovisnosti, DNS/.env promjena, workera ili stvarnog slanja.
- Detalji: SUPPORT_PHASE3DA.md; 127 izoliranih testova lokalno, 10 DB testova na korisničkom TEST-u.

### S3D-B — servis i kontrolirana isporuka (B1/B2/B3 DEV prihvat završen)
- Odabir pružatelja, verificiranje domene/pošiljatelja, testni primatelji i DNS prema servisu.
- Worker, pokušaji/lease, idempotencija i neizvjestan ishod, praćenje isporuke.
- Ponovno provjeriti aktualni potvrđeni kontakt autora prije slanja.
- Ne slati automatski held događaje nastale prije aktivacije; izričit prag i pravila čuvanja.
- Nedostupan vanjski e-mail servis ne gubi spremljenu prijavu niti odgovor.

## 5. Domena, staging i javne stranice

### I1 — infrastruktura za razvoj integracija (U TIJEKU)
- Kupnja zrihtan.com potvrđena; slijede provjera 2FA/oporavka, ovlaštenja, DNS i hosting.
- HTTPS, zaštićeni staging bez indeksiranja, posebna baza i odvojene tajne.
- Odabir API rasporeda /api ili api poddomene, CORS, dopuštene Clerk adrese/povratne rute.
- Privremeni i produkcijski resursi ne dijele bazu, tokene ili stvarna plaćanja.
- Dogovor tko upravlja računima pružatelja i kako se osigurava pristup/oporavak.

### L1 — landing HR/EN (PLAN)
- zrihtan.com: opis, stvarne funkcije, frizerski/barber i grooming scenariji, demo,
  prikaz aplikacije, FAQ, kontakt i footer dokumenata.
- Dok je kreiranje kontrolirano: Zatraži pristup / demo, uz Prijavu za postojeće korisnike.
- Zbirka potencijalnih korisnika ima svrhu, rok čuvanja i pravila kontaktiranja.
- Ne objavljivati izmišljene preporuke, cijene, broj korisnika ili neimplementirane funkcije.
- Osnovni SEO, pristupačnost, mobilni prikaz, performanse i provjera kontaktnog obrasca.

### L2 — pravni i korisnički dokumenti (PLAN)
- Stvarni podaci pružatelja, kontakt i oznaka verzije/datuma primjene dokumenata.
- Pravila privatnosti, uvjeti korištenja i DPA za salonske podatke.
- Popis podizvršitelja, svrhe obrade, međunarodni prijenosi gdje postoje, rokovi čuvanja.
- Inventura kolačića/tehnologija; privola samo gdje je potrebna, jednako jednostavno povlačenje.
- Pravila pretplate/otkazivanja/povrata prije naplate; dobrovoljno money-back jamstvo
  definirati odvojeno od zakonskih prava. B2B/B2C opseg mora biti izričit.
- Evidencija prihvaćene verzije uvjeta i postupak obavijesti o materijalnim promjenama.
- Postupci pristupa, ispravka, izvoza/povrata i brisanja podataka uz provjeru ovlasti.
- Brisanje korisničkog računa nije automatsko brisanje cijelog salona; zaštititi
  posljednjeg vlasnika, prijenos ovlasti, poslovnu evidenciju i obveze čuvanja.
- Tekstovi odgovaraju stvarnoj implementaciji i prolaze stručnu provjeru prije objave.

## 6. WhatsApp i dogovoreni AI

### W0 — odluke i testno okruženje (PLAN)
- Meta testni resursi za slanje/primanje; osobni broj može biti samo testni primatelj.
- Produkcijski pošiljatelj je identificirani salon; zajednički broj za sve salone nije prešutna pretpostavka.
- Izbor direct Cloud API ili posrednika prema povezivanju više salona, trošku i održavanju.
- Provjera uvjeta dobavljača, povezivanja/odvajanja broja, ovlasti aplikacije i potrebnih odobrenja.

### W1 — komunikacijska podloga (PLAN)
- Evidencija dopuštenja za kontakt, svrhe/kategorije poruka, jezika primatelja i odjave.
- Jezik poruke klijenta odvojen je od jezika korisnika aplikacije.
- Tajne na serveru, izolacija salona, trajni red poruka, ključevi protiv duplikata,
  pokušaji uz ograničenja i kontrola troška; validacija potpisa webhookova.
- Neizvjestan ishod slanja ne ponavljati slijepo; evidentirati i razriješiti status.

### W2 — obavijesti i podsjetnici (PLAN)
- Potvrda, promjena, otkazivanje i jedan dogovoreni podsjetnik.
- U trenutku slanja ponovno provjeriti stanje termina, salon, primatelja i dopuštenje.
- Reschedule/otkazivanje uklanja zastarjele podsjetnike; vremenska zona salona.
- Predlošci HR/EN i Meta pravila/odobrenja prema aktualnom postupku pružatelja.
- Evidencija queued/sent/delivered/failed; ne tvrditi da je isporučeno na sam API accept.
- Isključivanje funkcije i ograničeni pilot; simulirane pogreške, dupli webhookovi i prekidi.

### W3 — vođena rezervacija i AI (PLAN)
- Najprije deterministički tok: usluga, zaposlenik/raspoloživost, vlasnik i ljubimac.
- Izričita potvrda sažetka prije rezervacije, ponovna provjera kroz postojeći booking servis.
- AI tumači namjeru i predlaže strukturirani nacrt; ne određuje slobodna vremena sam.
- Bez izravnog zapisivanja u bazu mimo ovlasti i booking pravila.
- Identifikacija klijenta, privatnost povijesti, ograničenja tokena/troškova i predaja salonu.
- Prihvatiti definiran minimalni opseg prije javnog obećanja AI rezerviranja.
- n8n je opcionalna orkestracija, ne autoritet za termine i ne obavezna nova ovisnost.

## 7. Mobilni prikaz i PWA

### M1 — mobilna upotrebljivost (PLAN)
- Provjera glavnih tokova na stvarnim Android/iOS uređajima: tipkovnica, navigacija,
  kalendar, obrasci, privatne fotografije, safe-area, dodir, duži HR/EN tekstovi.

### M2 — PWA (PLAN)
- Manifest, ikone, ispravan start URL/scope na app poddomeni i instalacijske upute.
- HTTPS, ažuriranje aplikacije i jasan offline ekran bez nesigurnog offline rezerviranja.
- Predmemorija samo namjerno odabranih javnih statičkih resursa. Bez spremanja
  privatnih API odgovora, fotografija klijenata/ljubimaca i auth tokova u service worker cache.
- Odjava/promjena računa i verzije provjereni; stari kod ne smije tiho ostati aktivan.

### M3 — tehnički prototip za trgovine (PLAN; nije uvjet web/PWA objave)
- Kandidat omotača tek nakon provjere Clerk prijave, deep linkova, sesije i kamere.
- Google Play/App Store računi, potpisivanje, privatnost, brisanje računa i testna distribucija.
- Aktualna pravila naplate u trgovinama provjeriti prije store monetizacije.
- PWA instalacija nije automatska objava u trgovinama; odobrenje nije zajamčeno datumom.

## 8. Produkcijska spremnost — obavezni izlazni kriteriji

### R1 — sigurnost i pouzdanost (PLAN)
- Odvojeni prod DB/Clerk/tajne; nema razvojnih zaobilazaka autentikacije.
- Pregled svih ruta, korisničkih/službenih ovlasti, izolacije salona, uploadova i rate limita.
- Kritične booking promjene i integracije otporne na istodobnost/ponavljanje zahtjeva.
- Privatna pohrana medija, plan povećanja prostora, ograničenja i backup.
- Kontroliran rollout migracija i verzija; rollback aplikacije uz kompatibilnost podataka.
- Automatizirani backup i uspješan probni povrat na odvojenu bazu, uz dogovorene ciljeve oporavka.
- Nadzor dostupnosti i grešaka, sanitizirani logovi, upozorenja i postupak incidenta.
- Upravljački pristup platformi zaštićen, auditiran i opoziv.
- Praćenje troška AI/WhatsApp/hostinga, ograničenja i prekidači za isključivanje.

### R2 — operativni prihvat (PLAN)
- Upute za vlasnika i zaposlenika; aktivna podrška koja stvarno zaprima i rješava prijave.
- Postupak zatvaranja salona, prijenosa vlasnika, izvoza/povrata i brisanja podataka.
- Završni E2E frizerski i grooming scenarij: registracija, wizard, članstvo,
  prvi termin, promjena, otkazivanje, završetak i statistika.
- Test izolacije dva salona i nekoliko računa, HR/EN, teme i mobitel.
- Provjera performansi s realnim volumenom; frontend agregate ne koristiti nad
  skraćenom/paginiranom poviješću bez serverskih agregata.
- Build, migracije i svi potrebni testovi; pregled ovisnosti i utvrđenih ranjivosti.
- Uklonjeni blokirajući problemi; poznata ograničenja jasno dokumentirana.

## 9. Kontrolirani besplatni pilot

- Odabrani frizerski/barber i grooming salon, dogovoreni opseg i trajanje pilota.
- Prije stvarnih podataka: odabrani pružatelj, potrebni ugovori/dokumenti i operativna zaštita.
- Pristup kreiranju salona otvara se kontrolirano, ne samo uklanjanjem zastavice.
- Produkcijski deploy s oznakom verzije i smoke provjerom, nadzor i kanal podrške.
- Bilježiti uspjeh ključnih radnji, prijave problema i stvarnu vrijednost korisnicima.
- Ispraviti blokere i potvrditi planove/cijene prije uključivanja naplate.

## 10. Billing i komercijalna V1

### B0 — poslovne odluke
- Pravna/ugovorna strana i račun naplate, planovi, EUR, porezni tretman i izdavanje računa.
- Pretplata pripada salonu; vlasnik upravlja naplatom. Korisnik može imati više salona.
- Trial, ograničenja, uključeni WhatsApp/AI trošak, otkazivanje i dobrovoljni povrati.

### B1 — tehnička integracija i sandbox
- Checkout/portal, serverska provjera prava, potpisani webhookovi, idempotencija i
  obrada događaja koji dolaze pogrešnim redoslijedom.
- Aktivacija tek nakon pouzdane serverske potvrde; povratak na success URL nije dokaz plaćanja.
- Obnova, otkazivanje na kraju razdoblja, neuspjela naplata i dogovoreno razdoblje oporavka.
- Bez automatskog brisanja podataka zbog neuspjele naplate; pristup/povrat definirani pravilima.
- Računi i računovodstveni postupak potvrđeni; payment provider nije sam po sebi cijela lokalna usklađenost.

### B2 — uključivanje stvarne naplate i publish
- Završni pravni/cjenovni sadržaj, stvarni ključevi i kontrolirana provjera naplate/povrata.
- Zatvoreni blokirajući pilot problemi, odobrenje objave, verzija/tag i release bilješke.
- Provjera nakon deploya: prijava, salon, termin, mediji, podrška, WhatsApp i billing.
- Javni landing prikazuje stvarno dostupne funkcije i jasne cijene/uvjete.
- Plan podrške i praćenja nakon objave; datum se veže uz kriterije, ne izmišljeni postotak dovršenosti.

## 11. Kasnija promjena pružatelja usluge

- Razlikovati vlasništvo/licencu nad kodom i brendom od ugovorne strane prema salonima.
- Pravno urediti uporabu proizvoda od početnog obrta i uvjete kasnijeg prijenosa.
- Napraviti inventuru domene, hostinga, Clerk/Meta/e-mail/naplatnih računa i ovlaštenih osoba.
- Promjenu ugovorne strane, DPA/privatnost i obavijesti korisnicima provjeriti pravno;
  ne pretpostavljati da promjena naziva u footeru prenosi ugovore ili podatke.
- Migraciju aktivnih pretplata i Meta resursa uskladiti s pravilima pružatelja.
- Stari računi/financijska povijest ostaju povezani s tadašnjim izdavateljem.
- Prijenos može biti nakon V1; početni ugovorni odnos mora biti uređen prije pilota/naplate.

## 12. Redoslijed i sljedeći korak

S1A → S1B → S2 → S3 → I1/L1/L2 → W0/W1/W2/W3 → M1/M2 → R1/R2 → pilot → B0/B1/B2.
Domena, pravne odluke, landing sadržaj i plan billing-a mogu se pripremati paralelno.
M3/store distribucija je zasebna grana nakon mobilne provjere i ne blokira web/PWA V1.

S3D-A: korisnik potvrdio TEST/DEV migracije i held događaj; commit 736b3ef.
S3D-B1: 19/19 testova, commit ae3ed5b; zasebna Resend testna poruka stigla u Gmail.
S3D-B2: korisnik potvrdio 166 izoliranih, 17 novih + 10 outbox DB testova i puni
backend s TEST bazom; commit/push b6d1478, radna kopija čista.
B2 pohranjuje zamrznutu poruku/pokušaje, zaključavanje, lease i neizvjestan ishod.
Još ne pokreće samostalno stvarno slanje iz aplikacije.

### S3D-B3 — završna kontrolirana DEV integracija (ZAVRŠENO, 0d76fad)

- Jedna odabrana obavijest; aktualna potvrđena primarna Clerk adresa autora.
- Read-only početak/popisi/pregled/status, odvojene naredbe pripreme i slanja.
- Točan naziv DEV baze, Clerk TEST ključ, jedan primatelj i izričit ID događaja.
- Postojeći transport B1 i trajna evidencija B2; nema masovnog slanja starog held reda.
- Nema novih migracija, ovisnosti, UI-ja, javnog API-ja ni workera na startupu.
- Korisnik potvrdio 206 izoliranih, PostgreSQL 6 + 17 + 10 i puni backend; svi izlazni kodovi 0.
- DEV događaj #2 / prijava #4: accepted, attempt_count=1; primitak u Gmailu potvrđen.
- Zaseban terminalski rezultat ručnog replay testa nije dostavljen; ne navoditi ga kao potvrđen.
- Detalji SUPPORT_PHASE3DB3.md. Nakon prihvata slijedi I1 — domena i hosting.

### Otvoreni kriteriji aktivacije na hostingu (I1 / R1 / R2)

- Automatsko izvršavanje obavijesti, izolirane tajne i odvojeni staging/produkcija.
- Izričita granica aktivacije, monitoring te postupak za neizvjestan ishod.
- Pouzdana provjera provider statusa; accepted nije delivered.
- Pravila čuvanja/brisanja i operativni odgovori podrške prije stvarnog pilota.
- Ne označavati produkcijsko e-mail slanje završenim samo na temelju DEV testa.

Domena je kupljena; aplikacija još nije time objavljena. I1 je sljedeća kategorija,
a ne novi niz funkcionalnih S paketa. L1/L2, W0–W3, M1/M2, R1/R2, pilot i billing
ostaju u ranije dogovorenom redoslijedu.

### I1 — potvrđena infrastruktura i konfiguracijska podloga

- Render projekt ZRIHTAN / Staging u Hobby workspaceu.
- zrihtan-staging-db: PostgreSQL 18, Frankfurt, 1 GB, 256 MB RAM;
  6.30 USD/mj. osnovica, vanjski pristup isključen prema korisničkoj potvrdi.
- Lokalni PostgreSQL 18.6; frontend build uspješan na 0d76fad.
- Budžet približno 30 EUR/mj., bez kupnje Pro workspacea.
- HOSTING_I1_CONFIGURATION.md: ZAVRŠENO, 2e2cb56, korisnik potvrdio 42/42.
- Zaseban staging server lokalno prihvaćen: abf6707, korisnik potvrdio 87/87. Nema deploya ni staging migracije.
- Slijedi hosting entry point, gate svih API ruta, povezivanje frontenda,
  health/readiness, uredno gašenje i kontrolirana staging migracija/deploy.

### I1 — staging runtime (ZAVRŠENO lokalno, abf6707)

- Zaseban stagingServer.js: provjera konfiguracije prije importa aplikacije.
- Clerk sesija + tester allowlist prije svih poslovnih ruta; /healthz jedina javna GET/HEAD provjera.
- Točan HTTPS origin, ograničeni CORS, no-store/noindex.
- Provjera stvarnog naziva baze, HTTP port i uredno gašenje.
- 45 novih izoliranih testova; ukupno s prethodnim konfiguracijskim testovima 87.
- Nije provedena stvarna Clerk/Render integracija ni objava. Slijedi kontrolirana
  staging migracija i konfiguracija Web Service/Static Site u okviru I1.

### I1 — kontrolirane staging migracije (PRIPREMLJENO)

- HOSTING_I1_MIGRATIONS.md: read-only --check i eksplicitni --apply.
- Stvarni naziv baze, PostgreSQL 18, prava, btree_gist i poznata povijest.
- Manifest 43 postojećih migracija; nema novih domenskih migracija.
- Provjereni client predaje se runneru, zaključavanje i transakcija migracija.
- 49 novih izoliranih testova; s konfiguracijom/runtimeom ukupno 136.
- Render baza nije migrirana ovim paketom. Slijede konfiguracija Web Servicea,
  kontrolirani pre-deploy, frontend povezivanje i staging prihvat.
