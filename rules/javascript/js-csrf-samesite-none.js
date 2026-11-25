const express = require("express");
const session = require("express-session");
const cookieSession = require("cookie-session");

const app = express();

app.use(
  // ruleid: js-csrf-samesite-none
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: true, httpOnly: true, sameSite: "none" },
  }),
);

// ruleid: js-csrf-samesite-none
app.use(cookieSession({ name: "sess", keys: [process.env.KEY], sameSite: false }));

app.post("/login", (req, res) => {
  // ruleid: js-csrf-samesite-none
  res.cookie("session_token", "abc", { httpOnly: true, secure: true, sameSite: "None" });
  res.sendStatus(204);
});

// ok: js-csrf-samesite-none
app.use(session({ secret: "x", cookie: { secure: true, sameSite: "lax" } }));

app.get("/embed", (req, res) => {
  // ok: js-csrf-samesite-none
  res.cookie("theme", "dark", { sameSite: "none", secure: true });
  res.send("ok");
});
