"""Back-office blueprint: staff tools, document uploads, customer records."""
import logging
import os
import traceback
import uuid

from flask import Blueprint, abort, jsonify, request
from flask_login import current_user, login_required
from flask_wtf.csrf import CSRFProtect
from werkzeug.utils import secure_filename

backoffice = Blueprint("backoffice", __name__)
csrf = CSRFProtect()
log = logging.getLogger(__name__)
UPLOADS = "/srv/backoffice/uploads"

# expect: py-world-writable-permissions
os.makedirs(UPLOADS, mode=0o777, exist_ok=True)
os.makedirs("/srv/backoffice/cache", mode=0o750, exist_ok=True)


@backoffice.post("/documents")
@login_required
def upload_document():
    doc = request.files["doc"]
    # expect: py-upload-client-filename
    doc.save(os.path.join(UPLOADS, doc.filename))
    return "", 201


@backoffice.post("/documents/v2")
@login_required
def upload_document_v2():
    doc = request.files["doc"]
    doc.save(os.path.join(UPLOADS, uuid.uuid4().hex + "-" + secure_filename(doc.filename)))
    return "", 201


# Form posts from the browser with CSRF protection switched off.
# expect: py-csrf-disabled
@csrf.exempt
@backoffice.post("/settings/email")
@login_required
def change_email():
    current_user.email = request.form["email"]
    return "", 204


# expect: py-admin-route-without-auth
@backoffice.post("/admin/customers/<int:cid>/reset-password")
def reset_password(cid):
    Customer.query.get_or_404(cid).reset_password()
    return "", 204


# expect: py-admin-route-without-role-check
@backoffice.get("/admin/customers/export")
@login_required
def export_customers():
    return jsonify([c.to_dict() for c in Customer.query.all()])


@backoffice.get("/admin/customers/stats")
@login_required
def customer_stats():
    if not current_user.is_admin:
        abort(403)
    return jsonify(count=Customer.query.count())


@backoffice.get("/customers/<int:cid>")
@login_required
def customer(cid):
    # expect: py-idor-unscoped-lookup
    return jsonify(Customer.query.get_or_404(cid).to_dict())


@backoffice.get("/my/customers/<int:cid>")
@login_required
def my_customer(cid):
    c = Customer.query.get_or_404(cid)
    if c.account_manager_id != current_user.id:
        abort(404)
    return jsonify(c.to_dict())


@backoffice.post("/refunds")
@login_required
def refund():
    # expect: py-client-controlled-authorization
    if request.form.get("role") == "supervisor":
        return jsonify(issue_refund(request.form))
    abort(403)


@backoffice.get("/reports/<name>")
@login_required
def report(name):
    try:
        return jsonify(build_report(name))
    except Exception:
        # expect: py-stack-trace-exposure
        return jsonify(error="report failed", detail=traceback.format_exc()), 500


@backoffice.get("/reports-v2/<name>")
@login_required
def report_v2(name):
    try:
        return jsonify(build_report(name))
    except Exception:
        log.error("report %s failed: %s", name, traceback.format_exc())
        return jsonify(error="report failed"), 500


def issue_refund(form):
    return dict(form)


def build_report(name):
    return {}
