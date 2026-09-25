/* WerkKracht Nederland: zoekmodule /vinden/. Serverdata gaat altijd via textContent de DOM in, nooit als HTML-string. */
(function () {
  'use strict';
  var PDOK_FREE = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free';
  var PDOK_TEGELS = 'https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/grijs/EPSG:3857/{z}/{x}/{y}.png';
  var ZOEKLOG_URL = 'https://script.google.com/macros/s/AKfycbzdXXGNa07uz0GQdVCmSnXFfyRVRQywsWfl1r-IJRxx9ETyFGswLcy0LzCzwroSSV5z/exec'; // Apps Script relay, actie "zoeklog"; leeg = uit
  var STRALEN = [10, 25, 50, 100, 200];
  var t = function (s, v) { return window.WKN.t(s, v); };

  var D = null, wsById = {}, hgById = {}, wsBySlug = {}, hgBySlug = {};
  var state = { sel: [], loc: null, r: 25, alle: false };
  var kaart = null, kaartKlaar = false, popup = null, laatste = [];
  var $ = function (id) { return document.getElementById(id); };

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'on') Object.keys(attrs.on).forEach(function (ev) { n.addEventListener(ev, attrs.on[ev]); });
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function norm(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function naam(o) { var l = window.WKN.taal(); return (l !== 'nl' && o['naam_' + l]) || o.naam; }
  function afstand(a, b, c, d) {
    var R = 6371, r = Math.PI / 180, dLa = (c - a) * r, dLo = (d - b) * r;
    var x = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  function melding(s) { $('melding').textContent = s || ''; }

  /* ---------- combobox (gedeeld voor werksoort en locatie) ---------- */
  function combobox(invoer, lijst, bron, kies) {
    var opties = [], actief = -1, timer = null;
    function sluit() { lijst.hidden = true; invoer.setAttribute('aria-expanded', 'false'); actief = -1; }
    function toon(items) {
      opties = items; actief = items.length ? 0 : -1;
      lijst.textContent = '';
      items.forEach(function (it, i) {
        var li = el('li', { role: 'option', id: lijst.id + '-' + i, 'aria-selected': String(i === actief),
          on: { mousedown: function (e) { e.preventDefault(); kies(it); sluit(); } } },
          [el('span', { text: it.label }), it.sub ? el('small', { text: it.sub }) : null]);
        lijst.appendChild(li);
      });
      lijst.hidden = !items.length;
      invoer.setAttribute('aria-expanded', String(!!items.length));
      if (actief >= 0) invoer.setAttribute('aria-activedescendant', lijst.id + '-0');
    }
    function markeer() {
      Array.prototype.forEach.call(lijst.children, function (li, i) { li.setAttribute('aria-selected', String(i === actief)); });
      if (actief >= 0) invoer.setAttribute('aria-activedescendant', lijst.id + '-' + actief);
    }
    invoer.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { Promise.resolve(bron(invoer.value)).then(toon); }, 180);
    });
    invoer.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' && opties.length) { actief = (actief + 1) % opties.length; markeer(); e.preventDefault(); }
      else if (e.key === 'ArrowUp' && opties.length) { actief = (actief - 1 + opties.length) % opties.length; markeer(); e.preventDefault(); }
      else if (e.key === 'Escape') sluit();
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (!lijst.hidden && actief >= 0) { kies(opties[actief]); sluit(); }
        else Promise.resolve(bron(invoer.value)).then(function (it) { if (it.length) kies(it[0]); else kies(null); });
      }
    });
    invoer.addEventListener('blur', function () { setTimeout(sluit, 120); });
    return { sluit: sluit };
  }

  /* ---------- werksoorten ---------- */
  function wsBron(q) {
    var n = norm(q).trim();
    if (n.length < 2) return [];
    var gekozen = state.sel.map(function (s) { return s.type + s.id; });
    var uit = [];
    D.hoofdgroepen.forEach(function (h) {
      if (gekozen.indexOf('hg' + h.id) < 0 && norm([h.naam, h.naam_en, h.naam_es].join(' ')).indexOf(n) >= 0)
        uit.push({ type: 'hg', id: h.id, label: naam(h), sub: t('hoofdgroep'), rang: 0 });
    });
    D.werksoorten.forEach(function (w) {
      if (gekozen.indexOf('ws' + w.id) >= 0) return;
      var hoofd = norm([w.naam, w.naam_en, w.naam_es].join(' ')), extra = norm(w.termen.join(' '));
      var p = hoofd.indexOf(n);
      if (p >= 0 || extra.indexOf(n) >= 0) uit.push({ type: 'ws', id: w.id, label: naam(w), sub: naam(hgById[w.hg]), rang: p === 0 ? 1 : p > 0 ? 2 : 3 });
    });
    uit.sort(function (a, b) { return a.rang - b.rang || a.label.localeCompare(b.label); });
    if (!uit.length) melding(t('Geen werksoort gevonden voor deze zoekterm.')); else melding('');
    return uit.slice(0, 8);
  }
  function voegToe(it) {
    if (!it) return;
    state.sel.push({ type: it.type, id: it.id });
    $('ws-invoer').value = '';
    tekenChips();
  }
  function tekenChips() {
    var c = $('chips'), inv = $('ws-invoer');
    Array.prototype.slice.call(c.querySelectorAll('.chip')).forEach(function (x) { x.remove(); });
    state.sel.forEach(function (s, i) {
      var o = s.type === 'hg' ? hgById[s.id] : wsById[s.id];
      var chip = el('span', { class: 'chip' + (s.type === 'hg' ? ' hg' : '') }, [
        el('span', { text: naam(o) }),
        el('button', { type: 'button', 'aria-label': t('Verwijder {x}', { x: naam(o) }),
          on: { click: function () { state.sel.splice(i, 1); tekenChips(); if (!$('resultaten').hidden) zoek(false); inv.focus(); } } }, ['×'])
      ]);
      c.insertBefore(chip, inv);
    });
    inv.placeholder = state.sel.length ? '' : t('bijvoorbeeld verpakken of groenonderhoud');
  }

  /* ---------- locatie (PDOK Locatieserver) ---------- */
  function locBron(q) {
    q = (q || '').trim();
    if (q.length < 2) return Promise.resolve([]);
    // Een postcode ("3011" of "3011 AB") alleen tegen postcodes zoeken; anders matcht PDOK ook woonplaatscodes (3011 = Eursinge)
    var fq = /^\d{4}\s?[a-z]{0,2}$/i.test(q) ? 'type:postcode' : 'type:(postcode OR woonplaats OR adres OR gemeente)';
    var url = PDOK_FREE + '?rows=6&fl=weergavenaam,type,centroide_ll,postcode&fq=' +
      encodeURIComponent(fq) + '&q=' + encodeURIComponent(q);
    return fetch(url).then(function (r) { return r.json(); }).then(function (j) {
      return (j.response && j.response.docs || []).map(function (d) {
        var m = /POINT\(([-\d.]+) ([-\d.]+)\)/.exec(d.centroide_ll || '');
        return m ? { label: d.weergavenaam, sub: d.type, lon: +m[1], lat: +m[2], pc4: ((d.postcode || '') + ' ' + d.weergavenaam).match(/\b\d{4}/) } : null;
      }).filter(Boolean);
    }).catch(function () { return []; });
  }
  function kiesLoc(it) {
    if (!it) { melding(t('Locatie niet gevonden. Probeer een postcode of plaatsnaam.')); return; }
    melding('');
    state.loc = { label: it.label, lat: it.lat, lon: it.lon, pc4: it.pc4 ? it.pc4[0] : '' };
    $('loc-invoer').value = it.label;
    zoek(true);
  }

  /* ---------- zoeken ---------- */
  function bereken(r) {
    var k = state.sel.length, uit = [];
    D.organisaties.forEach(function (o) {
      var ids = o.aanbod.map(function (a) { return a[0]; });
      var raak = state.sel.map(function (s) {
        return s.type === 'ws' ? ids.indexOf(s.id) >= 0 : ids.some(function (id) { return wsById[id] && wsById[id].hg === s.id; });
      });
      var m = raak.filter(Boolean).length;
      if (k && !m) return;
      if (state.alle && m < k) return;
      var best = null;
      if (state.loc) o.vestigingen.forEach(function (v) {
        var d = afstand(state.loc.lat, state.loc.lon, v[0], v[1]);
        if (!best || d < best.d) best = { d: d, v: v };
      });
      if (state.loc && best.d > r) return;
      uit.push({ o: o, m: m, raak: raak, d: best ? best.d : null, v: best ? best.v : o.vestigingen[0] });
    });
    uit.sort(function (a, b) {
      return (b.m - a.m) || (a.d !== null ? a.d - b.d : 0) || a.o.naam.localeCompare(b.o.naam);
    });
    return uit;
  }

  function zoek(expliciet) {
    if (!state.sel.length && !state.loc) { melding(t('Kies een of meer werksoorten of een locatie om te zoeken.')); return; }
    melding('');
    state.r = +$('straal').value; state.alle = $('alles').checked;
    laatste = bereken(state.r);
    $('resultaten').hidden = false;
    tekenLijst(laatste);
    tekenKaart(laatste);
    schrijfUrl();
    if (expliciet) log(laatste.length);
  }

  function tekenLijst(res) {
    var k = state.sel.length;
    $('telling').textContent = state.loc ? t('{n} werkontwikkelbedrijven binnen {r} km', { n: res.length, r: state.r }) : t('{n} werkontwikkelbedrijven', { n: res.length });
    var lijst = $('reslijst'), leeg = $('leeg');
    lijst.textContent = ''; leeg.textContent = '';
    if (!res.length && state.loc) {
      var groter = STRALEN.filter(function (x) { return x > state.r; }).map(function (x) { return { r: x, n: bereken(x).length }; }).filter(function (x) { return x.n; })[0];
      leeg.appendChild(el('div', { class: 'leegmelding' }, [
        el('p', { text: t('Geen werkontwikkelbedrijf gevonden binnen {r} km.', { r: state.r }) }),
        groter ? el('p', { text: t('Binnen {r} km vindt u {n} partijen.', groter) }) : null,
        groter ? el('button', { class: 'knop knop-licht', type: 'button', text: t('Vergroot de straal naar {r} km', groter),
          on: { click: function () { zetStraal(groter.r); zoek(true); } } }) : null
      ]));
    }
    res.forEach(function (x, i) {
      var o = x.o, plaats = x.v[2] || o.plaats;
      var meta = plaats + (x.d !== null ? ', ' + t('{d} km hemelsbreed', { d: x.d < 10 ? x.d.toFixed(1).replace('.', ',') : Math.round(x.d) }) : '');
      var match = el('ul', { class: 'match' });
      state.sel.forEach(function (s, j) {
        var nm = naam(s.type === 'hg' ? hgById[s.id] : wsById[s.id]);
        match.appendChild(el('li', { class: x.raak[j] ? '' : 'mis', text: nm }));
      });
      if (k > 1) match.appendChild(el('li', { text: t('{m} van {k} werksoorten', { m: x.m, k: k }) }));
      var li = el('li', { 'data-id': o.id }, [
        el('h3', {}, [el('button', { type: 'button', text: o.naam, on: { click: function () { focusOp(i); } } })]),
        el('p', { class: 'meta', text: meta }),
        k ? match : null,
        el('p', { class: 'links' }, [
          el('a', { href: '/vinden/' + o.slug + '/', text: t('Bekijk profiel') }),
          el('a', { href: o.website, target: '_blank', rel: 'noopener', text: t('Website') })
        ])
      ]);
      lijst.appendChild(li);
    });
  }

  /* ---------- kaart ---------- */
  function maakKaart(klaar) {
    if (kaart) { if (kaartKlaar) klaar(); else kaart.once('load', klaar); return; }
    if (!window.maplibregl) return;
    kaart = new maplibregl.Map({
      container: 'kaart', center: [5.3, 52.2], zoom: 6.3, attributionControl: { compact: true },
      style: { version: 8, sources: { pdok: { type: 'raster', tiles: [PDOK_TEGELS], tileSize: 256, maxzoom: 19, attribution: 'Kaartgegevens © Kadaster' } },
        layers: [{ id: 'pdok', type: 'raster', source: 'pdok' }] }
    });
    kaart.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    kaart.on('load', function () {
      var leeg = { type: 'FeatureCollection', features: [] };
      kaart.addSource('straal', { type: 'geojson', data: leeg });
      kaart.addSource('mij', { type: 'geojson', data: leeg });
      kaart.addSource('res', { type: 'geojson', data: leeg });
      kaart.addLayer({ id: 'straal-vlak', type: 'fill', source: 'straal', paint: { 'fill-color': '#D5F5E3', 'fill-opacity': 0.35 } });
      kaart.addLayer({ id: 'straal-lijn', type: 'line', source: 'straal', paint: { 'line-color': '#27AE60', 'line-width': 2, 'line-dasharray': [2, 2] } });
      kaart.addLayer({ id: 'res-punt', type: 'circle', source: 'res', paint: {
        'circle-radius': ['case', ['boolean', ['feature-state', 'actief'], false], 11, 8],
        'circle-color': ['case', ['boolean', ['feature-state', 'actief'], false], '#1A5C38', '#27AE60'],
        'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 2 } });
      kaart.addLayer({ id: 'mij-punt', type: 'circle', source: 'mij', paint: { 'circle-radius': 7, 'circle-color': '#0D3320', 'circle-stroke-color': '#A9DFBF', 'circle-stroke-width': 3 } });
      kaart.on('click', 'res-punt', function (e) { focusOp(+e.features[0].properties.i); });
      kaart.on('mouseenter', 'res-punt', function () { kaart.getCanvas().style.cursor = 'pointer'; });
      kaart.on('mouseleave', 'res-punt', function () { kaart.getCanvas().style.cursor = ''; });
      kaartKlaar = true; klaar();
    });
  }
  function cirkel(lat, lon, km) {
    var pts = [], n = 64;
    for (var i = 0; i <= n; i++) {
      var h = (i / n) * 2 * Math.PI;
      pts.push([lon + (km / (111.32 * Math.cos(lat * Math.PI / 180))) * Math.cos(h), lat + (km / 110.574) * Math.sin(h)]);
    }
    return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [pts] } };
  }
  function tekenKaart(res) {
    if ($('kaartkolom').hidden) return;
    maakKaart(function () {
      var fc = function (f) { return { type: 'FeatureCollection', features: f }; };
      var feats = [];
      res.forEach(function (x, i) {
        x.o.vestigingen.forEach(function (v, j) {
          feats.push({ type: 'Feature', id: i * 100 + j, properties: { i: i }, geometry: { type: 'Point', coordinates: [v[1], v[0]] } });
        });
      });
      kaart.getSource('res').setData(fc(feats));
      kaart.getSource('mij').setData(fc(state.loc ? [{ type: 'Feature', geometry: { type: 'Point', coordinates: [state.loc.lon, state.loc.lat] } }] : []));
      kaart.getSource('straal').setData(fc(state.loc ? [cirkel(state.loc.lat, state.loc.lon, state.r)] : []));
      if (popup) popup.remove();
      var b = new maplibregl.LngLatBounds();
      if (state.loc) cirkel(state.loc.lat, state.loc.lon, state.r).geometry.coordinates[0].forEach(function (c) { b.extend(c); });
      else feats.forEach(function (f) { b.extend(f.geometry.coordinates); });
      if (!b.isEmpty()) kaart.fitBounds(b, { padding: 40, maxZoom: 12, duration: 0 });
    });
  }
  function focusOp(i) {
    var x = laatste[i]; if (!x) return;
    Array.prototype.forEach.call($('reslijst').children, function (li, j) { li.classList.toggle('actief', j === i); });
    var li = $('reslijst').children[i]; if (li && li.scrollIntoView) li.scrollIntoView({ block: 'nearest' });
    if (!kaartKlaar || $('kaartkolom').hidden) return;
    kaart.querySourceFeatures('res').forEach(function (f) { kaart.setFeatureState({ source: 'res', id: f.id }, { actief: false }); });
    x.o.vestigingen.forEach(function (v, j) { kaart.setFeatureState({ source: 'res', id: i * 100 + j }, { actief: true }); });
    var inhoud = el('div', {}, [
      el('h3', { text: x.o.naam }),
      el('p', { text: (x.v[2] || x.o.plaats) + (x.d !== null ? ', ' + t('{d} km hemelsbreed', { d: Math.round(x.d) }) : '') }),
      el('a', { href: '/vinden/' + x.o.slug + '/', text: t('Bekijk profiel') })
    ]);
    if (popup) popup.remove();
    popup = new maplibregl.Popup({ offset: 12 }).setLngLat([x.v[1], x.v[0]]).setDOMContent(inhoud).addTo(kaart);
    kaart.easeTo({ center: [x.v[1], x.v[0]], duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 400 });
  }

  /* ---------- URL-status, delen en log ---------- */
  function schrijfUrl() {
    var p = new URLSearchParams();
    if (state.sel.length) p.set('w', state.sel.map(function (s) { return s.type === 'hg' ? 'hg-' + hgById[s.id].slug : wsById[s.id].slug; }).join(','));
    if (state.loc) { p.set('l', state.loc.label); p.set('lat', state.loc.lat.toFixed(4)); p.set('lon', state.loc.lon.toFixed(4)); if (state.loc.pc4) p.set('pc', state.loc.pc4); }
    p.set('r', state.r);
    if (state.alle) p.set('alle', '1');
    history.replaceState(null, '', '?' + p.toString());
  }
  function leesUrl() {
    var p = new URLSearchParams(location.search);
    (p.get('w') || '').split(',').filter(Boolean).forEach(function (s) {
      if (s.indexOf('hg-') === 0 && hgBySlug[s.slice(3)]) state.sel.push({ type: 'hg', id: hgBySlug[s.slice(3)].id });
      else if (wsBySlug[s]) state.sel.push({ type: 'ws', id: wsBySlug[s].id });
    });
    var lat = parseFloat(p.get('lat')), lon = parseFloat(p.get('lon'));
    if (!isNaN(lat) && !isNaN(lon)) { state.loc = { label: p.get('l') || t('Uw locatie'), lat: lat, lon: lon, pc4: p.get('pc') || '' }; $('loc-invoer').value = state.loc.label; }
    if (p.get('r')) zetStraal(+p.get('r'));
    if (p.get('alle') === '1') $('alles').checked = true;
    tekenChips();
    return state.sel.length || state.loc;
  }
  function zetStraal(r) {
    var s = $('straal');
    if (!Array.prototype.some.call(s.options, function (o) { return +o.value === r; })) s.appendChild(el('option', { value: r, text: r + ' km' }));
    s.value = String(r);
  }
  function log(n) {
    if (!ZOEKLOG_URL) return;
    var body = JSON.stringify({ actie: 'zoeklog', werksoorten: state.sel.map(function (s) { return s.type + ':' + s.id; }).join(','),
      postcode4: state.loc ? state.loc.pc4 : '', straal_km: state.r, alles_vereist: state.alle, aantal_resultaten: n, taal: window.WKN.taal() });
    try { fetch(ZOEKLOG_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body }); } catch (e) {}
  }

  /* ---------- start ---------- */
  function start() {
    D.werksoorten.forEach(function (w) { wsById[w.id] = w; wsBySlug[w.slug] = w; });
    D.hoofdgroepen.forEach(function (h) { hgById[h.id] = h; hgBySlug[h.slug] = h; });
    var inUse = {};
    D.organisaties.forEach(function (o) { o.aanbod.forEach(function (a) { if (wsById[a[0]]) inUse[wsById[a[0]].hg] = true; }); });
    var hgDiv = $('hoofdgroepen');
    function tekenHg() {
      Array.prototype.slice.call(hgDiv.querySelectorAll('button')).forEach(function (b) { b.remove(); });
      D.hoofdgroepen.filter(function (h) { return inUse[h.id]; }).forEach(function (h) {
        hgDiv.appendChild(el('button', { type: 'button', text: naam(h), on: { click: function () {
          if (!state.sel.some(function (s) { return s.type === 'hg' && s.id === h.id; })) voegToe({ type: 'hg', id: h.id });
          if (state.loc) zoek(true); else $('loc-invoer').focus();
        } } }));
      });
    }
    tekenHg();
    combobox($('ws-invoer'), $('ws-opties'), wsBron, voegToe);
    combobox($('loc-invoer'), $('loc-opties'), locBron, kiesLoc);
    $('ws-invoer').addEventListener('keydown', function (e) {
      if (e.key === 'Backspace' && !this.value && state.sel.length) { state.sel.pop(); tekenChips(); }
    });
    $('zoekknop').addEventListener('click', function () {
      var v = $('loc-invoer').value.trim();
      if (v && (!state.loc || state.loc.label !== v)) locBron(v).then(function (it) { kiesLoc(it[0] || null); });
      else zoek(true);
    });
    $('straal').addEventListener('change', function () { if (!$('resultaten').hidden) zoek(true); });
    $('alles').addEventListener('change', function () { if (!$('resultaten').hidden) zoek(true); });
    $('geoknop').addEventListener('click', function () {
      if (!navigator.geolocation) { melding(t('Uw locatie kon niet worden bepaald.')); return; }
      navigator.geolocation.getCurrentPosition(function (p) {
        state.loc = { label: t('Uw locatie'), lat: p.coords.latitude, lon: p.coords.longitude, pc4: '' };
        $('loc-invoer').value = state.loc.label; zoek(true);
      }, function () { melding(t('Uw locatie kon niet worden bepaald.')); }, { timeout: 10000 });
    });
    var smal = window.matchMedia('(max-width: 860px)');
    function pasKaartAan() { $('kaartkolom').hidden = smal.matches; $('kaartwissel').textContent = t('Toon op kaart'); }
    pasKaartAan();
    smal.addEventListener('change', function () { pasKaartAan(); if (!smal.matches) tekenKaart(laatste); });
    $('kaartwissel').addEventListener('click', function () {
      var k = $('kaartkolom'); k.hidden = !k.hidden;
      this.textContent = t(k.hidden ? 'Toon op kaart' : 'Toon lijst');
      if (!k.hidden) { tekenKaart(laatste); setTimeout(function () { if (kaart) kaart.resize(); }, 50); }
    });
    $('deelknop').addEventListener('click', function () {
      var knop = this;
      if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(function () {
        knop.textContent = t('Link gekopieerd'); setTimeout(function () { knop.textContent = t('Kopieer de link naar deze resultaten'); }, 2000);
      });
    });
    document.addEventListener('taalwijziging', function () {
      tekenChips(); tekenHg();
      $('kaartwissel').textContent = t($('kaartkolom').hidden ? 'Toon op kaart' : 'Toon lijst');
      if (!$('resultaten').hidden) { tekenLijst(laatste); }
    });
    if (leesUrl()) zoek(false);
  }

  fetch('/vinden/data/vinden.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (j) { D = j; start(); })
    .catch(function () { melding(t('De gegevens konden niet worden geladen. Vernieuw de pagina.')); });
})();
