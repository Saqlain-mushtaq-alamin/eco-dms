import json
import os
from pathlib import Path

from app.services.redis_service import redis_service


def migrate_verdicts() -> int:
    base_dir = Path(__file__).parent
    storage_dir = Path(os.getenv('VERDICT_STORAGE_DIR', str(base_dir / 'ml_verdicts')))
    mapping_file = storage_dir / 'verdicts.json'

    if not mapping_file.exists():
        print(f"No verdicts file found at {mapping_file}")
        return 0

    with open(mapping_file, 'r', encoding='utf-8') as f:
        mappings = json.load(f)

    migrated = 0
    for post_cid, verdict_data in mappings.items():
        if not isinstance(verdict_data, dict):
            continue

        payload = dict(verdict_data)
        payload.setdefault('status', 'completed')
        payload.setdefault('task_id', None)
        payload.setdefault('attempts', payload.get('attempts', 1))
        payload.setdefault('last_error', '')
        payload.setdefault('queued_at', payload.get('verified_at'))
        payload.setdefault('started_at', payload.get('verified_at'))
        payload.setdefault('completed_at', payload.get('verified_at'))

        redis_service.client.hset(
            f"verdict:{post_cid}",
            mapping={"payload": json.dumps(payload)},
        )
        migrated += 1

    print(f"Migrated {migrated} verdict entries to Redis")
    return migrated


if __name__ == '__main__':
    migrate_verdicts()
