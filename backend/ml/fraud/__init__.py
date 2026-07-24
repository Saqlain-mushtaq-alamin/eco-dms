"""
Fraud Detection Pipeline for EcoDMS ML verification.
Exports all detection modules and the main pipeline orchestrator.

Plan 06 additions:
  - co2_impact_scorer: CO₂-equivalent impact estimation (Phase 2)
  - multimodal_verifier: Cross-modal consistency checker (Phase 4)
"""
from .pipeline import FraudPipeline, FraudResult, fraud_pipeline
from .duplicate_detector import DuplicateDetector, duplicate_detector
from .exif_analyzer import ExifAnalyzer, exif_analyzer
from .temporal_analyzer import TemporalAnalyzer, temporal_analyzer
from .ai_detector import AIDetector, AIDetectionResult, ai_detector
from .impact_scorer import ImpactScorer, ImpactScore, impact_scorer
from .co2_impact_scorer import CO2ImpactScorer, CO2ImpactResult, co2_impact_scorer
from .multimodal_verifier import MultiModalVerifier, MultiModalResult, multimodal_verifier

__all__ = [
    # Fraud detection
    "fraud_pipeline", "FraudPipeline", "FraudResult",
    "duplicate_detector", "DuplicateDetector",
    "exif_analyzer", "ExifAnalyzer",
    "temporal_analyzer", "TemporalAnalyzer",
    "ai_detector", "AIDetector", "AIDetectionResult",
    # Credibility scoring
    "impact_scorer", "ImpactScorer", "ImpactScore",
    # Plan 06 Phase 2: CO₂ impact estimation
    "co2_impact_scorer", "CO2ImpactScorer", "CO2ImpactResult",
    # Plan 06 Phase 4: Multi-modal verification
    "multimodal_verifier", "MultiModalVerifier", "MultiModalResult",
]

