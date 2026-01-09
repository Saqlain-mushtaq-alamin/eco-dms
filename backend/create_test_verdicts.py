"""
Create test verification verdicts for existing posts
This is for testing the frontend without ML models
"""
import json
import os
from pathlib import Path
from datetime import datetime

# Create storage directory
storage_dir = Path('./ml_verdicts')
storage_dir.mkdir(exist_ok=True)

# Mock verdicts - you can add your actual post CIDs here
test_verdicts = {
    # Example post CID - replace with your actual post CIDs
    "QmTest1": {
        "verdict_cid": "QmVerdictTest1",
        "eco": True,
        "confidence": 0.85,
        "verified_at": datetime.utcnow().isoformat(),
    },
    "QmTest2": {
        "verdict_cid": "QmVerdictTest2",
        "eco": False,
        "confidence": 0.45,
        "verified_at": datetime.utcnow().isoformat(),
    },
}

# Save verdicts
mapping_file = storage_dir / 'verdicts.json'

# Load existing mappings if any
mappings = {}
if mapping_file.exists():
    try:
        with open(mapping_file, 'r') as f:
            mappings = json.load(f)
    except Exception:
        pass

# Merge with test verdicts
mappings.update(test_verdicts)

# Save
with open(mapping_file, 'w') as f:
    json.dump(mappings, f, indent=2)

print(f"✅ Created {len(test_verdicts)} test verdicts at {mapping_file}")
print("\nTo add verdicts for your posts:")
print("1. Get your post CIDs from the frontend")
print("2. Edit this script and add them to test_verdicts dict")
print("3. Run this script again")
print("\nExample:")
print("""
test_verdicts = {
    "bafybeiabc123...": {  # Your actual post CID
        "verdict_cid": "bafybeixyz789...",  # Can be any string for testing
        "eco": True,
        "confidence": 0.85,
        "verified_at": datetime.utcnow().isoformat(),
    },
}
""")
