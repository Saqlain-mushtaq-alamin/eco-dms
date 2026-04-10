# ML Verification and Community Voting Deep Dive

## 1. Purpose

This document explains how eco verification and community voting work end-to-end in this project, including:

- ML inference pipeline and signed verdict generation
- Voting window creation, vote privacy, anti-abuse rules
- Final verdict computation (ML + community hybrid)
- On-chain settlement and reward minting
- Frontend visibility rules and user experience states
- Operational notes and troubleshooting


## 2. High-Level Architecture

The system is split into 4 layers:

1. ML layer (backend/ml)
- Downloads content from IPFS
- Runs model inference
- Produces confidence score and eco verdict
- Signs verdict cryptographically

2. Backend API layer (backend/app)
- Exposes verification and voting endpoints
- Stores voting state in Redis
- Enforces anti-abuse constraints
- Computes settlement payload

3. Frontend layer (apps/web + packages/ui)
- Shows ML verification state on feed
- Renders VotePanel only for eligible posts
- Casts votes and polls status

4. Smart contract layer (contracts/contracts)
- Accepts final settlement
- Mints rewards via RewardToken
- Supports Merkle proof claims for correct voters


## 3. Core Components and Responsibilities

### 3.1 ML worker

File: backend/ml/worker.py

Main task: verify_eco_content

Responsibilities:
- Fetch media from IPFS (primary gateway + fallback gateways)
- Run verifier inference
- Build metadata payload (post_id, author_wallet, verified_at)
- Sign verdict with VerdictSigner
- Store signed verdict on IPFS (best effort)
- Persist verdict mapping to backend/ml_verdicts/verdicts.json
- Open a voting window automatically after successful ML completion

Important behavior:
- Voting window opens from worker via _open_voting_window_for_post(...)
- If poster_wallet is missing, voting window is skipped
- Voting window open failure is non-fatal (verdict storage still succeeds)


### 3.2 Verification API routes

File: backend/app/verify_routes.py

Key endpoints:
- POST /api/verify/verify
  - async_mode=true submits Celery job
  - returns task_id for polling

- GET /api/verify/status/{task_id}
  - returns task state and result
  - contains an additional auto-open voting guard path on SUCCESS/completed

- GET /api/verify/verdict/{verdict_cid}
  - fetches signed verdict from IPFS and verifies signature

- GET /api/verify/claim-payload/{post_cid}
  - builds/refreshes chain payload for legacy Verification.sol flow

Note:
- Voting window open logic currently exists in both worker and status route for resilience.
- Worker path is the primary trigger because it runs exactly when ML finishes.


### 3.3 Voting service (off-chain source of truth)

File: backend/app/services/voting_service.py

Key constants:
- VOTE_WINDOW_SECONDS = 24h
- FAST_WINDOW_SECONDS = 6h
- DAILY_VOTE_LIMIT = 50 votes/day/wallet
- MIN_VOTE_STAKE = 10 ECO

Vote path selection from ML confidence (0..1):
- AUTO: confidence >= 0.85
  - Window: 6h
  - Quorum: 3
- STANDARD: 0.50 <= confidence < 0.85
  - Window: 24h
  - Quorum: 5
- EXTENDED: confidence < 0.50
  - Window: 24h
  - Quorum: 10

Redis key model:
- vote:status:{cid}
  - window metadata (deadline, path, quorum, poster, ml_confidence)
- vote:record:{cid}:{wallet}
  - private per-wallet vote record
- vote:tally:{cid}
  - aggregate counts only (eco, not_eco, total)
- voter:rate:{wallet}:{yyyy-mm-dd}
  - daily counter for rate limiting
- vote:index:{cid}
  - set of wallets used to reconstruct vote records for settlement

Privacy model:
- During open window, only aggregate counts are public
- Individual vote choice per wallet is never exposed through public API
- Optional has_voted boolean is exposed only for current authenticated viewer


### 3.4 Voting API routes

File: backend/app/voting_routes.py

Endpoints:
- POST /api/votes/{post_cid}/open-window
  - internal/manual open route
  - idempotent if already open

- POST /api/votes/{post_cid}
  - cast a vote
  - requires auth (wallet from token)
  - enforces all voting constraints

- GET /api/votes/{post_cid}/status
  - public status endpoint
  - returns:
    - exists=false, window_open=false when no window exists
    - full status object when window exists

- GET /api/votes/{post_cid}/my-vote
  - authenticated helper: returns has_voted only

- POST /api/votes/{post_cid}/settle
  - computes settlement payload off-chain
  - payload is submitted to CommunityVoting.sol separately

Validation rules for cast vote:
- Must have active window
- Must be before deadline
- Post owner cannot vote on own post
- One vote per wallet per post
- Daily rate limit must not be exceeded
- eco_token_balance must be >= 10


## 4. Final Verdict and Settlement Math

### 4.1 Off-chain final verdict rule

In compute_settlement(...):

If total community votes == 0:
- final_is_eco = (ml_confidence >= 0.50)
- method = ml_only

Else:
- community_eco_ratio = eco_votes / total_votes
- combined_score = (ml_confidence * 0.70) + (community_eco_ratio * 0.30)
- final_is_eco = (combined_score >= 0.50)
- method = hybrid

This means ML remains the primary signal (70%), with community providing corrective influence (30%).


### 4.2 On-chain reward minting rule

Contract: contracts/contracts/CommunityVoting.sol

At settlePost(...):
- BASE_REWARD = 10 ECO
- VOTER_REWARD_PERCENT = 5%

If final is eco:
- weightedScorePct = (mlConfidencePct * 70 + communityWeightPct * 30) / 100
- posterReward = BASE_REWARD * weightedScorePct / 100
- totalVoterPool = posterReward * 5 / 100
- mint posterReward to poster

If final is not eco:
- posterReward = 0
- voter pool = 0

Correct voters can later claim individual shares from voter pool using Merkle proofs.


## 5. Frontend Behavior and UX States

### 5.1 Where VotePanel appears

File: apps/web/src/pages/Feed.tsx

VotePanel is rendered only when:
- post has cid, and
- post.verification_status == "verified"

This prevents premature voting UI before ML is done.


### 5.2 VotePanel polling and rendering states

File: packages/ui/src/components/VotePanel.tsx

Status fetch:
- Poll interval: 30 seconds
- If status response is null (no window), polling stops to avoid API spam

Render states:
1. status == null
- Shows placeholder message: "Community voting opens after analysis completes"

2. window open
- Shows vote buttons:
  - Eco-Friendly
  - Not Eco
- Shows countdown and quorum progress
- Shows only total votes, never vote breakdown

3. window closed
- Shows aggregated results:
  - eco_votes
  - not_eco_votes
  - final verdict badge

User-side constraints reflected in UI:
- Not signed in -> vote disabled, hint shown
- ECO balance < 10 -> vote disabled, hint shown
- Already voted -> voted badge shown


### 5.3 API client behavior

File: apps/web/src/api.ts

- getVoteStatus returns null when:
  - endpoint returns 404, or
  - payload includes exists=false
- castVote normalizes FastAPI error arrays into readable string messages


## 6. End-to-End Sequence

1. User creates post with media
2. Backend calls /api/verify/verify async
3. Celery runs verify_eco_content
4. ML verdict + confidence generated
5. Verdict signed and stored
6. Voting window opened using post_id + confidence + author_wallet
7. Feed marks post verified
8. VotePanel appears and users vote off-chain
9. At deadline, backend computes settlement
10. Backend submits settlePost on-chain
11. Poster reward minted if final verdict is eco
12. Correct voters claim rewards via Merkle proof


## 7. Data Contracts

### 7.1 Vote status shape

Returned by GET /api/votes/{post_cid}/status when window exists:
- post_cid
- path
- quorum
- deadline
- seconds_left
- window_open
- total_votes
- quorum_met
- has_voted (viewer-specific)
- ml_confidence
- after close only:
  - eco_votes
  - not_eco_votes
  - final_verdict
  - settled

When no window exists:
- window_open=false
- exists=false
- post_cid


### 7.2 Settlement payload (off-chain)

Generated by POST /api/votes/{post_cid}/settle:
- post_cid
- poster_wallet
- is_eco
- ml_confidence_pct
- community_weight_pct
- community_votes
- quorum_met
- path
- method
- correct_voters
- wrong_voters


## 8. Security and Integrity Notes

1. Signature handling
- Vote signature is stored for audit trail
- Current frontend may use a placeholder signature if wallet signing is not wired
- Production should enforce real EIP-712 signatures for vote authenticity

2. Replay / duplicate vote protection
- One wallet, one vote per post via vote:record key

3. Sybil and spam resistance
- Minimum 10 ECO stake gate
- Daily vote cap per wallet
- Self-voting blocked for poster

4. Privacy
- No public endpoint returns per-wallet vote choice while window is open

5. Settlement trust model
- Off-chain tally + compute, on-chain settlement finalization
- Merkle claims allow cheap and verifiable distribution to correct voters


## 9. Operational Runbook

### 9.1 Services that must be up

- FastAPI backend
- Redis
- Celery worker (critical for ML and auto-open voting)
- IPFS API/gateway
- Chain node (for on-chain settlement and claims)


### 9.2 Common failure modes

1. Voting panel never appears
- Cause: ML still pending or verification_status not updated to verified
- Check: feed payload verification_status and Celery logs

2. status returns exists=false forever
- Cause: worker did not open window (missing author_wallet, worker not restarted, or exception)
- Check: Celery worker logs for [voting] messages

3. Vote rejected
- Cause: under 10 ECO, already voted, owner voting own post, expired window, daily cap
- Check: API response message from castVote

4. White screen on vote action (historical)
- Cause: non-string error rendering in UI
- Status: handled with string coercion and error boundary


## 10. Legacy vs Current Reward Path

Current recommendation:
- Use CommunityVoting.sol path for new posts (hybrid ML + community)

Legacy compatibility:
- Verification.sol still supports ML-only signed claim payload flow
- Useful for older posts and backward compatibility

RewardToken.sol role:
- Shared ERC-20 minter target for both flows
- CommunityVoting and Verification mint ECO through RewardToken


## 11. Suggested Future Hardening

1. Replace placeholder vote signature with mandatory wallet EIP-712 signing.
2. Move verdict mappings from JSON file to durable DB.
3. Add automated settlement scheduler (cron/queue) after deadline.
4. Enforce on-chain balance check for ECO gating (instead of trusting frontend-provided balance).
5. Add observability metrics for window-open success/failure, vote rejects, and settlement latency.


## 12. Quick Reference

Important files:
- backend/ml/worker.py
- backend/app/verify_routes.py
- backend/app/services/voting_service.py
- backend/app/voting_routes.py
- apps/web/src/pages/Feed.tsx
- apps/web/src/api.ts
- packages/ui/src/components/VotePanel.tsx
- contracts/contracts/CommunityVoting.sol
- contracts/contracts/RewardToken.sol
- contracts/contracts/Verification.sol
