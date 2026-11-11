# Grooming 4 — fotografija ljubimca

## Opseg

Jedna neobavezna fotografija po profilu ljubimca, u Klijenti → Detalji → Ljubimci.
Dodavanje/zamjena s lokalnim pregledom i izričitim spremanjem; uklanjanje s potvrdom.
Bez fotografije ostaje inicijal. Svijetla i tamna tema koriste postojeće UI varijable.
Profil se prvo kreira, a zatim se dodaje fotografija. Nema AI poziva ni nove ovisnosti.

Ovaj paket prikazuje fotografije na karticama profila ljubimaca. Termini, kalendar,
dashboard i povijest i dalje prikazuju spremljeno ime ljubimca i vlasnika iz 3B;
minijature u tim prikazima i zasebna povijest pojedinog ljubimca nisu dio ovog paketa.
Fotografija je trenutačna slika profila, ne povijesni dokaz uz svaki termin.

## API i pristup

Rute pod postojećim autentificiranim /api/clients i owner/admin kontrolom:
- GET /:clientId/pets/:petId/photo?version=N → image/jpeg.
- PUT /:clientId/pets/:petId/photo → application/octet-stream; If-Match: "REVIZIJA_PROFILA".
- DELETE /:clientId/pets/:petId/photo → If-Match: "REVIZIJA_PROFILA".

Sve operacije ponovno provjeravaju aktivnog korisnika, salon, članstvo i owner/admin
ulogu u bazi, djelatnost grooming/mixed i pripadnost ljubimca vlasniku/salonu.
Zaposlenici ne dobivaju pristup profilnim fotografijama ovom nadogradnjom.
Upload dodatno traži aktivnog vlasnika i ljubimca. Arhivirana fotografija može se
pregledati ili ukloniti uz postojeće ovlasti. Ne postoji javna ruta ni trajni javni URL.
Pristup se provjerava prije dekodiranja i ponovno pod zaključavanjem pri spremanju.

Spremanje/uklanjanje povećava revision profila i photo_version. Zastarjela izmjena
vraća konflikt; nema automatskog ponavljanja pisanja. DELETE već prazne fotografije
s aktualnom revizijom ne mijenja verzije. Nakon neizvjesnog odgovora korisnik mora
osvježiti popis prije novog pokušaja. Prekid veze nije dokaz da pisanje nije završilo.

## Obrada i pohrana

- JPEG/PNG do 8 MiB i 24 milijuna piksela; kontrola potpisa i stvarnog dekodiranja.
- SVG, GIF, PDF, HEIC i APNG nisu podržani. APNG acTL se eksplicitno odbija.
- Postojeći Sharp u worker threadu primjenjuje EXIF orijentaciju, smanjuje unutar
  768×768 bez povećanja, pretvara u JPEG i uklanja EXIF/GPS/ICC metapodatke.
- Najviše 512 KiB spremljenog JPEG-a; izvorna fotografija i naziv nisu spremljeni.
- Ograničeni istodobni prijenosi i obrade; obrada ima vremensko ograničenje.
- Jedna nova migracija 1794420000000_add-pet-photos.js dodaje photo_data (bytea),
  photo_width, photo_height, photo_version u client_pets. Popisi vraćaju samo
  has_photo i photo_version, nikad binarne podatke ili base64.
- Binarnu fotografiju čita zaseban API s private/no-store i nosniff. Frontend
  provjerava identitet i verziju, koristi privremeni blob URL i oslobađa ga pri
  zamjeni, zatvaranju ili promjeni konteksta. Transport provjerava salon i nakon
  čitanja binarnog tijela; postojeći JSON zahtjevi nastavljaju raditi jednako.
- Fotografije ulaze u PostgreSQL backup. Za produkciju mjeriti rast baze i veličinu
  backupova; objektna pohrana može biti kasnija nadogradnja. Nema novih .env varijabli.
- Down migracija trajno uklanja pohranjene slike; ne koristiti je kao redovni korak.

## Provjera

Autor: 186 backend testova bez stvarne baze; 200 frontend testova; JSX kompilacija
aplikacije; React/jsdom interakcije (pregled, spremanje, potvrda brisanja, blob cleanup).
Instalater provjeren za check/apply, CRLF/BOM, odbijanje različitog izvora i rollback.
Stvarni PostgreSQL testovi i puni backend suite/Vite build pokreću se kod korisnika.
Verifier prvo provjerava odvojenost TEST/DEV baze, zatim TEST migracije i sve testove.
Tek nakon izlaznog koda 0 pokrenuti DEV migraciju i backend.

Ručna provjera:
1. Profil bez slike: inicijal; Fotografija → odaberi JPEG/PNG → pregled → Spremi.
2. Ponovno otvoriti profil i osvježiti preglednik: slika ostaje.
3. Zamijeniti drugom slikom: stara nestaje, ostali podaci ostaju isti.
4. Odustati od odabira: nema promjene. Ukloni → Zadrži: slika ostaje.
5. Ukloni → Potvrdi: vraća inicijal, profil i termini ostaju.
6. Odbiti pogrešnu vrstu/preveliku datoteku i neispravan sadržaj preimenovan u .jpg.
7. Drugi ljubimac istog vlasnika zadržava vlastitu sliku; drugi salon nema pristup.
8. Arhivirani profil ne dopušta upload, ali čuva postojeću sliku i dopušta uklanjanje.
9. U dvije kartice promijeniti isti profil/sliku: druga stara izmjena mora tražiti osvježavanje.
10. Provjeriti tamnu temu, uži prozor, obične termine i grooming odabir iz 3B.
