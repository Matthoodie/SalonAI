# Grooming 5 — povijest termina pojedinog ljubimca

Polazna verzija: 0f5d016; 11. studenoga 2026.
Paket za provjeru, još nije potvrđen na korisnikovoj TEST bazi.

## Korisnički tijek

Klijenti → Detalji vlasnika → Ljubimci → **Termini ljubimca**.
Prikaz se otvara unutar kartice; samo jedan ljubimac otvoren je u isto vrijeme.
Sadrži zakazane i prethodne termine, od najkasnijeg datuma prema ranijima,
uključujući otkazane termine i nedolaske. Status jasno razlikuje ove zapise.
Prikazuje datum/vrijeme početka, spremljeno ime/vrstu/pasminu, zaposlenika,
spremljene stavke usluga, trajanje i ukupnu cijenu. Iznos nije oznaka naplate.
Vlasnik i kontakt ostaju u zaglavlju otvorenog klijenta.

Početno se učitava najviše 20 zapisa. **Učitaj još termina** nastavlja isti pregled;
**Osvježi termine** kreće od prve stranice. Pregled je dostupan i za arhiviranog
ljubimca te arhiviranog vlasnika. Nema automatskog pozivanja API-ja za sve ljubimce.
Zatvaranje prekida čitanje; zakašnjeli odgovor ne otvara pregled ponovno.

## Podaci i ovlasti

GET /api/clients/:clientId/pets/:petId/appointments?cursor=...

- Serverski salon i korisnik dolaze iz autentikacije, ne iz query parametara.
- Ponovno se provjeravaju aktivan korisnik/salon/članstvo, owner/admin uloga,
  grooming/mixed djelatnost te vlasništvo ljubimca. Zaposlenički pristup nije proširen.
- Query je vezan uz salon_id, client_id i pet_id, nikada uz podudaranje imena.
- Stari termini bez pet_id ne pojavljuju se u povijesti životinje. Ostaju kod vlasnika;
  postojeći dopušteni postupak uređivanja termina može ih povezati, bez nagađanja.
- Naziv ljubimca i stavke usluga uzimaju se iz snimke termina. Naknadno preimenovanje
  profila/cjenika ne prepisuje ovu povijest. Ime zaposlenika prikazuje sadašnji naziv
  profila. Za stari zapis bez stavki nazivi se ne izmišljaju; iznosi/trajanje ostaju sačuvani.
- Datumi se prikazuju u zoni salona. Nema tihog prelaska na zonu preglednika.
- Upit ne vraća bilješke termina, fotografije ni druge privatne podatke profila.
- Cache-Control: no-store. Frontend provjerava identitete, stavke, zbrojeve i oblik
  odgovora; promjena salonskog konteksta odbacuje zakašnjeli odgovor.
- Kursor sadrži salon/vlasnika/ljubimca, točan početak do mikrosekunde i ID termina.
  Nije tajna ni dozvola; svaka stranica ponovno provjerava ovlasti. Tuđi kursor se odbija.
- Paginacija nije zaključana povijesna snimka cijelog popisa: nakon paralelnog
  pomicanja/dodavanja termina osvježiti pregled. UI deduplicira ID-eve učitanih stranica.
- Postojeći indeks appointments_pet_history_idx iz 3A se ponovno koristi.
  **Nema nove migracije, novih ovisnosti ili promjena konfiguracije.**

## Automatske provjere

Novi backend: validacija kursora, kontekst i rollback/release, arhivirani profili,
parametrizacija paginacije, kontroler. Novi frontend: identiteti, iznosi, zona,
neispravni odgovori, signal/no-store, zabrana ponavljanja i promjena salonskog konteksta.

PostgreSQL testovi: odvajanje istoimenih ljubimaca, stari termini, očuvanje snimki,
arhiviranje, zabrana tuđeg pristupa, 23 termina s istim početkom i mikrosekundama,
API owner/employee. Verifier ih pokreće nakon postojećih TEST migracija, zatim cijeli
backend suite, frontend suite i Vite build. TEST i DEV baza moraju biti različite.

Kod autora: 192 backend testa bez stvarne baze i 208 frontend testova prošli;
JSX kompilacija, React provjera povijesti i postojeći tijek fotografija prošli.
PostgreSQL i Vite provjere ostaju korisničkom verifieru; nisu ovdje izvršene.

## Ručna provjera

1. Vlasnik s dva ljubimca: termini svakog odvojeni, čak i kad imaju isto ime.
2. Zakazani, završeni, otkazani i nedolazak prikazuju pravilan status, vrijeme,
   zaposlenika, sve usluge i sačuvane iznose. Nema podataka drugog vlasnika/salona.
3. Ljubimac bez termina: jasno prazno stanje; vlasnikovi stari termini nisu pripisani.
4. Promijeni ime ljubimca ili usluge: postojeći termini zadržavaju spremljene nazive.
5. Arhiviraj ljubimca: pregled ostaje dostupan; vlasnikove brojke ostaju nepromijenjene.
6. Ako testni podaci imaju preko 20 zapisa, učitaj iduću stranicu pa osvježi.
7. Zatvori pregled tijekom učitavanja; prebaci ljubimca ili salon: nema starog odgovora.
8. Svijetla/tamna tema i uzak prozor; tipkovnica i postojeće zatvaranje profila.
9. Fotografija: pregled/promjena/uklanjanje i dalje rade. Uređivanje, kreiranje termina,
   kalendar i postojeći frizerski/mješoviti salon ostaju funkcionalni.
10. Zaposlenički račun ne dobiva novi pristup privatnom profilu. Ovlašteni izbor
    ljubimca na terminu nastavlja raditi kao prije.

Nakon uspješnih provjera poslati izvještaj i git status prije commita ovog paketa.
Sljedeće: završnica groominga → HR/EN → WhatsApp/AI → mobilna/PWA + produkcija
→ besplatni pilot → naplata, prema ROADMAP_V1.md.
