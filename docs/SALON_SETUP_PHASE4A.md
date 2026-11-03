# Početni ulazak — faza 4A

Polazni commit: d6111da. Samo frontend i dokumentacija; nema migracija niti ovisnosti.

App sada prije poslovnog Layouta prikazuje WelcomeScreen tijekom učitavanja,
kod greške i kad nema potvrđenog salonskog konteksta. Time i izravni URL
/calendar ili /settings bez salona ostaje na ulaznom ekranu.
Postojeća provjera aktivnog korisnika, članstva i salona ostaje autoritativna.
Jedan dostupni salon i zapamćeni aktivni salon i dalje se automatski otvaraju.
Više salona bez zapamćenog izbora prikazuje kartice za odabir.
Prihvat pozivnice koristi postojeći API, bez automatskog ponavljanja zahtjeva.
Pozivnica je inicijalno otvorena samo kad korisnik nema dostupnih salona.
Odjava koristi postojeću Clerk integraciju.

## Granica ovog paketa

Nema obrasca za stvaranje salona ni završnog onboarding endpointa.
SALON_CREATION_MODE ostaje disabled ili nepostavljen. Ne uključivati allowlist još.
Opcionalni Wizard u Postavkama ostaje dostupan vlasniku.
Novostvoreni salon još nije blokiran prema salon_onboarding.status; to slijedi
u paketu s povezanim koracima i završnom provjerom. UI ulaz nije nova API zaštita.

## Provjere

- Novi račun: nema sidebara, vidi račun, otvorenu pozivnicu i odjavu.
- Pogrešan kod: postojeća poruka; bez stvaranja salona.
- Valjana pozivnica: potvrda, Otvori salon, učitavanje pravih ovlasti.
- Više dostupnih salona: izbor kartice otvara ispravan kontekst.
- Jedan postojeći salon: uobičajeni ulazak i postojeći sidebar.
- Greška učitavanja: Ponovno učitaj salone; poslovni sadržaj nije vidljiv.
- 320px, 390px i desktop: nema horizontalnog prelijevanja.
- Odjava i drugi račun: bez prenesenog korisnika ili pozivnice.

Sljedeći korak: obvezan onboarding novih salona sa stvarnim timom, uslugama,
kvalifikacijama i radnim vremenom; kontrolirano aktiviranje testnog računa tek
kad završni pregled i ulazak na dashboard budu povezani.
