# ZRIHTAN Support S3A — platformni pristup i audit

Datum: 19. studenoga 2026. Polazni commit 3b71a1a.
Status: PRIPREMLJENO. 30 unit testova lokalno; 10 DB scenarija treba potvrditi na korisničkoj TEST bazi.

## Opseg

Migracija 1795089600000_create-platform-support-access.js dodaje dvije prazne tablice.
platform_support_access drži izričitu ovlast uz user_id, Clerk auth_subject, enabled i reviziju.
platform_support_access_audit bilježi dodjelu/opoziv, prethodno/novo stanje, reviziju,
razlog, vrijeme i DB ulogu izvršitelja. Audit zadržava numerički ID cilja nakon brisanja
računa, ali ne kopira e-mail ni sadržaj prijava. Razlog ne smije sadržavati tajne.

Owner/admin/employee salona ne daju platformni pristup. Neaktivan račun, opozvana
ovlast ili promijenjeni Clerk identitet odbijaju pristup. Identifikacija nije po e-mailu:
ponovno registrirani Clerk račun može imati istu adresu kao stari lokalni zapis.
Migracija ne dodjeljuje ovlasti nijednom korisniku. Trenutačno sučelje ostaje isto.

## Administriranje

CLI scripts/support-access.mjs pokreće samo osoba koja već ima pristup serveru i DB
vjerodajnicama. On nije korisnički API niti ga podrška može pozvati preko preglednika.
--database mora točno odgovarati current_database() prije ikakvog upisa.
inspect je čitanje; grant/revoke bez --apply vraćaju samo plan. Upis traži --apply,
--expected-revision i razlog od 10 do 500 znakova. Neaktivan račun može se opozvati.
Ponovljena operacija koja ništa ne mijenja ne stvara novu reviziju ni audit događaj.
Zastarjela revizija daje SUPPORT_ACCESS_REVISION_CONFLICT; prvo ponovno inspect.

CLI ne vjeruje korisničkom parametru actor. Audit identitet je PostgreSQL current_user
(actor_kind database_operator). To identificira DB vjerodajnice, NE potvrđuje fizičku
osobu ako više administratora dijeli iste vjerodajnice. Prije produkcije trebaju zasebni
administratorski pristupi i ograničene runtime DB ovlasti u infrastrukturnoj fazi.
Aplikacija ne nudi update/delete audit zapisa. Audit NIJE kriptografski nepromjenjiv
niti štiti od administratora baze s izravnim SQL/DDL ovlastima. Rok čuvanja i kontrolirano
brisanje dio su pravne/infrastrukturne pripreme; S3A ne uvodi automatsko brisanje.

## Transakcije i budući S3B

Mutacije zaključavaju korisnika FOR UPDATE pa grant FOR UPDATE. Grant i audit upisuju
se u jednoj transakciji; kvar audita vraća i promjenu ovlasti. Istodobna prva dodjela
istome korisniku serijalizirana je zaključavanjem postojećeg users retka.

requireSupportAccess(db, authenticatedLocalUserId) koristi FOR SHARE nad korisnikom i
grant retkom. Mora biti pozvan unutar ISTE transakcije kao buduća privilegirana radnja.
Poziv iz middlewarea s naknadnim otključavanjem ne zamjenjuje ovu provjeru.
S3B smije uzeti userId samo iz postojeće server autentikacije. Provjera nikad ne koristi
ulogu, ID ili enabled iz HTTP tijela ili frontend pohrane. Ovlast se ne predmemorira.
Opoziv čeka već započetu autoriziranu transakciju; nakon što opoziv završi, novi pristup
se odbija. S3A još nema HTTP rute obrade, e-mailove, odgovore ni operatorov ekran.

## Instalacija i provjere

1. Paket --check, zatim --apply iz backend mape.
2. Verifier --unit: sintaksa, 30 ciljanih testova, svi backend unit testovi, Git provjere.
3. Verifier --database: .env.test DATABASE_URL, stroga odvojenost od .env DEV naziva,
   dopušten točan naziv salonai_regression ili zasebna riječ test u nazivu baze.
   TEST migracija, 10 DB scenarija, puni backend skup nad TEST bazom.
4. Tek nakon izlaznog koda 0 zasebno npm run migrate:up za DEV.
5. Nema frontend izmjena, npm install, .env izmjena ni ponavljanja frontend builda.

DB testovi koriste sintetičke Clerk identitete i uklanjaju samo vlastite audit/korisničke
zapise. Testiraju preview, grant, revoke/regrant, no-op, zastarjelu reviziju, konkurenciju,
rollback audita, deaktivaciju/promjenu identiteta, krivu bazu, zadržavanje audita i brave.
Lokalno ovdje nema PostgreSQL servera, stoga se DB uspjeh ne tvrdi prije korisničkog izvještaja.
Migracija down namjerno odbija brisanje ovlasti i audita. Ne koristiti migrate:down kao
rutinski rollback. Aditivne tablice mogu ostati uz prethodni kod bez dodjele pristupa.

## Primjeri CLI-ja za kasnije kontrolirano uključivanje

Ne treba dodijeliti stvarnu ovlast za prihvat ovog paketa. Sljedeći primjeri nisu za
kopiranje s placeholderom. Prvo odabrati namjenski račun operatera, prijaviti ga u
aplikaciju i prepisati njegov stvarni Clerk user ID. Ne brisati/ponovno stvarati račun.

node --env-file=.env scripts/support-access.mjs inspect --database salonai_dev --clerk-user-id user_STVARNI_ID
node --env-file=.env scripts/support-access.mjs grant --database salonai_dev --clerk-user-id user_STVARNI_ID --expected-revision 0 --reason "Odobrena razvojna podrska"

Drugi poziv je samo pregled plana. Tek pregledan plan može se ponoviti s --apply.
Za revoke koristiti točnu reviziju iz novog inspect poziva, a ne unaprijed pretpostavljen broj.
Planirano stvarno uključivanje operatera nakon S3B/S3C, kad postoji ekran obrade.
