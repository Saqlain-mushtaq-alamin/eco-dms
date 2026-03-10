"""
Voting Service — Off-chain vote management.

All votes are EIP-712 signed messages stored in Redis.
After the window closes the backend calls the CommunityVoting smart
contract once (settlePost) to distribute rewards trustlessly.

Design principles
─────────────────
• Votes are completely anonymous publicly — no one can see who voted
  what (including the post owner) until the window closes.
• One vote per wallet per post, enforced by a Redis key.
• Poster cannot vote on their own post.
• Rate-limited: max DAILY_VOTE_LIMIT votes per wallet per calendar day.
• ML confidence drives the path, not the final verdict.
"""

import time
import logging
from typing import Optional, Dict, List, Tuple
from datetime import datetime, timezone
from enum import Enum

from .redis_service import redis_service

logger = logging.getLogger(__name__)

# ── Constants ────────────────────────────────────────────────────────────────

VOTE_WINDOW_SECONDS     = 24 * 3600   # 24 h standard window
FAST_WINDOW_SECONDS     =  6 * 3600   #  6 h for high-confidence AUTO path
DAILY_VOTE_LIMIT        = 50          # max votes a wallet can cast per day
MIN_VOTE_STAKE          = 10.0        # minimum ECO balance required to vote


# ── Enums ────────────────────────────────────────────────────────────────────

class VotePath(str, Enum):
    AUTO     = "auto"      # ML ≥ 85 % — fast 6 h path, quorum = 3
    STANDARD = "standard"  # ML 50-85 % — 24 h, quorum = 5
    EXTENDED = "extended"  # ML < 50 % — 24 h, higher quorum = 10


class VoteChoice(str, Enum):
    ECO     = "eco"
    NOT_ECO = "not_eco"


# ── Redis key templates ───────────────────────────────────────────────────────

_STATUS  = "vote:status:{cid}"        # JSON – voting window metadata
_RECORD  = "vote:record:{cid}:{w}"    # JSON – individual vote (private)
_TALLY   = "vote:tally:{cid}"         # JSON – running counts (not public)
_RATE    = "voter:rate:{w}:{date}"    # counter  – daily rate limit
_INDEX   = "vote:index:{cid}"         # Redis SET – set of voter wallets


# ── Service ───────────────────────────────────────────────────────────────────

class VotingService:

    # ── Path & quorum helpers ─────────────────────────────────────────────────

    @staticmethod
    def get_vote_path(ml_confidence: float) -> VotePath:
        if ml_confidence >= 0.85:
            return VotePath.AUTO
        if ml_confidence >= 0.50:
            return VotePath.STANDARD
        return VotePath.EXTENDED

    @staticmethod
    def get_quorum(path: VotePath) -> int:
        return {VotePath.AUTO: 3, VotePath.STANDARD: 5, VotePath.EXTENDED: 10}[path]

    # ── Window management ─────────────────────────────────────────────────────

    def open_window(
        self,
        post_cid: str,
        ml_confidence: float,
        poster_wallet: str,
    ) -> Dict:
        """Create a new voting window and persist it to Redis."""
        path           = self.get_vote_path(ml_confidence)
        window_seconds = FAST_WINDOW_SECONDS if path == VotePath.AUTO else VOTE_WINDOW_SECONDS
        deadline       = int(time.time()) + window_seconds

        status = {
            "post_cid":      post_cid,
            "poster_wallet": poster_wallet.lower(),
            "ml_confidence": ml_confidence,
            "path":          path.value,
            "deadline":      deadline,
            "window_open":   True,
            "settled":       False,
            "quorum":        self.get_quorum(path),
            "opened_at":     int(time.time()),
        }
        redis_service.set_json(
            _STATUS.format(cid=post_cid),
            status,
            ex=window_seconds * 2,   # keep record for 2× the window
        )
        logger.info("Voting window opened: %s  path=%s  deadline=%s", post_cid, path.value, deadline)
        return status

    def get_status(self, post_cid: str) -> Optional[Dict]:
        return redis_service.get_json(_STATUS.format(cid=post_cid))

    # ── Anti-abuse guards ─────────────────────────────────────────────────────

    def _check_rate_limit(self, wallet: str) -> bool:
        """Return True when the wallet is still within the daily vote limit."""
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        key   = _RATE.format(w=wallet, date=today)
        count = redis_service.incr(key, ex=86400)
        return count <= DAILY_VOTE_LIMIT

    def has_voted(self, post_cid: str, wallet: str) -> bool:
        return redis_service.get_json(
            _RECORD.format(cid=post_cid, w=wallet.lower())
        ) is not None

    # ── Core vote cast ────────────────────────────────────────────────────────

    def cast_vote(
        self,
        post_cid: str,
        wallet: str,
        choice: VoteChoice,
        signature: str,               # EIP-712 signature for audit trail
        eco_token_balance: float = 0.0,
    ) -> Tuple[bool, str]:
        """
        Record an off-chain vote.

        Returns (success, message).
        Votes are private — the choice is stored but never exposed
        per-voter through any public API.
        """
        status = self.get_status(post_cid)
        if not status:
            return False, "No active voting window for this post"
        if not status.get("window_open"):
            return False, "Voting window is already closed"
        if int(time.time()) > status["deadline"]:
            return False, "Voting window has expired"

        wallet = wallet.lower()

        # Post owner cannot influence their own verdict
        if wallet == status.get("poster_wallet", "").lower():
            return False, "Post owners cannot vote on their own content"

        if self.has_voted(post_cid, wallet):
            return False, "You have already voted on this post"

        if not self._check_rate_limit(wallet):
            return False, f"Daily voting limit ({DAILY_VOTE_LIMIT} votes) reached"

        if eco_token_balance < MIN_VOTE_STAKE:
            return False, f"You need at least {MIN_VOTE_STAKE} ECO to participate in voting"

        # ── Persist vote (private) ─────────────────────────────────────────
        ttl = VOTE_WINDOW_SECONDS * 3
        redis_service.set_json(
            _RECORD.format(cid=post_cid, w=wallet),
            {
                "wallet":    wallet,
                "choice":    choice.value,
                "timestamp": int(time.time()),
                "signature": signature,          # stored for on-chain audit if challenged
            },
            ex=ttl,
        )

        # ── Update aggregate tally ─────────────────────────────────────────
        tally = redis_service.get_json(_TALLY.format(cid=post_cid)) or {
            "eco": 0, "not_eco": 0, "total": 0
        }
        tally[choice.value] = tally.get(choice.value, 0) + 1
        tally["total"]       = tally.get("total", 0) + 1
        redis_service.set_json(_TALLY.format(cid=post_cid), tally, ex=ttl)

        # ── Add wallet to voter index (for settlement) ─────────────────────
        try:
            redis_service.sadd(_INDEX.format(cid=post_cid), wallet)
        except Exception:
            pass

        logger.info("Vote recorded  post=%s  wallet=%s  choice=%s", post_cid, wallet[:8], choice.value)
        return True, "Vote cast successfully"

    # ── Result computation ────────────────────────────────────────────────────

    def _get_all_votes(self, post_cid: str) -> List[Dict]:
        try:
            raw = redis_service.client.smembers(_INDEX.format(cid=post_cid))
            voters: set = raw if isinstance(raw, set) else set()
            records = []
            for w in voters:
                r = redis_service.get_json(_RECORD.format(cid=post_cid, w=w))
                if r:
                    records.append(r)
            return records
        except Exception:
            return []

    def compute_settlement(self, post_cid: str) -> Optional[Dict]:
        """
        Compute the final verdict and voter split after the window closes.

        Combined score:
            score = ML_confidence × 0.70 + community_eco_ratio × 0.30
            final_is_eco = score ≥ 0.50
        """
        status = self.get_status(post_cid)
        if not status:
            return None

        tally  = redis_service.get_json(_TALLY.format(cid=post_cid)) or {}
        total  = tally.get("total", 0)
        ml_conf = float(status["ml_confidence"])

        if total == 0:
            # No community votes — ML alone decides
            final_is_eco  = ml_conf >= 0.50
            community_eco = 0.0
        else:
            eco_votes     = tally.get("eco", 0)
            community_eco = eco_votes / total          # 0-1
            combined      = ml_conf * 0.70 + community_eco * 0.30
            final_is_eco  = combined >= 0.50

        path        = VotePath(status["path"])
        quorum_met  = total >= self.get_quorum(path)

        all_votes      = self._get_all_votes(post_cid)
        correct_voters = [v["wallet"] for v in all_votes if (v["choice"] == "eco") == final_is_eco]
        wrong_voters   = [v["wallet"] for v in all_votes if (v["choice"] == "eco") != final_is_eco]

        return {
            "post_cid":             post_cid,
            "poster_wallet":        status["poster_wallet"],
            "is_eco":               final_is_eco,
            "ml_confidence_pct":    int(ml_conf * 100),
            "community_weight_pct": int(community_eco * 100),
            "community_votes":      total,
            "quorum_met":           quorum_met,
            "path":                 path.value,
            "method":               "hybrid" if total > 0 else "ml_only",
            "correct_voters":       correct_voters,
            "wrong_voters":         wrong_voters,
        }

    def get_public_status(self, post_cid: str, viewer_wallet: Optional[str] = None) -> Optional[Dict]:
        """
        Public-safe window status.

        Votes are never exposed per-voter while the window is open.
        After closing, only aggregated counts are shown.
        """
        status = self.get_status(post_cid)
        if not status:
            return None

        now          = int(time.time())
        deadline     = status["deadline"]
        window_open  = now < deadline and status.get("window_open", True)
        seconds_left = max(0, deadline - now)

        tally = redis_service.get_json(_TALLY.format(cid=post_cid)) or {"eco": 0, "not_eco": 0, "total": 0}

        viewer_has_voted = (
            self.has_voted(post_cid, viewer_wallet)
            if viewer_wallet else None
        )

        result: Dict = {
            "post_cid":      post_cid,
            "path":          status["path"],
            "quorum":        status["quorum"],
            "deadline":      deadline,
            "seconds_left":  seconds_left,
            "window_open":   window_open,
            "total_votes":   tally["total"],
            "quorum_met":    tally["total"] >= status["quorum"],
            "has_voted":     viewer_has_voted,
            "ml_confidence": status["ml_confidence"],
        }

        # Reveal breakdown only after window closes
        if not window_open:
            settlement = self.compute_settlement(post_cid)
            result["eco_votes"]     = tally.get("eco", 0)
            result["not_eco_votes"] = tally.get("not_eco", 0)
            result["final_verdict"] = settlement.get("is_eco") if settlement else None
            result["settled"]       = status.get("settled", False)

        return result


voting_service = VotingService()
