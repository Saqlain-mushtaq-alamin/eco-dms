import json
from typing import Any, Optional
import redis
from backend.app.config import settings

class RedisService:
    def __init__(self):
        # Use connection pool + timeouts to avoid blocking
        self.client = redis.Redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=1.0,  # fail fast if Redis unreachable
            socket_timeout=1.5,          # limit per-command time
            retry_on_timeout=True,
            health_check_interval=30
        )

    def ping(self) -> bool:
        try:
            return bool(self.client.ping())
        except Exception:
            return False

    def set_json(self, key: str, value: Any, ex: Optional[int] = None):
        try:
            self.client.set(key, json.dumps(value), ex=ex)
        except Exception:
            # swallow to keep API responsive even if cache fails
            pass

    def get_json(self, key: str) -> Optional[Any]:
        try:
            raw = self.client.get(key)
            if not raw:
                return None
            try:
                return json.loads(str(raw))
            except Exception:
                # If already a stringified dict that failed to parse, return None
                return None
        except Exception:
            return None

    def set_str(self, key: str, value: str, ex: Optional[int] = None):
        try:
            self.client.set(key, value, ex=ex)
        except Exception:
            pass

    def get_str(self, key: str) -> Optional[str]:
        try:
            result = self.client.get(key)
            return result if isinstance(result, str) else None
        except Exception:
            return None

    def delete(self, key: str):
        try:
            self.client.delete(key)
        except Exception:
            pass

    def incr(self, key: str, ex: Optional[int] = None) -> int:
        try:
            pipe = self.client.pipeline()
            pipe.incr(key, 1)
            if ex:
                pipe.expire(key, ex)
            res = pipe.execute()
            return int(res[0])
        except Exception:
            return 1  # default minimal value to reduce blocking

redis_service = RedisService()