# SalonAI Database Design

## Verzija

v0.1

---

# 1. Cilj baze podataka

Baza podataka SalonAI sustava mora omogućiti upravljanje:

- salonima
- zaposlenicima
- uslugama
- klijentima
- rezervacijama
- financijama
- AI funkcijama

Prva verzija namijenjena je malim frizerskim salonima (1-5 zaposlenika).

---

# 2. Glavni entiteti

Osnovni modeli sustava:

Salon
|
|--- Employee
|
|--- Service
|
|--- Client
|
|
Appointment
|
|
Transaction



---

# 3. Salon

Predstavlja poslovni subjekt.

## Polja

| Polje | Opis |
|---|---|
| id | Jedinstveni identifikator |
| name | Naziv salona |
| address | Adresa |
| phone | Kontakt telefon |
| email | Email |
| owner_id | Vlasnik salona |
| created_at | Datum kreiranja |

---

# 4. Employee

Predstavlja zaposlenika salona.

## Polja

| Polje | Opis |
|---|---|
| id | Jedinstveni identifikator |
| salon_id | Salon kojem pripada |
| first_name | Ime |
| last_name | Prezime |
| role | Uloga |
| commission_rate | Postotak provizije |
| active | Aktivni zaposlenik |

Primjer:
Ivan Horvat

Usluga:
Muško šišanje 20 €

Provizija:
40 %

Zaposlenik dobiva:
8 €

Salon dobiva:
12 €


---

# 5. Service

Predstavlja uslugu.

Primjeri:

- muško šišanje
- žensko šišanje
- bojanje
- feniranje

## Polja

| Polje | Opis |
|---|---|
| id | Jedinstveni identifikator |
| salon_id | Salon |
| name | Naziv usluge |
| price | Cijena |
| duration_minutes | Trajanje |
| active | Aktivna usluga |

---

# 6. Client

Predstavlja klijenta.

## Polja

| Polje | Opis |
|---|---|
| id | Jedinstveni identifikator |
| salon_id | Salon |
| first_name | Ime |
| last_name | Prezime |
| phone | Telefon |
| email | Email |
| notes | Bilješke |
| created_at | Datum kreiranja |

Primjeri bilješki:

- voli kraću frizuru
- uvijek dolazi petkom
- koristi određeni proizvod

---

# 7. Appointment

Predstavlja rezervaciju termina.

## Polja

| Polje | Opis |
|---|---|
| id | Jedinstveni identifikator |
| salon_id | Salon |
| client_id | Klijent |
| employee_id | Zaposlenik |
| service_id | Usluga |
| appointment_date | Datum |
| appointment_time | Vrijeme |
| status | Status |

Statusi:
scheduled
completed
cancelled
no_show



---

# 8. Transaction

Predstavlja financijski zapis.

Svaka završena usluga može generirati transakciju.

## Polja

| Polje | Opis |
|---|---|
| id | Jedinstveni identifikator |
| appointment_id | Povezani termin |
| total_amount | Ukupna cijena |
| employee_amount | Iznos zaposleniku |
| salon_amount | Prihod salona |
| payment_status | Status plaćanja |
| created_at | Datum |

Primjer:
Usluga:
Muško šišanje

Ukupno:
20 €

Provizija zaposlenika:
8 €

Prihod salona:
12 €


---

# 9. AI pristup podacima

AI asistenti neće direktno mijenjati bazu.

AI koristi podatke kroz aplikacijski sloj.

Primjer:

Klijent:

"Imate li termin sutra?"

AI:

1. Provjerava radno vrijeme salona
2. Provjerava slobodne zaposlenike
3. Provjerava trajanje usluge
4. Predlaže slobodan termin

---

# 10. Buduća proširenja

Mogući dodatni modeli:

- Product (prodaja proizvoda)
- Inventory (zalihe)
- Customer loyalty
- Reviews
- Marketing campaigns
- AI conversations
- Multiple locations

---

# 11. MVP baza

Prva verzija uključuje:

Obavezno:

- Salon
- Employee
- Service
- Client
- Appointment
- Transaction

Ne uključuje:

- proizvode
- skladište
- više lokacija
- naprednu analitiku
