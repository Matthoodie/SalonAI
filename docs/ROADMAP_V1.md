# ZRIHTAN — roadmap do javne V1

Ažurirano: 18. studenoga 2026.
Potvrđena polazna verzija: development 4870d09.
Aktualni paket: Support S1A — ugovor i validacija prijave, 23 nova izolirana testa.
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
- Domene još nisu potvrđene kao kupljene. Predloženo: zrihtan.com javna stranica,
  app.zrihtan.com aplikacija, staging.zrihtan.com zaštićeni test, podrška pod /help.
  zrihtan.hr opcionalno preusmjeravanje; druga domena nije nužna za landing.
- Hosting, e-mail servis, naplatni servis, cijene i rokovi čuvanja još nisu odabrani.
- WhatsApp produkcijski/pilot broj NIJE ODABRAN; ne povezivati privatni broj automatski.
- Prvi razvoj WhatsAppa koristi testne resurse i dogovorene testne primatelje.
- Službeničke obveze i dopuštenost konkretnog poslovnog angažmana provjeriti zasebno;
  izostanak isplate ne tretirati kao automatsku pravnu dozvolu.
- Prije uporabe stvarnih podataka odrediti ugovornu stranu, ovlasti i obveze obrade.

## 4. Podrška — prvi sljedeći razvojni blok

### S1A — ugovor prijave i validacija (PRIPREMLJENO)
- Kategorije help/bug/idea, naslov 5–160 i opis 20–5000 Unicode znakova.
- HR/EN, UUID v4 za sigurno ponavljanje, hash normaliziranog sadržaja.
- Neobavezan kontekst salona; novi prijavljeni korisnik bez salona također je podržan.
- Samo oznaka stranice iz dopuštenog popisa i oznaka verzije; nema automatskog
  slanja tokena, kolačića, URL parametara, sadržaja obrazaca ili podataka klijenata.
- Odbijanje identiteta autora, statusa, uloge i privitaka iz korisničkog zahtjeva.
- 23 testa. Nema migracije, API rute, UI-ja, slanja poruka niti .env promjene.

### S1B — baza i korisnički API (PLAN)
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

### S2 — HR/EN korisničko sučelje (PLAN)
- Pomoć i podrška u aplikaciji i početnom Welcome zaslonu.
- Obrazac, objašnjenje da se ne unose lozinke/osjetljivi podaci, potvrda s brojem prijave.
- Vlastite prijave i statusi; čuvanje istog request_id kod neizvjesnog ishoda.
- Nema automatskog screenshotanja. Privitci ostaju zasebna kasnija dorada.
- Teme, mobilni prikaz, promjena jezika, računa i salona te nedostupna mreža.

### S3 — operativna obrada i odgovor (PLAN; obavezno prije pilota)
- Posebna platformna ovlast podrške, odvojena od owner/admin salona.
- Kontrolirano dodjeljivanje i opoziv pristupa, audit radnji, bez impersonacije klijenta.
- Pregled prijave, odgovor i promjena statusa s kontrolom istodobnih izmjena.
- Korisnik čita odgovore samo na svojoj prijavi.
- Obavijest e-mailom nakon odabira servisa; spremljena prijava ne ovisi o uspjehu e-maila.
- Praćenje novih prijava, radno vrijeme podrške i realno obećani rok odgovora.
- Definirati rokove čuvanja i brisanje; sustav podrške nije trajni arhiv svih podataka.

## 5. Domena, staging i javne stranice

### I1 — infrastruktura za razvoj integracija (PLAN)
- Kupnja domene, kontrola vlasništva/ovlaštenja, 2FA, obnova i DNS.
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

Odmah: primijeniti S1A, potvrditi 23/23 i diff, spremiti commit/push.
Zatim: S1B migracija i autentificirani API; UI se pojavljuje tek u S2, operativni odgovori u S3.
