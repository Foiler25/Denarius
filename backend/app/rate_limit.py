from slowapi import Limiter
from slowapi.util import get_remote_address

# Process-local in-memory limiter. For multi-worker deployments swap the
# storage_uri to a redis:// URL.
limiter = Limiter(key_func=get_remote_address)
