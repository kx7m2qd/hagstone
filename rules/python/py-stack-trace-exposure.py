import logging
import traceback

from django.http import HttpResponseServerError, JsonResponse
from flask import Flask, jsonify

app = Flask(__name__)
log = logging.getLogger(__name__)


@app.get("/report")
def report():
    try:
        return build_report()
    except Exception:
        # ruleid: py-stack-trace-exposure
        return jsonify(error="failed", trace=traceback.format_exc()), 500


@app.errorhandler(500)
def server_error(e):
    # ruleid: py-stack-trace-exposure
    return "<pre>" + traceback.format_exc() + "</pre>", 500


def django_view(request):
    try:
        return JsonResponse(build_report())
    except Exception as e:
        # ruleid: py-stack-trace-exposure
        return HttpResponseServerError("".join(traceback.format_exception(e)))


# --- safe ---------------------------------------------------------------------------------


@app.get("/report-safe")
def report_safe():
    try:
        return build_report()
    except Exception:
        log.error("report failed: %s", traceback.format_exc())
        # ok: py-stack-trace-exposure
        return jsonify(error="failed"), 500


def build_report():
    return {}
