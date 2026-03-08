"""
Eco Scoring Logic Engine
Combines YOLOv8, CLIP, and EfficientNet results to calculate eco confidence score
"""
from typing import Dict, List, Tuple, Optional
from statistics import mean


class EcoScorer:
    """
    Logic engine that combines ML model results and calculates eco confidence score.
    Score range: 0.0 (not eco-friendly) to 1.0 (very eco-friendly)
    Eco verdict is True only if score > 0.8
    """
    
    # Eco-positive objects with their confidence weights
    ECO_POSITIVE_OBJECTS = {
        'public_transport': 0.9,
        'bicycle': 0.95,
        'electric_scooter': 0.85,
        'tree': 0.7,
        'cloth_bag': 0.8,
        'recycle_bin': 0.85,
        'waste_segregation': 0.9,
        'solar_panel_clean': 1.0,
        'wind_turbine': 1.0,
        'garden_tools': 0.6,
        'biogas_ready': 0.95,
    }
    
    # Eco-negative objects with their penalty weights
    ECO_NEGATIVE_OBJECTS = {
        'plastic_waste': -0.7,
        'solar_panel_dusty': -0.3,
        'smoking': -0.5,
        'water_bottle': -0.2,  # Single-use plastic concern
    }
    
    # Eco-related prompts for CLIP text alignment (full sentences work better)
    ECO_KEYWORDS = [
        'a photo showing sustainable living and eco-friendly practices',
        'renewable energy sources like solar panels and wind turbines',
        'people using bicycles and public transportation',
        'recycling bins and waste segregation for environmental protection',
        'trees and nature conservation efforts',
        'clean energy and carbon neutral technology',
        'organic and biodegradable products for zero waste lifestyle',
        'electric vehicles and green transportation',
        'environmental activism and tree planting initiatives',
        'sustainable agriculture and eco-friendly gardening'
    ]
    
    def __init__(self):
        self.eco_threshold = 0.2  # Minimum score to be marked as eco
    
    def calculate_yolo_score(self, detections: List[Dict]) -> Tuple[float, List[str]]:
        """
        Calculate eco score from YOLOv8 object detections.
        
        Args:
            detections: List of detected objects with format:
                [{'class': 'bicycle', 'confidence': 0.95, 'bbox': [...]}]
        
        Returns:
            Tuple of (score, detected_eco_labels)
        """
        if not detections:
            return 0.0, []
        
        eco_score = 0.0
        eco_labels = []
        total_confidence = 0.0
        
        for detection in detections:
            obj_class = detection.get('class', '')
            confidence = detection.get('confidence', 0.0)
            
            # Check if object is eco-positive
            if obj_class in self.ECO_POSITIVE_OBJECTS:
                weight = self.ECO_POSITIVE_OBJECTS[obj_class]
                eco_score += weight * confidence
                eco_labels.append(obj_class)
                total_confidence += confidence
            
            # Check if object is eco-negative
            elif obj_class in self.ECO_NEGATIVE_OBJECTS:
                weight = self.ECO_NEGATIVE_OBJECTS[obj_class]
                eco_score += weight * confidence
                total_confidence += confidence
        
        # Normalize by number of detections (avoid over-scoring)
        if total_confidence > 0:
            eco_score = eco_score / len(detections)
        
        # Clamp to [0, 1] range
        eco_score = max(0.0, min(1.0, eco_score))
        
        return eco_score, eco_labels
    
    def calculate_clip_score(self, clip_similarities: Dict[str, float]) -> float:
        """
        Calculate eco score from CLIP image-text alignment.
        
        Args:
            clip_similarities: Dict mapping eco keywords to similarity scores
                {'sustainability': 0.85, 'renewable energy': 0.72, ...}
        
        Returns:
            Normalized eco score from CLIP (0.0-1.0)
        """
        if not clip_similarities:
            return 0.0
        
        # Average of top 5 eco keyword similarities
        top_scores = sorted(clip_similarities.values(), reverse=True)[:5]
        
        if not top_scores:
            return 0.0
        
        avg_score = mean(top_scores)
        return float(avg_score)
    
    def calculate_efficientnet_score(self, classification: Dict[str, float]) -> float:
        """
        Calculate eco score from EfficientNet classification.
        
        Args:
            classification: Dict with eco classification results
                {'is_eco_friendly': 0.9, 'confidence': 0.85}
        
        Returns:
            Eco score from classification (0.0-1.0)
        """
        if not classification:
            return 0.0
        
        # Weighted by confidence
        is_eco = classification.get('is_eco_friendly', 0.0)
        confidence = classification.get('confidence', 1.0)
        
        return float(is_eco * confidence)
    
    def calculate_final_score(
        self,
        yolo_detections: Optional[List[Dict]] = None,
        clip_similarities: Optional[Dict[str, float]] = None,
        efficientnet_classification: Optional[Dict[str, float]] = None,
        text_content: Optional[str] = None
    ) -> Dict:
        """
        Combine all ML model results to calculate final eco confidence score.
        
        Args:
            yolo_detections: YOLOv8 object detection results
            clip_similarities: CLIP image-text similarity scores
            efficientnet_classification: EfficientNet classification results
            text_content: Optional post text for additional context
        
        Returns:
            Dict with eco verdict and detailed scoring:
            {
                'is_eco': bool,
                'confidence': float (0.0-1.0),
                'breakdown': {
                    'yolo_score': float,
                    'clip_score': float,
                    'efficientnet_score': float,
                    'text_score': float
                },
                'detected_objects': List[str],
                'reasoning': str
            }
        """
        # Calculate individual scores
        yolo_score, eco_labels = self.calculate_yolo_score(yolo_detections or [])
        clip_score = self.calculate_clip_score(clip_similarities or {})
        efficientnet_score = self.calculate_efficientnet_score(
            efficientnet_classification or {}
        )
        
        # Text-based scoring (simple keyword matching)
        text_score = self._calculate_text_score(text_content)
        
        # Weighted combination of scores
        # YOLOv8 is most important (40%), then CLIP (30%), EfficientNet (20%), Text (10%)
        weights = {
            'yolo': 0.4,
            'clip': 0.3,
            'efficientnet': 0.2,
            'text': 0.1
        }
        
        # Calculate weighted average
        final_score = (
            yolo_score * weights['yolo'] +
            clip_score * weights['clip'] +
            efficientnet_score * weights['efficientnet'] +
            text_score * weights['text']
        )
        
        # Ensure score is in valid range
        final_score = max(0.0, min(1.0, final_score))
        
        # Determine eco verdict (threshold: 0.8)
        is_eco = final_score > self.eco_threshold
        
        # Generate reasoning
        reasoning = self._generate_reasoning(
            is_eco, final_score, yolo_score, clip_score, 
            efficientnet_score, text_score, eco_labels
        )
        
        return {
            'is_eco': is_eco,
            'confidence': round(final_score, 3),
            'breakdown': {
                'yolo_score': round(yolo_score, 3),
                'clip_score': round(clip_score, 3),
                'efficientnet_score': round(efficientnet_score, 3),
                'text_score': round(text_score, 3)
            },
            'detected_objects': eco_labels,
            'reasoning': reasoning
        }
    
    def _calculate_text_score(self, text: Optional[str]) -> float:
        """Calculate eco score based on text content."""
        if not text:
            return 0.0
        
        text_lower = text.lower()
        
        # Eco-positive keywords to search for
        eco_keywords = [
            'sustainable', 'eco', 'green', 'renewable', 'recycl', 'solar',
            'wind', 'clean energy', 'environment', 'nature', 'organic',
            'biodegradable', 'carbon neutral', 'zero waste', 'plant',
            'tree', 'bicycle', 'electric', 'conservation', 'compost'
        ]
        
        matches = sum(1 for keyword in eco_keywords if keyword in text_lower)
        
        # Normalize by number of keywords (cap at 5 matches = 100%)
        score = min(1.0, matches / 5.0)
        return score
    
    def _generate_reasoning(
        self, is_eco: bool, final_score: float,
        yolo_score: float, clip_score: float,
        efficientnet_score: float, text_score: float,
        detected_objects: List[str]
    ) -> str:
        """Generate human-readable reasoning for the verdict."""
        if is_eco:
            reason = f"Eco-friendly content detected (confidence: {final_score:.1%}). "
        else:
            reason = f"Not eco-friendly (confidence: {final_score:.1%}). "
        
        # Add details about detections
        if detected_objects:
            reason += f"Detected eco-positive objects: {', '.join(detected_objects)}. "
        
        # Mention strongest signal
        scores = {
            'object detection': yolo_score,
            'image-text alignment': clip_score,
            'visual classification': efficientnet_score,
            'text content': text_score
        }
        
        max_source = max(scores.keys(), key=lambda k: scores[k])
        max_score = scores[max_source]
        
        if max_score > 0.5:
            reason += f"Strongest signal from {max_source} ({max_score:.1%})."
        
        return reason
