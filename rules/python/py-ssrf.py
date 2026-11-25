import urllib.request
from urllib.parse import urlparse

import httpx
import requests
import urllib3
from flask import Flask, request

app = Flask(__name__)
ALLOWED_HOSTS = {"api.partner.example", "cdn.example.com"}


@app.route("/fetch")
def fetch():
    url = request.args.get("url")
    # ruleid: py-ssrf
    return requests.get(url, timeout=5).text


@app.route("/preview", methods=["POST"])
def preview():
    target = request.form["target"]
    # ruleid: py-ssrf
    with urllib.request.urlopen(target) as resp:
        return resp.read()


@app.route("/webhook-test", methods=["POST"])
def webhook_test():
    hook = request.get_json()["callback"]
    # ruleid: py-ssrf
    httpx.post(hook, json={"ping": True})
    return "ok"


@app.route("/proxy")
def proxy():
    host = request.args["host"]
    # ruleid: py-ssrf
    r = requests.request("GET", f"http://{host}/status")
    return r.text


@app.route("/avatar")
def avatar():
    session = requests.Session()
    url = request.args["src"]
    # ruleid: py-ssrf
    return session.get(url).content


@app.route("/pool")
def pool():
    http = urllib3.PoolManager()
    # ruleid: py-ssrf
    return http.request("GET", request.args["u"]).data


def django_view(req):
    # ruleid: py-ssrf
    data = requests.get(req.GET["feed"]).json()
    return data


# --- safe ---------------------------------------------------------------------------------


@app.route("/user")
def user():
    name = request.args["name"]
    # ok: py-ssrf
    return requests.get("https://api.github.com/users/" + name).text


@app.route("/repo")
def repo():
    repo = request.args["repo"]
    # ok: py-ssrf
    return requests.get(f"https://api.github.com/repos/{repo}").text


@app.route("/item")
def item():
    item_id = int(request.args["id"])
    # ok: py-ssrf
    return requests.get("https://shop.example/items/%d" % item_id).text


@app.route("/allowlisted")
def allowlisted():
    url = request.args["url"]
    if urlparse(url).hostname not in ALLOWED_HOSTS:
        return "forbidden", 403
    # ok: py-ssrf
    return requests.get(url).text


@app.route("/type-checked")
def type_checked():
    url = request.args["url"]
    if not isinstance(url, str):
        return "bad", 400
    # ruleid: py-ssrf
    return requests.get(url).text


def is_allowed_url(url):
    return urlparse(url).hostname in ALLOWED_HOSTS


@app.route("/validated")
def validated():
    url = request.args["url"]
    if not is_allowed_url(url):
        return "forbidden", 403
    # ok: py-ssrf
    return requests.get(url).text


@app.route("/constant")
def constant():
    # ok: py-ssrf
    return requests.get("https://status.example.com/health").text


@app.route("/json-body")
def json_body():
    payload = request.get_json()
    # ok: py-ssrf
    return requests.post("https://api.example.com/v1/events", json=payload).text
