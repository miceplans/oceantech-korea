"""Check that the Astro build contains every saved page and local asset link."""

from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import re


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "src" / "legacy"
DIST = ROOT / "dist"


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []
        self.bad_asset_types = []
        self.redirects = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == "meta" and attributes.get("http-equiv", "").lower() == "refresh":
            destination = attributes.get("content", "").partition("url=")[2]
            if destination:
                self.redirects.append(destination)
        if tag == "link" and attributes.get("rel") == "stylesheet":
            if not urlsplit(attributes.get("href", "")).path.endswith(".css"):
                self.bad_asset_types.append(attributes.get("href", ""))
        if tag == "script" and attributes.get("src"):
            if not urlsplit(attributes["src"]).path.endswith(".js"):
                self.bad_asset_types.append(attributes["src"])
        for name in ("src", "href", "poster"):
            if attributes.get(name):
                self.urls.append(attributes[name])
        if attributes.get("srcset"):
            self.urls.extend(
                item.strip().split(" ", 1)[0]
                for item in attributes["srcset"].split(",")
            )


source_pages = {page.relative_to(SOURCE) for page in SOURCE.rglob("*.html")}
built_pages = {page.relative_to(DIST) for page in DIST.rglob("*.html")}
missing_pages = source_pages - built_pages
extra_pages = built_pages - source_pages
missing_links = Counter()
bad_asset_types = Counter()

for page in DIST.rglob("*.html"):
    parser = Links()
    parser.feed(page.read_text(encoding="utf-8"))
    bad_asset_types.update(parser.bad_asset_types)
    for url in parser.urls + parser.redirects:
        if url.startswith(("#", "//", "data:", "mailto:", "tel:", "javascript:")):
            continue
        parsed = urlsplit(url)
        if parsed.scheme or parsed.netloc or not parsed.path:
            continue
        pathname = unquote(parsed.path)
        target = (DIST / pathname.lstrip("/")) if pathname.startswith("/") else (page.parent / pathname)
        target = target.resolve()
        if target.is_relative_to(DIST) and not target.is_file() and not (target / "index.html").is_file():
            missing_links[pathname] += 1

for stylesheet in DIST.rglob("*.css"):
    for raw_url in re.findall(r"url\(\s*['\"]?([^'\")]+)", stylesheet.read_text(errors="replace")):
        parsed = urlsplit(raw_url.strip())
        if parsed.scheme or parsed.netloc or raw_url.startswith(("#", "//", "data:")):
            continue
        pathname = unquote(parsed.path)
        target = (DIST / pathname.lstrip("/")) if pathname.startswith("/") else (stylesheet.parent / pathname)
        target = target.resolve()
        if target.is_relative_to(DIST) and not target.is_file():
            missing_links[pathname] += 1

print(f"Source pages: {len(source_pages)}; Astro pages: {len(built_pages)}")
for label, failures in (("Missing pages", missing_pages), ("Extra pages", extra_pages)):
    if failures:
        print(f"{label}: {sorted(map(str, failures))[:20]}")
if missing_links:
    print(f"Missing local links: {missing_links.most_common(20)}")
if bad_asset_types:
    print(f"Invalid CSS/JS paths: {bad_asset_types.most_common(20)}")
if missing_pages or extra_pages or missing_links or bad_asset_types:
    raise SystemExit(1)
print("All saved pages and local links are present.")
