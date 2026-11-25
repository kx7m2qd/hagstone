from flask import Flask, jsonify
from flask_login import current_user, login_required
from rest_framework import permissions, viewsets
from rest_framework.permissions import AllowAny, IsAdminUser

app = Flask(__name__)


# ruleid: py-admin-route-without-auth
@app.post("/admin/users/<int:uid>/delete")
def delete_user(uid):
    User.query.filter_by(id=uid).delete()
    return "", 204


# ruleid: py-admin-route-without-auth
@app.route("/internal/config")
def config():
    return jsonify(dict(app.config))


class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.all()
    # ruleid: py-admin-route-without-auth
    permission_classes = [AllowAny]


# --- safe ---------------------------------------------------------------------------------


# ok: py-admin-route-without-auth
@app.get("/admin/stats")
@login_required
def stats():
    return jsonify({})


# ok: py-admin-route-without-auth
@app.get("/admin/report")
def report():
    if not current_user.is_authenticated:
        return "", 401
    return jsonify({})


# ok: py-admin-route-without-auth
@app.get("/products")
def products():
    return jsonify([])


class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    # ok: py-admin-route-without-auth
    permission_classes = [AllowAny]


class AdminOrderViewSet(viewsets.ModelViewSet):
    # ok: py-admin-route-without-auth
    permission_classes = [IsAdminUser]
