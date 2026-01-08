"""
Example usage of the ML Eco Verifier
"""
import asyncio
from ml.inference import EcoVerifier
from ml.signer import VerdictSigner
from ml.eco_scorer import EcoScorer
from typing import Any, cast


async def example_basic_verification():
    """Example: Basic image verification."""
    print("=" * 60)
    print("Example 1: Basic Image Verification")
    print("=" * 60)
    
    # Initialize verifier
    verifier = EcoVerifier(
        yolo_model_path="ml/models/yolov8_eco.pt"
    )
    
    # Verify an image file
    result = await verifier.verify_image(
        image_data="path/to/your/image.jpg",
        text_content="My new solar panels generating clean energy!"
    )
    
    print("\n✅ Verification Result:")
    print(f"Is Eco-Friendly: {result['is_eco']}")
    print(f"Confidence Score: {result['confidence']:.2%}")
    print(f"Detected Objects: {result['detected_objects']}")
    print(f"Reasoning: {result['reasoning']}")
    print(f"\nScore Breakdown:")
    for model, score in result['breakdown'].items():
        print(f"  {model}: {score:.2%}")


async def example_ipfs_verification():
    """Example: Verify content from IPFS."""
    print("\n" + "=" * 60)
    print("Example 2: IPFS Content Verification")
    print("=" * 60)
    
    verifier = EcoVerifier()
    
    # Verify from IPFS CID
    ipfs_cid = "QmYourImageCID..."
    
    result = await verifier.verify_from_ipfs(
        ipfs_cid=ipfs_cid,
        ipfs_gateway="http://localhost:8080",
        text_content="Cycling to work to reduce carbon footprint"
    )
    
    print(f"\n✅ Verified CID: {ipfs_cid}")
    print(f"Eco-Friendly: {result['is_eco']}")
    print(f"Confidence: {result['confidence']:.2%}")


def example_signing_verdict():
    """Example: Sign a verification verdict."""
    print("\n" + "=" * 60)
    print("Example 3: Signing Verdicts")
    print("=" * 60)
    
    # Create a sample verdict
    verdict_data = {
        'is_eco': True,
        'confidence': 0.87,
        'detected_objects': ['solar_panel_clean', 'tree'],
        'ipfs_cid': 'QmTest123...',
        'verified_at': '2026-01-09T12:00:00'
    }
    
    # Sign the verdict
    signer = VerdictSigner()
    signed_verdict = signer.sign_verdict(verdict_data)
    
    print("\n✅ Signed Verdict:")
    print(f"Verifier Address: {signed_verdict['verifier_address']}")
    print(f"Signature: {signed_verdict['signature'][:66]}...")
    print(f"Nonce: {signed_verdict['nonce'][:16]}...")
    print(f"Timestamp: {signed_verdict['timestamp']}")
    
    # Verify the signature
    is_valid = VerdictSigner.verify_signature(signed_verdict)
    print(f"\n🔐 Signature Valid: {is_valid}")


def example_custom_scoring():
    """Example: Custom eco scoring logic."""
    print("\n" + "=" * 60)
    print("Example 4: Custom Eco Scoring")
    print("=" * 60)
    
    scorer = EcoScorer()
    
    # Simulate model results
    yolo_detections = [
        {'class': 'bicycle', 'confidence': 0.95, 'bbox': [100, 100, 300, 400]},
        {'class': 'tree', 'confidence': 0.88, 'bbox': [400, 50, 600, 500]},
    ]
    
    clip_similarities = {
        'sustainability': 0.82,
        'eco-friendly': 0.78,
        'green': 0.75,
    }
    
    efficientnet_classification = {
        'is_eco_friendly': 0.85,
        'confidence': 0.90
    }
    
    # Calculate final score
    result = scorer.calculate_final_score(
        yolo_detections=yolo_detections,
        clip_similarities=clip_similarities,
        efficientnet_classification=efficientnet_classification,
        text_content="Riding my bike through the park"
    )
    
    print("\n✅ Scoring Result:")
    print(f"Final Verdict: {'ECO ✅' if result['is_eco'] else 'NOT ECO ❌'}")
    print(f"Confidence: {result['confidence']:.2%}")
    print(f"Detected Objects: {result['detected_objects']}")
    print(f"\nBreakdown:")
    for component, score in result['breakdown'].items():
        print(f"  {component}: {score:.2%}")


async def example_celery_workflow():
    """Example: Async verification workflow."""
    print("\n" + "=" * 60)
    print("Example 5: Celery Async Workflow")
    print("=" * 60)
    
    from ml.worker import verify_eco_content, get_verification_status
    
    # Submit verification task
    print("\n📤 Submitting verification task...")
    task = cast(Any, verify_eco_content).delay(
        ipfs_cid="QmTestCID...",
        text_content="Solar powered home",
        post_id="post_123",
        author_wallet="0xAuthor..."
    )
    
    print(f"✅ Task submitted: {task.id}")
    print("   Celery worker will process this in background...")
    print("   Frontend can poll: GET /api/verify/status/{task.id}")
    
    # In production, frontend would poll this endpoint:
    # status = get_verification_status(task.id)


if __name__ == "__main__":
    print("\n" + "🌍 " * 20)
    print("ML ECO VERIFIER - EXAMPLES")
    print("🌍 " * 20 + "\n")
    
    # Run examples
    # asyncio.run(example_basic_verification())
    # asyncio.run(example_ipfs_verification())
    example_signing_verdict()
    example_custom_scoring()
    # asyncio.run(example_celery_workflow())
    
    print("\n" + "=" * 60)
    print("✅ Examples completed!")
    print("=" * 60)
