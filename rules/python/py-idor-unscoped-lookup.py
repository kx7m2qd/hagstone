from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404
from flask_login import current_user, login_required as flask_login_required


@login_required
def order_detail(request, pk):
    # ruleid: py-idor-unscoped-lookup
    order = Order.objects.get(pk=pk)
    return render(request, "order.html", {"order": order})


@login_required
def invoice_pdf(request, invoice_id):
    # ruleid: py-idor-unscoped-lookup
    invoice = get_object_or_404(Invoice, id=invoice_id)
    return invoice.pdf()


@app.get("/notes/<int:note_id>")
@login_required
def note(note_id):
    # ruleid: py-idor-unscoped-lookup
    return Note.query.get_or_404(note_id).to_dict()


# --- safe ---------------------------------------------------------------------------------


@login_required
def my_order(request, pk):
    # ok: py-idor-unscoped-lookup
    order = get_object_or_404(Order, pk=pk, owner=request.user)
    return render(request, "order.html", {"order": order})


@app.get("/my-notes/<int:note_id>")
@login_required
def my_note(note_id):
    # ok: py-idor-unscoped-lookup
    n = Note.query.get_or_404(note_id)
    if n.user_id != current_user.id:
        abort(404)
    return n.to_dict()


def public_product(request, pk):
    # ok: py-idor-unscoped-lookup
    return Product.objects.get(pk=pk)
