# SalonAI Core Model

## 1. Vizija proizvoda

SalonAI je AI operativni sustav za male frizerske salone.

Cilj proizvoda je pomoći vlasnicima salona u upravljanju:
- klijentima
- rezervacijama
- zaposlenicima
- prihodima
- komunikaciji s klijentima

Prva ciljna skupina:
mali frizerski saloni s 1-5 zaposlenika.

---

# 2. Problem koji rješavamo

Mali saloni često koriste:
- papir
- Excel
- WhatsApp
- ručno vođenje termina

Problemi:
- izgubljeno vrijeme na poruke
- teško praćenje prihoda
- ručni izračun provizija
- zaboravljeni klijenti

---

# 3. SalonAI Core

Core sustav sastoji se od glavnih poslovnih entiteta:

## Salon

Predstavlja poslovni subjekt.

Podaci:
- naziv
- adresa
- kontakt
- radno vrijeme
- vlasnik

---

## Employee

Predstavlja zaposlenika.

Podaci:
- ime
- prezime
- uloga
- postotak provizije
- radno vrijeme

---

## Service

Predstavlja uslugu.

Primjeri:
- muško šišanje
- žensko šišanje
- bojanje
- feniranje

Podaci:
- naziv
- cijena
- trajanje
- provizija

---

## Client

Predstavlja klijenta.

Podaci:
- ime
- prezime
- telefon
- email
- povijest dolazaka
- omiljene usluge

---

## Appointment

Predstavlja rezervaciju.

Podaci:
- klijent
- zaposlenik
- usluga
- datum
- vrijeme
- status

---

## Transaction

Predstavlja financijsku transakciju.

Podaci:
- usluga
- cijena
- zaposlenik
- provizija
- prihod salona
- datum

---

# 4. AI asistenti

## Reception AI

Zadužen za:
- odgovaranje klijentima
- rezervacije
- informacije o uslugama

---

## Manager AI

Zadužen za:
- analizu poslovanja
- izvještaje
- pregled prihoda

---

## Marketing AI

Zadužen za:
- objave
- kampanje
- komunikaciju s klijentima

---

## Finance AI

Zadužen za:
- provizije
- financijske analize
- izvještaje

---

# 5. MVP verzija

Prva verzija uključuje:

## Core funkcije

- Salon
- Employee
- Service
- Client
- Appointment

## Prvi AI

Reception AI

---

# 6. Dugoročna vizija

SalonAI može postati platforma za različite uslužne djelatnosti:

- barber saloni
- beauty saloni
- wellness
- autoservisi
- drugi mali poduzetnici

Temelj ostaje isti:
AI koji razumije poslovanje korisnika.