# SalonAI Development Blueprint

## Dokument projekta

**Naziv projekta:** SalonAI  
**Vrsta proizvoda:** SaaS platforma za upravljanje frizerskim salonima  
**Frontend:** React + Vite  
**Trenutačna faza:** Završeni Milestone 2 i Frontend Refactoring v1  
**Glavni razvojni branch:** `development`

---

# 1. Vizija proizvoda

SalonAI je AI-powered platforma za upravljanje frizerskim salonima.

Cilj proizvoda je vlasnicima salona i zaposlenicima omogućiti jednostavno upravljanje:

- klijentima
- terminima
- zaposlenicima
- uslugama i cjenikom
- kalendarom
- prihodima i poslovnom analitikom
- komunikacijom putem WhatsAppa
- automatizacijama
- AI asistentom

Dugoročni cilj je razviti sustav koji se može prilagoditi i drugim uslužnim djelatnostima, poput:

- autoservisa
- kozmetičkih salona
- masažnih salona
- dentalnih ordinacija
- fitness i wellness centara

---

# 2. Problem koji SalonAI rješava

Mnogi mali saloni termine i podatke o klijentima vode pomoću:

- papira
- običnog kalendara
- WhatsApp poruka
- bilježnica
- tablica
- više nepovezanih aplikacija

To stvara izazove poput:

- dvostrukih rezervacija
- izgubljenih termina
- zaboravljenih klijenata
- nedostatka pregleda dnevnog rasporeda
- nedostatka poslovne analitike
- sporog odgovaranja korisnicima
- ručnog vođenja evidencija

SalonAI te funkcije objedinjuje u jednoj aplikaciji.

---

# 3. Planirani poslovni model

Početni plan pretplate:

| Paket | Planirana cijena |
|---|---:|
| Starter | 39 € mjesečno |
| Standard | 79 € mjesečno |
| Premium | 149 € mjesečno |

Početna verzija može uključivati probno razdoblje ili besplatni testni paket.

---

# 4. Tehnološki stack

## Frontend

- React
- Vite
- React Router
- JavaScript
- CSS
- localStorage tijekom razvoja

## Planirani backend

- Node.js
- Express
- REST API
- PostgreSQL

## Planirana autentikacija

- Clerk ili Auth.js

## AI i automatizacije

- OpenAI API
- n8n
- WhatsApp Business API

## Hosting

- Vercel za frontend
- Railway ili Render za backend i bazu

---

# 5. Git i razvojni workflow

Projekt koristi Git i GitHub.

Glavni branchovi:

```text
main
development

--- || ---

Razvoj se trenutačno odvija na:
development

Osnovni Git proces:
git status
git add .
git commit -m "Opis završene cjeline"
git push
git status


Poželjni završni rezultat:

nothing to commit, working tree clean
Prije većih funkcionalnosti radi se Git checkpoint.


6. Početna struktura projekta

Projekt je organiziran ovako:

SalonAI/
├── docs/
├── frontend/
├── README.md
└── TODO.md

Frontend aplikacija nalazi se u:

frontend/

Pokretanje razvojnog servera:

cd frontend
npm run dev

Production build provjera:

npm run build

7. Milestone 1 — osnovni frontend

U početnoj fazi napravljeni su:

React i Vite projekt
osnovni Dashboard
Sidebar
Header
Layout
React Router
stranice Dashboard, Klijenti i Termini
početni modeli podataka
GitHub repozitorij
development branch

Početni cilj bio je uspostaviti funkcionalan frontend kostur na kojem će se graditi poslovna logika.

8. Milestone 2 — klijenti i termini
8.1 Modul Klijenti

Implementirano je:

prikaz klijenata
dodavanje klijenata
spremanje klijenata u localStorage
prikaz imena
prikaz telefona
prikaz broja posjeta
izdvajanje početnih podataka u data/clients.js

Osnovni model klijenta:

{
  id,
  name,
  phone,
  visits
}

Planirane nadogradnje:

validacija telefona
podrška za prefiks države
automatsko formatiranje imena
uređivanje klijenta
brisanje klijenta
automatsko povećavanje broja posjeta
povijest termina klijenta
8.2 Modul Termini

Implementirano je:

dodavanje termina
prikaz termina
uređivanje termina
brisanje termina
potvrda prije brisanja
označavanje termina završenim
localStorage spremanje
kronološko sortiranje
prazno stanje
statistika termina

Osnovni model termina:

{
  id,
  time,
  clientName,
  service,
  status
}
8.3 Validacija forme termina

Implementirano je:

provjera praznih polja
trim() provjera teksta
individualne poruke greške
crveni obrubi
stabilan prostor za poruke
automatsko uklanjanje greške tijekom unosa
automatski fokus na prvo neispravno polje
8.4 Poslovna pravila termina

Implementirano je:

novi termini koriste intervale od 15 minuta
koristi se 24-satni format vremena
uređivanje dopušta preciznije vrijeme
nije moguće dodati dva termina u isto vrijeme
termin se tijekom uređivanja ne uspoređuje sam sa sobom
8.5 Statistika termina

Prikazuju se:

ukupni termini
zakazani termini
završeni termini

Statistika se automatski ažurira nakon promjena.

9. Frontend Refactoring v1
9.1 Razlog refactoringa

Početna struktura bila je ravna:

components/
├── AppointmentCard.jsx
├── AppointmentForm.jsx
├── ClientCard.jsx
├── ClientForm.jsx
├── DashboardCard.jsx
├── Header.jsx
├── Layout.jsx
└── Sidebar.jsx

Kako je projekt rastao, bilo je potrebno:

odvojiti CSS po komponentama
poboljšati preglednost
pojednostaviti održavanje
pripremiti projekt za nove funkcionalnosti
spriječiti rast jednog velikog CSS dokumenta
olakšati buduće refactoriranje
9.2 Nova struktura komponenti
components/
├── AppointmentCard/
│   ├── AppointmentCard.jsx
│   └── AppointmentCard.css
├── AppointmentForm/
│   ├── AppointmentForm.jsx
│   └── AppointmentForm.css
├── ClientCard/
│   ├── ClientCard.jsx
│   └── ClientCard.css
├── ClientForm/
│   ├── ClientForm.jsx
│   └── ClientForm.css
├── DashboardCard/
│   ├── DashboardCard.jsx
│   └── DashboardCard.css
├── Header/
│   ├── Header.jsx
│   └── Header.css
├── Layout/
│   ├── Layout.jsx
│   └── Layout.css
└── Sidebar/
    ├── Sidebar.jsx
    └── Sidebar.css
9.3 Nova struktura stranica
pages/
├── Appointments/
│   ├── Appointments.jsx
│   └── Appointments.css
├── Clients/
│   ├── Clients.jsx
│   └── Clients.css
└── Dashboard/
    ├── Dashboard.jsx
    └── Dashboard.css
9.4 Promjene import putanja

Primjer stare putanje:

import AppointmentCard from '../components/AppointmentCard'

Nova putanja:

import AppointmentCard from '../../components/AppointmentCard/AppointmentCard'

Primjer stare stranice:

import Dashboard from './pages/Dashboard'

Nova putanja:

import Dashboard from './pages/Dashboard/Dashboard'
9.5 Proces refactoringa

Svaka komponenta premještana je odvojeno:

napravljen je novi folder
premješten je JSX
ažuriran je import
aplikacija je testirana
napravljen je CSS dokument
stilovi su izdvojeni
aplikacija je ponovno testirana
napravljen je Git checkpoint
9.6 Izazovi tijekom refactoringa

Uočeni izazovi:

nespremljeni importi u VS Codeu
Failed to resolve import
nedostajuće CSS datoteke
zastarjele CSS putanje
generičke klase poput .layout i .main
uklanjanje starog App.css
gubitak globalnog box-sizing pravila
pogrešna HTML struktura jednog Sidebar linka
9.7 Rješenje layout izazova

Generičke klase zamijenjene su preciznijim nazivima:

.layout → .app-layout
.main → .app-main
.sidebar → .app-sidebar
.page-content → .app-page-content

Vraćen je globalni stil:

*,
*::before,
*::after {
  box-sizing: border-box;
}
9.8 Završna provjera

Nakon refactoringa provedeno je:

npm run build

Build je uspješno završen.

Git stanje:

nothing to commit, working tree clean
10. Trenutačna struktura frontenda
frontend/src/
├── assets/
├── components/
├── data/
├── pages/
├── App.jsx
├── index.css
└── main.jsx

index.css sadrži samo globalne stilove i CSS varijable.

Svaka komponenta i stranica ima vlastiti CSS.

11. Pravila budućeg razvoja

Kod svakog novog refactoringa dokumentirati:

razlog promjene
staru strukturu
novu strukturu
premještene datoteke
promjene importa
testne scenarije
Git korake
konačni rezultat

Kod svake nove funkcionalnosti:

definirati poslovni cilj
definirati model podataka
implementirati mali korak
testirati
tek zatim nastaviti
napraviti Git checkpoint nakon završene cjeline
12. Sljedeći milestone
Milestone 3 — datum i kalendar

Planirani koraci:

dodati datum svakom terminu
migrirati postojeće localStorage podatke
ažurirati provjeru duplih termina
prikazati datum na kartici
filtrirati termine po danu
napraviti dnevni prikaz
napraviti mjesečni kalendar
povezati kalendar s Dashboardom

Planirani novi model termina:

{
  id,
  date,
  time,
  clientName,
  service,
  status
}
# 13. Službeni roadmap projekta

Ovaj roadmap predstavlja trenutačni plan razvoja SalonAI platforme.

Redoslijed milestoneova može se prilagoditi ako poslovne potrebe ili tehnički zahtjevi pokažu da je drugačiji raspored učinkovitiji. Svaka veća promjena roadmapa mora biti dokumentirana.

---

## Milestone 0 — Project Foundation

**Status:** ✅ Završeno

Cilj milestonea bio je postaviti osnovni razvojni temelj projekta.

Implementirano je:

* React i Vite projekt
* Git i GitHub repozitorij
* `main` i `development` branch
* React Router
* osnovni Layout
* Sidebar
* Header
* Dashboard
* početna organizacija projekta
* production build provjera

---

## Milestone 1 — Clients Engine v1

**Status:** ✅ Završeno

Implementirano je:

* prikaz klijenata
* dodavanje klijenata
* spremanje u localStorage
* ClientForm
* ClientCard
* prikaz imena i telefona
* prikaz broja posjeta
* modularna organizacija komponenti

Planirane buduće nadogradnje:

* uređivanje klijenta
* brisanje klijenta
* validacija telefona
* povijest termina
* automatsko povećavanje broja posjeta
* povezivanje klijenta s terminima

---

## Milestone 2 — Appointment Engine v1

**Status:** ✅ Završeno

Implementirano je:

* dodavanje termina
* uređivanje termina
* brisanje termina
* potvrda prije brisanja
* označavanje termina završenim
* localStorage
* migracija podataka
* datum i vrijeme termina
* sortiranje po datumu i vremenu
* validacija forme
* fokus na prvo neispravno polje
* sprječavanje dvostrukih termina
* statistika zakazanih i završenih termina
* prikaz datuma na kartici
* modularna struktura komponenti

Trenutačni model termina:

```js
{
  id,
  date,
  time,
  clientName,
  service,
  status,
}
```

Planirane buduće nadogradnje:

* `clientId`
* `serviceId`
* `employeeId`
* početno i završno vrijeme
* trajanje termina
* cijena
* bilješke
* izvor rezervacije
* status potvrde

---

## Milestone 3 — Calendar Engine v1

**Status:** ✅ Završeno

Implementirano je:

* zasebna Calendar stranica
* Calendar ruta
* navigacija kroz mjesece
* gumb Danas
* hrvatski nazivi mjeseci i dana
* vlastiti algoritam za generiranje 42 kalendarske ćelije
* prikaz dana prethodnog i sljedećeg mjeseca
* označavanje današnjeg datuma
* odabir datuma
* automatski prijelaz na mjesec odabranog sivog datuma
* prikaz broja termina po danu
* prikaz broja završenih termina
* dnevni panel termina
* sortiranje termina po vremenu
* zajednički `appointmentList`
* Single Source of Truth u `App.jsx`
* dodavanje termina iz Calendara
* unaprijed odabrani datum u AppointmentForm
* uređivanje termina klikom iz Calendara
* automatska sinkronizacija Calendara i stranice Termini
* responsive prikaz
* production build provjera

Calendar Engine v1 smatra se završenim jer podržava osnovni mjesečni operativni tok.

Planirane buduće Calendar nadogradnje:

* tjedni planner
* dnevni planner
* prikaz zaposlenika
* drag-and-drop termina
* blokirano vrijeme
* pauze
* smjene
* nedostupnost
* prikaz trajanja usluge
* tooltip pregledi
* filtriranje po zaposleniku
* filtriranje po statusu i usluzi

---

## Milestone 4 — Service Engine v1

**Status:** ⏳ Sljedeće

Cilj je napraviti strukturirani katalog usluga koji će koristiti termini, zaposlenici, kalendar, analitika i AI Booking Engine.

Planirane funkcionalnosti:

* Services stranica
* ServiceForm
* ServiceCard
* prikaz liste usluga
* dodavanje usluge
* uređivanje usluge
* aktivacija i deaktivacija usluge
* localStorage
* cijena
* trajanje
* naziv usluge
* osnovna validacija

Početni model usluge:

```js
{
  id,
  name,
  price,
  durationMinutes,
  active,
}
```

Buduće nadogradnje:

* kategorije
* opis
* cijena „od”
* buffer prije i poslije usluge
* zaposlenici koji izvršavaju uslugu
* različito trajanje po zaposleniku
* različita cijena po zaposleniku
* faze usluge
* paralelni rad tijekom čekanja

---

## Milestone 5 — Employee Engine v1

**Status:** 📝 Planirano

Planirane funkcionalnosti:

* dodavanje zaposlenika
* uređivanje zaposlenika
* deaktivacija zaposlenika
* dodjela usluga zaposleniku
* dodjela zaposlenika terminu
* prikaz zaposlenika
* osnovni filter kalendara
* priprema korisničkih uloga

Početni model zaposlenika:

```js
{
  id,
  firstName,
  lastName,
  email,
  phone,
  role,
  active,
}
```

---

## Milestone 6 — Shifts and Availability Engine

**Status:** 📝 Planirano

Planirane funkcionalnosti:

* raspored smjena
* početak i završetak smjene
* pauze
* slobodni dani
* godišnji odmor
* bolovanje
* odsutnosti
* blokirano vrijeme
* sprječavanje rezervacije izvan smjene
* provjera dostupnosti zaposlenika
* evidencija radnog vremena

Model smjene:

```js
{
  id,
  employeeId,
  date,
  startTime,
  endTime,
  breakMinutes,
  status,
}
```

---

## Milestone 7 — Business Hours and Booking Rules

**Status:** 📝 Planirano

Planirane funkcionalnosti:

* radno vrijeme salona
* neradni dani
* posebna radna vremena
* minimalno vrijeme prije rezervacije
* maksimalno vrijeme unaprijed
* politika otkazivanja
* pravila potvrde rezervacija
* automatska ili ručna potvrda
* blokiranje vremenskih intervala

---

## Milestone 8 — Backend and PostgreSQL

**Status:** 📝 Planirano

Planirane tehnologije:

* Node.js
* Express
* REST API
* PostgreSQL

Planirane migracije:

* localStorage klijenti → PostgreSQL
* localStorage termini → PostgreSQL
* usluge → PostgreSQL
* zaposlenici → PostgreSQL
* smjene → PostgreSQL

Cilj je sačuvati postojeći frontend i zamijeniti lokalni izvor podataka API slojem.

---

## Milestone 9 — Authentication, Roles and Multi-Tenant Architecture

**Status:** 📝 Planirano

Planirane funkcionalnosti:

* registracija
* prijava
* vlasnik salona
* voditelj
* zaposlenik
* prava pristupa
* prilagođeni Sidebar
* prilagođeni Dashboard
* odvajanje podataka između salona
* multi-tenant arhitektura

---

## Milestone 10 — AI Booking Engine

**Status:** 📝 Planirano

Planirane funkcionalnosti:

* prepoznavanje upita klijenta
* prepoznavanje usluge
* pronalazak dostupnog zaposlenika
* provjera trajanja
* provjera smjene
* provjera blokiranog vremena
* prijedlog slobodnog termina
* automatsko ili ručno potvrđivanje
* obavijest vlasniku ili zaposleniku
* automatska rezervacija prema pravilima salona

---

## Milestone 11 — WhatsApp and Automation Engine

**Status:** 📝 Planirano

Planirane funkcionalnosti:

* WhatsApp Business API
* automatski odgovori
* potvrde termina
* podsjetnici
* otkazivanje
* promjena termina
* n8n automatizacije
* obavijesti vlasniku
* obavijesti zaposleniku

---

## Milestone 12 — AI Price List Import

**Status:** 📝 Planirano

Planirani ulazi:

* PDF
* PNG
* JPG
* fotografija cjenika

Planirani tok:

```text
Upload dokumenta
↓
Prepoznavanje sadržaja
↓
Ekstrakcija usluga i cijena
↓
AI prijedlog trajanja
↓
Korisnička provjera
↓
Uređivanje
↓
Spremanje u Service Engine
```

AI prijedlozi ne smiju se spremati kao potvrđene činjenice bez korisničke provjere.

---

## Milestone 13 — Salon Setup Wizard

**Status:** 📝 Planirano

Salon Setup Wizard predstavljat će personalizirano početno postavljanje aplikacije.

Planirani koraci:

1. podaci o salonu
2. logo i izgled
3. radno vrijeme
4. usluge i cjenik
5. zaposlenici
6. smjene
7. WhatsApp
8. AI postavke
9. pravila rezervacija
10. završna provjera

Wizard se implementira nakon što svi moduli koje konfigurira budu stabilni.

---

## Milestone 14 — Dashboard 2.0 and Business Intelligence

**Status:** 📝 Planirano

Planirane funkcionalnosti:

* stvarni današnji termini
* sljedeći termin
* dnevni prihod
* tjedni prihod
* mjesečni prihod
* popunjenost
* najtraženije usluge
* učinak zaposlenika
* slobodni vremenski intervali
* otkazivanja
* AI poslovne preporuke

---

## Milestone 15 — Production and Commercial Launch

**Status:** 📝 Planirano

Planirane funkcionalnosti:

* deployment frontenda
* deployment backenda
* produkcijska baza
* environment varijable
* monitoring
* logging
* backup
* sigurnost
* Stripe
* paketi pretplate
* trial period
* produkcijski onboarding
* prvi pilot salon

---

# 14. Trenutačni status projekta

```text
Milestone 0 — Foundation                    ✅ Završeno
Milestone 1 — Clients Engine               ✅ Završeno
Milestone 2 — Appointment Engine           ✅ Završeno
Milestone 3 — Calendar Engine v1           ✅ Završeno
Milestone 4 — Service Engine v1            ⏳ Sljedeće
Milestone 5 — Employee Engine              📝 Planirano
Milestone 6 — Shifts and Availability      📝 Planirano
Milestone 7 — Booking Rules                📝 Planirano
Milestone 8 — Backend and PostgreSQL        📝 Planirano
Milestone 9 — Auth and Multi-Tenant         📝 Planirano
Milestone 10 — AI Booking Engine           📝 Planirano
Milestone 11 — WhatsApp Automation         📝 Planirano
Milestone 12 — AI Price List Import        📝 Planirano
Milestone 13 — Salon Setup Wizard          📝 Planirano
Milestone 14 — Business Intelligence       📝 Planirano
Milestone 15 — Production Launch           📝 Planirano
```

---

# 15. Pravilo završetka milestonea

Milestone se smatra završenim tek kada su ispunjeni svi uvjeti:

1. funkcionalnost radi
2. provedeni su testovi
3. nema poznatih kritičnih grešaka
4. `npm run build` prolazi
5. Git commit je napravljen
6. GitHub je ažuriran
7. `working tree clean`
8. blueprint je ažuriran

Napredne nadogradnje mogu ostati planirane za buduću verziju modula bez blokiranja zatvaranja njegove prve stabilne verzije.
