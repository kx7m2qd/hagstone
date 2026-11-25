# Django settings

DEBUG = False
ALLOWED_HOSTS = ["shop.example"]

# ruleid: py-django-upload-limits-disabled
DATA_UPLOAD_MAX_MEMORY_SIZE = None

# ruleid: py-django-upload-limits-disabled
DATA_UPLOAD_MAX_NUMBER_FIELDS = None

# ok: py-django-upload-limits-disabled
DATA_UPLOAD_MAX_NUMBER_FILES = 200

# ok: py-django-upload-limits-disabled
FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024

# ok: py-django-upload-limits-disabled
SESSION_COOKIE_DOMAIN = None
