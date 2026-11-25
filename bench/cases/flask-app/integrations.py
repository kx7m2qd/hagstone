import re
from urllib.parse import urlparse

import requests
from flask import Blueprint, abort, jsonify, request

integrations = Blueprint("integrations", __name__)

PARTNER_HOSTS = {"hooks.partner.example", "api.partner.example"}
CATALOG = ["Blue Mug", "Red Mug", "Green Teapot", "Coffee Grinder"]


@integrations.post("/webhooks/test")
def test_webhook():
    """Send a sample event to the URL the merchant configured, so they can check their endpoint."""
    url = request.json["url"]
    # expect: py-ssrf
    resp = requests.post(url, json={"event": "ping"}, timeout=5)
    return jsonify(status=resp.status_code)


@integrations.post("/webhooks/test-safe")
def test_webhook_safe():
    url = request.json["url"]
    if urlparse(url).hostname not in PARTNER_HOSTS:
        abort(400)
    resp = requests.post(url, json={"event": "ping"}, timeout=5)
    return jsonify(status=resp.status_code)


@integrations.get("/link-preview")
def link_preview():
    target = request.args["url"]
    session = requests.Session()
    # expect: py-ssrf
    html = session.get(target, timeout=3).text
    title = re.search(r"<title>(.*?)</title>", html)
    return jsonify(title=title.group(1) if title else None)


@integrations.get("/github/<user>")
def github_profile(user):
    # Fixed host; only the path comes from the request.
    return requests.get(f"https://api.github.com/users/{user}", timeout=5).json()


@integrations.get("/catalog/search")
def catalog_search():
    q = request.args.get("q", "")
    # expect: py-regex-injection
    matcher = re.compile(q, re.IGNORECASE)
    return jsonify([name for name in CATALOG if matcher.search(name)])


@integrations.get("/catalog/search-safe")
def catalog_search_safe():
    q = request.args.get("q", "")
    matcher = re.compile(re.escape(q), re.IGNORECASE)
    return jsonify([name for name in CATALOG if matcher.search(name)])
