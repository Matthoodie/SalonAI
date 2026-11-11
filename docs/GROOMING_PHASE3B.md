# Grooming 3B — vlasnik i ljubimac u terminima

Polazna verzija: cfc67fd (Grooming 3A). Nema novih migracija ni ovisnosti.

## Korisnički tok
- Grooming: datum, odabir postojećeg vlasnika, odabir aktivnog ljubimca, usluge, zaposlenik i vrijeme.
- Mješoviti salon: korisnik bira uslugu za osobu ili ljubimca. Za ljubimca vrijede ista pravila kao u groomingu.
- Frizerski/ostali salon: postojeći tok s osobom. Ako djelatnost još nije postavljena, ostaje tok za osobu.
- Promjena vlasnika briše odabir ljubimca. Životinje se razlikuju po ID-u, nikada po imenu.
- Za novog vlasnika/ljubimca koristiti Klijenti → dodavanje vlasnika → Detalji → Ljubimci. Inline unos novog klijenta ostaje dostupan za termine za osobe.
- Nedostajući ljubimac označen je greškom. API ponovno provjerava aktivnost, vlasništvo i salon.
- Opcije ljubimaca učitavaju se stranicama od 50 uz gumb Učitaj još. Osvježavanje popisa čita podatke; ne ponavlja spremanje.

## Uređivanje i prikazi
Vlasnik i ljubimac mijenjaju se jednim versioniranim PATCH zahtjevom, sa scopeom postojeće ovlasti appointment.change_client. Istovremena promjena vremena i primatelja ostaje odvojena operacija; postojeća poruka to objašnjava. Spremanje usluga blokirano je dok postoje druge nespremljene izmjene.

Kartica termina, kalendar, pregled poslovanja i povijest/nadolazeći termini vlasnika prikazuju spremljeno ime, vrstu i pasminu ljubimca te ime vlasnika. Pretraga termina uključuje ime/pasminu ljubimca. Povijest je i dalje organizirana po vlasniku, a svaki povezani termin jasno prikazuje ljubimca; zasebna kartica povijesti jednog ljubimca nije uvedena.

Stari termini bez recipient_type ostaju nepromijenjeni. Grooming obrazac nudi Poveži ljubimca s terminom. Ne nagađamo ljubimca po vlasniku/imenu. Nepromijenjena arhivirana životinja ostaje vidljiva kao spremljeni odabir, a novi odabiri dolaze iz aktivnog popisa. Zaposlenik bez prava promjene klijenta može pomicati termin ako za to ima ovlast; ne može promijeniti vlasnika/ljubimca.

## Backend
GET /api/appointments/recipient-context vraća samo salon_id i business_type aktivnim članovima salona, bez podataka o klijentima, uz Cache-Control: no-store. Omogućava pravilan obrazac i zaposlenicima bez pristupa postavkama.

prepareRecipient sada čita djelatnost unutar transakcije prije prihvaćanja izostavljenih polja. Za grooming odbija izostavljenog primatelja s APPOINTMENT_PET_REQUIRED. Pravilo vrijedi i za stari bookingService jer poziva istu pripremu. Stari /api/bookings ne dobiva novu podršku za ljubimce; grooming koristi autentificirani /api/appointments. Ostalim salonima ostaje kompatibilnost starog poziva.

Nema izmjena baze, ovlasti za upravljanje profilima, Clerk računa, konfiguracije ili AI poziva. Fotografije nisu dio ovog paketa.

## Provjere
- 170 backend testova bez stvarne PostgreSQL baze, uključujući 29 recipient unit/API/transakcijskih testova.
- 188 frontend testova (14 novih); vlasništvo/salon, strogi ID-ovi, paginacija, dozvoljena polja, verzije, greške i zastarjeli odgovor nakon promjene salona.
- JSX paket kompajliran esbuildom; lokalne React/jsdom interakcije: spremljeni odabir, istoimeni ljubimci, obvezno polje, stari termin, ograničeni zaposlenik.
- Provjerna skripta na korisnikovoj TEST bazi izvršava 20 recipient DB/integracijskih testova i cijeli backend suite, zatim frontend testove i Vite build. Ti PostgreSQL testovi i Vite build nisu izvršeni u razvojnom okruženju autora paketa.

## Ručna provjera prije commita
1. Grooming: bez ljubimca nema spremanja; vlasnik s dva ljubimca daje dvije opcije.
2. Spremi termin za svakog ljubimca, provjeri prikaz i nakon osvježavanja stranice.
3. Promijeni vlasnika: prethodni ljubimac mora nestati iz odabira.
4. Promijeni ljubimca i provjeri karticu/kalendarski detalj/povijest vlasnika.
5. Stari termin: pomicanje vremena radi bez prisilne dodjele; Poveži ljubimca omogućava izričitu dodjelu.
6. Zaposlenik: prema ovlastima može dodati termin; nema upravljanje profilima; denied change_client ne može mijenjati ljubimca.
7. Mješoviti salon: osoba/ljubimac; frizerski salon: stari tok radi.
8. Arhivirani ljubimac ne nudi se za novi termin; njegov stari termin i dalje prikazuje spremljene podatke.
9. Tamna/svijetla tema i uži prozor: polja i sve akcije čitljivi.

## Nastavak
Nakon potvrde i commita: fotografije ljubimaca. Zatim WhatsApp i dogovorene AI funkcionalnosti, mobilna/PWA i produkcijska priprema, besplatni pilot, naplata. Prije produkcije provjeriti sve javne/legacy ulaze za rezerviranje kao dio općeg API pregleda.
