"""
Force refresh all user profiles to cache them with new 7-day TTL
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.redis_service import redis_service
from app.services.ipfs_service import ipfs_service

def refresh_profiles():
    """Re-cache all user profiles with extended TTL."""
    print("🔄 Refreshing user profiles...")
    
    # Clear old cache
    print("Clearing users:all cache...")
    redis_service.delete("users:all")
    
    # Get all users from registry
    wallet_addresses = redis_service.smembers("users:registry")
    print(f"Found {len(wallet_addresses)} users in registry: {wallet_addresses}")
    
    if not wallet_addresses:
        print("⚠️  No users in registry! Run migrate_users.py first.")
        return
    
    refreshed = 0
    for wallet_addr in wallet_addresses:
        print(f"\n🔍 Processing {wallet_addr}...")
        
        # Get CID key
        cid_key = f"user:profile:cid:{wallet_addr}"
        cid = redis_service.get_str(cid_key)
        
        if cid:
            print(f"  Found CID in cache: {cid}")
            # Extend TTL to 7 days
            redis_service.set_str(cid_key, cid, ex=7*24*3600)
            print(f"  ✅ Extended cache TTL to 7 days")
            
            # Verify data is in IPFS
            data = ipfs_service.get_json(cid)
            if data:
                print(f"  ✅ Profile data accessible from IPFS")
                print(f"     Username: {data.get('username', 'Not set')}")
                print(f"     Bio: {data.get('bio', 'Not set')}")
                refreshed += 1
            else:
                print(f"  ⚠️  Could not fetch data from IPFS for CID {cid}")
        else:
            print(f"  ⚠️  No CID in cache for {wallet_addr}")
            print(f"     User needs to log in once to cache their profile")
    
    print(f"\n✅ Refresh complete!")
    print(f"   Refreshed: {refreshed} profiles")
    print(f"   Total in registry: {len(wallet_addresses)}")
    print(f"\n💡 Tip: If profiles are still missing, have each user:")
    print(f"   1. Log in to their account")
    print(f"   2. Visit their profile or update it")
    print(f"   This will trigger profile caching")

if __name__ == "__main__":
    refresh_profiles()
