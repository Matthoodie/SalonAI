# ZRIHTAN Support S2 — korisničko sučelje

Datum: 19. studenoga 2026. Polazni commit: 1a96b01.
Status: PRIPREMLJENO, čeka korisničke provjere i commit.

## Ponašanje

Gumb Pomoć i podrška / Help and support otvara modalni dijalog u aplikaciji,
na Welcome zaslonu i pri postavljanju salona. Potreban je prijavljeni lokalni
aktivni korisnik; salon nije obavezan. Podrška ne mijenja ekran/formu ispod dijaloga.
U aplikaciji je gumb iznad sadržaja stranice; na Welcome/onboarding zaslonu u zaglavlju.

Nova prijava: pomoć, problem ili prijedlog, naslov 5–160 i opis 20–5000 Unicode
znakova. Opcionalno povezivanje s trenutačnim salonom. Stranica se šalje samo
kao dopuštena kategorija; ne šalju se URL parametri, tokeni, podaci drugih obrazaca,
snimke zaslona, privitci ni podaci klijenata. app_version zasad ostaje null.
Autor, pristup i kvota i dalje se provjeravaju u S1B na serveru.

Moje prijave: samo vlastiti zapisi, ne prijave drugih članova salona; 20 po stranici,
stabilan kursor, detalj i status. Tekst se prikazuje React escapingom, ne kao HTML.
Statusi su prevedeni HR/EN. U S2 se ne mijenjaju i ne šalju odgovori/e-mailovi.
Nema novih migracija, paketa ovisnosti ni konfiguracije .env.

## Slanje i prekid veze

Prije POST-a validirani sadržaj i UUID v4 spremaju se u sessionStorage pod ključem
zrihtan:support:pending:v1:<local_user_id>. Ponavljanje koristi isti sadržaj, salon,
jezik i request_id. Jezik prikaza može se mijenjati, ali izvorni jezik prijave ostaje.
Nakon potvrde lokalni se pokušaj uklanja. U slučaju prekida veze ili neprovjerljivog
odgovora sadržaj ostaje zaključan za isto ponavljanje, uključujući osvježavanje.
Ako pohrana nije dostupna, ne šalje se nepohranjeni pokušaj. Brisanje neispravnog
zapisa zahtijeva potvrdu; prvo provjeriti Moje prijave jer server možda već ima zapis.

SessionStorage je privremena pohrana ove kartice, a ne šifrirani sef. Sadržaj se
čuva do potvrde/izričitog poništavanja ili završetka sesije kartice (preglednik može
obnoviti sesiju). Odjava ne briše neizvjestan pokušaj, ali drugi račun ga ne učitava.
Ovo treba opisati pri konačnoj izradi pravila privatnosti/čuvanja podataka.
Neslani tekst je samo u memoriji: zatvaranje i ponovno otvaranje dijaloga ga zadržava;
osvježavanje, odjava ili promjena salona ga odbacuju. beforeunload upozorava gdje
preglednik podržava upozorenje; ne obećava se pohrana nacrta.

Brzo dvostruko slanje blokira se u UI-ju, a serverova idempotencija ostaje konačna
zaštita. Promjena računa/salona prekida lokalne zahtjeve i odbacuje zakašnjele odgovore.
Prekid HTTP zahtjeva nije jamstvo otkazivanja upisa na serveru; ponavljanje zato čuva UUID.

## Provjere

- 21 Node test: payload, Unicode, metapodaci, privatni API pozivi, potvrda/replay,
  abort, paginacija, detalj, izolacija i kvar pohrane, HR/EN pokrivenost.
- Lokalno montirani React u jsdomu: validacija/fokus, jedno slanje, mrežna pogreška,
  isto ponavljanje nakon promjene jezika i salona, uspjeh/čišćenje, popis/detalj,
  escaping, zatvori/otvori, blokada slanja pri kvaru pohrane, zakašnjeli odgovor.
- JSX integracije provjerene nad lokalno rekonstruiranim frontend izvorima.
  To nije puni build cijelog aktualnog repozitorija niti ručna provjera pravog preglednika.
- Isporučeni verifier pokreće sve lokalne frontend .test.mjs datoteke i Vite build
  korisnikove aktualne verzije. Nije potreban novi backend/DB regression run za ovaj frontend paket.

## Ručni prihvat

1. Na postojećem računu otvoriti podršku, pokušati prazno slanje i provjeriti fokus/poruku.
2. Napisati testni naslov i opis bez osobnih podataka. Zatvoriti/otvoriti: tekst ostaje.
3. Poslati jednom: broj prijave, popis i detalj trebaju odgovarati unosu.
4. Promijeniti HR/EN i temu; provjeriti prikaz na uskom ekranu, Tab i Escape.
5. Prijaviti se drugim postojećim računom: nema prijava prvoga. Ako nema salon,
   podrška je na Welcome zaslonu; nije potrebno uključivati kreiranje salona.
6. Za mrežni test zaustaviti lokalni backend, poslati jedan testni pokušaj, ponovno
   pokrenuti backend te odabrati Ponovi isto slanje. Popis treba imati jednu novu prijavu.
   Ne raditi više od 5 novih prijava/sat po računu (S1B kvota); replay ne troši kvotu.

## Sljedeće

S3: platformna podrška odvojena od salonskih uloga, audit, kontrolirani odgovori/statusi.
S2 potvrđuje zaprimanje u bazu; još nema automatske obavijesti operateru ni obećanog roka odgovora.
