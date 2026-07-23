"""
Feed Service
============
Computes ranked feed scores for eco posts, integrating:
  - ML confidence score (base credibility)
  - Engagement metrics (likes, comments, views, shares)
  - EcoBoost multiplier (token-backed reach amplification)
  - Author eco-level reputation bonus
  - Recency decay (fresher posts rank higher)
  - Fraud/impact score from the fraud pipeline

Score formula:
  base_score     = ml_confidence × 100
  engagement     = log2(1 + likes) × 3 + log2(1 + comments) × 5 + log2(1 + shares) × 4
  recency_decay  = exp(-hours_old / 48)   ← half-life of 48h
  boost_factor   = boost_service.get_feed_multiplier(active_level)
  rep_bonus      = 1 + (eco_level - 1) × 0.02   ← up to 38% for level 20
  impact_bonus   = impact_score / 100 × 0.25    ← up to 25% for exceptional posts

  feed_score = (base_score + engagement) × recency_decay × boost_factor × rep_bonus × (1 + impact_bonus)

Intended to be called from the posts API to sort the global feed.
"""
from __future__ import annotations

import logging
import math
import time
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class FeedScore:
    post_cid: str
    feed_score: float
    base_score: float
    engagement_score: float
    recency_factor: float
    boost_multiplier: float
    reputation_bonus: float
    impact_bonus: float
    active_boost_level: int
    hours_old: float


@dataclass
class FeedPost:
    post_cid: str
    author_wallet: str
    created_at: float           # Unix timestamp
    ml_confidence: float        # 0.0–1.0
    eco_level: int              # Author level 1-20
    impact_score: float         # 0-100 from fraud pipeline
    likes: int = 0
    comments: int = 0
    views: int = 0
    shares: int = 0
    active_boost_level: int = 0
    extra: dict = field(default_factory=dict)  # any extra fields passed through


class FeedService:
    """
    Ranks eco posts for the home feed using a multi-signal scoring formula.
    """

    # Weights for engagement components
    LIKE_WEIGHT    = 3.0
    COMMENT_WEIGHT = 5.0
    SHARE_WEIGHT   = 4.0

    # Recency: half-life = 48 hours
    RECENCY_HALFLIFE_HOURS = 48.0

    # Reputation bonus per level (2% per level above 1)
    REP_BONUS_PER_LEVEL = 0.02

    def score_post(self, post: FeedPost) -> FeedScore:
        """
        Compute a single post's feed score.
        """
        now = time.time()
        hours_old = (now - post.created_at) / 3600.0

        # Base: ML confidence × 100 (0–100 pts)
        base_score = post.ml_confidence * 100.0

        # Engagement: log-scaled to prevent viral runaway
        engagement = (
            self._log2(1 + post.likes)    * self.LIKE_WEIGHT +
            self._log2(1 + post.comments) * self.COMMENT_WEIGHT +
            self._log2(1 + post.shares)   * self.SHARE_WEIGHT
        )

        # Recency decay: exponential with 48h half-life
        recency = math.exp(-hours_old / self.RECENCY_HALFLIFE_HOURS)

        # Boost multiplier (1x – 50x)
        boost_mult = self._boost_multiplier(post.active_boost_level)

        # Reputation bonus (1.0 – 1.38 for level 1–20)
        rep_bonus = 1.0 + max(0, post.eco_level - 1) * self.REP_BONUS_PER_LEVEL

        # Impact bonus (0 – +25%)
        impact_bonus = (post.impact_score / 100.0) * 0.25

        feed_score = (
            (base_score + engagement)
            * recency
            * boost_mult
            * rep_bonus
            * (1.0 + impact_bonus)
        )

        return FeedScore(
            post_cid=post.post_cid,
            feed_score=round(feed_score, 4),
            base_score=round(base_score, 2),
            engagement_score=round(engagement, 2),
            recency_factor=round(recency, 4),
            boost_multiplier=boost_mult,
            reputation_bonus=round(rep_bonus, 4),
            impact_bonus=round(impact_bonus, 4),
            active_boost_level=post.active_boost_level,
            hours_old=round(hours_old, 2),
        )

    def rank_posts(self, posts: list[FeedPost]) -> list[tuple[FeedPost, FeedScore]]:
        """
        Score and rank a list of posts. Returns (post, score) pairs, highest score first.
        """
        scored = [(post, self.score_post(post)) for post in posts]
        scored.sort(key=lambda x: x[1].feed_score, reverse=True)
        return scored

    async def get_ranked_feed(
        self,
        posts_raw: list[dict],
        limit: int = 50,
        offset: int = 0,
    ) -> list[dict]:
        """
        Full pipeline: raw post dicts → enriched + ranked feed dicts.

        Each post dict is expected to have:
          post_cid, author_wallet, created_at, ml_confidence (optional),
          eco_level (optional), likes, comments, views, shares
        """
        feed_posts = []
        for p in posts_raw:
            # Pull boost level from Redis cache (non-blocking, defaults to 0)
            active_boost = 0
            cid = p.get("post_cid") or p.get("id") or ""
            if cid:
                try:
                    from .redis_service import redis_service
                    boost_raw = redis_service.get_json(f"boost:status:{cid}")
                    if boost_raw:
                        active_boost = int(boost_raw.get("active_level", 0))
                except Exception:
                    pass

            # Pull impact score from fraud pipeline result if stored
            impact_score = 0.0
            if cid:
                try:
                    from .redis_service import redis_service
                    import json
                    verdict_raw = redis_service.client.hget(f"verdict:{cid}", "payload")
                    if verdict_raw:
                        verdict = json.loads(verdict_raw)
                        fraud_detail = verdict.get("fraud_detail") or {}
                        impact_score = float(
                            fraud_detail.get("impact", {}).get("value", 0.0)
                        )
                except Exception:
                    pass

            feed_posts.append(FeedPost(
                post_cid=cid,
                author_wallet=p.get("author_wallet") or p.get("wallet") or "",
                created_at=float(p.get("created_at") or p.get("timestamp") or time.time()),
                ml_confidence=float(p.get("ml_confidence") or p.get("confidence") or 0.85),
                eco_level=int(p.get("eco_level") or 1),
                impact_score=impact_score,
                likes=int(p.get("likes") or 0),
                comments=int(p.get("comments") or 0),
                views=int(p.get("views") or 0),
                shares=int(p.get("shares") or 0),
                active_boost_level=active_boost,
                extra=p,
            ))

        ranked = self.rank_posts(feed_posts)

        result = []
        for post, score in ranked[offset: offset + limit]:
            enriched = dict(post.extra)
            enriched["feed_score"]        = score.feed_score
            enriched["active_boost_level"] = score.active_boost_level
            enriched["boost_multiplier"]   = score.boost_multiplier
            enriched["is_boosted"]         = score.active_boost_level > 0
            result.append(enriched)

        return result

    # ── Helpers ─────────────────────────────────────────────────

    @staticmethod
    def _log2(x: float) -> float:
        return math.log2(x) if x > 1 else 0.0

    @staticmethod
    def _boost_multiplier(level: int) -> float:
        mapping = {0: 1.0, 1: 3.0, 2: 10.0, 3: 50.0}
        return mapping.get(level, 1.0)


feed_service = FeedService()
