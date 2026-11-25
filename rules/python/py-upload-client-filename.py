import os
import uuid

from flask import Flask, request
from werkzeug.utils import secure_filename

app = Flask(__name__)
UPLOADS = "/var/app/uploads"


@app.post("/avatar")
def avatar():
    f = request.files["avatar"]
    # ruleid: py-upload-client-filename
    f.save(os.path.join(UPLOADS, f.filename))
    return "", 204


@app.post("/docs")
def docs():
    for doc in request.files.getlist("docs"):
        # ruleid: py-upload-client-filename
        with open(os.path.join(UPLOADS, doc.filename), "wb") as out:
            out.write(doc.read())
    return "", 204


def django_upload(request):
    upload = request.FILES["file"]
    # ruleid: py-upload-client-filename
    with open(f"{UPLOADS}/{upload.name}", "wb+") as dest:
        for chunk in upload.chunks():
            dest.write(chunk)


# --- safe ---------------------------------------------------------------------------------


@app.post("/avatar-safe")
def avatar_safe():
    f = request.files["avatar"]
    # ok: py-upload-client-filename
    f.save(os.path.join(UPLOADS, secure_filename(f.filename)))
    return "", 204


@app.post("/avatar-uuid")
def avatar_uuid():
    f = request.files["avatar"]
    ext = os.path.splitext(f.filename)[1].lower()
    if ext not in {".png", ".jpg"}:
        return "bad type", 400
    # ok: py-upload-client-filename
    f.save(os.path.join(UPLOADS, uuid.uuid4().hex + ext))
    return "", 204


@app.post("/meta")
def meta():
    f = request.files["avatar"]
    # ok: py-upload-client-filename
    with open(os.path.join(UPLOADS, "names.log"), "a") as log:
        log.write(f.filename + "\n")
    return "", 204
