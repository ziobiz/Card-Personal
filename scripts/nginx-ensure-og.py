#!/usr/bin/env python3
"""Ensure nginx site has /og/ proxy and SPA HTML OG injection without wiping SSL blocks."""
from __future__ import annotations

import re
import sys
from pathlib import Path

OG_LOCATION = """
    location /og/ {
        add_header Cache-Control "public, max-age=3600" always;
        proxy_pass http://127.0.0.1:3001/og/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
""".strip(
    "\n"
)

SPA_NAMED = """
    location @spa_html {
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;
        add_header Pragma "no-cache" always;
        add_header CDN-Cache-Control "no-store" always;
        # Named locations cannot use URI in proxy_pass — rewrite then proxy.
        rewrite ^ /api/public/spa break;
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Original-URI $request_uri;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
""".strip(
    "\n"
)

INDEX_PROXY = """
    location = /index.html {
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;
        add_header Pragma "no-cache" always;
        add_header CDN-Cache-Control "no-store" always;
        proxy_pass http://127.0.0.1:3001/api/public/spa;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Original-URI $request_uri;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
""".strip(
    "\n"
)


def patch_server(srv: str) -> str:
    if "api.icocard" in srv and "root " not in srv:
        return srv

    # Fix invalid named-location proxy_pass with URI (nginx emerg)
    if "location @spa_html" in srv and "rewrite ^ /api/public/spa break;" not in srv:
        srv = re.sub(
            r"location\s+@spa_html\s*\{.*?\}",
            SPA_NAMED,
            srv,
            count=1,
            flags=re.S,
        )

    srv = re.sub(
        r"try_files\s+\$uri\s+\$uri/\s+/index\.html\s*;",
        "try_files $uri $uri/ @spa_html;",
        srv,
    )
    # normalize other named spa locations already pointing at index fallback
    srv = re.sub(
        r"try_files\s+\$uri\s+\$uri/\s+@spa_html_\w+\s*;",
        "try_files $uri $uri/ @spa_html;",
        srv,
    )

    if "root " in srv and "location /og/" not in srv and "location /api/" in srv:
        srv = srv.replace("location /api/ {", OG_LOCATION + "\n    location /api/ {", 1)

    if "@spa_html" in srv and "location @spa_html" not in srv and "location /api/" in srv:
        srv = srv.replace("location /api/ {", SPA_NAMED + "\n    location /api/ {", 1)

    if "root " in srv:
        if "location = /index.html" in srv:
            _head, rest = srv.split("location = /index.html", 1)
            if "api/public/spa" not in rest[:900]:
                srv = re.sub(
                    r"location\s+=\s+/index\.html\s*\{.*?\n\s*\}",
                    INDEX_PROXY,
                    srv,
                    count=1,
                    flags=re.S,
                )
        elif "@spa_html" in srv and "location /api/" in srv and "location = /index.html" not in srv:
            srv = srv.replace("location /api/ {", INDEX_PROXY + "\n    location /api/ {", 1)

    return srv


def patch(text: str) -> str:
    parts = re.split(r"(?=server\s*\{)", text)
    return "".join(patch_server(p) for p in parts)


def main() -> int:
    path = Path(sys.argv[1] if len(sys.argv) > 1 else "/etc/nginx/sites-available/icocard")
    if not path.exists():
        print(f"missing {path}")
        return 1
    original = path.read_text(encoding="utf-8")
    updated = patch(original)
    if updated == original:
        print("nginx OG/SPA already configured")
        return 0
    backup = path.with_suffix(path.suffix + ".bak-og")
    backup.write_text(original, encoding="utf-8")
    path.write_text(updated, encoding="utf-8")
    print(f"patched {path} (backup {backup})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
