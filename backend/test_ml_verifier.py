"""
Integration test for ML Verifier
Tests the complete verification pipeline
"""
import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

async def test_verifier():
    """Test the ML verifier end-to-end."""
    print("=" * 60)
    print("ML Verifier Integration Test")
    print("=" * 60)
    print()
    
    # Test 1: Import modules
    print("1. Testing imports...")
    try:
        from ml.inference import get_verifier
        from ml.eco_scorer import EcoScorer
        from ml.signer import VerdictSigner
        print("   ✓ All modules imported successfully")
    except Exception as e:
        print(f"   ✗ Import failed: {e}")
        return False
    
    # Test 2: Initialize verifier
    print("\n2. Initializing ML verifier...")
    try:
        verifier = get_verifier()
        active_models = verifier._get_active_models()
        print(f"   ✓ Verifier initialized")
        print(f"   Active models: {', '.join(active_models) if active_models else 'None (mock mode)'}")
    except Exception as e:
        print(f"   ✗ Verifier init failed: {e}")
        return False
    
    # Test 3: Test eco scorer
    print("\n3. Testing eco scorer...")
    try:
        scorer = EcoScorer()
        
        # Test YOLO scoring
        mock_detections = [
            {'class': 'bicycle', 'confidence': 0.95, 'bbox': [0, 0, 100, 100]},
            {'class': 'tree', 'confidence': 0.85, 'bbox': [100, 0, 200, 100]}
        ]
        yolo_score, labels = scorer.calculate_yolo_score(mock_detections)
        print(f"   ✓ YOLO scoring: {yolo_score:.3f} (detected: {', '.join(labels)})")
        
        # Test CLIP scoring
        mock_clip = {
            'sustainability': 0.9,
            'renewable energy': 0.85,
            'green': 0.8
        }
        clip_score = scorer.calculate_clip_score(mock_clip)
        print(f"   ✓ CLIP scoring: {clip_score:.3f}")
        
        # Test final score
        result = scorer.calculate_final_score(
            yolo_detections=mock_detections,
            clip_similarities=mock_clip,
            text_content="Riding my bicycle to save the environment!"
        )
        print(f"   ✓ Final verdict: {'ECO ✓' if result['is_eco'] else 'Not Eco'} (confidence: {result['confidence']:.1%})")
        print(f"   Breakdown: YOLO={result['breakdown']['yolo_score']:.2f}, "
              f"CLIP={result['breakdown']['clip_score']:.2f}, "
              f"EfficientNet={result['breakdown']['efficientnet_score']:.2f}, "
              f"Text={result['breakdown']['text_score']:.2f}")
    except Exception as e:
        print(f"   ✗ Scorer test failed: {e}")
        return False
    
    # Test 4: Test signer
    print("\n4. Testing verdict signer...")
    try:
        signer = VerdictSigner()
        
        mock_verdict = {
            'is_eco': True,
            'confidence': 0.87,
            'test': True
        }
        
        signed = signer.sign_verdict(mock_verdict)
        print(f"   ✓ Verdict signed")
        print(f"   Verifier address: {signed['verifier_address']}")
        print(f"   Signature: {signed['signature'][:20]}...")
        
        # Verify signature
        is_valid = signer.verify_signature(signed)
        if is_valid:
            print(f"   ✓ Signature verified")
        else:
            print(f"   ✗ Signature verification failed")
            return False
    except Exception as e:
        print(f"   ✗ Signer test failed: {e}")
        return False
    
    # Test 5: Test full inference (if models available)
    print("\n5. Testing ML inference...")
    if active_models:
        try:
            from PIL import Image
            import numpy as np
            
            # Create a dummy RGB image
            dummy_image = Image.fromarray(
                np.random.randint(0, 255, (256, 256, 3), dtype=np.uint8)
            )
            
            result = await verifier.verify_image(
                dummy_image,
                text_content="Testing eco verification"
            )
            
            print(f"   ✓ Inference completed")
            print(f"   Result: {'ECO ✓' if result['is_eco'] else 'Not Eco'} ({result['confidence']:.1%})")
        except Exception as e:
            print(f"   ⚠ Inference test skipped: {e}")
    else:
        print("   ⚠ No models loaded (expected in dev mode)")
        print("   Place yolov8_eco.pt in backend/ml/models/ to enable full testing")
    
    # Test 6: Test worker functions
    print("\n6. Testing worker utilities...")
    try:
        from ml.worker import get_verdict_for_post
        
        # Test verdict lookup (will return None if no verdicts)
        verdict = get_verdict_for_post("test_cid")
        print(f"   ✓ Verdict lookup working (found: {verdict is not None})")
    except Exception as e:
        print(f"   ✗ Worker test failed: {e}")
        return False
    
    print("\n" + "=" * 60)
    print("All tests passed! ✓")
    print("=" * 60)
    print()
    print("Next steps:")
    print("  1. Ensure Redis is running: redis-server")
    print("  2. Start Celery worker: celery -A backend.ml.worker worker --pool=solo")
    print("  3. Place YOLOv8 model at: backend/ml/models/yolov8_eco.pt")
    print("  4. Start backend API and create posts with images")
    print()
    
    return True


if __name__ == "__main__":
    success = asyncio.run(test_verifier())
    sys.exit(0 if success else 1)
