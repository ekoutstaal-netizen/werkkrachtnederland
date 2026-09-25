/**
 * WerkKracht Nederland: anonieme zoeklog voor /vinden/.
 * Toevoegen aan het project "WKN Portaal Script" (de bestaande relay).
 *
 * 1. Plak deze functie in het script.
 * 2. Voeg bovenaan in de bestaande doPost(e), direct na het parsen van de body, toe:
 *      if (body && body.actie === 'zoeklog') return logZoekopdracht(body);
 *    (gebruik de variabelenaam die de bestaande doPost voor de geparste JSON gebruikt)
 * 3. Vul ZOEKLOG_SHEET_ID in met het ID van de Google Sheet "WKN Vinden data".
 * 4. Implementeren > Implementaties beheren > nieuwe versie. Anders draait de oude code.
 * 5. Zet daarna in vinden/assets/vinden.js de constante ZOEKLOG_URL op de relay-URL.
 *
 * Er wordt geen IP-adres, geen volledige postcode en geen vrije tekst opgeslagen.
 */
var ZOEKLOG_SHEET_ID = 'VUL_HIER_HET_SHEET_ID_IN';

function logZoekopdracht(b) {
  var schoon = function (s, re, max) { s = String(s || ''); return re.test(s) ? s.slice(0, max) : ''; };
  var rij = [
    new Date(),
    schoon(b.werksoorten, /^[a-z0-9:,\-]*$/, 300),
    schoon(b.postcode4, /^\d{4}$/, 4),
    Math.max(0, Math.min(500, Number(b.straal_km) || 0)),
    b.alles_vereist === true,
    Math.max(0, Math.min(1000, Number(b.aantal_resultaten) || 0)),
    schoon(b.taal, /^(nl|en|es)$/, 2)
  ];
  var ss = SpreadsheetApp.openById(ZOEKLOG_SHEET_ID);
  var sh = ss.getSheetByName('zoeklog') || ss.insertSheet('zoeklog');
  if (sh.getLastRow() === 0) sh.appendRow(['datum', 'werksoorten', 'postcode4', 'straal_km', 'alles_vereist', 'aantal_resultaten', 'taal']);
  sh.appendRow(rij);
  return ContentService.createTextOutput('ok').setMimeType(ContentService.MimeType.TEXT);
}
