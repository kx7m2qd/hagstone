import hashlib
import hmac

from django.http import HttpResponse, JsonResponse
from django.urls import path
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from flask import Flask
from flask_wtf.csrf import CSRFProtect

app = Flask(__name__)
csrf = CSRFProtect(app)


# ruleid: py-csrf-disabled
@csrf_exempt
def change_email(request):
    request.user.email = request.POST["email"]
    request.user.save()
    return JsonResponse({"ok": True})


# ruleid: py-csrf-disabled
@method_decorator(csrf_exempt, name="dispatch")
class TransferView(View):
    def post(self, request):
        return HttpResponse("done")


# ruleid: py-csrf-disabled
@csrf.exempt
@app.post("/settings")
def settings():
    return "saved"


def delete_account(request):
    return HttpResponse("bye")


urlpatterns = [
    # ruleid: py-csrf-disabled
    path("account/delete", csrf_exempt(delete_account)),
]

# ruleid: py-csrf-disabled
app.config["WTF_CSRF_ENABLED"] = False


# ok: py-csrf-disabled
@csrf_exempt
def stripe_webhook(request):
    sig = request.headers["Stripe-Signature"]
    expected = hmac.new(b"whsec", request.body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig, expected):
        return HttpResponse(status=400)
    return HttpResponse("ok")


# ok: py-csrf-disabled
def profile(request):
    return JsonResponse({"name": request.user.username})


class GraphQLApiView(View):
    # API view that authenticates with tokens itself.
    # ok: py-csrf-disabled
    @csrf_exempt
    def dispatch(self, request, *args, **kwargs):
        auth = TokenAuthentication().authenticate(request)
        return super().dispatch(request, *args, **kwargs)
