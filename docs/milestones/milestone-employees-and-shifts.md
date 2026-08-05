# Milestone — Zaposlenici i smjene

## Status

Planned.

## Cilj

Omogućiti upravljanje zaposlenicima, rasporedima smjena, dostupnošću, korisničkim ulogama i evidencijom radnog vremena.

## Planirane funkcionalnosti

### Zaposlenici

- dodavanje zaposlenika
- uređivanje zaposlenika
- deaktivacija zaposlenika
- kontaktni podaci
- usluge koje zaposlenik izvršava
- radno vrijeme
- aktivan/neaktivan status

### Termini

- dodjela zaposlenika terminu
- filtriranje termina po zaposleniku
- prikaz termina zaposlenika
- sprječavanje rezervacije izvan smjene
- provjera preklapanja termina

### Smjene

- dnevni i tjedni raspored smjena
- početak i završetak smjene
- pauze
- slobodni dani
- godišnji odmor
- bolovanje i odsutnost
- kopiranje rasporeda prethodnog tjedna

### Uloge i dopuštenja

- vlasnik
- voditelj
- zaposlenik
- pristup prema ulozi
- prilagođen Sidebar i Dashboard

### Evidencija radnog vremena

- planirani sati
- dolazak
- odlazak
- pauze
- odrađeni sati
- prekovremeni sati
- mjesečni izvještaj

## Planirani modeli podataka

```js
employee = {
  id,
  salonId,
  firstName,
  lastName,
  email,
  phone,
  role,
  active,
}




shift = {
  id,
  employeeId,
  date,
  startTime,
  endTime,
  breakMinutes,
  status,
}

timeEntry = {
  id,
  employeeId,
  date,
  clockIn,
  clockOut,
  breakMinutes,
}

Budući model termina:

appointment = {
  id,
  date,
  time,
  clientName,
  service,
  status,
  employeeId,
}