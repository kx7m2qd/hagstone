from flask import Flask, abort, jsonify
from flask_login import current_user, login_required
from rest_framework import permissions, viewsets
from rest_framework.permissions import IsAdminUser, IsAuthenticated

app = Flask(__name__)


# ruleid: py-admin-route-without-role-check
@app.post("/admin/users/<int:uid>/ban")
@login_required
def ban_user(uid):
    User.query.get(uid).banned = True
    return "", 204


class AdminUserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    # ruleid: py-admin-route-without-role-check
    permission_classes = [IsAuthenticated]


# --- safe ---------------------------------------------------------------------------------


# ok: py-admin-route-without-role-check
@app.post("/admin/users/<int:uid>/unban")
@login_required
def unban_user(uid):
    if not current_user.is_admin:
        abort(403)
    return "", 204


# ok: py-admin-route-without-role-check
@app.get("/account")
@login_required
def account():
    return jsonify(current_user.to_dict())


class AdminAuditViewSet(viewsets.ReadOnlyModelViewSet):
    # ok: py-admin-route-without-role-check
    permission_classes = [IsAdminUser]


class OrderViewSet(viewsets.ModelViewSet):
    # ok: py-admin-route-without-role-check
    permission_classes = [IsAuthenticated]
