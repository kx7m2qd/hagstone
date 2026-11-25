const express = require("express");
const app = express();

// ruleid: js-admin-route-without-role-check
app.delete("/admin/users/:id", requireAuth, (req, res) => {
  removeUser(req.params.id);
  res.sendStatus(204);
});

// ruleid: js-admin-route-without-role-check
app.get("/api/admin/export", passport.authenticate("jwt", { session: false }), (req, res) => res.json([]));

// ok: js-admin-route-without-role-check
app.delete("/admin/posts/:id", requireAuth, (req, res) => {
  if (req.user.role !== "admin") return res.sendStatus(403);
  res.sendStatus(204);
});

// ok: js-admin-route-without-role-check
app.get("/admin/stats", requireAuth, requireRole("admin"), (req, res) => res.json({}));

// ok: js-admin-route-without-role-check
app.get("/account", requireAuth, (req, res) => res.json(req.user));

const admin = express.Router();
admin.use(requireAdmin);
// ok: js-admin-route-without-role-check
admin.get("/admin/audit", requireAuth, (req, res) => res.json([]));

function requireAuth(req, res, next) { next(); }
function requireAdmin(req, res, next) { next(); }
function requireRole(r) { return (req, res, next) => next(); }
function removeUser(id) {}
