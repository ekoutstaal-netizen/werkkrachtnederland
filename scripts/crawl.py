#!/usr/bin/env python3
"""Crawl de openbare websites van de werkontwikkelbedrijven uit data/organisaties.csv.

Per organisatie: robots.txt respecteren, homepage + sitemap lezen, de meest relevante
subpagina's (diensten, werkgevers, producten, contact) ophalen en de leesbare tekst
opslaan als JSONL buiten de repo (auteursrecht: ruwe tekst hoort niet in een publieke repo).

Gebruik:
  python3 scripts/crawl.py --uit ~/Developer/wkn-crawl [--max 20] [--alleen slug1,slug2]
"""
import argparse, csv, json, re, sys, time
from pathlib import Path
from urllib.parse import urljoin, urlparse, urldefrag
from urllib import robotparser

import requests
from bs4 import BeautifulSoup

UA = "WerkKrachtNederland-inventarisatie/1.0 (+https://werkkrachtnederland.nl; info@werkkrachtnederland.nl)"
PAUZE = 1.0
TIMEOUT = 15

RELEVANT = [
    ("dienst", 10), ("werkgever", 9), ("opdrachtgever", 9), ("bedrijven", 7), ("zakelijk", 7),
    ("uitbested", 9), ("product", 6), ("activiteit", 6), ("wat-we-doen", 8), ("wat-wij-doen", 8),
    ("werksoort", 9), ("vakgebied", 6), ("services", 6), ("aanbod", 7), ("montage", 8),
    ("assemblage", 8), ("verpak", 8), ("logistiek", 8), ("groen", 7), ("schoonmaak", 7),
    ("catering", 7), ("metaal", 7), ("hout", 6), ("wasserij", 7), ("recycl", 6), ("fulfil", 7),
    ("contact", 5), ("vestiging", 6), ("locatie", 5), ("over-ons", 3),
]
UITSLUITEN = re.compile(r"(nieuws|news|blog|agenda|vacature|vacancies|login|inloggen|privacy|cookie|"
                        r"cao|jaarverslag|klachten|\.pdf$|\.jpg$|\.png$|\.docx?$|\.zip$|mailto:|tel:|/tag/|/page/\d)", re.I)


def host(url: str) -> str:
    return (urlparse(url).hostname or "").replace("www.", "")


def score(url: str) -> int:
    u = url.lower()
    return sum(p for k, p in RELEVANT if k in u)


def leesbare_tekst(html: str):
    soup = BeautifulSoup(html, "html.parser")
    titel = (soup.title.string or "").strip() if soup.title else ""
    koppen = [h.get_text(" ", strip=True) for h in soup.find_all(["h1", "h2", "h3"])][:40]
    for t in soup(["script", "style", "noscript", "svg", "form", "iframe"]):
        t.decompose()
    for t in soup.find_all(["nav", "footer"]):
        t.decompose()
    tekst = re.sub(r"\s+", " ", soup.get_text(" ", strip=True))
    return titel, koppen, tekst[:60000], soup


def sitemap_urls(sessie, basis, rp):
    kandidaten = list(rp.site_maps() or []) or [urljoin(basis, "/sitemap.xml"), urljoin(basis, "/sitemap_index.xml")]
    urls, gezien = [], set()
    while kandidaten and len(gezien) < 6:
        sm = kandidaten.pop(0)
        if sm in gezien:
            continue
        gezien.add(sm)
        try:
            r = sessie.get(sm, timeout=TIMEOUT)
            time.sleep(PAUZE)
            if r.status_code != 200:
                continue
            locs = re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", r.text)
            for loc in locs:
                (kandidaten if loc.endswith(".xml") else urls).append(loc)
        except requests.RequestException:
            continue
    return urls


def crawl_org(sessie, org, uitdir, maxpag):
    start = org["website"].rstrip("/") + "/"
    p = urlparse(start)
    domein = host(start)
    padprefix = p.path if org["crawl_modus"] == "pad" else "/"
    log = {"slug": org["slug"], "start": start, "paginas": 0, "fouten": []}

    rp = robotparser.RobotFileParser()
    try:
        r = sessie.get(f"{p.scheme}://{p.netloc}/robots.txt", timeout=TIMEOUT)
        rp.parse(r.text.splitlines() if r.status_code == 200 else [])
    except requests.RequestException:
        rp.parse([])

    def mag(url):
        q = urlparse(url)
        return (host(url) == domein and q.path.startswith(padprefix)
                and not UITSLUITEN.search(url) and rp.can_fetch(UA, url))

    wachtrij = {start: 100}
    for u in sitemap_urls(sessie, start, rp):
        if mag(u):
            wachtrij.setdefault(u, score(u))
    bezocht, uitvoer = set(), []

    while wachtrij and len(uitvoer) < maxpag:
        url = max(wachtrij, key=wachtrij.get)
        wachtrij.pop(url)
        if url in bezocht:
            continue
        bezocht.add(url)
        try:
            r = sessie.get(url, timeout=TIMEOUT, allow_redirects=True)
            time.sleep(PAUZE)
        except requests.RequestException as e:
            log["fouten"].append(f"{url}: {type(e).__name__}")
            continue
        if r.status_code != 200 or "text/html" not in r.headers.get("content-type", ""):
            continue
        if host(r.url) != domein:
            log["fouten"].append(f"redirect buiten domein: {r.url}")
            if url == start:
                log["startredirect"] = r.url
            continue
        titel, koppen, tekst, soup = leesbare_tekst(r.text)
        uitvoer.append({"url": r.url, "titel": titel, "koppen": koppen, "tekst": tekst})
        for a in soup.find_all("a", href=True):
            link = urldefrag(urljoin(r.url, a["href"]))[0]
            if link not in bezocht and mag(link):
                s = score(link) + score(a.get_text(" ", strip=True).lower().replace(" ", "-"))
                wachtrij[link] = max(wachtrij.get(link, 0), s)

    with open(uitdir / f"{org['slug']}.jsonl", "w", encoding="utf-8") as f:
        for rij in uitvoer:
            f.write(json.dumps(rij, ensure_ascii=False) + "\n")
    log["paginas"] = len(uitvoer)
    return log


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--uit", required=True)
    ap.add_argument("--max", type=int, default=20)
    ap.add_argument("--alleen", default="")
    a = ap.parse_args()
    uitdir = Path(a.uit).expanduser() / "paginas"
    uitdir.mkdir(parents=True, exist_ok=True)
    orgs = list(csv.DictReader(open(Path(__file__).parent.parent / "data/organisaties.csv", encoding="utf-8")))
    alleen = set(filter(None, a.alleen.split(",")))
    sessie = requests.Session()
    sessie.headers.update({"User-Agent": UA, "Accept-Language": "nl-NL,nl;q=0.9"})
    logs = []
    for i, org in enumerate(orgs, 1):
        if alleen and org["slug"] not in alleen:
            continue
        if org["crawl_modus"] == "overslaan":
            logs.append({"slug": org["slug"], "overgeslagen": "algemene gemeentesite"})
            continue
        print(f"[{i}/{len(orgs)}] {org['naam']} ...", flush=True)
        try:
            logs.append(crawl_org(sessie, org, uitdir, a.max))
        except Exception as e:  # één kapotte site mag de run niet stoppen
            logs.append({"slug": org["slug"], "fouten": [repr(e)], "paginas": 0})
        print(f"    {logs[-1].get('paginas', 0)} pagina's", flush=True)
    json.dump(logs, open(Path(a.uit).expanduser() / "crawl-log.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    leeg = [l["slug"] for l in logs if not l.get("overgeslagen") and not l.get("paginas")]
    print(f"\nKlaar. Zonder resultaat: {len(leeg)} {leeg}")


if __name__ == "__main__":
    sys.exit(main())
