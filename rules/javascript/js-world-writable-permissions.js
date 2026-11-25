const fs = require("fs");

const UPLOADS = "/var/app/uploads";

// ruleid: js-world-writable-permissions
fs.mkdirSync(UPLOADS, { recursive: true, mode: 0o777 });

// ruleid: js-world-writable-permissions
fs.chmodSync("/etc/app/config.json", 0o666);

// ruleid: js-world-writable-permissions
fs.chmod("/var/app/run.sh", "777", () => {});

// ruleid: js-world-writable-permissions
fs.writeFileSync("/var/app/token", "secret", { mode: 0o666 });

// ruleid: js-world-writable-permissions
process.umask(0);

// ok: js-world-writable-permissions
fs.mkdirSync(UPLOADS, { recursive: true, mode: 0o750 });

// ok: js-world-writable-permissions
fs.chmodSync("/etc/app/secret.key", 0o600);

// ok: js-world-writable-permissions
fs.chmod("/var/app/run.sh", "755", () => {});
