"""
ML Inference Service for Eco-DMS
Performs eco verification using YOLOv8, CLIP, and EfficientNet models
"""
import os
import io
import httpx
from typing import Dict, List, Optional, Union
from pathlib import Path

try:
    import numpy as np
except ImportError:
    np = None  # type: ignore

try:
    from PIL import Image
except ImportError:
    Image = None  # type: ignore

try:
    import torch
except ImportError:
    torch = None  # type: ignore

# Import ML frameworks
try:
    from ultralytics import YOLO  # type: ignore[attr-defined]
    YOLO_AVAILABLE = True
except ImportError:
    YOLO = None  # type: ignore
    YOLO_AVAILABLE = False
    print("Warning: ultralytics not installed. YOLOv8 will be disabled.")

try:
    import clip
    CLIP_AVAILABLE = True
except ImportError:
    clip = None  # type: ignore
    CLIP_AVAILABLE = False
    print("Warning: CLIP not installed. CLIP scoring will be disabled.")

try:
    from torchvision import models, transforms
    EFFICIENTNET_AVAILABLE = True
except ImportError:
    models = None  # type: ignore
    transforms = None  # type: ignore
    EFFICIENTNET_AVAILABLE = False
    print("Warning: torchvision not installed. EfficientNet will be disabled.")

from .eco_scorer import EcoScorer


class EcoVerifier:
    """
    ML-based eco-friendliness verifier for decentralized social media posts.
    Combines YOLOv8 object detection, CLIP image-text alignment, and EfficientNet classification.
    """
    
    def __init__(
        self,
        yolo_model_path: Optional[str] = None,
        device: str = 'cuda' if (torch is not None and torch.cuda.is_available()) else 'cpu'
    ):
        """
        Initialize the eco verifier with ML models.
        
        Args:
            yolo_model_path: Path to trained YOLOv8 model weights
            device: 'cuda' or 'cpu' for inference
        """
        self.device = device
        self.scorer = EcoScorer()
        
        # Model paths
        models_dir = Path(__file__).parent / 'models'
        models_dir.mkdir(exist_ok=True)
        
        self.yolo_model_path = yolo_model_path or str(models_dir / 'yolov8_eco.pt')
        
        # Initialize models
        self.yolo_model = None
        self.clip_model = None
        self.clip_preprocess = None
        self.efficientnet_model = None
        self.efficientnet_transform = None
        
        self._load_models()
    
    def _load_models(self):
        """Load all ML models."""
        print(f"Loading models on device: {self.device}")
        
        # Load YOLOv8
        if YOLO_AVAILABLE and YOLO is not None and os.path.exists(self.yolo_model_path):
            print(f"Loading YOLOv8 from {self.yolo_model_path}")
            self.yolo_model = YOLO(self.yolo_model_path)
            self.yolo_model.to(self.device)
        else:
            print(f"YOLOv8 model not found at {self.yolo_model_path}")
        
        # Load CLIP
        if CLIP_AVAILABLE and clip is not None:
            print("Loading CLIP model...")
            self.clip_model, self.clip_preprocess = clip.load(
                "ViT-B/32", device=self.device
            )
        
        # Load EfficientNet
        if EFFICIENTNET_AVAILABLE and models is not None and transforms is not None:
            print("Loading EfficientNet...")
            # Use modern torchvision weights API when available; keep a legacy fallback.
            try:
                self.efficientnet_model = models.efficientnet_b0(
                    weights=models.EfficientNet_B0_Weights.DEFAULT
                )
            except Exception:
                self.efficientnet_model = models.efficientnet_b0(pretrained=True)
            self.efficientnet_model.eval()
            self.efficientnet_model.to(self.device)
            
            # Standard ImageNet preprocessing
            self.efficientnet_transform = transforms.Compose([
                transforms.Resize(256),
                transforms.CenterCrop(224),
                transforms.ToTensor(),
                transforms.Normalize(
                    mean=[0.485, 0.456, 0.406],
                    std=[0.229, 0.224, 0.225]
                )
            ])
        
        print("Models loaded successfully!")
    
    async def verify_from_ipfs(
        self,
        ipfs_cid: str,
        ipfs_gateway: str = "http://localhost:8080",
        text_content: Optional[str] = None
    ) -> Dict:
        """
        Verify eco-friendliness of content stored on IPFS.
        
        Args:
            ipfs_cid: IPFS content identifier
            ipfs_gateway: IPFS gateway URL
            text_content: Optional text content from the post
        
        Returns:
            Verification result with eco verdict and confidence score
        """
        image_bytes = await self._fetch_image_from_ipfs(ipfs_cid, ipfs_gateway)
        
        # Perform verification
        return await self.verify_image(image_bytes, text_content)

    async def verify_images_from_ipfs(
        self,
        ipfs_cids: List[str],
        ipfs_gateway: str = "http://localhost:8080",
        text_content: Optional[str] = None,
    ) -> Dict:
        """
        Verify multiple images and return one merged verdict for the whole post.
        """
        if not ipfs_cids:
            raise ValueError("ipfs_cids cannot be empty")

        per_image_results: List[Dict] = []
        failed_images: List[Dict[str, str]] = []

        for cid in ipfs_cids:
            try:
                image_bytes = await self._fetch_image_from_ipfs(cid, ipfs_gateway)
                image_verdict = await self.verify_image(image_bytes, text_content)
                per_image_results.append({
                    'ipfs_cid': cid,
                    **image_verdict,
                })
            except Exception as e:
                failed_images.append({'ipfs_cid': cid, 'error': str(e)})

        if not per_image_results:
            raise RuntimeError("Failed to verify all images from IPFS")

        confidences = [float(v.get('confidence', 0.0)) for v in per_image_results]
        merged_confidence = sum(confidences) / len(confidences)

        threshold = float(self.scorer.eco_threshold)
        merged_is_eco = merged_confidence > threshold

        all_objects: List[str] = []
        for v in per_image_results:
            for obj in v.get('detected_objects', []):
                if obj not in all_objects:
                    all_objects.append(obj)

        breakdown_keys = ('yolo_score', 'clip_score', 'efficientnet_score', 'text_score')
        merged_breakdown = {
            key: round(
                sum(float(v.get('breakdown', {}).get(key, 0.0)) for v in per_image_results)
                / len(per_image_results),
                3,
            )
            for key in breakdown_keys
        }

        eco_images = sum(1 for v in per_image_results if bool(v.get('is_eco', False)))
        merged_reasoning = (
            f"Merged result from {len(per_image_results)} images "
            f"({eco_images} eco-positive). "
            f"Average confidence: {merged_confidence:.1%}."
        )

        return {
            'is_eco': merged_is_eco,
            'confidence': round(merged_confidence, 3),
            'breakdown': merged_breakdown,
            'detected_objects': all_objects,
            'reasoning': merged_reasoning,
            'models_used': self._get_active_models(),
            'total_images': len(ipfs_cids),
            'analyzed_images': len(per_image_results),
            'failed_images': failed_images,
            'per_image_results': per_image_results,
        }

    async def _fetch_image_from_ipfs(self, ipfs_cid: str, ipfs_gateway: str) -> bytes:
        """Fetch one image from IPFS gateway."""
        image_url = f"{ipfs_gateway}/ipfs/{ipfs_cid}"

        async with httpx.AsyncClient(
            timeout=httpx.Timeout(connect=10.0, read=35.0, write=10.0, pool=10.0),
            follow_redirects=True,
        ) as client:
            response = await client.get(image_url)
            response.raise_for_status()
            return response.content
    
    async def verify_image(
        self,
        image_data: Union[bytes, str, "Image.Image"],  # type: ignore
        text_content: Optional[str] = None
    ) -> Dict:
        """
        Verify eco-friendliness of an image.
        
        Args:
            image_data: Image as bytes, file path, or PIL Image
            text_content: Optional text content from the post
        
        Returns:
            Dict with verification results:
            {
                'is_eco': bool,
                'confidence': float,
                'breakdown': {...},
                'detected_objects': List[str],
                'reasoning': str,
                'models_used': List[str]
            }
        """
        # Load image
        if Image is None:
            raise RuntimeError("PIL not installed. Run: pip install pillow")
        
        if Image is None:
            raise RuntimeError("PIL is not installed")
        
        if isinstance(image_data, bytes):
            img: "Image.Image" = Image.open(io.BytesIO(image_data)).convert('RGB')  # type: ignore
        elif isinstance(image_data, str):
            img = Image.open(image_data).convert('RGB')
        elif hasattr(image_data, 'convert'):
            # It's a PIL Image
            img = image_data.convert('RGB')  # type: ignore
        else:
            # Fallback: assume it's already RGB
            img = image_data  # type: ignore
        
        # Run inference on all models
        yolo_results = self._run_yolo(img)
        clip_results = self._run_clip(img, text_content)
        efficientnet_results = self._run_efficientnet(img)
        
        # Calculate final eco score
        verdict = self.scorer.calculate_final_score(
            yolo_detections=yolo_results,
            clip_similarities=clip_results,
            efficientnet_classification=efficientnet_results,
            text_content=text_content
        )
        
        # Add metadata
        verdict['models_used'] = self._get_active_models()
        verdict['image_size'] = img.size
        
        return verdict
    
    def _run_yolo(self, image) -> List[Dict]:
        """
        Run YOLOv8 object detection.
        
        Returns:
            List of detected objects with class, confidence, and bbox
        """
        if not self.yolo_model:
            return []
        
        # Run inference
        results = self.yolo_model(image, verbose=False)
        
        detections = []
        for result in results:
            boxes = result.boxes
            
            for box in boxes:
                # Get class name and confidence
                class_id = int(box.cls[0])
                confidence = float(box.conf[0])
                bbox = box.xyxy[0].tolist()  # [x1, y1, x2, y2]
                
                # Get class name from model
                class_name = result.names[class_id]
                
                detections.append({
                    'class': class_name,
                    'confidence': confidence,
                    'bbox': bbox
                })
        
        return detections
    
    def _run_clip(
        self,
        image,
        text_content: Optional[str] = None
    ) -> Dict[str, float]:
        """
        Run CLIP image-text similarity scoring.
        
        Returns:
            Dict mapping eco keywords to similarity scores
        """
        if not self.clip_model or self.clip_preprocess is None or clip is None:
            return {}
        
        # Preprocess image
        image_input = self.clip_preprocess(image).unsqueeze(0).to(self.device)
        
        # Prepare text prompts (eco keywords)
        text_prompts = self.scorer.ECO_KEYWORDS
        
        # Add post text content if provided
        if text_content:
            text_prompts = text_prompts + [text_content[:77]]  # CLIP max length
        
        # Tokenize text
        text_tokens = clip.tokenize(text_prompts).to(self.device)
        
        # Calculate similarities
        if torch is None:
            return {}
        with torch.no_grad():
            image_features = self.clip_model.encode_image(image_input)
            text_features = self.clip_model.encode_text(text_tokens)
            
            # Normalize features
            image_features /= image_features.norm(dim=-1, keepdim=True)
            text_features /= text_features.norm(dim=-1, keepdim=True)
            
            # Calculate cosine similarity
            similarities = (image_features @ text_features.T).squeeze(0)
        
        # Convert to dict
        similarity_dict = {
            prompt: float(sim)
            for prompt, sim in zip(text_prompts, similarities.cpu().numpy())
        }
        
        return similarity_dict
    
    def _run_efficientnet(self, image) -> Dict[str, float]:
        """
        Run EfficientNet classification.
        
        Returns:
            Dict with eco classification and confidence
        """
        if not self.efficientnet_model or self.efficientnet_transform is None or torch is None:
            return {}
        
        # Preprocess image
        image_tensor = self.efficientnet_transform(image).unsqueeze(0).to(self.device)
        
        # Run inference
        with torch.no_grad():
            outputs = self.efficientnet_model(image_tensor)
            probabilities = torch.nn.functional.softmax(outputs, dim=1)
        
        # For eco classification, we use a heuristic based on ImageNet classes
        # Classes related to nature, plants, outdoor scenes get higher scores
        eco_classes = self._get_eco_imagenet_classes()
        
        # Calculate eco probability
        eco_prob = 0.0
        max_conf = 0.0
        
        for class_id in eco_classes:
            prob = float(probabilities[0][class_id])
            eco_prob += prob
            max_conf = max(max_conf, prob)
        
        # Normalize
        eco_prob = min(1.0, eco_prob)
        
        return {
            'is_eco_friendly': eco_prob,
            'confidence': max_conf
        }
    
    def _get_eco_imagenet_classes(self) -> List[int]:
        """
        Get ImageNet class IDs related to eco-friendly concepts.
        These are rough mappings to nature/outdoor/sustainability themes.
        
        ImageNet 1000 classes include many nature-related categories:
        - Plants/trees: 949-953, 971-985
        - Outdoor scenes: 978-982 
        - Animals: 0-397 (many birds, mammals)
        - Natural objects: 900-920
        """
        eco_classes = [
            # Plants and vegetation (949-970)
            949, 950, 951, 952, 953, 954, 955, 956, 957, 958,
            959, 960, 961, 962, 963, 964, 965, 966, 967, 968, 969, 970,
            # Natural landscapes (971-985)
            971, 972, 973, 974, 975, 976, 977, 978, 979, 980, 981, 982, 983, 984, 985,
            # Birds (0-100)
            *range(0, 100),
            # Natural food items (900-920)
            *range(900, 921),
        ]
        return eco_classes
    
    def _get_active_models(self) -> List[str]:
        """Get list of active/loaded models."""
        active = []
        if self.yolo_model:
            active.append('YOLOv8')
        if self.clip_model:
            active.append('CLIP')
        if self.efficientnet_model:
            active.append('EfficientNet')
        return active


# Global verifier instance (singleton)
_verifier_instance = None


def get_verifier(yolo_model_path: Optional[str] = None) -> EcoVerifier:
    """Get or create the global verifier instance."""
    global _verifier_instance
    
    if _verifier_instance is None:
        _verifier_instance = EcoVerifier(yolo_model_path=yolo_model_path)
    
    return _verifier_instance
