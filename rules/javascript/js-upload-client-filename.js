const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");
const multer = require("multer");
const fileUpload = require("express-fileupload");

const app = express();
const UPLOADS = "/var/app/uploads";

const storage = multer.diskStorage({
  destination: UPLOADS,
  filename: (req, file, cb) => {
    // ruleid: js-upload-client-filename
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const storage2 = multer.diskStorage({
  destination: UPLOADS,
  filename: function (req, file, cb) {
    // ruleid: js-upload-client-filename
    cb(null, file.originalname);
  },
});

app.use(fileUpload());

app.post("/avatar", (req, res) => {
  const avatar = req.files.avatar;
  // ruleid: js-upload-client-filename
  avatar.mv(path.join(UPLOADS, avatar.name), () => res.sendStatus(204));
});

app.post("/doc", multer().single("doc"), (req, res) => {
  // ruleid: js-upload-client-filename
  fs.writeFileSync(path.join(UPLOADS, req.file.originalname), req.file.buffer);
  res.sendStatus(204);
});

// --- safe ---------------------------------------------------------------------------------

const safeStorage = multer.diskStorage({
  destination: UPLOADS,
  filename: (req, file, cb) => {
    // ok: js-upload-client-filename
    cb(null, crypto.randomUUID() + path.extname(file.originalname));
  },
});

const safeStorage2 = multer.diskStorage({
  destination: UPLOADS,
  filename: (req, file, cb) => {
    const name = security.sanitizeFilename(file.originalname).toLowerCase();
    // ok: js-upload-client-filename
    cb(null, name + "-" + Date.now());
  },
});

app.post("/photo", (req, res) => {
  const photo = req.files.photo;
  // ok: js-upload-client-filename
  photo.mv(path.join(UPLOADS, crypto.randomUUID() + ".jpg"), () => res.sendStatus(204));
});

app.post("/report", multer().single("report"), (req, res) => {
  // ok: js-upload-client-filename
  fs.writeFileSync(path.join(UPLOADS, path.basename(req.file.originalname)), req.file.buffer);
  res.json({ name: req.file.originalname });
});
