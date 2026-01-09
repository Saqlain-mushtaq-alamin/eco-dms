"""
Test if verdict lookup is working correctly
"""
import sys
sys.path.insert(0, '.')

from ml.worker import get_verdict_for_post

# Test with the actual post CID
post_cid = "QmQSJfE3rZAJb76HEbKwPEMkPH9cxkGtPQTxwShXCGkwTk"

print(f"Testing verdict lookup for: {post_cid}")
print("=" * 60)

verdict = get_verdict_for_post(post_cid)

if verdict:
    print("✅ Verdict found!")
    print(f"   Eco: {verdict.get('eco')}")
    print(f"   Confidence: {verdict.get('confidence')}")
    print(f"   Verdict CID: {verdict.get('verdict_cid')}")
    print(f"   Verified at: {verdict.get('verified_at')}")
else:
    print("❌ No verdict found for this post CID")
    print("\nPossible issues:")
    print("1. Post CID not in ml_verdicts/verdicts.json")
    print("2. File path issue")
    print("3. JSON file corrupted")

print("\n" + "=" * 60)
print("If verdict found, the backend should include this in post responses")
