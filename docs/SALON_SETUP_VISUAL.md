# Magic Wizard — završna vizualna dorada

Tamna mornarskoplava pozadina s ljubičastim prijelazom samo za dobrodošlicu i početno postavljanje. Bijele kartice ostaju čitljive, uključujući označena obavezna polja. Numerirani koraci jasno označavaju trenutačni korak; prolazak kroz korake nije dokaz dovršenosti.

Nakon potvrđenog uspjeha postojećeg complete API-ja prikazuje se završni ekran i gumb Otvori moj salon. Neuspjelo spremanje ostavlja korisnika u provjeri spremnosti. Ponovno učitavanje već dovršenog salona koristi postojeće usmjeravanje u aplikaciju.

Nema novih API ruta, migracija, ovisnosti ni promjena ovlasti. Postojeći wizard u Postavkama ostaje u stilu aplikacije. Stil tamnog ulaza prestaje vrijediti kad ulazni ekran više nije u DOM-u.

## Provjera prije isporuke

- 157/157 postojećih frontend testova.
- Stvarne React komponente u Chromiumu uz zamjenske API odgovore: spremanje, povratak, sukob verzije, obavezna polja, grooming primjeri, završetak i neuspjeli završetak, eksplicitan ulazak u salon, pozivnice i ekran dobrodošlice.
- Širine 320, 390, 768 i 1200 px bez vodoravnog prelijevanja u provjerenim stanjima.
- Provjera grafa uvoza stvarnog App.jsx kroz esbuild. Produkcijski Vite build pokreće se korisnikovom verify skriptom.
- Instalacijske provjere: preduvjeti i sadržaj datoteka, CRLF/BOM, check bez upisa, ponovljena primjena, odbijanje nepoznatih promjena i povrat izvornog sadržaja nakon simulirane greške.

Lokalne provjere ne koriste stvarnu bazu ni plaćeni AI API. U aplikaciji treba potvrditi završni prolazak novog testnog salona.
