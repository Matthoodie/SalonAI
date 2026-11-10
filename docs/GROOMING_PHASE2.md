# Grooming 2 — profili ljubimaca u CRM-u

Polazna verzija: 04751e8 (Grooming 1). Nema novih migracija, ovisnosti ni promjena backend API-ja.

## Korištenje

Vlasnik ili administrator otvara Klijenti → Detalji. API provjerava aktivno
članstvo i djelatnost salona. Grooming i mixed saloni dobivaju odjeljak Ljubimci;
za hair/other/nepostavljenu djelatnost odjeljak se ne prikazuje nakon provjere.
Employee račun nema pristup stranici Klijenti kroz postojeću zaštitu App-a.
Odjeljak ne koristi owner-only salon-setup API, pa je dostupan i administratoru.

Jedan vlasnik može imati više ljubimaca. Jednaka imena dopuštena su, identitet je ID.
Obavezni su ime (do 100 Unicode znakova) i vrsta (pas/mačka/druga životinja).
Pasmina (do 150) i bilješke (do 2000) nisu obavezne. Prazna pasmina ostaje prazna.
Pogrešno polje je označeno tekstom, obrubom i pozadinom; fokus ide na prvo pogrešno polje.
Svijetla i tamna tema koriste postojeće semantičke boje aplikacije.

Arhiviranje i aktiviranje imaju potvrdu unutar kartice. Profil se ne briše.
Za arhiviranog vlasnika dopušteni su pregled i arhiviranje, a dodavanje,
uređivanje i ponovno aktiviranje traže aktivnog vlasnika.

## Spremanje i greške

- PUT/PATCH šalju expected_revision; konflikt ne prepisuje novu verziju.
- API adapter provjerava identitet salona, vlasnika, ljubimca, verziju i spremljena polja.
- Podaci, identitet i aktivacija šalju se samo kroz odgovarajući allowlist.
- Pozivi koriste postojeći salonFetch, koji poništava zastarjele odgovore nakon promjene salona.
- Komponenta se ponovno montira za drugog vlasnika/salon; stari odgovor ne mijenja novi prikaz.
- Nema automatskog ponavljanja pisanja. Kod mrežne greške ili neispravne potvrde
  korisnik mora osvježiti popis i provjeriti stanje. POST u fazi 1 nije idempotentan.
- Nakon greške obrazac je vidljiv, ali pisanje zaključano do osvježavanja.
  Osvježavanje odbacuje nespremljeni obrazac, što je izričito naznačeno.
- Za vrijeme spremanja blokirano je zatvaranje profila tipkom, Escapeom i klikom izvan njega.
  Navigacija, zatvaranje kartice ili prekid veze ipak mogu ostaviti neizvjestan rezultat;
  pri povratku učitati popis i provjeriti postoji li profil prije novog dodavanja.
- Polja ljubimca prikazuju se kao React tekst; nema HTML interpretacije bilježaka.

## Provjere

Automatizirani frontend testovi provjeravaju granice polja, kanonske ID-jeve,
izolaciju vlasnika/salona, duplikate odgovora, dozvoljena polja, revizije,
konflikte, status, neizvjesna pisanja bez ponavljanja i promjenu salonskog konteksta.
Browser provjera koristi simulirani API; stvarno spremanje potvrditi ručno na lokalnom backendu.

Ručno:
1. Grooming vlasnik → Klijenti → Detalji → Dodaj ljubimca.
2. Pokušati spremiti prazno ime: poruka, naglasak i fokus.
3. Dodati psa Luna i mačku Luna istom vlasniku; zasebne kartice.
4. Urediti pasminu/bilješke, odustati od arhiviranja, zatim potvrditi arhiviranje i aktiviranje.
5. Zatvoriti i otvoriti profil/refresh preglednika: podaci ostaju.
6. Drugi vlasnik nema te ljubimce; drugi salon nema pristup.
7. Dva prozora istog profila: spremiti u prvom; spremanje stare verzije u drugom daje konflikt.
8. Arhivirani vlasnik: pregled/arhiviranje rade; ostalo tek nakon aktivacije vlasnika.
9. Vlasnik i admin grooming salona vide odjeljak. Employee zadržava postojeća ograničenja.
10. Frizerski salon nema odjeljak; postojeći termini, kalendar, klijenti i teme rade.
11. Provjeriti svijetlu/tamnu temu i uski prozor.

## Sljedeće

Grooming 3 povezuje ljubimca s terminom i poviješću, uz ograničen izbor u bookingu
za ovlaštene zaposlenike. Grooming 4 uvodi fotografiju/avatar i siguran upload.
Ovaj paket prikazuje inicijal imena, bez lažnih fotografija i bez dodavanja ljubimca terminu.
