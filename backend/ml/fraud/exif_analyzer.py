"""
EXIF Metadata Analyzer — detects staged/recycled eco-action photos.

Checks GPS, timestamp freshness, camera model, and editing software.
Score < 0 = suspicious. Score <= -50 = auto-reject.
"""
from __future__ import annotations
import io, logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)
MAX_IMAGE_AGE_DAYS = 90
EDITING_SOFTWARE = [
    "adobe photoshop", "gimp", "lightroom", "pixlr", "canva",
    "snapseed", "vsco", "facetune", "meitu",
]


@dataclass
class ExifFinding:
    field: str
    status: str   # "ok" | "warning" | "suspicious" | "missing"
    score_delta: int
    detail: str


@dataclass
class ExifResult:
    is_suspicious: bool
    total_score: int
    auto_reject: bool
    findings: list[ExifFinding] = field(default_factory=list)
    has_gps: bool = False
    has_timestamp: bool = False
    image_age_days: Optional[int] = None
    camera_model: Optional[str] = None
    editing_software: Optional[str] = None
    reason: str = ""


class ExifAnalyzer:
    def __init__(self):
        self._PIL = None
        self._TAGS = {}
        self._available = False
        try:
            from PIL import Image
            from PIL.ExifTags import TAGS
            self._PIL = Image
            self._TAGS = TAGS
            self._available = True
        except ImportError:
            logger.warning("ExifAnalyzer: Pillow not installed — skipping EXIF checks.")

    def _get_exif(self, image_bytes: bytes) -> dict:
        if not self._available:
            return {}
        try:
            img = self._PIL.Image.open(io.BytesIO(image_bytes))
            raw = img._getexif()  # type: ignore[attr-defined]
            return {self._TAGS.get(k, k): v for k, v in (raw or {}).items()}
        except Exception:
            return {}

    def analyze(self, image_bytes: bytes) -> ExifResult:
        if not self._available:
            return ExifResult(False, 0, False, reason="Pillow not installed")

        exif = self._get_exif(image_bytes)
        findings, score = [], 0

        # GPS
        has_gps = bool(exif.get("GPSInfo"))
        gps_f = ExifFinding("GPS", "ok" if has_gps else "missing",
                            10 if has_gps else -5,
                            "GPS present" if has_gps else "No GPS data")
        findings.append(gps_f); score += gps_f.score_delta

        # Timestamp
        date_str = exif.get("DateTimeOriginal") or exif.get("DateTime")
        age_days, has_ts = None, False
        if date_str:
            try:
                dt = datetime.strptime(str(date_str), "%Y:%m:%d %H:%M:%S").replace(tzinfo=timezone.utc)
                age_days = (datetime.now(timezone.utc) - dt).days
                if age_days < 0:
                    ts_f = ExifFinding("Timestamp", "suspicious", -30, "Timestamp in future")
                elif age_days > MAX_IMAGE_AGE_DAYS:
                    ts_f = ExifFinding("Timestamp", "warning", -20, f"Photo is {age_days}d old")
                else:
                    ts_f = ExifFinding("Timestamp", "ok", 10, f"{age_days}d ago")
                    has_ts = True
            except ValueError:
                ts_f = ExifFinding("Timestamp", "suspicious", -15, "Invalid timestamp format")
        else:
            ts_f = ExifFinding("Timestamp", "missing", -10, "No timestamp")
        findings.append(ts_f); score += ts_f.score_delta

        # Camera model
        cam = f"{exif.get('Make','').strip()} {exif.get('Model','').strip()}".strip() or None
        cam_f = ExifFinding("Camera", "ok" if cam else "warning",
                            5 if cam else -10,
                            f"Camera: {cam}" if cam else "No camera model")
        findings.append(cam_f); score += cam_f.score_delta

        # Editing software
        software = str(exif.get("Software") or "").strip()
        editing = None
        if software:
            sw_lower = software.lower()
            editing = next((s for s in EDITING_SOFTWARE if s in sw_lower), None)
        if editing:
            sw_f = ExifFinding("Software", "suspicious", -25, f"Edited with: {software}")
        else:
            sw_f = ExifFinding("Software", "ok", 0 if not software else 5,
                               f"Software: {software}" if software else "No software field")
        findings.append(sw_f); score += sw_f.score_delta

        bad = [f.detail for f in findings if f.status in ("suspicious", "warning")]
        return ExifResult(
            is_suspicious=score < 0,
            total_score=score,
            auto_reject=score <= -50,
            findings=findings,
            has_gps=has_gps,
            has_timestamp=has_ts,
            image_age_days=age_days,
            camera_model=cam,
            editing_software=editing,
            reason="; ".join(bad) if bad else "All checks passed",
        )


exif_analyzer = ExifAnalyzer()
