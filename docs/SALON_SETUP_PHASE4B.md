# Magic Wizard — povezani ulazak i završetak

Polazni commit a35184e. Nema novih migracija niti ovisnosti. Potrebne su prethodno
primijenjene migracije salon-setup i salon-onboarding u TEST i DEV bazi.

## Put korisnika

Bez salona: prihvat pozivnice ili kreiranje ako GET eligibility potvrdi allowlist.
Kreiranje sprema UUID i tijelo u localStorage pod backend korisničkim ID-em prije slanja.
Neizvjestan odgovor nikad se ne ponavlja automatski. Gumb ponavlja točno isti zahtjev.
Pokvarena/nedostupna pohrana blokira pripremu zahtjeva. Korisnik prvo osvježava salone.
Nakon uspjeha osvježava se autentikacija/salonski kontekst postojećim bootstrapom.

App učitava status odabranog salona prije poslovnog Layouta. In_progress otvara wizard
vlasniku, a ostalim članovima poruku čekanja. Completed i not_required otvaraju postojeću
aplikaciju. Greška statusa ostavlja početni ekran s ponovnim učitavanjem. Više salona
može se birati i tijekom postavljanja. Stari saloni ne dobivaju novi onboarding redak.
Ovo je kontrola korisničkog toka. Postojeći poslovni API-ji zadržavaju svoje ovlasti;
status onboardinga nije nova sigurnosna granica za API niti ograničenje pretplate.

1. Salon: naziv/zona potvrđuju se pri kreiranju; poslije su u wizardu samo za čitanje.
   Djelatnost i lokacija mogu se uređivati. Promjena naziva/zone nije dio ovog paketa.
2. Tim: izbor solo/team i pruža li vlasnik usluge; stvarni profili kroz Employees.
   Ako vlasnik radi, dodaje svoj profil. Taj profil se ovdje ne povezuje automatski
   s vlasničkim korisničkim računom; nije isto što i članstvo za pristup aplikaciji.
3. Usluge: postojeći Services, ručni unos ili photo/PDF import s potvrdom.
4. Raspored: postojeći Employees editor, kvalifikacije i tjedno radno vrijeme.
5. Pregled: provjera spremnosti i izričita potvrda završetka.

Obrasci zaposlenika/usluga spremaju se svojim gumbima. Navigacija upozorava na otvoren
nespremljen unos; Spremi i nastavi sprema izbore i korak, ne nepredani pod-obrazac.
Prije nastavka treba pričekati potvrdu spremanja tog obrasca. Ponovni login nastavlja
spremljeni korak. Sukob/nesigurno spremanje setupa zaključava uređivanje do reload-a.
Odjava je dostupna na početnom ekranu, wizardu i u poslovnom zaglavlju.

## Backend

GET /api/salon-onboarding/readiness i POST /api/salon-onboarding/complete.
Autentificirani korisnik i salon dolaze iz middlewarea. Provjerava se aktivni owner u
bazi. Body complete dopušta samo expected_revision. Cache-Control: no-store.
Readiness vraća salon_id, status, revision, counts i ready/issues sa ciljnim korakom.
Uvjeti: djelatnost, team_mode, owner_provides_services, barem jedan aktivni zaposlenik,
barem jedna aktivna usluga; svaka aktivna usluga ima barem jednog aktivnog zaposlenika
s kvalifikacijom i barem jednim tjednim radnim intervalom. Solo zahtijeva točno jedan
aktivan profil i owner_provides_services=true. Cijenu/trajanje štite postojeća pravila.

Provjera je konzistentan REPEATABLE READ snapshot. Onboarding redak i setup se
zaključavaju; complete ponovno provjerava stvarne podatke i expected_revision,
a zatim upisuje completed_at. Već completed operacija je sigurna za izričito ponavljanje,
ne mijenja completed_at. Not_required ne stvara onboarding. Sve se rollbacka na grešku.
Provjera spremnosti je provjera u trenutku završetka, ne trajna zabrana kasnijeg
uređivanja profila, usluga ili radnog vremena. Ne provjerava slobodan termin na svaki
konkretan datum; to i dalje radi availability engine s odsutnostima/iznimkama/blokadama.

## Provjera i aktivacija

Verifier radi nove backend unit/API testove, TEST migracije (nema novih), nove DB testove,
cijeli backend suite, frontend testove, Vite build i Git diff. Nema pravih AI poziva.
DEV baza se ne migrira u verifieru. TEST i DEV moraju biti različite baze.
Lokalno kod autora: 152 frontend testa, 130 DB-neovisnih backend testova, JSX/CSS bundle,
browser testovi s mockovima (koraci, sukob, provjera, kreiranje/retry, čekanje zaposlenika,
App gate i responsive 320–1200). PostgreSQL i pravi Vite build provjerava korisnik.

Nakon svih provjera: helper --email iz lokalnog backend direktorija traži jedan aktivan
Clerk račun bez ikakvih članstava/creation receipt-a u lokalnoj *_dev bazi. Sprema
TEMP backup .env i uključuje allowlist samo tog subjecta. Korisnik ne šalje ključeve.
Helper --disable isključuje kreiranje, ali ne oduzima pristup već kreiranom salonu.
Nakon svake promjene konfiguracije ponovno pokrenuti backend.

Ručno: postojeći owner/employee; novi nedozvoljeni račun; dozvoljeni novi račun;
kreiranje, refresh na koraku Tim, solo ili team, ručni/uvezeni cjenik, prazno trajanje,
nepokrivena usluga, radno vrijeme, pregled, završetak, refresh i dashboard, više usluga
u terminu, novi salon nasuprot starom, odjava. Ne koristiti stvarne korisničke podatke.
Nakon prolaska isključiti kreiranje prije commita. U Git ne uključivati .env ili backup.
