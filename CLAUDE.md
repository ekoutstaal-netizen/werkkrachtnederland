Dit is de website van WerkKracht Nederland (werkkrachtnederland.nl), een single-file SPA in index.html van ~3,5 MB. Drietalig NL/EN/ES met Nederlandse strings als vertaalsleutels — bij tekstwijzigingen altijd alle drie de talen bijwerken. De site bevat ook een PWA-setup en een klantportaal. Het manifest zit niet in een los bestand maar inline in index.html (regel 25, `<link rel="manifest">` met een base64 data:-URI); de service worker sw.js is wel een apart bestand.

Werkregels:
- Toon wijzigingen altijd eerst als diff voordat je commit.
- Commit messages in het Nederlands.
- Push gaat naar main en zet de wijziging direct live.
