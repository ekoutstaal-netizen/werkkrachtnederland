#!/usr/bin/env python3
"""Zet de crawl om in kandidaten voor curatie.

  python3 scripts/extract.py kandidaten --crawl ~/Developer/wkn-crawl
      -> <crawl>/aanbod_kandidaten.csv    werksoort per organisatie met bewijs en betrouwbaarheid
      -> <crawl>/vestiging_kandidaten.csv adressen (straat, huisnummer, postcode, plaats) per organisatie
      -> <crawl>/koppen_dienstpaginas.csv koppen van dienst-/werkgeverspagina's (om ontbrekende werksoorten te vinden)
      -> <crawl>/dekking.txt              samenvatting

  python3 scripts/extract.py geocode
      -> vult lat/lon aan in data/vestigingen.csv voor rijen met postcode maar zonder coordinaten (PDOK Locatieserver)
"""
import argparse, csv, json, re, sys, time
from collections import defaultdict
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
PDOK_FREE = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free"
ADRES = re.compile(r"([A-Z][A-Za-zÀ-ÿ'.\- ]{2,40}?)\s(\d{1,4}\s?[a-zA-Z]?(?:-\d+)?)\s*,?\s*(\d{4})\s?([A-Z]{2})\s+([A-Z'][A-Za-zÀ-ÿ'\-]+(?:[ \-](?:aan|den|de|op|in|bij|[A-Z][A-Za-zÀ-ÿ'\-]+)){0,3})")
DIENSTURL = re.compile(r"(dienst|werkgever|opdrachtgever|uitbested|product|activiteit|wat-w|aanbod|zakelijk|services)", re.I)


def laad_tax():
    tax = json.load(open(ROOT / "data/taxonomie.json", encoding="utf-8"))
    for w in tax["werksoorten"]:
        w["_re"] = [re.compile(p, re.I) for p in w["patronen"]]
    return tax


def fragment(tekst, m, breedte=90):
    a, b = max(0, m.start() - breedte), min(len(tekst), m.end() + breedte)
    return ("…" + tekst[a:b] + "…").replace("\n", " ")


def kandidaten(crawldir: Path):
    tax = laad_tax()
    orgs = {o["slug"]: o for o in csv.DictReader(open(ROOT / "data/organisaties.csv", encoding="utf-8"))}
    aanbod, vest, koppen = [], [], []
    dekking = {}
    for slug, org in orgs.items():
        f = crawldir / "paginas" / f"{slug}.jsonl"
        if not f.exists():
            dekking[slug] = "geen crawl"
            continue
        paginas = [json.loads(l) for l in open(f, encoding="utf-8")]
        treffers = defaultdict(lambda: {"paginas": set(), "hits": 0, "kop_of_url": False, "bewijs": "", "bron": ""})
        adressen = {}
        for p in paginas:
            kopregel = " | ".join(p["koppen"])
            if DIENSTURL.search(p["url"]):
                for k in p["koppen"]:
                    koppen.append([org["id"], slug, p["url"], k])
            for w in tax["werksoorten"]:
                for rx in w["_re"]:
                    ms = list(rx.finditer(p["tekst"]))
                    in_kop = bool(rx.search(kopregel) or rx.search(p["url"].replace("-", " ")))
                    if not ms and not in_kop:
                        continue
                    t = treffers[w["id"]]
                    t["paginas"].add(p["url"])
                    t["hits"] += len(ms)
                    t["kop_of_url"] |= in_kop
                    if ms and not t["bewijs"]:
                        t["bewijs"], t["bron"] = fragment(p["tekst"], ms[0]), p["url"]
                    elif in_kop and not t["bron"]:
                        t["bron"] = p["url"]
            for m in ADRES.finditer(p["tekst"]):
                sleutel = (m.group(3) + m.group(4), m.group(2).replace(" ", ""))
                adressen.setdefault(sleutel, [org["id"], slug, m.group(1).strip(), m.group(2).strip(), f"{m.group(3)} {m.group(4)}", m.group(5).strip(), p["url"]])
        for wid, t in treffers.items():
            if t["kop_of_url"] or len(t["paginas"]) >= 2:
                b = "hoog"
            elif t["hits"] >= 2:
                b = "midden"
            else:
                b = "laag"
            aanbod.append([org["id"], slug, wid, b, len(t["paginas"]), t["hits"], t["bron"], t["bewijs"]])
        vest.extend(adressen.values())
        dekking[slug] = f"{len(paginas)} pagina's, {len(treffers)} werksoorten"

    def schrijf(naam, kop, rijen):
        with open(crawldir / naam, "w", newline="", encoding="utf-8") as fh:
            w = csv.writer(fh)
            w.writerow(kop)
            w.writerows(rijen)

    schrijf("aanbod_kandidaten.csv", ["organisatie_id", "slug", "werksoort_id", "betrouwbaarheid", "paginas", "hits", "bron_url", "bewijs"], aanbod)
    schrijf("vestiging_kandidaten.csv", ["organisatie_id", "slug", "straat", "huisnummer", "postcode", "plaats", "bron_url"], vest)
    schrijf("koppen_dienstpaginas.csv", ["organisatie_id", "slug", "url", "kop"], koppen)
    met = sum(1 for s in orgs if any(r[1] == s and r[3] != "laag" for r in aanbod))
    with open(crawldir / "dekking.txt", "w", encoding="utf-8") as fh:
        fh.write(f"Organisaties met minstens één werksoort (midden/hoog): {met} van {len(orgs)}\n\n")
        for s, d in dekking.items():
            fh.write(f"{s}: {d}\n")
    print(f"{len(aanbod)} aanbodregels, {len(vest)} adreskandidaten, {len(koppen)} koppen. Dekking: {met}/{len(orgs)}")


def geocode():
    pad = ROOT / "data/vestigingen.csv"
    rijen = list(csv.DictReader(open(pad, encoding="utf-8")))
    s = requests.Session()
    n = 0
    for r in rijen:
        if r["lat"] and r["lon"]:
            continue
        if not r["postcode"]:
            continue
        q = f"{r['postcode'].replace(' ', '')} {r['adres'].split()[-1] if r['adres'] else ''}".strip()
        try:
            res = s.get(PDOK_FREE, params={"q": q, "fq": "type:adres", "rows": 1, "fl": "weergavenaam,centroide_ll,provincienaam,woonplaatsnaam"}, timeout=15).json()
        except (requests.RequestException, ValueError):
            continue
        docs = res.get("response", {}).get("docs", [])
        if docs:
            lon, lat = re.findall(r"[\d.]+", docs[0]["centroide_ll"])[:2]
            r["lat"], r["lon"] = f"{float(lat):.5f}", f"{float(lon):.5f}"
            r["provincie"] = r["provincie"] or docs[0].get("provincienaam", "")
            r["plaats"] = r["plaats"] or docs[0].get("woonplaatsnaam", "")
            n += 1
        time.sleep(0.2)
    with open(pad, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rijen[0]))
        w.writeheader()
        w.writerows(rijen)
    open_ = [r["id"] for r in rijen if not (r["lat"] and r["lon"])]
    print(f"{n} vestigingen gegeocodeerd. Zonder coördinaten: {open_}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("actie", choices=["kandidaten", "geocode"])
    ap.add_argument("--crawl", default="~/Developer/wkn-crawl")
    a = ap.parse_args()
    if a.actie == "kandidaten":
        kandidaten(Path(a.crawl).expanduser())
    else:
        geocode()
    sys.exit(0)
