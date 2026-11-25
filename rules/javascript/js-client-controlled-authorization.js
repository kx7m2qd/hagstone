const express = require("express");
const app = express();

app.get("/admin/users", (req, res) => {
  // ruleid: js-client-controlled-authorization
  if (req.query.role === "admin") {
    return res.json(listUsers());
  }
  res.sendStatus(403);
});

app.delete("/posts/:id", (req, res) => {
  const isAdmin = req.cookies.isAdmin;
  // ruleid: js-client-controlled-authorization
  if (!isAdmin) return res.sendStatus(403);
  res.sendStatus(204);
});

app.post("/config", (req, res) => {
  // ruleid: js-client-controlled-authorization
  const allowed = req.headers["x-user-role"] === "superuser";
  res.json({ allowed });
});

// --- safe ---------------------------------------------------------------------------------

app.get("/admin/report", (req, res) => {
  // ok: js-client-controlled-authorization
  if (req.user.role === "admin") return res.json({});
  res.sendStatus(403);
});

app.post("/users", (req, res) => {
  // ok: js-client-controlled-authorization
  const user = createUser({ name: req.body.name, role: req.body.role });
  res.json(user);
});

app.get("/search", (req, res) => {
  // ok: js-client-controlled-authorization
  if (req.query.sort === "admin") res.json([]);
});

function listUsers() {
  return [];
}
function createUser(u) {
  return u;
}
