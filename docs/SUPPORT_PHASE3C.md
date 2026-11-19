# ZRIHTAN Support S3C — razgovori i operatorsko sučelje

Polazna verzija: development 9725dea. Datum: 19. studenoga 2026.
Status: pripremljeno; čeka provjere u stvarnoj aplikaciji.
S3B je korisnički potvrđen: 12/12 DB i 1121/1121 backend testova, commit/push.

## Opseg
- Pomoć i podrška / Moje prijave prikazuje izvorni zahtjev, aktualni status i odgovore podrške.
- Posebno ovlašteni operator dobiva način Obrada podrške u istom dijalogu.
- Popis, filtar statusa, paginacija, razgovor, odgovor i promjena statusa.
- HR/EN, postojeće teme, mobilni raspored i tipkovnički dostupne kontrole.
- Operator vidi izvorni opis i jezik prijave. Odgovori su običan tekst, bez HTML izvršavanja.
- Korisnik zasad čita odgovore; nema korisničkih nastavaka razgovora, privitaka ili e-mail obavijesti.
- Nema nove migracije, promjene .env ili ovisnosti.

## Ovlasti
Owner/admin salona nije automatski operator platforme. Pristup provjerava S3B API.
Dodjelu radi postojeći CLI scripts/support-access.mjs, prema točnom Clerk user_ID.
Ne traži se e-mail niti se automatski odabire najnoviji korisnički zapis.
CLI mora potvrditi salonai_dev, aktivan račun i očekivanu reviziju.
Sadržaj prijava drugih korisnika dostupan je samo operatoru uz postojeći audit.
Zatvaranje panela prekida zahtjeve; zakašnjeli odgovori nakon promjene računa ignoriraju se.
Nakon odgovora 401/403 na operatorski poziv operatorski prikaz se uklanja.
Opoziv ne može izbrisati sadržaj koji je operator ranije već pročitao.

## Slanje i istodobnost
Prije mrežnog poziva pokušaj se zapisuje u sessionStorage za točan račun i prijavu.
UUID, tekst, status i expected_revision ostaju isti kod ponavljanja nakon prekida veze.
Dvostruki klik ne šalje dva paralelna pokušaja. Potvrđen odgovor briše lokalni pokušaj.
Nedostupna lokalna pohrana blokira slanje kako se ne bi izgubio identitet pokušaja.
Sukob revizije zadržava tekst, traži osvježavanje i novu svjesnu predaju.
Odustajanje od lokalnog pokušaja ne poništava eventualno već spremljenu serversku radnju.
Neslani tekst nije trajno spremljen: povratak na popis, promjena načina ili zatvaranje
operatorskog panela može ga ukloniti. Sučelje to objašnjava. Ne unositi tajne.
SessionStorage nije trajna arhiva; zatvaranje kartice može ukloniti lokalni pokušaj.
Kod nepoznatog ishoda najprije pregledati razgovor, ne slati automatski isti odgovor novim UUID-om.

## Provjere
Lokalno: 24 nova čista frontend testa API ugovora, validacije, pohrane i HR/EN ključeva.
React/jsdom scenariji: read-only autor i escaped sadržaj, single-flight,
pohrana prije mreže, retry nakon promjene jezika, obnova nakon remounta,
replay cleanup, sukob revizije, storage failure, stale response i opoziv ovlasti.
To nije zamjena za provjere pune korisničke aplikacije ili stvarnog PostgreSQL-a.
Verifier: ciljanih 21 postojećih + 24 novih = 45, svi frontend testovi, Vite build,
git diff --check, stat i status. Ako nije bilo drugih testnih promjena, ukupno 371.
Backend se ne mijenja; već potvrđene DB migracije ne ponavljaju se za ovaj paket.

## Ručni prihvat
1. Običan račun: slanje prijave i vlastita povijest rade, operatorska kartica se ne pojavljuje.
2. Ovlašteni račun: otvori Obrada podrške, odaberi prijavu i pošalji probni odgovor.
3. Autor u drugom browser profilu: Moje prijave, odabir prijave, osvježi razgovor;
   vidi odgovor i status, nema operatorskog obrasca niti pristupa drugim prijavama.
4. Operator: zasebno promijeni status. Autor osvježava i vidi promjenu.
5. Dva operatorska prozora iste prijave: prvi spremi, drugi dobije sukob revizije;
   nakon osvježavanja može pregledati promjenu i ponovno predati svoj tekst.
6. Offline pokušaj: vrati vezu i ponovi isti pokušaj; samo jedna spremljena poruka.
7. Opozovi testnom operatoru ovlast; iduće osvježavanje uklanja operatorski prikaz.
8. Provjeri HR/EN, svijetlu/tamnu temu, uski prikaz i zatvaranje dijaloga tipkovnicom.
Ne koristiti stvarne osobne podatke u probnim opisima.

## Primjena i povrat
Raspakirati ZIP izvan projekta. Iz backend mape: package --check, zatim --apply,
pa verify.mjs. Installer provjerava hash preduvjeta i sprema originalne datoteke u TEMP.
Ne mijenja bazu, prava ili konfiguraciju. Ne pokretati npm install ni migrate:down.
Za povrat koristiti backup installera uz pregled promjena; nakon commita git revert
odgovarajućeg S3C commita. Ne koristiti reset --hard.
Commit tek nakon automatskih i ručnih provjera. Sljedeći paket S3D: kontrolirane
obavijesti, uz prethodno odabrani e-mail servis i dogovorene testne primatelje.
