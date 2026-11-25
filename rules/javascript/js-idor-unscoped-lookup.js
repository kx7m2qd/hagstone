const express = require("express");
const app = express();

app.get("/orders/:id", requireAuth, async (req, res) => {
  // ruleid: js-idor-unscoped-lookup
  const order = await Order.findById(req.params.id);
  res.json(order);
});

app.delete("/invoices/:invoiceId", requireAuth, function (req, res) {
  // ruleid: js-idor-unscoped-lookup
  Invoice.destroy({ where: { id: req.params.invoiceId } }).then(() => res.sendStatus(204));
});

// --- safe ---------------------------------------------------------------------------------

app.get("/my/orders/:id", requireAuth, async (req, res) => {
  // ok: js-idor-unscoped-lookup
  const order = await Order.findOne({ _id: req.params.id, owner: req.user.id });
  res.json(order);
});

app.get("/docs/:id", requireAuth, async (req, res) => {
  // ok: js-idor-unscoped-lookup
  const doc = await Doc.findById(req.params.id);
  if (!doc || doc.ownerId !== req.user.id) return res.sendStatus(404);
  res.json(doc);
});

app.get("/products/:id", async (req, res) => {
  // ok: js-idor-unscoped-lookup
  res.json(await Product.findById(req.params.id));
});

function requireAuth(req, res, next) {
  next();
}
