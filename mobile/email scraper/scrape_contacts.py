#!/usr/bin/env python3
""":)
scrape_contacts.py - find emails likely to answer simple info requests
(e.g. "what are your business hours?") from a table of websites.

Input : CSV with a column of website URLs (header containing "url", "website",
        or "site"; otherwise the first column is used).
Output: CSV with every email found per site, ranked best-first.

Usage:
    pip install requests beautifulsoup4
    python scrape_contacts.py sites.csv -o contacts.csv
    python scrape_contacts.py sites.csv --workers 4 --delay 2 --max-pages 4

Behavior:
  * Respects robots.txt and rate-limits requests per site.
  * Checks the homepage plus up to N pages that look like contact/about/hours/
    location pages.
  * Finds emails in mailto: links, visible text, "name [at] domain [dot] com"
    obfuscation, and Cloudflare-protected addresses.
  * Ranks role-based inboxes (info@, contact@, office@, frontdesk@ ...) above
    personal addresses, and drops noreply-style addresses.
"""
import argparse
import csv
import json
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib import robotparser
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

try:  # optional: load SUPABASE_URL / SUPABASE_KEY from a .env file if python-dotenv is installed
    from pathlib import Path
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent / ".env")  # next to the script
    load_dotenv(Path.cwd() / ".env")                       # or the folder you ran it from
    HAVE_DOTENV = True
except ImportError:
    HAVE_DOTENV = False

USER_AGENT = "ContactInfoFinder/1.0 (looking for public contact addresses; polite crawler)"

EMAIL_RE = re.compile(
    r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(?:\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,}"
)
BAD_TLDS = {"png", "jpg", "jpeg", "gif", "svg", "webp", "css", "js", "ico", "woff", "woff2"}

# Higher = more likely a human reads it and answers simple questions.
ROLE_SCORES = {
    "hours": 10, "info": 10, "contact": 10, "contactus": 10,
    "hello": 9, "office": 9, "reception": 9, "frontdesk": 9, "front.desk": 9,
    "inquiries": 9, "enquiries": 9, "inquiry": 9, "enquiry": 9,
    "customerservice": 8, "customer.service": 8, "customercare": 8, "cs": 8,
    "support": 7, "help": 7, "service": 7, "questions": 8,
    "booking": 6, "bookings": 6, "reservations": 6, "appointments": 6,
    "admin": 6, "general": 6, "team": 6, "mail": 5, "sales": 5,
}
EXCLUDE_PREFIXES = ("noreply", "no-reply", "no_reply", "donotreply", "do-not-reply",
                    "mailer-daemon", "bounce", "unsubscribe")
LOW_PREFIXES = ("privacy", "legal", "press", "media", "careers", "jobs", "hr",
                "abuse", "postmaster", "webmaster", "security", "billing", "invoices")
PERSONAL_SCORE = 3

# link keywords -> priority (lower = visited first)
LINK_KEYWORDS = [
    ("contact", 0), ("hours", 1), ("location", 2), ("visit", 3),
    ("find-us", 3), ("about", 4), ("support", 5), ("help", 6), ("faq", 7),
]


def normalize_url(raw):
    raw = (raw or "").strip()
    if not raw:
        return None
    if not re.match(r"^https?://", raw, re.I):
        raw = "https://" + raw
    return raw


def read_sites(path, column=None):
    with open(path, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.reader(f))
    if not rows:
        return []
    header = rows[0]
    idx = None
    if column is not None:
        idx = header.index(column)
        data = rows[1:]
    else:
        for i, h in enumerate(header):
            if any(k in h.lower() for k in ("url", "website", "site")):
                idx = i
                break
        if idx is None:
            # no recognizable header: treat first row as data if it looks like a URL
            idx = 0
            data = rows if "." in header[0] else rows[1:]
        else:
            data = rows[1:]
    sites = []
    for r in data:
        if len(r) > idx:
            u = normalize_url(r[idx])
            if u:
                sites.append(u)
    # de-dupe, keep order
    return list(dict.fromkeys(sites))


class Fetcher:
    """Polite fetcher: robots.txt aware, per-host delay."""

    def __init__(self, delay, timeout):
        self.delay = delay
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers["User-Agent"] = USER_AGENT
        self.robots = {}
        self.last_hit = {}

    def _allowed(self, url):
        p = urlparse(url)
        base = f"{p.scheme}://{p.netloc}"
        if base not in self.robots:
            rp = robotparser.RobotFileParser()
            try:
                resp = self.session.get(base + "/robots.txt", timeout=self.timeout)
                if resp.status_code == 200:
                    rp.parse(resp.text.splitlines())
                else:
                    rp.parse([])  # no robots.txt -> allowed
            except requests.RequestException:
                rp.parse([])
            self.robots[base] = rp
        return self.robots[base].can_fetch(USER_AGENT, url)

    def get(self, url):
        """Return (html, final_url) or (None, reason)."""
        if not self._allowed(url):
            return None, "blocked by robots.txt"
        host = urlparse(url).netloc
        wait = self.delay - (time.time() - self.last_hit.get(host, 0))
        if wait > 0:
            time.sleep(wait)
        try:
            resp = self.session.get(url, timeout=self.timeout)
            self.last_hit[host] = time.time()
        except requests.RequestException as e:
            return None, f"request failed: {type(e).__name__}"
        if resp.status_code != 200:
            return None, f"HTTP {resp.status_code}"
        if "html" not in resp.headers.get("Content-Type", "").lower():
            return None, "not HTML"
        return resp.text, resp.url


def decode_cfemail(hexstr):
    try:
        key = int(hexstr[:2], 16)
        return "".join(chr(int(hexstr[i:i + 2], 16) ^ key) for i in range(2, len(hexstr), 2))
    except ValueError:
        return None


def deobfuscate(text):
    text = re.sub(r"\s*[\[\(\{]\s*at\s*[\]\)\}]\s*", "@", text, flags=re.I)
    text = re.sub(r"\s*[\[\(\{]\s*dot\s*[\]\)\}]\s*", ".", text, flags=re.I)
    text = re.sub(r"\s+at\s+(?=[\w\-]+\s+dot\s+)", "@", text, flags=re.I)
    text = re.sub(r"(?<=[\w\-])\s+dot\s+(?=[\w\-]+)", ".", text, flags=re.I)
    return text


def extract_emails(html):
    """Return dict {email: via_mailto(bool)}."""
    soup = BeautifulSoup(html, "html.parser")
    found = {}

    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href.lower().startswith("mailto:"):
            addr = href[7:].split("?")[0].strip()
            for m in EMAIL_RE.findall(addr):
                found[m.lower()] = True
        elif "/cdn-cgi/l/email-protection#" in href:
            dec = decode_cfemail(href.split("#", 1)[1])
            if dec and EMAIL_RE.fullmatch(dec):
                found[dec.lower()] = True
    for el in soup.find_all(attrs={"data-cfemail": True}):
        dec = decode_cfemail(el["data-cfemail"])
        if dec and EMAIL_RE.fullmatch(dec):
            found[dec.lower()] = True

    for s in soup(["script", "style"]):
        s.decompose()
    text = deobfuscate(soup.get_text(" ", strip=True))
    for m in EMAIL_RE.findall(text):
        found.setdefault(m.lower(), False)

    return {
        e: v for e, v in found.items()
        if e.rsplit(".", 1)[-1] not in BAD_TLDS and not e.startswith(EXCLUDE_PREFIXES)
        and "example." not in e and "sentry" not in e and "wixpress" not in e
    }


def candidate_links(html, base_url, max_pages):
    soup = BeautifulSoup(html, "html.parser")
    host = urlparse(base_url).netloc.removeprefix("www.")
    scored = {}
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if href.startswith(("mailto:", "tel:", "javascript:", "#")):
            continue
        url = urljoin(base_url, href).split("#")[0]
        p = urlparse(url)
        if p.netloc.removeprefix("www.") != host or p.scheme not in ("http", "https"):
            continue
        hay = (a.get_text(" ", strip=True) + " " + p.path).lower()
        for kw, pri in LINK_KEYWORDS:
            if kw in hay:
                if url not in scored or pri < scored[url]:
                    scored[url] = pri
                break
    ordered = sorted(scored.items(), key=lambda kv: kv[1])
    return [u for u, _ in ordered if u.rstrip("/") != base_url.rstrip("/")][:max_pages]


GENERIC_TITLE_PARTS = {
    "home", "homepage", "welcome", "contact", "contact us", "about", "about us",
    "official site", "official website", "main", "index",
}
ORG_TYPE_HINTS = ("Organization", "Business", "Store", "Restaurant", "School", "Library",
                  "Hospital", "Clinic", "Dentist", "Physician", "Hotel", "Gym", "Church",
                  "Museum", "University", "College", "Corporation", "NGO")
NOT_NAME_WORDS = {"email", "contact", "us", "info", "support", "team", "send", "mail",
                  "click", "here", "write", "to", "our", "staff", "office"}


def _domain_label(host):
    return re.sub(r"[^a-z0-9]", "", host.removeprefix("www.").split(".")[0].lower())


def org_name(html, host):
    """Best guess at the organization's name: JSON-LD -> og:site_name -> <title> -> domain."""
    soup = BeautifulSoup(html, "html.parser")

    for s in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(s.string or s.get_text() or "")
        except ValueError:
            continue
        if isinstance(data, dict):
            items = data.get("@graph", [data])
        elif isinstance(data, list):
            items = data
        else:
            continue
        for it in items:
            if not isinstance(it, dict) or not isinstance(it.get("name"), str):
                continue
            types = it.get("@type")
            types = types if isinstance(types, list) else [types]
            if any(isinstance(t, str) and any(h in t for h in ORG_TYPE_HINTS) for t in types):
                name = it["name"].strip()
                if name:
                    return name

    og = soup.find("meta", property="og:site_name")
    if og and og.get("content", "").strip():
        return og["content"].strip()

    if soup.title and soup.title.string:
        parts = [p.strip() for p in re.split(r"\s*[|–—•·]\s*|\s+-\s+|\s*:\s*", soup.title.string) if p.strip()]
        parts = [p for p in parts if p.lower() not in GENERIC_TITLE_PARTS]
        label = _domain_label(host)
        for p in parts:
            norm = re.sub(r"[^a-z0-9]", "", p.lower())
            if len(label) >= 3 and (label in norm or (len(norm) >= 3 and norm in label)):
                return p
        if parts:
            return parts[0]

    return host.removeprefix("www.").split(".")[0].replace("-", " ").title()


def looks_like_name(text):
    words = text.split()
    if not 2 <= len(words) <= 4:
        return False
    if any(w.lower().strip(".,") in NOT_NAME_WORDS for w in words):
        return False
    return all(re.fullmatch(r"[A-Z][A-Za-z'’\-\.]+", w) for w in words)


def extract_link_names(html):
    """{email: person name} from mailto: links whose visible text is a person's name."""
    soup = BeautifulSoup(html, "html.parser")
    names = {}
    for a in soup.find_all("a", href=True):
        if not a["href"].lower().startswith("mailto:"):
            continue
        m = EMAIL_RE.search(a["href"][7:].split("?")[0])
        text = a.get_text(" ", strip=True)
        if m and looks_like_name(text):
            names[m.group(0).lower()] = text
    return names


def name_from_local(local):
    """jane.doe@ / jane_doe@ / jane-doe@ -> 'Jane Doe'. Needs 2-3 alphabetic parts."""
    parts = [p for p in re.split(r"[._\-]+", local) if p]
    if not 2 <= len(parts) <= 3:
        return None
    if not all(p.isalpha() and len(p) >= 2 for p in parts):
        return None
    if any(p.lower() in ROLE_SCORES or p.lower().startswith(LOW_PREFIXES) for p in parts):
        return None
    return " ".join(p.capitalize() for p in parts)


def upload_to_supabase(rows, url, key, table="contacts"):
    """Insert rows [{name, email}] into Supabase, skipping emails already in the table.
    Sends name, email, active=true; created_at is left to the column default."""
    base = url.rstrip("/") + f"/rest/v1/{table}"
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}

    emails = list(dict.fromkeys(r["email"] for r in rows))
    existing = set()
    for i in range(0, len(emails), 50):
        chunk = emails[i:i + 50]
        in_list = ",".join('"' + e.replace('"', "") + '"' for e in chunk)
        resp = requests.get(base, headers=headers, timeout=30,
                            params={"select": "email", "email": f"in.({in_list})"})
        if resp.status_code != 200:
            raise RuntimeError(f"Supabase lookup failed ({resp.status_code}): {resp.text[:300]}")
        existing.update(r["email"].lower() for r in resp.json())

    seen, payload = set(), []
    for r in rows:
        e = r["email"].lower()
        if e in existing or e in seen:
            continue
        seen.add(e)
        payload.append({"name": r["name"], "email": e, "active": True})

    for i in range(0, len(payload), 100):
        resp = requests.post(base, headers={**headers, "Prefer": "return=minimal"},
                             data=json.dumps(payload[i:i + 100]), timeout=30)
        if resp.status_code not in (200, 201, 204):
            raise RuntimeError(f"Supabase insert failed ({resp.status_code}): {resp.text[:300]}")
    return len(payload), len(emails) - len(payload)


def score_email(email, site_host, via_mailto):
    local, domain = email.split("@", 1)
    base = re.sub(r"[^a-z.]", "", local.lower())
    if local.lower() in ROLE_SCORES:
        score, kind = ROLE_SCORES[local.lower()], "role"
    elif base in ROLE_SCORES:
        score, kind = ROLE_SCORES[base], "role"
    elif local.lower().startswith(LOW_PREFIXES):
        score, kind = 1, "department"
    else:
        score, kind = PERSONAL_SCORE, "personal"
    d = domain.removeprefix("www.")
    if d == site_host or d.endswith("." + site_host) or site_host.endswith("." + d):
        score += 2
    elif d in ("gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "aol.com", "icloud.com"):
        score += 1  # small businesses often use these legitimately
    else:
        score -= 2  # third-party domain (web agency, platform, etc.)
    if via_mailto:
        score += 1
    return score, kind


def scrape_site(url, args):
    fetcher = Fetcher(args.delay, args.timeout)
    site_host = urlparse(url).netloc.removeprefix("www.")
    results = {}  # email -> dict
    notes = []

    html, final = fetcher.get(url)
    if html is None:
        # retry once over http for sites with broken TLS
        if url.startswith("https://"):
            html, final = fetcher.get("http://" + url[len("https://"):])
        if html is None:
            return url, None, [], [final]
    pages = [(final, html)]
    for link in candidate_links(html, final, args.max_pages):
        h, f = fetcher.get(link)
        if h is None:
            notes.append(f"{link}: {f}")
        else:
            pages.append((f, h))

    org = org_name(pages[0][1], site_host)
    link_names = {}
    for _, page_html in pages:
        link_names.update(extract_link_names(page_html))

    for page_url, page_html in pages:
        for email, via_mailto in extract_emails(page_html).items():
            score, kind = score_email(email, site_host, via_mailto)
            prev = results.get(email)
            if prev is None or score > prev["score"]:
                person = None
                if kind == "personal":
                    person = link_names.get(email) or name_from_local(email.split("@", 1)[0])
                results[email] = {"email": email, "score": score, "kind": kind,
                                  "source_page": page_url, "person": person or ""}
    ranked = sorted(results.values(), key=lambda r: -r["score"])
    return url, org, ranked, notes


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("input_csv")
    ap.add_argument("-o", "--output", default="contacts.csv")
    ap.add_argument("--column", help="name of the CSV column holding URLs")
    ap.add_argument("--max-pages", type=int, default=4, help="extra pages to check per site")
    ap.add_argument("--delay", type=float, default=1.5, help="seconds between requests to one site")
    ap.add_argument("--timeout", type=float, default=15)
    ap.add_argument("--workers", type=int, default=4, help="sites processed in parallel")
    ap.add_argument("--top", type=int, default=0, help="keep only the top N emails per site (0 = all)")
    ap.add_argument("--upload", action="store_true",
                    help="insert results into Supabase (needs SUPABASE_URL and SUPABASE_KEY env vars)")
    ap.add_argument("--table", default="contacts", help="Supabase table name (default: contacts)")
    args = ap.parse_args()

    def first_env(*names):
        return next((os.environ[n].strip() for n in names if os.environ.get(n, "").strip()), None)

    sb_url = first_env("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "VITE_SUPABASE_URL",
                       "EXPO_PUBLIC_SUPABASE_URL", "PUBLIC_SUPABASE_URL")
    sb_key = first_env("SUPABASE_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY",
                       "SUPABASE_SECRET_KEY")
    if args.upload and not (sb_url and sb_key):  # fail fast, before the slow scraping
        found = sorted(k for k in os.environ if "SUPABASE" in k.upper())
        msg = ["--upload needs a Supabase URL and a secret/service-role key."]
        msg.append(f"  URL found: {'yes' if sb_url else 'NO (use SUPABASE_URL)'}")
        msg.append(f"  Key found: {'yes' if sb_key else 'NO (use SUPABASE_KEY or SUPABASE_SERVICE_ROLE_KEY)'}")
        msg.append(f"  Supabase-related variable names that ARE set: {found or 'none'}")
        if HAVE_DOTENV:
            msg.append(f"  Looked for .env in: {Path(__file__).resolve().parent} and {os.getcwd()}")
        else:
            msg.append("  python-dotenv is not installed, so .env was not read. Run: pip install python-dotenv")
        sys.exit("\n".join(msg))

    sites = read_sites(args.input_csv, args.column)
    if not sites:
        sys.exit("No URLs found in input.")
    print(f"Scraping {len(sites)} sites...", file=sys.stderr)

    out_rows = []
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(scrape_site, u, args): u for u in sites}
        for i, fut in enumerate(as_completed(futures), 1):
            url = futures[fut]
            try:
                _, org, ranked, notes = fut.result()
            except Exception as e:  # keep going on unexpected errors
                org, ranked, notes = None, [], [f"error: {type(e).__name__}: {e}"]
            if args.top:
                ranked = ranked[:args.top]
            if ranked:
                for rank, r in enumerate(ranked, 1):
                    out_rows.append({"site": url, "organization": org or "", "rank": rank,
                                     "email": r["email"], "person_name": r["person"],
                                     # what goes in the Supabase "name" column:
                                     # the person if we found one, else the organization
                                     "name": r["person"] or org or "",
                                     "score": r["score"], "kind": r["kind"],
                                     "source_page": r["source_page"], "notes": ""})
            else:
                out_rows.append({"site": url, "organization": org or "", "rank": "", "email": "",
                                 "person_name": "", "name": "", "score": "", "kind": "",
                                 "source_page": "",
                                 "notes": "; ".join(notes) or "no emails found"})
            print(f"[{i}/{len(sites)}] {url}: {len(ranked)} email(s)", file=sys.stderr)

    order = {u: i for i, u in enumerate(sites)}
    out_rows.sort(key=lambda r: (order[r["site"]], r["rank"] if r["rank"] != "" else 0))
    with open(args.output, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["site", "organization", "rank", "email", "person_name",
                                          "name", "score", "kind", "source_page", "notes"])
        w.writeheader()
        w.writerows(out_rows)
    print(f"Wrote {args.output}", file=sys.stderr)

    if args.upload:
        to_upload = [r for r in out_rows if r["email"]]
        added, skipped = upload_to_supabase(to_upload, sb_url, sb_key, args.table)
        print(f"Supabase: added {added}, skipped {skipped} already in '{args.table}'", file=sys.stderr)


if __name__ == "__main__":
    main()
