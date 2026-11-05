# Izgled aplikacije V1

Postavke nude Svijetlo, Tamno i Prema uređaju. Zadani izgled je svijetli.
Svijetla tema koristi bisernu podlogu, bijele kartice i diskretan ljubičasti sjaj;
tamna tema mornarskoplave površine i odvojene nijanse teksta, obruba i statusa.
Struktura stranica, poslovni podaci, ovlasti i API ugovori ostaju postojeći.

Odabir se sprema lokalno po ID-u korisnika u ovom pregledniku. Ne sinkronizira
se između uređaja. Ako spremanje nije dostupno, izbor radi u otvorenoj sesiji
uz jasnu poruku. Prema uređaju prati promjene sustava. Odjava uklanja temu
poslovnog sučelja, a drugi račun učitava vlastiti izbor. Početni Magic Wizard
zadržava svoj zaseban izgled. Clerkovo vanjsko sučelje za uređivanje računa
nije predmet ovog paketa.

Iz Postavki uklonjeni su JSON izvoz i njegova funkcija u App.jsx. Pregledani
izvoz bio je lokalno generiranje datoteke iz učitanih podataka, bez posebne
backend rute. Redovni API pristup podacima zadržava postojeće ovlasti.

## Provjere

- 163 frontend testa, uključujući šest provjera odabira teme i izolacije računa.
- Graf uvoza App.jsx provjeren kroz esbuild.
- Stvarne React komponente uz zamjensku autentikaciju/podatke u Chromiumu:
  Postavke, pregled poslovanja, kalendar, usluge, klijenti, zaposlenici i termini.
- Obje teme, osvježavanje stranice, promjena računa, promjena teme uređaja,
  uklanjanje teme pri izlasku iz poslovnog prikaza i širine 320/390/768 px.
- Instalacijska zaštita sadržaja, check bez promjena, CRLF/BOM, odbijanje
  ponovne primjene i nepoznatih izmjena, povrat nakon simulirane greške upisa.
- Verify skripta na korisnikovu računalu pokreće sve frontend testove i pravi
  produkcijski Vite build. Lokalna provjera ne zamjenjuje provjeru stvarne prijave,
  baze i poslovnih akcija kod korisnika. Plaćeni AI API se ne koristi.

Nema migracija, novih ovisnosti ni promjene konfiguracije kreiranja salona.
Prije commita pregledati obje teme, obrasce, zahtjeve, dijaloge i mobilni izbornik.
