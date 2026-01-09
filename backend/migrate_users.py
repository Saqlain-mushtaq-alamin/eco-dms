"""
Script to migrate existing user profiles to the new registry system.
Run this once to add all existing users to the users:registry set.
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.redis_service import redis_service
from app.services.ipfs_service import ipfs_service
import asyncio

async def migrate_users():
    """Scan Redis for existing profile CIDs and add them to the registry."""
    print("🔄 Starting user migration...")
    
    # Get all existing profile CID keys
    pattern = "user:profile:cid:*"
    keys = list(await redis_service.client.keys(pattern))
    
    print(f"Found {len(keys)} profile keys")
    
    migrated = 0
    for key in keys:
        # Extract wallet address from key
        # Key format: user:profile:cid:0x1234...
        wallet_addr = key.replace("user:profile:cid:", "")
        
        # Add to registry
        result = redis_service.sadd("users:registry", wallet_addr)
        print(f"  Added {wallet_addr} to registry (result: {result})")
        migrated += 1
    
    # Verify
    registry = redis_service.smembers("users:registry")
    print(f"\n✅ Migration complete!")
    print(f"   Migrated: {migrated} users")
    print(f"   Registry now contains: {len(registry)} users")
    print(f"   Users: {registry}")

if __name__ == "__main__":
    asyncio.run(migrate_users())
