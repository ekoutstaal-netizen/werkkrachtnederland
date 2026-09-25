/* WerkKracht Nederland: taallaag voor /vinden/. Nederlandse tekst = vertaalsleutel.
   Elke tekstwijziging = drie aanpassingen: NL zichtbare tekst, en-blok, es-blok (usted-vorm). */
(function () {
  'use strict';
  var TAALSLEUTEL = 'wk-lang'; // gelijk houden aan de sleutel die index.html gebruikt (WKsetLang)
  var DICTS = {
    en: {
      'Zoek een werkontwikkelbedrijf': 'Find a work development company',
      'Elke stap telt.': 'Every step counts.',
      'Gegevens afgeleid van de openbare websites van de werkontwikkelbedrijven. Klopt er iets niet? Laat het ons weten.': 'Data derived from the public websites of the work development companies. Something not right? Let us know.',
      'Neem contact op met WerkKracht Nederland': 'Contact WerkKracht Nederland',
      'De werksoorten van deze organisatie zijn nog niet bekend.': 'The types of work of this organisation are not yet known.',
      'Bezoek de website': 'Visit the website',
      'Vraag via WerkKracht Nederland': 'Ask via WerkKracht Nederland',
      'Werksoorten': 'Types of work',
      'De uitvoeringsvorm is indicatief. Vraag de actuele mogelijkheden na bij de organisatie.': 'The way of working is indicative. Please check current options with the organisation.',
      'Vestigingen': 'Locations',
      'Vergelijk met andere werkontwikkelbedrijven': 'Compare with other work development companies',
      'Zoek op afstand van uw locatie': 'Search by distance from your location',
      'werkontwikkelbedrijven': 'work development companies',
      'Ik zoek': 'I am looking for',
      'binnen': 'within',
      'van': 'of',
      'bijvoorbeeld verpakken of groenonderhoud': 'for example packaging or grounds maintenance',
      'postcode of plaats': 'postcode or town',
      'Werksoort': 'Type of work',
      'Locatie': 'Location',
      'Straal': 'Radius',
      'Gebruik mijn locatie': 'Use my location',
      'Toon werkontwikkelbedrijven': 'Show work development companies',
      'Alleen partijen die alles doen': 'Only providers that do everything selected',
      'Of kies een hoofdgroep': 'Or choose a category',
      'Opdrachtgevers vinden hier werkontwikkelbedrijven die het werk uitvoeren, dicht bij de eigen locatie.': 'Clients find work development companies here that carry out the work, close to their own location.',
      'Toon op kaart': 'Show on map',
      'Toon lijst': 'Show list',
      '{n} werkontwikkelbedrijven binnen {r} km': '{n} work development companies within {r} km',
      '{n} werkontwikkelbedrijven': '{n} work development companies',
      '{m} van {k} werksoorten': '{m} of {k} types of work',
      '{d} km hemelsbreed': '{d} km as the crow flies',
      'Bekijk profiel': 'View profile',
      'Website': 'Website',
      'Geen werkontwikkelbedrijf gevonden binnen {r} km.': 'No work development company found within {r} km.',
      'Binnen {r} km vindt u {n} partijen.': 'Within {r} km you will find {n} providers.',
      'Vergroot de straal naar {r} km': 'Increase the radius to {r} km',
      'Geen passende match? WerkKracht Nederland bundelt uw vraag.': 'No suitable match? WerkKracht Nederland bundles your request.',
      'Vraag uitzetten': 'Submit your request',
      'Locatie niet gevonden. Probeer een postcode of plaatsnaam.': 'Location not found. Try a postcode or town name.',
      'Uw locatie kon niet worden bepaald.': 'Your location could not be determined.',
      'Geen werksoort gevonden voor deze zoekterm.': 'No type of work found for this search term.',
      'Verwijder {x}': 'Remove {x}',
      'De gegevens konden niet worden geladen. Vernieuw de pagina.': 'The data could not be loaded. Please refresh the page.',
      'Kies een of meer werksoorten of een locatie om te zoeken.': 'Choose one or more types of work or a location to search.',
      'Uw locatie': 'Your location',
      'Kopieer de link naar deze resultaten': 'Copy the link to these results',
      'Link gekopieerd': 'Link copied',
      'hoofdgroep': 'category',
      'Kaart': 'Map',
      'Alle werkontwikkelbedrijven in Nederland': 'All work development companies in the Netherlands'
    },
    es: {
      'Zoek een werkontwikkelbedrijf': 'Busque una empresa de desarrollo laboral',
      'Elke stap telt.': 'Cada paso cuenta.',
      'Gegevens afgeleid van de openbare websites van de werkontwikkelbedrijven. Klopt er iets niet? Laat het ons weten.': 'Datos obtenidos de los sitios web públicos de las empresas de desarrollo laboral. ¿Hay algo incorrecto? Háganoslo saber.',
      'Neem contact op met WerkKracht Nederland': 'Póngase en contacto con WerkKracht Nederland',
      'De werksoorten van deze organisatie zijn nog niet bekend.': 'Los tipos de trabajo de esta organización aún no se conocen.',
      'Bezoek de website': 'Visite el sitio web',
      'Vraag via WerkKracht Nederland': 'Consulte a través de WerkKracht Nederland',
      'Werksoorten': 'Tipos de trabajo',
      'De uitvoeringsvorm is indicatief. Vraag de actuele mogelijkheden na bij de organisatie.': 'La modalidad de ejecución es indicativa. Consulte las posibilidades actuales con la organización.',
      'Vestigingen': 'Sedes',
      'Vergelijk met andere werkontwikkelbedrijven': 'Compare con otras empresas de desarrollo laboral',
      'Zoek op afstand van uw locatie': 'Busque por distancia desde su ubicación',
      'werkontwikkelbedrijven': 'empresas de desarrollo laboral',
      'Ik zoek': 'Busco',
      'binnen': 'a menos de',
      'van': 'de',
      'bijvoorbeeld verpakken of groenonderhoud': 'por ejemplo, embalaje o mantenimiento de zonas verdes',
      'postcode of plaats': 'código postal o localidad',
      'Werksoort': 'Tipo de trabajo',
      'Locatie': 'Ubicación',
      'Straal': 'Radio',
      'Gebruik mijn locatie': 'Usar mi ubicación',
      'Toon werkontwikkelbedrijven': 'Mostrar empresas de desarrollo laboral',
      'Alleen partijen die alles doen': 'Solo proveedores que realizan todo lo seleccionado',
      'Of kies een hoofdgroep': 'O elija una categoría',
      'Opdrachtgevers vinden hier werkontwikkelbedrijven die het werk uitvoeren, dicht bij de eigen locatie.': 'Aquí los clientes encuentran empresas de desarrollo laboral que realizan el trabajo, cerca de su propia ubicación.',
      'Toon op kaart': 'Mostrar en el mapa',
      'Toon lijst': 'Mostrar lista',
      '{n} werkontwikkelbedrijven binnen {r} km': '{n} empresas de desarrollo laboral a menos de {r} km',
      '{n} werkontwikkelbedrijven': '{n} empresas de desarrollo laboral',
      '{m} van {k} werksoorten': '{m} de {k} tipos de trabajo',
      '{d} km hemelsbreed': '{d} km en línea recta',
      'Bekijk profiel': 'Ver perfil',
      'Website': 'Sitio web',
      'Geen werkontwikkelbedrijf gevonden binnen {r} km.': 'No se ha encontrado ninguna empresa de desarrollo laboral a menos de {r} km.',
      'Binnen {r} km vindt u {n} partijen.': 'A menos de {r} km encontrará {n} proveedores.',
      'Vergroot de straal naar {r} km': 'Amplíe el radio a {r} km',
      'Geen passende match? WerkKracht Nederland bundelt uw vraag.': '¿No encuentra lo que busca? WerkKracht Nederland agrupa su solicitud.',
      'Vraag uitzetten': 'Presentar su solicitud',
      'Locatie niet gevonden. Probeer een postcode of plaatsnaam.': 'Ubicación no encontrada. Pruebe con un código postal o el nombre de una localidad.',
      'Uw locatie kon niet worden bepaald.': 'No se ha podido determinar su ubicación.',
      'Geen werksoort gevonden voor deze zoekterm.': 'No se ha encontrado ningún tipo de trabajo para este término.',
      'Verwijder {x}': 'Eliminar {x}',
      'De gegevens konden niet worden geladen. Vernieuw de pagina.': 'No se han podido cargar los datos. Actualice la página.',
      'Kies een of meer werksoorten of een locatie om te zoeken.': 'Elija uno o varios tipos de trabajo o una ubicación para buscar.',
      'Uw locatie': 'Su ubicación',
      'Kopieer de link naar deze resultaten': 'Copie el enlace a estos resultados',
      'Link gekopieerd': 'Enlace copiado',
      'hoofdgroep': 'categoría',
      'Kaart': 'Mapa',
      'Alle werkontwikkelbedrijven in Nederland': 'Todas las empresas de desarrollo laboral de los Países Bajos'
    }
  };

  function leesTaal() {
    try { var t = localStorage.getItem(TAALSLEUTEL); if (t === 'en' || t === 'es') return t; } catch (e) {}
    return 'nl';
  }
  var taal = leesTaal();

  function t(nl, vars) {
    var s = (taal !== 'nl' && DICTS[taal] && DICTS[taal][nl]) || nl;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(String(vars[k])); });
    return s;
  }

  function pasToe() {
    document.documentElement.lang = taal;
    document.querySelectorAll('[data-t]').forEach(function (el) { el.textContent = t(el.getAttribute('data-t')); });
    document.querySelectorAll('[data-t-ph]').forEach(function (el) { el.setAttribute('placeholder', t(el.getAttribute('data-t-ph'))); });
    document.querySelectorAll('[data-t-aria]').forEach(function (el) { el.setAttribute('aria-label', t(el.getAttribute('data-t-aria'))); });
    document.querySelectorAll('.ws').forEach(function (el) {
      if (!el.hasAttribute('data-nl')) el.setAttribute('data-nl', el.textContent);
      el.textContent = taal === 'nl' ? el.getAttribute('data-nl') : (el.getAttribute('data-' + taal) || el.getAttribute('data-nl'));
    });
    document.querySelectorAll('[data-lang]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === taal)); });
  }

  function zetTaal(nieuw) {
    taal = nieuw;
    try { localStorage.setItem(TAALSLEUTEL, nieuw); } catch (e) {}
    pasToe();
    document.dispatchEvent(new CustomEvent('taalwijziging', { detail: nieuw }));
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-lang]');
    if (b) zetTaal(b.getAttribute('data-lang'));
  });

  window.WKN = { t: t, taal: function () { return taal; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pasToe); else pasToe();
})();
