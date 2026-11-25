import os
import stat
from pathlib import Path

UPLOADS = "/var/app/uploads"

# ruleid: py-world-writable-permissions
os.makedirs(UPLOADS, mode=0o777, exist_ok=True)

# ruleid: py-world-writable-permissions
os.chmod("/etc/app/config.yml", 0o666)

# ruleid: py-world-writable-permissions
os.chmod("/var/app/run.sh", stat.S_IRWXU | stat.S_IRWXG | stat.S_IRWXO)

# ruleid: py-world-writable-permissions
Path("/var/app/cache").mkdir(parents=True, mode=0o777)

# ruleid: py-world-writable-permissions
os.umask(0)

# ok: py-world-writable-permissions
os.makedirs(UPLOADS, mode=0o750, exist_ok=True)

# ok: py-world-writable-permissions
os.chmod("/etc/app/secret.key", 0o600)

# ok: py-world-writable-permissions
os.chmod("/var/app/run.sh", 0o755)

# ok: py-world-writable-permissions
os.umask(0o077)
