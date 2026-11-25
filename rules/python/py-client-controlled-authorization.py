from flask import Flask, abort, request
from flask_login import current_user

app = Flask(__name__)


@app.get("/admin/users")
def admin_users():
    # ruleid: py-client-controlled-authorization
    if request.args.get("role") == "admin":
        return {"users": []}
    abort(403)


@app.post("/admin/purge")
def purge():
    is_admin = request.cookies.get("is_admin")
    # ruleid: py-client-controlled-authorization
    if not is_admin:
        abort(403)
    return "purged"


def django_view(request):
    # ruleid: py-client-controlled-authorization
    if request.headers.get("X-User-Role") in ("admin", "staff"):
        return {"secret": 1}


# --- safe ---------------------------------------------------------------------------------


@app.get("/admin/report")
def report():
    # ok: py-client-controlled-authorization
    if current_user.role == "admin":
        return {}
    abort(403)


@app.post("/users")
def create_user():
    # ok: py-client-controlled-authorization
    user = {"name": request.form["name"], "role": request.form.get("role", "viewer")}
    return user
