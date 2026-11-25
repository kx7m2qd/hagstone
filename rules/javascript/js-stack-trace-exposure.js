const express = require("express");
const app = express();

app.get("/orders", async (req, res) => {
  try {
    res.json(await loadOrders());
  } catch (err) {
    // ruleid: js-stack-trace-exposure
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

app.use((err, req, res, next) => {
  // ruleid: js-stack-trace-exposure
  res.status(500).send(err.stack);
});

async function koaHandler(ctx, next) {
  try {
    await next();
  } catch (e) {
    ctx.status = 500;
    // ruleid: js-stack-trace-exposure
    ctx.body = { message: "failed", trace: e.stack };
  }
}

// --- safe ---------------------------------------------------------------------------------

app.use((err, req, res, next) => {
  console.error(err.stack);
  // ok: js-stack-trace-exposure
  res.status(500).json({ error: "Internal error", id: req.id });
});

app.get("/stack", (req, res) => {
  const stack = ["a", "b"];
  // ok: js-stack-trace-exposure
  res.json({ size: stack.length });
});

async function loadOrders() {
  return [];
}
