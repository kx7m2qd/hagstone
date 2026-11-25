// Back-office service: staff tools, document uploads, customer records.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");
const session = require("express-session");
const multer = require("multer");

const app = express();
const UPLOADS = "/srv/backoffice/uploads";

app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    // expect: js-csrf-samesite-none
    cookie: { secure: true, sameSite: "none" },
  }),
);

// expect: js-world-writable-permissions
fs.mkdirSync(UPLOADS, { recursive: true, mode: 0o777 });
fs.mkdirSync("/srv/backoffice/cache", { recursive: true, mode: 0o750 });

const storage = multer.diskStorage({
  destination: UPLOADS,
  filename: (req, file, cb) => {
    // expect: js-upload-client-filename
    cb(null, file.originalname);
  },
});
const safeStorage = multer.diskStorage({
  destination: UPLOADS,
  filename: (req, file, cb) => cb(null, crypto.randomUUID() + path.extname(file.originalname)),
});

app.post("/documents", requireAuth, multer({ storage }).single("doc"), (req, res) => res.sendStatus(201));
app.post("/documents/v2", requireAuth, multer({ storage: safeStorage }).single("doc"), (req, res) => res.sendStatus(201));

// Staff tool with no auth at all.
// expect: js-admin-route-without-auth
app.post("/admin/customers/:id/reset-password", (req, res) => {
  resetPassword(req.params.id);
  res.sendStatus(204);
});

// Logged in is enough to export every customer.
// expect: js-admin-route-without-role-check
app.get("/admin/customers/export", requireAuth, (req, res) => {
  res.json(exportCustomers());
});

app.get("/admin/customers/stats", requireAuth, (req, res) => {
  if (req.user.role !== "admin") return res.sendStatus(403);
  res.json({ count: 0 });
});

app.get("/customers/:id", requireAuth, async (req, res) => {
  // expect: js-idor-unscoped-lookup
  const customer = await Customer.findById(req.params.id);
  res.json(customer);
});

app.get("/me/customers/:id", requireAuth, async (req, res) => {
  const customer = await Customer.findOne({ _id: req.params.id, accountManager: req.user.id });
  res.json(customer);
});

app.post("/refunds", requireAuth, (req, res) => {
  // The client says whether it's a supervisor.
  // expect: js-client-controlled-authorization
  if (req.body.role === "supervisor" || req.headers["x-role"] === "admin") {
    return res.json(issueRefund(req.body));
  }
  res.sendStatus(403);
});

app.use((err, req, res, next) => {
  // expect: js-stack-trace-exposure
  res.status(500).json({ error: err.message, stack: err.stack });
});

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.sendStatus(401);
  next();
}
function resetPassword(id) {}
function exportCustomers() {
  return [];
}
function issueRefund(body) {
  return body;
}

module.exports = app;
