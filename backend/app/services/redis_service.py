import json
from typing import Any, Optional
import redis
from backend.app.config import settings

class RedisService:
    def __init__(self):
        self.client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)

    def ping(self) -> bool:
        try:
            return bool(self.client.ping())
        except Exception:
            return False

    def set_json(self, key: str, value: Any, ex: Optional[int] = None):
        self.client.set(key, json.dumps(value), ex=ex)

    def get_json(self, key: str) -> Optional[Any]:
        raw = self.client.get(key)
        if not raw:
            return None
        try:
            return json.loads(str(raw))
        except Exception:
            return None

    def set_str(self, key: str, value: str, ex: Optional[int] = None):
        self.client.set(key, value, ex=ex)

    def get_str(self, key: str) -> Optional[str]:
        result = self.client.get(key)
        return result if isinstance(result, str) else None

    def delete(self, key: str):
        self.client.delete(key)

    def incr(self, key: str, ex: Optional[int] = None) -> int:
        pipe = self.client.pipeline()
        pipe.incr(key, 1)
        if ex:
            pipe.expire(key, ex)
        res = pipe.execute()
        return int(res[0])

redis_service = RedisService()