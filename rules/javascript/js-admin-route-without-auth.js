const express = require("express");
const app = express();
app.use(express.json());
app.use(session({ secret: process.env.SECRET }));

// ruleid: js-admin-route-without-auth
app.post("/admin/users/:id/delete", (req, res) => {
  deleteUser(req.params.id);
  res.sendStatus(204);
});

// ruleid: js-admin-route-without-auth
app.get("/internal/config", (req, res) => res.json(process.env));

// ok: js-admin-route-without-auth
app.get("/admin/stats", requireAdmin, (req, res) => res.json({}));

// ok: js-admin-route-without-auth
app.get("/admin/report", (req, res) => {
  if (!req.user || !req.user.isAdmin) return res.sendStatus(403);
  res.json({});
});

// ok: js-admin-route-without-auth
app.get("/products", (req, res) => res.json([]));

const secured = express();
secured.use(requireAuth);
// ok: js-admin-route-without-auth
secured.get("/admin/audit", (req, res) => res.json([]));

const router = express.Router();
// ok: js-admin-route-without-auth
router.get("/admin/users", (req, res) => res.json([]));

function requireAdmin(req, res, next) { next(); }
function requireAuth(req, res, next) { next(); }
function deleteUser(id) {}
