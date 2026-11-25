import re

from flask import Flask, request

app = Flask(__name__)
PRODUCTS = ["apple pie", "banana bread"]


@app.route("/search")
def search():
    q = request.args.get("q", "")
    # ruleid: py-regex-injection
    pattern = re.compile(q, re.IGNORECASE)
    return [p for p in PRODUCTS if pattern.search(p)]


@app.route("/filter")
def filter_rows():
    term = request.args["term"]
    # ruleid: py-regex-injection
    return [p for p in PRODUCTS if re.search(".*" + term + ".*", p)]


def django_view(req):
    # ruleid: py-regex-injection
    return re.sub(req.GET["find"], "***", "some text")


# --- safe ---------------------------------------------------------------------------------


@app.route("/search-escaped")
def search_escaped():
    q = request.args.get("q", "")
    # ok: py-regex-injection
    pattern = re.compile(re.escape(q), re.IGNORECASE)
    return [p for p in PRODUCTS if pattern.search(p)]


@app.route("/validate")
def validate():
    email = request.args["email"]
    # ok: py-regex-injection
    return str(bool(re.fullmatch(r"[^@]+@[^@]+\.[a-z]+", email)))


@app.route("/plain")
def plain():
    q = request.args["q"]
    # ok: py-regex-injection
    return [p for p in PRODUCTS if q.lower() in p]
