# Dorada povezanog wizarda

Nadogradnja primijenjenog SalonAI_wizard_flow paketa, prije zajednickog commita.
Nema novih migracija, ovisnosti, promjena API ugovora ni promjene konfiguracije kreiranja salona.

- Obavezna polja pri nastavku pokazuju obrub, blagu pozadinu, poruku uz polje i fokus na prvi problem.
- Kreiranje validira prazan naziv i nepostojecu vremensku zonu prije spremanja zahtjeva.
- Tim odvojeno objasnjava samostalnog izvodjaca, vlasnika koji upravlja timom i stvarne profile.
- Pozivnice i clanstva ostaju na stranici Zaposlenici; ne prikazuju se u uvodnom wizardu.
- Napredovanje provjerava i solo sukob (vise aktivnih profila ili vlasnik ne izvodi usluge).
- Nova usluga unutar wizarda dobiva primjere djelatnosti; grooming koristi njegu pasa.
- Izvan wizarda, bez proslijedjene djelatnosti, primjer usluge ostaje neutralan. Nema dodatnog API dohvata djelatnosti.
- Obrazac usluge oznacava naziv, cijenu i trajanje te fokusira prvi neispravan unos.
- Obrazac zaposlenika prikazuje gresku imena uz polje umjesto browser alerta.
- Ne sprema se nijedna vrijednost iz placeholdera. Cijene i trajanja unosi korisnik.
- Spremi ovaj korak i dalje cuva nedovrsen nacrt. Spremi i nastavi zahtijeva obavezne podatke.

Potvrdjeni salon ne resetira se radi testiranja. Za cijeli uvodni wizard koristite novi odobreni testni racun bez clanstva i bez prethodnog kreiranja salona.

Provjere: frontend Node testovi i build kod korisnika; razvojno dodatno browser validacija fokusa/poruka/neposlanog zahtjeva, exact-retry kreiranja, napredovanja i uskih zaslona. Backend readiness i autorizacija ostaju iz prethodno provjerenog paketa.
