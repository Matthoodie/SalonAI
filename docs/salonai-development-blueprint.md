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
13. Status projekta
Milestone 1                 ✅ Završeno
Milestone 2                 ✅ Završeno
Frontend Refactoring v1     ✅ Završeno
Frontend Audit              ✅ Završeno
Milestone 3                 ⏳ Sljedeće

# FAZA 3 — spremi i provjeri dokument

Spremi datoteku:

```text
Ctrl + S

Zatim provjeri Git:

git status

Trebao bi vidjeti novu datoteku:

docs/salonai-development-blueprint.md

i možda nove foldere nećeš vidjeti jer Git ne prati prazne foldere.

To je normalno.

Važno: Git ne sprema prazne foldere

Kako bi Git zadržao prazne foldere, u svaki napravi .gitkeep datoteku:

docs/architecture/.gitkeep
docs/milestones/.gitkeep
docs/testing/.gitkeep
docs/screenshots/.gitkeep

.gitkeep može biti potpuno prazan.

Nakon toga će Git prepoznati strukturu.

FAZA 4 — dokument Milestonea 2

U folderu:

docs/milestones

napravi:

milestone-2-appointments-and-clients.md

U njega zalijepi:

# Milestone 2 — Clients and Appointment Management

## Status

Completed.

## Cilj

Izgraditi funkcionalni frontend modul za upravljanje klijentima i terminima prije uvođenja backenda.

## Implementirane funkcionalnosti

### Klijenti

- prikaz klijenata
- dodavanje klijenata
- localStorage
- prikaz telefona
- prikaz broja posjeta

### Termini

- dodavanje
- uređivanje
- brisanje
- potvrda prije brisanja
- označavanje završenim
- kronološko sortiranje
- localStorage
- sprječavanje duplih termina
- validacija
- automatski fokus na grešku
- prazno stanje
- statistika termina

## Završni testovi

- dodavanje klijenta
- refresh i provjera podataka
- dodavanje termina
- uređivanje termina
- brisanje termina
- odustajanje od brisanja
- označavanje završenim
- pokušaj dvostrukog termina
- provjera sortiranja
- provjera praznog stanja
- provjera statistike
- production build

## Rezultat

Milestone je uspješno završen i spremljen na `development` branch.


FAZA 5 — dokument refactoringa

U:

docs/architecture

napravi:

frontend-refactoring-v1.md

Zalijepi:

# Frontend Refactoring v1

## Cilj

Pretvoriti početnu ravnu strukturu React aplikacije u modularnu strukturu spremnu za rast.

## Pravilo organizacije

Svaka veća komponenta:

```text
ComponentName/
├── ComponentName.jsx
└── ComponentName.css

Svaka stranica:

PageName/
├── PageName.jsx
└── PageName.css
Refaktorirane komponente
AppointmentCard
AppointmentForm
ClientCard
ClientForm
DashboardCard
Header
Sidebar
Layout
Refaktorirane stranice
Appointments
Clients
Dashboard
Testiranje

Nakon svakog premještanja provedena je provjera:

import putanja
render komponente
funkcionalnosti
vizualnog izgleda
Vite terminala
production builda
Završni rezultat

Frontend je modularan, build prolazi, a Git working tree je čist.


# FAZA 6 — Git checkpoint dokumentacije

Vrati se u glavni folder projekta:

```powershell
cd C:\Users\matej\OneDrive\Radna površina\PROJECT_____2026\SalonAI

Provjeri:

git status

Zatim:

git add .

Provjeri ponovno:

git status

Commit:

git commit -m "Add SalonAI development blueprint"

Push:

git push

Završna provjera:

git status

Očekujemo:

nothing to commit, working tree clean
FAZA 7 — kako ćemo održavati blueprint

Od sada poslije svake veće cjeline radimo ovaj postupak:

Implementacija
↓
Testiranje
↓
Git commit
↓
Ažuriranje milestone dokumenta
↓
Ažuriranje glavnog blueprinta
↓
Nova PDF verzija nakon većeg milestonea

Blueprint neće biti dovršen jednom zauvijek. Bit će verzioniran zajedno s kodom.

Planirane verzije:

Blueprint v0.1
→ Milestone 1 + Milestone 2 + Refactoring

Blueprint v0.2
→ Datum i kalendar

Blueprint v0.3
→ Dashboard 2.0 i cjenik

Blueprint v0.4
→ Backend i PostgreSQL

Blueprint v0.5
→ Autentikacija i multi-tenant arhitektura

Blueprint v1.0
→ Prva produkcijska MVP verzija
Nakon blueprinta: Milestone 3

Tek nakon uspješnog Git checkpointa dokumentacije počinjemo mijenjati model termina.

Prvi tehnički korak bit će:

Dodavanje date vrijednosti novim i postojećim terminima

Ali nećemo samo dodati input i nadati se najboljem. Prvo ćemo riješiti migraciju postojećih podataka iz localStoragea, kako postojeći termini bez date vrijednosti ne bi srušili kalendar.

Redoslijed Milestonea 3:

1. Analiza postojećeg modela
2. Migracija starih termina
3. Date input u formi
4. Spremanje datuma
5. Uređivanje datuma
6. Datum na kartici
7. Provjera duplikata po datumu i vremenu
8. Filtriranje po odabranom danu
9. Dnevni prikaz
10. Mjesečni kalendar
11. Dashboard povezivanje
12. Testiranje
13. Git checkpoint
14. Blueprint update


Milestone 4 — Dashboard 2.0
Milestone 5 — Cjenik, usluge i filteri
Milestone 6 — Zaposlenici i smjene
Milestone 7 — Backend i PostgreSQL
Milestone 8 — Autentikacija i dopuštenja
Milestone 9 — AI, WhatsApp i automatizacije